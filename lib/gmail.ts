import { db } from "./db";
import { decrypt } from "./crypto";

export async function getGmailAccessToken(userId: string): Promise<string> {
  const { data } = await db
    .from("user_integrations")
    .select("access_token, token_expiry, encrypted_refresh, refresh_iv, refresh_auth_tag, connected")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .single();

  if (!data?.connected) throw new Error("Google not connected. Go to Settings → Connect Google to enable analytics.");

  // Still valid (5 min buffer)
  if (new Date(data.token_expiry).getTime() > Date.now() + 5 * 60 * 1000) {
    return data.access_token;
  }

  // Refresh
  const refreshToken = decrypt({
    encryptedKey: data.encrypted_refresh,
    iv: data.refresh_iv,
    authTag: data.refresh_auth_tag,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Google token expired. Go to Settings → Disconnect Google → Reconnect.");

  const { access_token, expires_in } = await res.json();
  const tokenExpiry = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

  await db
    .from("user_integrations")
    .update({ access_token, token_expiry: tokenExpiry })
    .eq("user_id", userId)
    .eq("provider", "gmail");

  return access_token;
}

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};

function findHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractBody(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64").toString("utf-8");
  }
  if (part.parts) {
    for (const p of part.parts) {
      const t = extractBody(p);
      if (t) return t;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return Buffer.from(part.body.data, "base64")
      .toString("utf-8")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
};

export async function searchGmailMessages(
  userId: string,
  query: string,
  maxResults = 10,
): Promise<GmailMessageSummary[]> {
  const token = await getGmailAccessToken(userId);
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!listRes.ok) throw new Error(`Gmail API ${listRes.status}`);
  const listData = (await listRes.json()) as { messages?: { id: string; threadId: string }[] };
  const ids = listData.messages ?? [];

  const details = await Promise.all(
    ids.map(async (m) => {
      const metaUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
      const mRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!mRes.ok) return null;
      const md = (await mRes.json()) as { snippet?: string; payload?: { headers?: GmailHeader[] } };
      const headers = md.payload?.headers ?? [];
      return {
        id: m.id,
        threadId: m.threadId,
        from: findHeader(headers, "From"),
        to: findHeader(headers, "To"),
        subject: findHeader(headers, "Subject"),
        date: findHeader(headers, "Date"),
        snippet: md.snippet ?? "",
      } satisfies GmailMessageSummary;
    }),
  );
  return details.filter((d): d is GmailMessageSummary => d !== null);
}

export type GmailMessageFull = GmailMessageSummary & { cc: string; body: string };

export async function getGmailMessage(userId: string, messageId: string): Promise<GmailMessageFull> {
  const token = await getGmailAccessToken(userId);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  const data = (await res.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    payload?: GmailPart & { headers?: GmailHeader[] };
  };
  const headers = data.payload?.headers ?? [];
  return {
    id: data.id,
    threadId: data.threadId,
    from: findHeader(headers, "From"),
    to: findHeader(headers, "To"),
    cc: findHeader(headers, "Cc"),
    subject: findHeader(headers, "Subject"),
    date: findHeader(headers, "Date"),
    snippet: data.snippet ?? "",
    body: extractBody(data.payload),
  };
}

export function buildRawEmail({
  from,
  to,
  cc,
  bcc,
  subject,
  body,
  attachments = [],
}: {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachments?: { name: string; type: string; data: Buffer }[];
}): string {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const headers: string[] = [
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    ...(bcc.length ? [`Bcc: ${bcc.join(", ")}`] : []),
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
  ];

  if (attachments.length === 0) {
    const msg = [...headers, "Content-Type: text/plain; charset=UTF-8", "", body].join("\r\n");
    return Buffer.from(msg).toString("base64url");
  }

  const boundary = `__boundary_${Date.now()}__`;
  const parts: string[] = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ];

  for (const att of attachments) {
    const b64 = att.data.toString("base64").replace(/.{76}/g, "$&\r\n");
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.type || "application/octet-stream"}; name="${att.name}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.name}"`,
      "",
      b64,
    );
  }
  parts.push(`--${boundary}--`);

  const msg = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    parts.join("\r\n"),
  ].join("\r\n");

  return Buffer.from(msg).toString("base64url");
}
