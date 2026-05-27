import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hubspotSearchAll } from "@/lib/hubspot";
import { maybeCreateSalesRep } from "@/lib/scope-companies";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Filters = {
  q?: string;
  industry?: string[];
  country?: string[];
  lifecyclestage?: string[];
  ownerId?: string;
  employeesMin?: number;
  employeesMax?: number;
  domain?: string;
};

type HubspotCompanyRow = {
  id: string;
  properties: Record<string, string | null | undefined>;
};

type PreviewCompany = {
  hubspotId: string;
  name: string;
  industry: string | null;
  country: string | null;
  employees: number | null;
  domain: string | null;
  lifecyclestage: string | null;
  ownerId: string | null;
  alreadyInScope: boolean;
};

const COMPANY_PROPS = [
  "name",
  "domain",
  "industry",
  "country",
  "numberofemployees",
  "lifecyclestage",
  "hubspot_owner_id",
];

function toInt(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function buildFilterGroups(f: Filters): Array<{ filters: Array<{ propertyName: string; operator: string; value?: string }> }> {
  const filters: Array<{ propertyName: string; operator: string; value?: string }> = [];
  if (f.ownerId) filters.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: f.ownerId });
  if (typeof f.employeesMin === "number")
    filters.push({ propertyName: "numberofemployees", operator: "GTE", value: String(f.employeesMin) });
  if (typeof f.employeesMax === "number")
    filters.push({ propertyName: "numberofemployees", operator: "LTE", value: String(f.employeesMax) });
  if (f.domain) filters.push({ propertyName: "domain", operator: "CONTAINS_TOKEN", value: f.domain });

  // Industries / countries / lifecycles : OR via plusieurs filterGroups
  const groups: Array<{ filters: Array<{ propertyName: string; operator: string; value?: string }> }> = [];
  const multiAxis: Array<{ key: keyof Filters; prop: string }> = [
    { key: "industry", prop: "industry" },
    { key: "country", prop: "country" },
    { key: "lifecyclestage", prop: "lifecyclestage" },
  ];
  const expandedGroups: Array<Array<{ propertyName: string; operator: string; value?: string }>> = [[...filters]];
  for (const { key, prop } of multiAxis) {
    const vals = (f[key] as string[] | undefined)?.filter(Boolean) ?? [];
    if (vals.length === 0) continue;
    const next: typeof expandedGroups = [];
    for (const base of expandedGroups) {
      for (const v of vals) {
        next.push([...base, { propertyName: prop, operator: "EQ", value: v }]);
      }
    }
    expandedGroups.length = 0;
    expandedGroups.push(...next);
  }
  for (const g of expandedGroups) groups.push({ filters: g });
  return groups;
}

async function searchHubspotCompanies(filters: Filters, max: number): Promise<HubspotCompanyRow[]> {
  const filterGroups = buildFilterGroups(filters);
  return hubspotSearchAll<HubspotCompanyRow>(
    "companies",
    {
      properties: COMPANY_PROPS,
      ...(filterGroups.length > 0 ? { filterGroups } : {}),
      ...(filters.q ? { query: filters.q } : {}),
      sorts: [{ propertyName: "name", direction: "ASCENDING" }],
      limit: 100,
    },
    max
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!process.env.HUBSPOT_ACCESS_TOKEN)
    return NextResponse.json({ error: "HubSpot non configuré" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    filters?: Filters;
    defaultOwner?: string;
    dryRun?: boolean;
    selectedIds?: string[];
    mode?: "skip" | "update";
    max?: number;
  } | null;
  if (!body) return NextResponse.json({ error: "Body invalide" }, { status: 400 });

  const filters = body.filters ?? {};
  const dryRun = body.dryRun !== false && !body.selectedIds; // dryRun par défaut si pas de selection
  const max = Math.min(Math.max(body.max ?? 200, 1), 500);
  const mode: "skip" | "update" = body.mode === "update" ? "update" : "skip";

  try {
    const rows = await searchHubspotCompanies(filters, max);

    // Build preview en croisant avec scope_companies existantes (dedup case-insensitive sur name).
    const { data: existing } = await db.from("scope_companies").select("id, name");
    const existingNames = new Set((existing ?? []).map((r) => (r.name as string).toLowerCase()));

    const preview: PreviewCompany[] = rows
      .map((r) => {
        const name = (r.properties.name ?? "").trim();
        if (!name) return null;
        return {
          hubspotId: r.id,
          name,
          industry: r.properties.industry?.trim() || null,
          country: r.properties.country?.trim() || null,
          employees: toInt(r.properties.numberofemployees),
          domain: r.properties.domain?.trim() || null,
          lifecyclestage: r.properties.lifecyclestage?.trim() || null,
          ownerId: r.properties.hubspot_owner_id?.trim() || null,
          alreadyInScope: existingNames.has(name.toLowerCase()),
        };
      })
      .filter((p): p is PreviewCompany => p !== null);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        preview,
        total: preview.length,
        truncated: rows.length >= max,
      });
    }

    // ── Commit
    const defaultOwner = (body.defaultOwner ?? "").trim();
    if (!defaultOwner) {
      return NextResponse.json({ error: "Owner par défaut obligatoire" }, { status: 400 });
    }
    const selectedSet = new Set(body.selectedIds ?? []);
    const toImport = preview.filter((p) => selectedSet.has(p.hubspotId));
    if (toImport.length === 0) {
      return NextResponse.json({ error: "Aucune company sélectionnée" }, { status: 400 });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { name: string; reason: string }[] = [];

    const existingByLower = new Map<string, string>();
    for (const r of existing ?? [])
      existingByLower.set((r.name as string).toLowerCase(), r.id as string);

    for (const c of toImport) {
      const lower = c.name.toLowerCase();
      const existingId = existingByLower.get(lower);
      const payload = {
        name: c.name,
        owner: defaultOwner,
        sector: c.industry,
      };
      if (existingId) {
        if (mode === "skip") {
          skipped++;
          continue;
        }
        const { error } = await db
          .from("scope_companies")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) errors.push({ name: c.name, reason: error.message });
        else updated++;
      } else {
        const { error } = await db.from("scope_companies").insert(payload);
        if (error) {
          if (error.code === "23505") skipped++;
          else errors.push({ name: c.name, reason: error.message });
        } else {
          inserted++;
        }
      }
    }

    await maybeCreateSalesRep(defaultOwner);

    return NextResponse.json({
      ok: true,
      summary: { inserted, updated, skipped, errors, total: toImport.length },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur HubSpot" },
      { status: 500 }
    );
  }
}
