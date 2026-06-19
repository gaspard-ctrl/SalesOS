import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hubspotUpdate } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

interface Body {
  titleChanges?: { contactId: string; jobtitle: string }[];
  companyChanges?: { contactId: string; personId: string | null; company: string }[];
}

// POST /api/orgchart/accounts/[id]/apply-hubspot
// Pousse sur HubSpot les changements CONFIRMÉS par l'utilisateur (jamais
// d'écriture HubSpot depuis Apollo sans cette confirmation) :
// - titleChanges : MAJ jobtitle.
// - companyChanges : MAJ company sur HubSpot + marque la personne "Left" dans
//   l'organigramme (badge rouge + note).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const titleChanges = (body.titleChanges ?? []).filter((c) => c && c.contactId && c.jobtitle);
  const companyChanges = (body.companyChanges ?? []).filter((c) => c && c.contactId && c.company);

  let titlesUpdated = 0;
  for (const c of titleChanges) {
    try {
      await hubspotUpdate("contacts", c.contactId, { jobtitle: c.jobtitle });
      titlesUpdated++;
    } catch (e) {
      console.error("[apply-hubspot] title failed", c.contactId, e instanceof Error ? e.message : e);
    }
  }

  let companiesUpdated = 0;
  for (const c of companyChanges) {
    try {
      await hubspotUpdate("contacts", c.contactId, { company: c.company });
      if (c.personId) {
        await db
          .from("orgchart_people")
          .update({ relationship_status: "left", updated_at: new Date().toISOString() })
          .eq("id", c.personId);
      }
      companiesUpdated++;
    } catch (e) {
      console.error("[apply-hubspot] company failed", c.contactId, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, titlesUpdated, companiesUpdated });
}
