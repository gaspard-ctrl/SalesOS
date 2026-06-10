import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface ContactOutreachEmail {
  id: string;
  subject: string | null;
  body: string | null;
  sent_at: string;
  source: string;
  scope_company_id: string | null;
}

export interface ContactOutreachResponse {
  emails: ContactOutreachEmail[];
  error?: string;
}

// Historique des emails envoyes depuis la plateforme a une adresse donnee.
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ emails: [], error: "Not authenticated" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) return NextResponse.json({ emails: [] });

  const { data, error } = await db
    .from("outreach_log")
    .select("id, subject, body, source, scope_company_id, sent_at")
    .eq("user_id", user.id)
    .eq("email_lower", email)
    .order("sent_at", { ascending: false });

  if (error) return NextResponse.json({ emails: [], error: error.message }, { status: 500 });

  const emails: ContactOutreachEmail[] = (data ?? []).map((r) => ({
    id: r.id as string,
    subject: (r.subject as string | null) ?? null,
    body: (r.body as string | null) ?? null,
    sent_at: r.sent_at as string,
    source: (r.source as string) ?? "",
    scope_company_id: (r.scope_company_id as string | null) ?? null,
  }));

  return NextResponse.json({ emails });
}
