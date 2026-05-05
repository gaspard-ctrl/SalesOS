import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hubspotFetch } from "@/lib/hubspot";
import type { LeadStageBucket } from "@/lib/marketing-types";

export const dynamic = "force-dynamic";

const LEADS_SINCE = "2025-01-01T00:00:00Z";

interface LeadRow {
  id: string;
  validation_status: string;
  validated_at: string | null;
  posted_at: string;
  last_analysis_id: string | null;
}

interface AnalysisRow {
  id: string;
  hubspot_deal_id: string | null;
  hubspot_lead_id: string | null;
  hubspot_lead_stage_id: string | null;
  hubspot_lead_stage_label: string | null;
  deal_amount: number | null;
  deal_stage_label: string | null;
  deal_is_closed: boolean | null;
  deal_is_closed_won: boolean | null;
}

type PipelineStage = { id: string; label: string; displayOrder?: number };
type LeadPipelinesResponse = { results?: Array<{ id?: string; stages?: PipelineStage[] }> };

// Pull the canonical stage order from HubSpot so the funnel bars follow
// the configured pipeline order, not insertion order. Fail open: if the
// pipeline lookup errors, we fall back to the order stages appear in the
// data.
async function fetchLeadPipelineStageOrder(): Promise<{ id: string; label: string }[]> {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return [];
  try {
    const res = await hubspotFetch<LeadPipelinesResponse>("/crm/v3/pipelines/0-136");
    const out: { id: string; label: string }[] = [];
    for (const pl of res.results ?? []) {
      const stages = (pl.stages ?? []).slice().sort((a, b) => {
        const ao = a.displayOrder ?? 0;
        const bo = b.displayOrder ?? 0;
        return ao - bo;
      });
      for (const s of stages) {
        if (s.id && s.label) out.push({ id: s.id, label: s.label });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// "Disco reached" = deal stage explicitly mentions discovery, OR the deal has
// since closed (won or lost) — both imply discovery happened.
function isDiscoReached(a: AnalysisRow): boolean {
  if (!a.hubspot_deal_id) return false;
  if (a.deal_is_closed === true) return true;
  if (a.deal_stage_label && /disco/i.test(a.deal_stage_label)) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 365 * 86400000).toISOString();
  const from = fromParam ?? defaultFrom;
  const to = toParam ?? now.toISOString();

  // Try the full select with the new hubspot_lead_* columns. If the migration
  // isn't applied yet, fall back to a legacy select so the page still loads —
  // byLeadStage will just be empty.
  const FULL_ANALYSES_SELECT =
    "id, hubspot_deal_id, hubspot_lead_id, hubspot_lead_stage_id, hubspot_lead_stage_label, deal_amount, deal_stage_label, deal_is_closed, deal_is_closed_won";
  const LEGACY_ANALYSES_SELECT =
    "id, hubspot_deal_id, deal_amount, deal_stage_label, deal_is_closed, deal_is_closed_won";

  const [leadsRes, analysesRes, stageOrder] = await Promise.all([
    db
      .from("leads")
      .select("id, validation_status, validated_at, posted_at, last_analysis_id")
      .gte("posted_at", LEADS_SINCE),
    db.from("lead_analyses").select(FULL_ANALYSES_SELECT),
    fetchLeadPipelineStageOrder(),
  ]);

  let analyses: AnalysisRow[];
  if (analysesRes.error) {
    const fallback = await db.from("lead_analyses").select(LEGACY_ANALYSES_SELECT);
    if (fallback.error) {
      return NextResponse.json(
        { error: fallback.error.message ?? "DB error" },
        { status: 500 },
      );
    }
    analyses = (fallback.data ?? []).map((row) => ({
      ...(row as Omit<AnalysisRow, "hubspot_lead_id" | "hubspot_lead_stage_id" | "hubspot_lead_stage_label">),
      hubspot_lead_id: null,
      hubspot_lead_stage_id: null,
      hubspot_lead_stage_label: null,
    }));
  } else {
    analyses = (analysesRes.data ?? []) as AnalysisRow[];
  }

  if (leadsRes.error) {
    return NextResponse.json(
      { error: leadsRes.error.message ?? "DB error" },
      { status: 500 },
    );
  }

  const leads = (leadsRes.data ?? []) as LeadRow[];
  const analysisById = new Map<string, AnalysisRow>(analyses.map((a) => [a.id, a]));

  const inPeriod = (iso: string | null): boolean => {
    if (!iso) return false;
    return iso >= from && iso <= to;
  };

  const periodLeads = leads.filter((l) => inPeriod(l.validated_at ?? l.posted_at));
  const totalLeads = periodLeads.length;
  const validated = periodLeads.filter((l) => l.validation_status === "validated").length;

  let withDeal = 0;
  let withLead = 0;
  let disco = 0;
  let closedWon = 0;
  let closedLost = 0;
  let openPipelineAmount = 0;
  let closedLostAmount = 0;
  // Stage counts keyed by stage_id (or label fallback when id is null).
  const stageCounts = new Map<string, { stage_id: string | null; stage_label: string; count: number }>();
  const stageKey = (a: AnalysisRow): string => a.hubspot_lead_stage_id ?? a.hubspot_lead_stage_label ?? "_unknown";

  for (const l of periodLeads) {
    if (l.validation_status !== "validated") continue;
    const a = l.last_analysis_id ? analysisById.get(l.last_analysis_id) : null;
    if (!a) continue;
    if (a.hubspot_deal_id) withDeal++;
    if (a.hubspot_lead_id) {
      withLead++;
      const key = stageKey(a);
      const existing = stageCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        stageCounts.set(key, {
          stage_id: a.hubspot_lead_stage_id,
          stage_label: a.hubspot_lead_stage_label ?? "Stage inconnu",
          count: 1,
        });
      }
    }
    if (isDiscoReached(a)) disco++;
    if (a.deal_is_closed_won) closedWon++;
    if (a.deal_is_closed === true && a.deal_is_closed_won === false) {
      closedLost++;
      if (typeof a.deal_amount === "number") closedLostAmount += a.deal_amount;
    }
    if (a.hubspot_deal_id && a.deal_is_closed === false && typeof a.deal_amount === "number") {
      openPipelineAmount += a.deal_amount;
    }
  }

  // Order stages by HubSpot pipeline order; append any stages found in data
  // but missing from the pipeline (e.g. archived stages).
  const byLeadStage: LeadStageBucket[] = [];
  const seen = new Set<string>();
  for (const s of stageOrder) {
    const bucket = stageCounts.get(s.id);
    byLeadStage.push({
      stage_id: s.id,
      stage_label: s.label,
      count: bucket?.count ?? 0,
    });
    seen.add(s.id);
  }
  for (const [, bucket] of stageCounts) {
    if (bucket.stage_id && seen.has(bucket.stage_id)) continue;
    byLeadStage.push(bucket);
  }

  const withoutLead = Math.max(0, validated - withLead);

  return NextResponse.json({
    period: { from, to },
    funnel: {
      totalLeads,
      validated,
      withDeal,
      withLead,
      withoutLead,
      disco,
      closedWon,
      closedLost,
      byLeadStage,
    },
    openPipelineAmount,
    closedLostAmount,
  });
}
