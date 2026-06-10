import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface CompanyEmailRecipient {
  email: string;
  kind: string | null;
}

export interface CompanyEmail {
  id: string; // source_id de l'envoi (regroupe les destinataires)
  subject: string | null;
  body: string | null;
  sent_at: string;
  source: string;
  sender_email: string | null;
  recipients: CompanyEmailRecipient[];
}

export interface CompanyEmailsResponse {
  emails: CompanyEmail[];
  error?: string;
}

// Historique des emails envoyes pour une company watchlist, regroupes par envoi.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ emails: [], error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await db
    .from("outreach_log")
    .select("source_id, email, recipient_kind, subject, body, source, sender_email, sent_at")
    .eq("user_id", user.id)
    .eq("scope_company_id", id)
    .order("sent_at", { ascending: false });

  if (error) return NextResponse.json({ emails: [], error: error.message }, { status: 500 });

  // Regroupe par envoi (source_id). Lignes sans source_id => envoi distinct par (date|sujet).
  const map = new Map<string, CompanyEmail>();
  for (const r of data ?? []) {
    const key = (r.source_id as string | null) ?? `${r.sent_at}|${r.subject ?? ""}`;
    const recipient: CompanyEmailRecipient = {
      email: r.email as string,
      kind: (r.recipient_kind as string | null) ?? null,
    };
    const existing = map.get(key);
    if (existing) {
      existing.recipients.push(recipient);
    } else {
      map.set(key, {
        id: key,
        subject: (r.subject as string | null) ?? null,
        body: (r.body as string | null) ?? null,
        sent_at: r.sent_at as string,
        source: (r.source as string) ?? "",
        sender_email: (r.sender_email as string | null) ?? null,
        recipients: [recipient],
      });
    }
  }

  return NextResponse.json({ emails: Array.from(map.values()) });
}
