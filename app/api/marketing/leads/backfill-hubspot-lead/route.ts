import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hubspotFetch } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Backfill the HubSpot Lead-object snapshot (CRM object type 0-136) on
// existing lead_analyses rows that already have a hubspot_contact_id but
// haven't been resolved to a Lead yet. Per row we make:
//   - 1 call: contact → leads associations
//   - up to N calls: lead-object property fetches
// Run repeatedly with ?limit=N until processed==0.

const LEAD_OBJECT_PROPS = [
  "hs_lead_name",
  "hs_pipeline",
  "hs_pipeline_stage",
  "hubspot_owner_id",
  "hs_lastmodifieddate",
];

interface AnalysisRow {
  id: string;
  hubspot_contact_id: string;
}

type LeadAssocResponse = {
  results?: Array<{ toObjectId?: string; id?: string }>;
};

type LeadObjectGetResponse = { id?: string; properties?: Record<string, string> };

type PipelineStage = { id: string; label: string; displayOrder?: number };
type LeadPipelinesResponse = { results?: Array<{ stages?: PipelineStage[] }> };

type OwnersResponse = {
  results?: { id: string; firstName?: string; lastName?: string; email?: string }[];
};

async function fetchOwnersIndex(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const owners = await hubspotFetch<OwnersResponse>("/crm/v3/owners?limit=200");
    for (const o of owners.results ?? []) {
      const name = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || "";
      if (o.id && name) out.set(o.id, name);
    }
  } catch {
    // non-fatal
  }
  return out;
}

async function fetchStageLabelMap(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await hubspotFetch<LeadPipelinesResponse>("/crm/v3/pipelines/0-136");
    for (const pl of res.results ?? []) {
      for (const st of pl.stages ?? []) {
        if (st.id && st.label) out.set(st.id, st.label);
      }
    }
  } catch {
    // non-fatal — labels will fall back to stage_id strings
  }
  return out;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN missing" }, { status: 500 });
  }

  let body: { limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body OK
  }
  const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);

  const { data, error } = await db
    .from("lead_analyses")
    .select("id, hubspot_contact_id")
    .not("hubspot_contact_id", "is", null)
    .is("hubspot_lead_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as AnalysisRow[];
  if (rows.length === 0) {
    return NextResponse.json({ processed: 0, ok: 0, errors: 0, no_lead: 0 });
  }

  const [ownersIndex, stageMap] = await Promise.all([
    fetchOwnersIndex(),
    fetchStageLabelMap(),
  ]);

  let ok = 0;
  let errors = 0;
  let noLead = 0;
  for (const row of rows) {
    try {
      const assoc = await hubspotFetch<LeadAssocResponse>(
        `/crm/v4/objects/contacts/${row.hubspot_contact_id}/associations/leads`,
      );
      const leadIds = (assoc.results ?? [])
        .map((r) => String(r.toObjectId ?? r.id ?? ""))
        .filter((s) => s.length > 0);
      if (leadIds.length === 0) {
        noLead++;
        continue;
      }
      const details = await Promise.allSettled(
        leadIds.map((id) =>
          hubspotFetch<LeadObjectGetResponse>(
            `/crm/v3/objects/leads/${id}?properties=${LEAD_OBJECT_PROPS.join(",")}`,
          ),
        ),
      );
      const candidates = details
        .filter((d): d is PromiseFulfilledResult<LeadObjectGetResponse> => d.status === "fulfilled")
        .map((d) => d.value)
        .filter((v) => !!v.id);
      if (candidates.length === 0) {
        noLead++;
        continue;
      }
      candidates.sort((a, b) => {
        const am = a.properties?.hs_lastmodifieddate ?? "";
        const bm = b.properties?.hs_lastmodifieddate ?? "";
        return bm.localeCompare(am);
      });
      const picked = candidates[0];
      const p = picked.properties ?? {};
      const stageId = p.hs_pipeline_stage || null;
      const stageLabel = stageId ? stageMap.get(stageId) ?? stageId : null;
      const ownerId = p.hubspot_owner_id || null;
      const ownerName = ownerId ? ownersIndex.get(ownerId) ?? null : null;

      const { error: updErr } = await db
        .from("lead_analyses")
        .update({
          hubspot_lead_id: picked.id ?? null,
          hubspot_lead_name: p.hs_lead_name || null,
          hubspot_lead_pipeline_id: p.hs_pipeline || null,
          hubspot_lead_stage_id: stageId,
          hubspot_lead_stage_label: stageLabel,
          hubspot_lead_owner_id: ownerId,
          hubspot_lead_owner_name: ownerName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updErr) {
        console.error(`[backfill-hubspot-lead ${row.id}]`, updErr.message);
        errors++;
      } else {
        ok++;
      }
    } catch (e) {
      console.error(`[backfill-hubspot-lead ${row.id}]`, e instanceof Error ? e.message : e);
      errors++;
    }
    // be polite to HubSpot rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({ processed: rows.length, ok, errors, no_lead: noLead });
}
