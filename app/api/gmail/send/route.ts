import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGmailAccessToken, buildRawEmail, loadUserSignature } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const to = (formData.get("to") as string ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const cc = (formData.get("cc") as string ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const bcc = (formData.get("bcc") as string ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const subject = (formData.get("subject") as string) ?? "";
  const body = (formData.get("body") as string) ?? "";
  const source = ((formData.get("source") as string) ?? "gmail_send").trim() || "gmail_send";
  const includeSignature = ["1", "true"].includes(((formData.get("include_signature") as string) ?? "").trim());
  const hubspotId = ((formData.get("hubspot_id") as string) ?? "").trim() || null;
  const scopeCompanyId = ((formData.get("scope_company_id") as string) ?? "").trim() || null;
  const files = formData.getAll("attachments") as File[];

  if (!to.length) return NextResponse.json({ error: "Recipient required" }, { status: 400 });

  const attachments = await Promise.all(
    files.filter((f) => f.size > 0).map(async (f) => ({
      name: f.name,
      type: f.type || "application/octet-stream",
      data: Buffer.from(await f.arrayBuffer()),
    }))
  );

  let accessToken: string;
  try {
    accessToken = await getGmailAccessToken(user.id);
  } catch {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 403 });
  }

  // Get sender address from Gmail profile
  const profileRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const { emailAddress } = await profileRes.json();

  const signature = includeSignature ? await loadUserSignature(user.id) : null;

  const raw = buildRawEmail({ from: emailAddress, to, cc, bcc, subject, body, attachments, signature: signature ?? undefined });

  const sendRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.json();
    return NextResponse.json({ error: err.error?.message ?? "Failed to send" }, { status: 500 });
  }

  // Log outreach (badge "X échanges" + historique complet). Best-effort : ne jamais
  // faire échouer l'envoi. Tous les destinataires d'un envoi partagent un source_id.
  const sendId = randomUUID();
  const recipientRows = [
    ...to.map((email) => ({ email, recipient_kind: "to" })),
    ...cc.map((email) => ({ email, recipient_kind: "cc" })),
    ...bcc.map((email) => ({ email, recipient_kind: "bcc" })),
  ].map((r) => ({
    user_id: user.id,
    email: r.email,
    hubspot_id: hubspotId,
    source,
    source_id: sendId,
    scope_company_id: scopeCompanyId,
    recipient_kind: r.recipient_kind,
    sender_email: emailAddress ?? null,
    subject: subject || null,
    body: body || null,
  }));
  if (recipientRows.length > 0) {
    const { error: logErr } = await db.from("outreach_log").insert(recipientRows);
    if (logErr) console.error("[gmail/send] outreach_log insert failed:", logErr.message);
  }

  return NextResponse.json({ ok: true });
}
