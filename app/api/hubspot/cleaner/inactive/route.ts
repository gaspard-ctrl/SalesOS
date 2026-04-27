import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { hubspotSearchAll, hubspotBatchAssociations } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Raw = { id: string; properties: Record<string, string> };

type InactiveRecord = {
  objectType: "contacts";
  id: string;
  label: string;
  subtitle: string;
  reason: "no_contact_since" | "email_optout" | "email_bounced";
  lastContacted: string | null;
  monthsSinceContact: number | null;
};

function monthsBetween(fromIso: string | null | undefined, to: Date): number | null {
  if (!fromIso) return null;
  const t = new Date(fromIso).getTime();
  if (!Number.isFinite(t)) return null;
  const diffMs = to.getTime() - t;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const thresholdMonths = parseInt(req.nextUrl.searchParams.get("months") ?? "12", 10);
  const safeThreshold = Number.isFinite(thresholdMonths) && thresholdMonths > 0 ? thresholdMonths : 12;
  const now = new Date();

  try {
    const contacts = await hubspotSearchAll<Raw>("contacts", {
      properties: [
        "firstname", "lastname", "email", "company",
        "notes_last_contacted", "hs_email_optout", "hs_email_bad_address",
        "hs_lead_status", "hs_lastmodifieddate",
      ],
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
    }, 1000);

    const assocMap = await hubspotBatchAssociations("contacts", "deals", contacts.map((c) => c.id));

    const records: InactiveRecord[] = [];
    for (const c of contacts) {
      const p = c.properties;
      const label = `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim() || p.email || c.id;
      const subtitle = [p.email, p.company].filter(Boolean).join(" · ");

      if (p.hs_email_bad_address === "true") {
        records.push({
          objectType: "contacts", id: c.id, label, subtitle,
          reason: "email_bounced",
          lastContacted: p.notes_last_contacted ?? null,
          monthsSinceContact: monthsBetween(p.notes_last_contacted, now),
        });
        continue;
      }

      if (p.hs_email_optout === "true") {
        records.push({
          objectType: "contacts", id: c.id, label, subtitle,
          reason: "email_optout",
          lastContacted: p.notes_last_contacted ?? null,
          monthsSinceContact: monthsBetween(p.notes_last_contacted, now),
        });
        continue;
      }

      const dealIds = assocMap.get(c.id) ?? [];
      if (dealIds.length > 0) continue;

      const months = monthsBetween(p.notes_last_contacted, now);
      const triggered = months == null ? true : months >= safeThreshold;
      if (triggered) {
        records.push({
          objectType: "contacts", id: c.id, label, subtitle,
          reason: "no_contact_since",
          lastContacted: p.notes_last_contacted ?? null,
          monthsSinceContact: months,
        });
      }
    }

    return NextResponse.json({
      records,
      total: records.length,
      thresholdMonths: safeThreshold,
      debug: { contactsScanned: contacts.length },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur HubSpot" }, { status: 500 });
  }
}
