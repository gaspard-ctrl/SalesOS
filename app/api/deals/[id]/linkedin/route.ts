import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { hubspotFetch } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

interface ContactProps {
  firstname?: string;
  lastname?: string;
  email?: string;
  jobtitle?: string;
  company?: string;
  linkedin_url?: string;
}

export interface DealContact {
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  email: string;
  linkedinUrl: string | null;
}

// Renvoie juste les contacts du deal (depuis HubSpot). L'enrichissement LinkedIn
// est ensuite déclenché À LA DEMANDE par l'utilisateur (bouton) via
// /api/linkedin/enrich — on ne scrape donc plus automatiquement (économie de
// crédits Bright Data).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const assoc = await hubspotFetch<{ results?: { id: string }[] }>(
      `/crm/v3/objects/deals/${id}/associations/contacts`,
    );
    const contactIds = (assoc.results ?? []).slice(0, 3).map((r) => r.id);
    if (contactIds.length === 0) return NextResponse.json({ contacts: [] });

    const contacts: DealContact[] = [];
    for (const cid of contactIds) {
      const c = await hubspotFetch<{ id: string; properties: ContactProps }>(
        `/crm/v3/objects/contacts/${cid}?properties=firstname,lastname,email,jobtitle,company,linkedin_url`,
      );
      const p = c.properties;
      const linkedinUrl = p.linkedin_url && /linkedin\.com\/in\//i.test(p.linkedin_url) ? p.linkedin_url : null;
      contacts.push({
        firstName: p.firstname ?? "",
        lastName: p.lastname ?? "",
        jobTitle: p.jobtitle ?? "",
        company: p.company ?? "",
        email: p.email ?? "",
        linkedinUrl,
      });
    }

    return NextResponse.json({ contacts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
