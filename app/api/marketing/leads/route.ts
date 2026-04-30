import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rematchHubspotForLead, runLeadAnalysis } from "@/lib/lead-analysis";
import { resolveMentionsInText, type SlackUser } from "@/lib/slack-leads";
import type {
  LeadAnalysisStatus,
  LeadDealScoreSummary,
  LeadValidationStatus,
} from "@/lib/marketing-types";
import type { DealScore } from "@/lib/deal-scoring";

// Module-level cache for Slack user lookups: avoids re-fetching the same user
// on every leads request. Cleared on cold start — names rarely change and the
// worst case is one extra users.info call.
const SLACK_USER_CACHE = new Map<string, SlackUser | null>();

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LEADS_SINCE = "2025-01-01T00:00:00Z";
const REMATCH_CAP = 30;
const VALID_STATUSES: LeadValidationStatus[] = ["pending", "validated", "rejected"];
const VALID_ANALYSIS: LeadAnalysisStatus[] = ["pending", "done", "no_match", "error"];
type StatusFilter = LeadValidationStatus | "all";
type AnalysisFilter = LeadAnalysisStatus | "all";

const LEAD_SELECT = `
  id, slack_ts, slack_permalink, author_name, text, files, posted_at,
  validation_status, validated_by, validated_at,
  last_analysis_id, analysis_status, analyzed_at,
  analysis:lead_analyses!leads_last_analysis_id_fkey (
    id, lead_id, status, extracted_email, extracted_name, extracted_company,
    extraction_confidence, extraction_notes,
    hubspot_contact_id, hubspot_deal_id, match_strategy,
    deal_name, deal_stage, deal_stage_label, deal_amount, deal_close_date,
    deal_owner_id, deal_owner_name, deal_is_closed, deal_is_closed_won,
    time_to_deal_seconds, time_to_close_seconds,
    error_message, created_at, updated_at
  )
`;

function isValidStatus(s: string): s is LeadValidationStatus {
  return (VALID_STATUSES as string[]).includes(s);
}

function isValidAnalysis(s: string): s is LeadAnalysisStatus {
  return (VALID_ANALYSIS as string[]).includes(s);
}

interface LeadWithAnalysisRow {
  id: string;
  analysis_status: string | null;
  analysis: {
    hubspot_deal_id: string | null;
    [k: string]: unknown;
  } | null;
}

async function hydrateLeadMentions<T>(rows: T[]): Promise<T[]> {
  if (!process.env.SLACK_BOT_TOKEN) return rows;
  return Promise.all(
    rows.map(async (r) => {
      const text = (r as { text?: string | null }).text;
      if (!text || !text.includes("<@")) return r;
      const resolved = await resolveMentionsInText(text, SLACK_USER_CACHE);
      return resolved === text ? r : { ...r, text: resolved };
    }),
  );
}

