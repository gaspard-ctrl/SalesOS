import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

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
  deal_amount: number | null;
  deal_stage_label: string | null;
  deal_is_closed: boolean | null;
  deal_is_closed_won: boolean | null;
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

  const [leadsRes, analysesRes] = await Promise.all([
    db
      .from("leads")
      .select("id, validation_status, validated_at, posted_at, last_analysis_id")
      .gte("posted_at", LEADS_SINCE),
    db
      .from("lead_analyses")
      .select(
        "id, hubspot_deal_id, deal_amount, deal_stage_label, deal_is_closed, deal_is_closed_won",
      ),
  ]);

  if (leadsRes.error || analysesRes.error) {
    return NextResponse.json(
      { error: leadsRes.error?.message ?? analysesRes.error?.message ?? "DB error" },
      { status: 500 },
    );
  }

  const leads = (leadsRes.data ?? []) as LeadRow[];
  const analyses = (analysesRes.data ?? []) as AnalysisRow[];
  const analysisById = new Map<string, AnalysisRow>(analyses.map((a) => [a.id, a]));

  const inPeriod = (iso: string | null): boolean => {
    if (!iso) return false;
    return iso >= from && iso <= to;
  };

  const periodLeads = leads.filter((l) => inPeriod(l.validated_at ?? l.posted_at));
  const totalLeads = periodLeads.length;
  const validated = periodLeads.filter((l) => l.validation_status === "validated").length;

  let withDeal = 0;
  let disco = 0;
  let closedWon = 0;
  let openPipelineAmount = 0;

  for (const l of periodLeads) {
    if (l.validation_status !== "validated") continue;
    const a = l.last_analysis_id ? analysisById.get(l.last_analysis_id) : null;
    if (!a) continue;
    if (a.hubspot_deal_id) withDeal++;
    if (isDiscoReached(a)) disco++;
    if (a.deal_is_closed_won) closedWon++;
    if (a.hubspot_deal_id && a.deal_is_closed === false && typeof a.deal_amount === "number") {
      openPipelineAmount += a.deal_amount;
    }
  }

  return NextResponse.json({
    period: { from, to },
    funnel: { totalLeads, validated, withDeal, disco, closedWon },
    openPipelineAmount,
  });
}
