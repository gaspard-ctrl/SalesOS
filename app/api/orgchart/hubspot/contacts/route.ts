import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchContactsForCompany } from "@/lib/orgchart/fetch-hubspot-contacts";

export const dynamic = "force-dynamic";

interface Body {
  companies?: { id: string; name?: string | null; domain?: string | null }[];
  accountId?: string; // mode append : exclure les contacts déjà dans le chart
}

interface PreviewContact {
  hubspot_contact_id: string;
  name: string;
  title: string | null;
  email: string | null;
  companyId: string;
  companyName: string | null;
}

// POST /api/orgchart/hubspot/contacts
// Pré-visualise les contacts HubSpot des company sélectionnées (dédup), SANS rien
// importer. Sert l'étape "qui mettre dans l'organigramme" du wizard : l'utilisateur
// décoche ceux à exclure avant le flow d'import/validation.
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const companies = Array.isArray(body.companies) ? body.companies.filter((c) => c && c.id) : [];
  if (companies.length === 0) return NextResponse.json({ error: "Select at least one company" }, { status: 400 });

  // Append : on ne propose que les contacts pas encore dans le chart.
  let existing = new Set<string>();
  if (body.accountId) {
    const { data } = await db
      .from("orgchart_people")
      .select("hubspot_contact_id")
      .eq("account_id", body.accountId)
      .not("hubspot_contact_id", "is", null);
    existing = new Set((data ?? []).map((r) => r.hubspot_contact_id as string).filter(Boolean));
  }

  const seen = new Set<string>();
  const contacts: PreviewContact[] = [];
  for (const c of companies) {
    try {
      const fetched = await fetchContactsForCompany(c.id);
      for (const contact of fetched.contacts) {
        if (seen.has(contact.hubspot_contact_id)) continue;
        seen.add(contact.hubspot_contact_id);
        if (existing.has(contact.hubspot_contact_id)) continue;
        contacts.push({
          hubspot_contact_id: contact.hubspot_contact_id,
          name: contact.name,
          title: contact.title,
          email: contact.email,
          companyId: c.id,
          companyName: fetched.name ?? c.name ?? null,
        });
      }
    } catch (e) {
      console.error("[orgchart/contacts preview] failed for", c.id, e instanceof Error ? e.message : e);
    }
  }

  // Tri : titrés d'abord, puis alpha (lecture plus simple pour décocher).
  contacts.sort((a, b) => {
    if (!!a.title !== !!b.title) return a.title ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ contacts });
}