async function attachDealScores<T extends LeadWithAnalysisRow>(rows: T[]): Promise<T[]> {
  const dealIds = Array.from(
    new Set(
      rows
        .map((r) => r.analysis?.hubspot_deal_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
  if (dealIds.length === 0) return rows;

  const { data: scores, error } = await db
    .from("deal_scores")
    .select("deal_id, score, next_action, scored_at")
    .in("deal_id", dealIds);

  if (error || !scores) return rows;

  const byDealId = new Map<string, LeadDealScoreSummary>();
  for (const row of scores as Array<{
    deal_id: string;
    score: DealScore | null;
    next_action: string | null;
    scored_at: string | null;
  }>) {
    if (!row.score) continue;
    byDealId.set(row.deal_id, {
      total: row.score.total,
      reliability: row.score.reliability,
      scored_at: row.scored_at,
      next_action: row.next_action,
    });
  }

  return rows.map((r) => {
    const dealId = r.analysis?.hubspot_deal_id;
    if (!dealId || !r.analysis) return r;
    const summary = byDealId.get(dealId) ?? null;
    return { ...r, analysis: { ...r.analysis, deal_score: summary } };
  });
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const statusParam = req.nextUrl.searchParams.get("status") ?? "pending";
  const status: StatusFilter =
    statusParam === "all" || isValidStatus(statusParam) ? (statusParam as StatusFilter) : "pending";

  const analysisParam = req.nextUrl.searchParams.get("analysis") ?? "all";
  const analysis: AnalysisFilter =
    analysisParam === "all" || isValidAnalysis(analysisParam)
      ? (analysisParam as AnalysisFilter)
      : "all";

  let query = db
    .from("leads")
    .select(LEAD_SELECT)
    .gte("posted_at", LEADS_SINCE)
    .order("posted_at", { ascending: false });

  if (status !== "all") query = query.eq("validation_status", status);
  if (analysis !== "all") query = query.eq("analysis_status", analysis);

  const [listRes, pendingRes, validatedRes, rejectedRes, validatedNoDealRes, validatedWithDealRes] =
    await Promise.all([
      query,
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("validation_status", "pending")
        .gte("posted_at", LEADS_SINCE),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("validation_status", "validated")
        .gte("posted_at", LEADS_SINCE),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("validation_status", "rejected")
        .gte("posted_at", LEADS_SINCE),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("validation_status", "validated")
        .in("analysis_status", ["no_match", "error"])
        .gte("posted_at", LEADS_SINCE),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("validation_status", "validated")
        .eq("analysis_status", "done")
        .gte("posted_at", LEADS_SINCE),
    ]);

  if (listRes.error) {
    return NextResponse.json(
      {
        error: listRes.error.message,
        leads: [],
        counts: {
          pending: 0,
          validated: 0,
          rejected: 0,
          validatedNoDeal: 0,
          validatedWithDeal: 0,
        },
      },
      { status: 500 },
    );
  }

  const initialLeads = (listRes.data ?? []) as Array<{ id: string; analysis_status: string | null }>;

  // Lazy re-match: for leads currently no_match / error, retry HubSpot lookup
  // (deal may have been created since last analysis). Capped + parallel.
  const candidates = initialLeads
    .filter((l) => l.analysis_status === "no_match" || l.analysis_status === "error")
    .slice(0, REMATCH_CAP);

  if (candidates.length > 0) {
    await Promise.allSettled(candidates.map((l) => rematchHubspotForLead(l.id)));
    let refreshQuery = db
      .from("leads")
      .select(LEAD_SELECT)
      .gte("posted_at", LEADS_SINCE)
      .order("posted_at", { ascending: false });
    if (status !== "all") refreshQuery = refreshQuery.eq("validation_status", status);
    if (analysis !== "all") refreshQuery = refreshQuery.eq("analysis_status", analysis);
    const refreshed = await refreshQuery;
    if (!refreshed.error && refreshed.data) {
      const enriched = await attachDealScores(
        refreshed.data as unknown as LeadWithAnalysisRow[],
      );
      const hydrated = await hydrateLeadMentions(enriched);
      return NextResponse.json({
        leads: hydrated,
        counts: {
          pending: pendingRes.count ?? 0,
          validated: validatedRes.count ?? 0,
          rejected: rejectedRes.count ?? 0,
          validatedNoDeal: validatedNoDealRes.count ?? 0,
          validatedWithDeal: validatedWithDealRes.count ?? 0,
        },
      });
    }
  }

  const enriched = await attachDealScores(
    (listRes.data ?? []) as unknown as LeadWithAnalysisRow[],
  );
  const hydrated = await hydrateLeadMentions(enriched);
  return NextResponse.json({
    leads: hydrated,
    counts: {
      pending: pendingRes.count ?? 0,
      validated: validatedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
      validatedNoDeal: validatedNoDealRes.count ?? 0,
      validatedWithDeal: validatedWithDealRes.count ?? 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, status } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!status || !["validated", "rejected", "pending"].includes(status)) {
    return NextResponse.json(
      { error: "status must be validated, rejected or pending" },
      { status: 400 },
    );
  }

  const isTerminal = status === "validated" || status === "rejected";
  const { data, error } = await db
    .from("leads")
    .update({
      validation_status: status,
      validated_by: isTerminal ? user.id : null,
      validated_at: isTerminal ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id, validation_status, validated_by, validated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-trigger analysis when a lead becomes validated. Synchronous so the
  // response carries the result; if Claude/HubSpot fail, the validation
  // remains and analysis_status is persisted as 'error'.
  if (status === "validated") {
    try {
      const analysis = await runLeadAnalysis(id, { userId: user.id });
      return NextResponse.json({ lead: data, analysis });
    } catch (e) {
      console.error(`[lead-analyze ${id}] failed:`, e instanceof Error ? e.message : e);
      return NextResponse.json({
        lead: data,
        analysisError: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return NextResponse.json({ lead: data });
}
