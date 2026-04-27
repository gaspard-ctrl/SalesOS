import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { hubspotSearchAll, hubspotBatchAssociations, type HubspotObjectType } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Raw = { id: string; properties: Record<string, string> };

type OrphanRecord = {
  objectType: HubspotObjectType;
  id: string;
  label: string;
  subtitle: string;
  reason: "deal_no_contact" | "deal_no_company" | "contact_no_company";
  suggestion?: {
    action: "associate";
    targetType: HubspotObjectType;
    targetId: string;
    targetLabel: string;
  };
};

type ScanResult = { records: OrphanRecord[]; rawCount: number };

function normalizeDomain(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
}

function extractDomainFromEmail(email: string | undefined | null): string {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 0) return "";
  return e.slice(at + 1);
}

async function scanDeals(): Promise<ScanResult> {
  const deals = await hubspotSearchAll<Raw>("deals", {
    properties: ["dealname", "amount", "num_associated_contacts", "hs_is_closed", "hs_lastmodifieddate"],
    filterGroups: [
      { filters: [{ propertyName: "hs_is_closed", operator: "EQ", value: "false" }] },
    ],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  }, 500);

  const records: OrphanRecord[] = [];
  for (const d of deals) {
    const numContacts = parseInt(d.properties.num_associated_contacts ?? "0", 10);
    if (!Number.isFinite(numContacts) || numContacts === 0) {
      records.push({
        objectType: "deals",
        id: d.id,
        label: d.properties.dealname ?? d.id,
        subtitle: d.properties.amount ? `${d.properties.amount} €` : "",
        reason: "deal_no_contact",
      });
    }
  }
  return { records, rawCount: deals.length };
}

async function scanContacts(): Promise<ScanResult> {
  const contacts = await hubspotSearchAll<Raw>("contacts", {
    properties: ["firstname", "lastname", "email", "company", "hs_lastmodifieddate"],
    filterGroups: [
      { filters: [{ propertyName: "email", operator: "HAS_PROPERTY" }] },
    ],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  }, 500);

  if (contacts.length === 0) return { records: [], rawCount: 0 };

  const assocMap = await hubspotBatchAssociations("contacts", "companies", contacts.map((c) => c.id));
  const orphanContacts = contacts.filter((c) => {
    const assocs = assocMap.get(c.id) ?? [];
    return assocs.length === 0;
  });

  const domainsNeeded = Array.from(new Set(
    orphanContacts.map((c) => extractDomainFromEmail(c.properties.email)).filter(Boolean),
  ));

  const companyByDomain = new Map<string, { id: string; name: string }>();
  if (domainsNeeded.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < domainsNeeded.length; i += batchSize) {
      const batch = domainsNeeded.slice(i, i + batchSize);
      const companies = await hubspotSearchAll<Raw>("companies", {
        properties: ["name", "domain"],
        filterGroups: batch.map((d) => ({
          filters: [{ propertyName: "domain", operator: "EQ", value: d }],
        })),
      }, batch.length * 2);
      for (const c of companies) {
        const domain = normalizeDomain(c.properties.domain);
        if (domain && !companyByDomain.has(domain)) {
          companyByDomain.set(domain, { id: c.id, name: c.properties.name ?? c.properties.domain ?? c.id });
        }
      }
    }
  }

  const records = orphanContacts.map((c): OrphanRecord => {
    const domain = extractDomainFromEmail(c.properties.email);
    const match = domain ? companyByDomain.get(domain) : undefined;
    return {
      objectType: "contacts",
      id: c.id,
      label: `${c.properties.firstname ?? ""} ${c.properties.lastname ?? ""}`.trim() || c.properties.email || c.id,
      subtitle: c.properties.email ?? "",
      reason: "contact_no_company",
      suggestion: match ? {
        action: "associate",
        targetType: "companies",
        targetId: match.id,
        targetLabel: match.name,
      } : undefined,
    };
  });

  return { records, rawCount: contacts.length };
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const objectType = (req.nextUrl.searchParams.get("objectType") ?? "all") as HubspotObjectType | "all";

  try {
    const [dealsRes, contactsRes] = await Promise.all([
      objectType === "all" || objectType === "deals" ? scanDeals() : Promise.resolve({ records: [], rawCount: 0 }),
      objectType === "all" || objectType === "contacts" ? scanContacts() : Promise.resolve({ records: [], rawCount: 0 }),
    ]);
    const records = [...dealsRes.records, ...contactsRes.records];
    return NextResponse.json({
      records,
      total: records.length,
      debug: {
        dealsScanned: dealsRes.rawCount,
        contactsScanned: contactsRes.rawCount,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur HubSpot" }, { status: 500 });
  }
}
