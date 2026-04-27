const CLAAP_BASE = "https://api.claap.io/v1";

export type ClaapParticipant = {
  id?: string;
  name?: string;
  email?: string;
  attended?: boolean;
};

export type ClaapTranscript = {
  isActive?: boolean;
  isTranscript?: boolean;
  langIso2?: string;
  textUrl?: string;
  url?: string;
};

export type ClaapRecording = {
  id: string;
  title?: string;
  createdAt?: string;
  durationSeconds?: number;
  source?: string;
  state?: string;
  url?: string;
  thumbnailUrl?: string;
  channel?: { id?: string; name?: string };
  meeting?: {
    type?: "external" | "internal";
    startingAt?: string;
    endingAt?: string;
    participants?: ClaapParticipant[];
    conferenceUrl?: string;
  };
  recorder?: ClaapParticipant;
  transcripts?: ClaapTranscript[];
  workspace?: { id?: string; name?: string };
};

async function claapFetch<T>(path: string): Promise<T> {
  const token = process.env.CLAAP_API_TOKEN;
  if (!token) throw new Error("CLAAP_API_TOKEN missing");
  const res = await fetch(`${CLAAP_BASE}${path}`, {
    headers: { "X-Claap-Key": token, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claap ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function listClaapRecordings(limit = 30): Promise<ClaapRecording[]> {
  const data = await claapFetch<{ result?: { recordings?: ClaapRecording[] } }>(
    `/recordings?limit=${limit}`,
  );
  return data.result?.recordings ?? [];
}

export async function getClaapRecording(id: string): Promise<ClaapRecording | null> {
  const data = await claapFetch<{ result?: { recording?: ClaapRecording } }>(
    `/recordings/${encodeURIComponent(id)}`,
  );
  return data.result?.recording ?? null;
}

/**
 * Pick the active transcript URL (text format, not JSON).
 * Returns null if no transcript is available.
 */
export function pickTranscriptUrl(rec: ClaapRecording): string | null {
  const active = rec.transcripts?.find((t) => t.isActive && t.textUrl);
  if (active?.textUrl) return active.textUrl;
  const any = rec.transcripts?.find((t) => t.textUrl);
  return any?.textUrl ?? null;
}

export type ExternalParticipant = {
  name: string | null;
  email: string;
  attended: boolean | null;
};

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.fr",
  "yahoo.com", "yahoo.fr", "icloud.com", "me.com", "live.com", "live.fr",
  "msn.com", "protonmail.com", "proton.me", "pm.me",
  "free.fr", "orange.fr", "sfr.fr", "wanadoo.fr", "laposte.net", "bbox.fr",
  "neuf.fr", "aol.com",
]);

/**
 * Derive a displayable company name from an email address by extracting and
 * title-casing the first label of the domain. Returns null for public email
 * domains (gmail, outlook, etc.) where the domain says nothing about the
 * participant's employer.
 */
export function companyFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) return null;
  const label = domain.split(".")[0];
  if (!label) return null;
  return label
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

/**
 * Keep only "external" participants — i.e. those whose email domain differs
 * from the recorder's. These are the prospects/customers we want to display
 * in the Sales Coach UI.
 */
export function extractExternalParticipants(
  participants: ClaapParticipant[] | undefined,
  recorderEmail: string,
): ExternalParticipant[] {
  const recorderDomain = recorderEmail.split("@")[1]?.toLowerCase();
  if (!recorderDomain) return [];
  return (participants ?? [])
    .filter((p): p is ClaapParticipant & { email: string } => {
      const email = p.email?.toLowerCase();
      return !!email && email.includes("@") && email.split("@")[1] !== recorderDomain;
    })
    .map((p) => ({
      name: p.name ?? null,
      email: p.email.toLowerCase(),
      attended: p.attended ?? null,
    }));
}
