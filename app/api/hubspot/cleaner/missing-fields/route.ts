import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { hubspotSearchAll, type HubspotObjectType } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Raw = { id: string; properties: Record<string, string> };

type MissingFieldRecord = {
  objectType: HubspotObjectType;
  id: string;
  label: string;
  subtitle: string;
  missing: string[];
};

type ScanResult = { records: MissingFieldRecord[]; rawCount: number };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmpty(v: string | undefined | null): boolean {
  return v == null || String(v).trim() === "";
}

async function scanContacts(): Promise<ScanResult> {
  const records = await hubspotSearchAll<Raw>("contacts", {
    properties: ["email", "firstname", "lastname", "jobtitle", "company", "hubspot_owner_id", "hs_lastmodifieddate"],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  }, 1000);

  const found = records.flatMap((r): MissingFieldRecord[] => {
    const missing: string[] = [];
    const email = r.properties.email;
    if (isEmpty(email)) missing.push("email");
    else if (!EMAIL_REGEX.test(email.trim())) missing.push("email (format invalide)");
    if (isEmpty(r.properties.hubspot_owner_id)) missing.push("owner");
    if (isEmpty(r.properties.company)) missing.push("company");
    if (isEmpty(r.properties.jobtitle)) missing.push("jobtitle");
    if (missing.length === 0) return [];
    return [{
      objectType: "contacts",
      id: r.id,
      label: `${r.properties.firstname ?? ""} ${r.properties.lastname ?? ""}`.trim() || email || r.id,
      subtitle: [r.properties.jobtitle, r.properties.company].filter(Boolean).join(" · "),
      missing,
    }];
  });
  return { records: found, rawCount: records.length };
}

async function scanDeals(): Promise<ScanResult> {
  const records = await hubspotSearchAll<Raw>("deals", {
    properties: ["dealname", "amount", "closedate", "hubspot_owner_id", "num_associated_contacts", "hs_is_closed", "hs_lastmodifieddate"],
    filterGroups: [
      { filters: [{ propertyName: "hs_is_closed", operator: "EQ", value: "false" }] },
    ],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  }, 1000);

  const found = records.flatMap((r): MissingFieldRecord[] => {
    const missing: string[] = [];
    if (isEmpty(r.properties.amount)) missing.push("amount");
    if (isEmpty(r.properties.closedate)) missing.push("closedate");
    if (isEmpty(r.properties.hubspot_owner_id)) missing.push("owner");
    const numContacts = parseInt(r.properties.num_associated_contacts ?? "0", 10);
    if (!Number.isFinite(numContacts) || numContacts === 0) missing.push("contact associé");
    if (missing.length === 0) return [];
    return [{
      objectType: "deals",
      id: r.id,
      label: r.properties.dealname ?? r.id,
      subtitle: r.properties.amount ? `${r.properties.amount} €` : "",
      missing,
    }];
  });
  return { records: found, rawCount: records.length };
}

async function scanCompanies(): Promise<ScanResult> {
  const records = await hubspotSearchAll<Raw>("companies", {
    properties: ["name", "domain", "industry", "numberofemployees", "hs_lastmodifieddate"],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  }, 1000);

  const found = records.flatMap((r): MissingFieldRecord[] => {
    const missing: string[] = [];
    if (isEmpty(r.properties.domain)) missing.push("domain");
    if (isEmpty(r.properties.industry)) missing.push("industry");
    if (isEmpty(r.properties.numberofemployees)) missing.push("numberofemployees");
    if (missing.length === 0) return [];
    return [{
      objectType: "companies",
      id: r.id,
      label: r.properties.name ?? r.properties.domain ?? r.id,
      subtitle: r.properties.domain ?? "",
      missing,
    }];
  });
  return { records: found, rawCount: records.length };
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const objectType = (req.nextUrl.searchParams.get("objectType") ?? "all") as HubspotObjectType | "all";

  try {
    const [contactsRes, dealsRes, companiesRes] = await Promise.all([
      objectType === "all" || objectType === "contacts" ? scanContacts() : Promise.resolve({ records: [], rawCount: 0 }),
      objectType === "all" || objectType === "deals" ? scanDeals() : Promise.resolve({ records: [], rawCount: 0 }),
      objectType === "all" || objectType === "companies" ? scanCompanies() : Promise.resolve({ records: [], rawCount: 0 }),
    ]);
    const records = [...contactsRes.records, ...dealsRes.records, ...companiesRes.records];
    return NextResponse.json({
      records,
      total: records.length,
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
