import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { hubspotSearchAll, type HubspotObjectType } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Raw = { id: string; properties: Record<string, string> };

type DuplicateGroup = {
  objectType: HubspotObjectType;
  key: string;
  keyType: "email" | "name+company" | "domain" | "dealname+owner";
  primaryId: string;
  records: Array<{
    id: string;
    label: string;
    subtitle: string;
    lastModified: string;
    propertyCount: number;
  }>;
};

type ScanResult = { groups: DuplicateGroup[]; rawCount: number };

function normalizeEmail(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

function normalizeDomain(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
}

function countFilledProps(props: Record<string, string>): number {
  return Object.values(props).filter((v) => v != null && String(v).trim() !== "").length;
}

function pickPrimary(records: Raw[]): string {
  const sorted = [...records].sort((a, b) => {
    const timeA = new Date(a.properties.hs_lastmodifieddate ?? 0).getTime();
    const timeB = new Date(b.properties.hs_lastmodifieddate ?? 0).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return countFilledProps(b.properties) - countFilledProps(a.properties);
  });
  return sorted[0].id;
}

async function scanContacts(): Promise<ScanResult> {
  const records = await hubspotSearchAll<Raw>("contacts", {
    properties: ["email", "firstname", "lastname", "company", "hs_lastmodifieddate", "jobtitle"],
    filterGroups: [
      { filters: [{ propertyName: "email", operator: "HAS_PROPERTY" }] },
    ],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  }, 1000);

  const byEmail = new Map<string, Raw[]>();
  const byNameCompany = new Map<string, Raw[]>();
  for (const r of records) {
    const email = normalizeEmail(r.properties.email);
    if (email) {
      const arr = byEmail.get(email) ?? [];
      arr.push(r);
      byEmail.set(email, arr);
    }
    const first = (r.properties.firstname ?? "").trim().toLowerCase();
    const last = (r.properties.lastname ?? "").trim().toLowerCase();
    const company = (r.properties.company ?? "").trim().toLowerCase();
    if (first && last && company) {
      const nc = `${first}|${last}|${company}`;
      const arr = byNameCompany.get(nc) ?? [];
      arr.push(r);
      byNameCompany.set(nc, arr);
    }
  }

  const groups: DuplicateGroup[] = [];
  const seenIds = new Set<string>();
  const pushGroup = (keyType: DuplicateGroup["keyType"], key: string, recs: Raw[]) => {
    const unique = recs.filter((r) => !seenIds.has(r.id));
    if (unique.length < 2) return;
    unique.forEach((r) => seenIds.add(r.id));
    groups.push({
      objectType: "contacts",
      key,
      keyType,
      primaryId: pickPrimary(unique),
      records: unique.map((r) => ({
        id: r.id,
        label: `${r.properties.firstname ?? ""} ${r.properties.lastname ?? ""}`.trim() || r.properties.email || r.id,
        subtitle: [r.properties.jobtitle, r.properties.company, r.properties.email].filter(Boolean).join(" · "),
        lastModified: r.properties.hs_lastmodifieddate ?? "",
        propertyCount: countFilledProps(r.properties),
      })),
    });
  };

  for (const [email, recs] of byEmail) {
    if (recs.length < 2) continue;
    pushGroup("email", email, recs);
  }
  for (const [nc, recs] of byNameCompany) {
    if (recs.length < 2) continue;
    pushGroup("name+company", nc, recs);
  }
  return { groups, rawCount: records.length };
}

async function scanDeals(): Promise<ScanResult> {
  const records = await hubspotSearchAll<Raw>("deals", {
    properties: ["dealname", "amount", "dealstage", "hubspot_owner_id", "hs_is_closed", "hs_lastmodifieddate"],
    filterGroups: [
      { filters: [{ propertyName: "hs_is_closed", operator: "EQ", value: "false" }] },
    ],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  }, 1000);

  const byKey = new Map<string, Raw[]>();
  for (const r of records) {
    const name = (r.properties.dealname ?? "").trim().toLowerCase();
    const owner = r.properties.hubspot_owner_id ?? "";
    if (!name || !owner) continue;
    const key = `${name}||${owner}`;
    const arr = byKey.get(key) ?? [];
    arr.push(r);
    byKey.set(key, arr);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, recs] of byKey) {
    if (recs.length < 2) continue;
    groups.push({
      objectType: "deals",
      key,
      keyType: "dealname+owner",
      primaryId: pickPrimary(recs),
      records: recs.map((r) => ({
        id: r.id,
        label: r.properties.dealname ?? r.id,
        subtitle: [r.properties.amount ? `${r.properties.amount} €` : "", r.properties.dealstage].filter(Boolean).join(" · "),
        lastModified: r.properties.hs_lastmodifieddate ?? "",
        propertyCount: countFilledProps(r.properties),
      })),
    });
  }
  return { groups, rawCount: records.length };
}

async function scanCompanies(): Promise<ScanResult> {
  const records = await hubspotSearchAll<Raw>("companies", {
    properties: ["name", "domain", "industry", "numberofemployees", "hs_lastmodifieddate"],
    filterGroups: [
      { filters: [{ propertyName: "domain", operator: "HAS_PROPERTY" }] },
    ],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  }, 1000);

  const byDomain = new Map<string, Raw[]>();
  for (const r of records) {
    const domain = normalizeDomain(r.properties.domain);
    if (!domain) continue;
    const arr = byDomain.get(domain) ?? [];
    arr.push(r);
    byDomain.set(domain, arr);
  }

  const groups: DuplicateGroup[] = [];
  for (const [domain, recs] of byDomain) {
    if (recs.length < 2) continue;
    groups.push({
      objectType: "companies",
      key: domain,
      keyType: "domain",
      primaryId: pickPrimary(recs),
      records: recs.map((r) => ({
        id: r.id,
        label: r.properties.name ?? r.properties.domain ?? r.id,
        subtitle: [r.properties.industry, r.properties.numberofemployees ? `${r.properties.numberofemployees} empl.` : ""].filter(Boolean).join(" · "),
        lastModified: r.properties.hs_lastmodifieddate ?? "",
        propertyCount: countFilledProps(r.properties),
      })),
    });
  }
  return { groups, rawCount: records.length };
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const objectType = (req.nextUrl.searchParams.get("objectType") ?? "all") as HubspotObjectType | "all";

  try {
    const [contactsRes, dealsRes, companiesRes] = await Promise.all([
      objectType === "all" || objectType === "contacts" ? scanContacts() : Promise.resolve({ groups: [], rawCount: 0 }),
      objectType === "all" || objectType === "deals" ? scanDeals() : Promise.resolve({ groups: [], rawCount: 0 }),
      objectType === "all" || objectType === "companies" ? scanCompanies() : Promise.resolve({ groups: [], rawCount: 0 }),
    ]);
    const groups = [...contactsRes.groups, ...dealsRes.groups, ...companiesRes.groups];
    return NextResponse.json({
      groups,
      total: groups.length,
      debug: {
        contactsScanned: contactsRes.rawCount,
        dealsScanned: dealsRes.rawCount,
        companiesScanned: companiesRes.rawCount,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur HubSpot" }, { status: 500 });
  }
}
