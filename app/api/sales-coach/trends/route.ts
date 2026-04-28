import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SalesCoachAnalysis } from "@/lib/guides/sales-coach";

export const dynamic = "force-dynamic";

type TrendRow = {
  id: string;
  meeting_title: string | null;
  meeting_started_at: string | null;
  score_global: number | null;
  meeting_kind: string | null;
  analysis: SalesCoachAnalysis | null;
};

type AxesScores = {
  opening: number;
  discovery: number;
  active_listening: number;
  value_articulation: number;
  objection_handling: number;
  next_steps: number;
};

type MeddicScores = {
  metrics: number;
  economic_buyer: number;
  decision_criteria: number;
  decision_process: number;
  identify_pain: number;
  champion: number;
};

function projectAxes(a: SalesCoachAnalysis | null): AxesScores | null {
  if (!a?.axes) return null;
  return {
    opening: a.axes.opening?.score ?? 0,
    discovery: a.axes.discovery?.score ?? 0,
    active_listening: a.axes.active_listening?.score ?? 0,
    value_articulation: a.axes.value_articulation?.score ?? 0,
    objection_handling: a.axes.objection_handling?.score ?? 0,
    next_steps: a.axes.next_steps?.score ?? 0,
  };
}

function projectMeddic(a: SalesCoachAnalysis | null): MeddicScores | null {
  if (!a?.meddic) return null;
  return {
    metrics: a.meddic.metrics?.score ?? 0,
    economic_buyer: a.meddic.economic_buyer?.score ?? 0,
    decision_criteria: a.meddic.decision_criteria?.score ?? 0,
    decision_process: a.meddic.decision_process?.score ?? 0,
    identify_pain: a.meddic.identify_pain?.score ?? 0,
    champion: a.meddic.champion?.score ?? 0,
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const dealId = searchParams.get("dealId");
  const scope = searchParams.get("scope"); // "mine" | "all"
  const excludeId = searchParams.get("excludeId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5", 10) || 5, 20);

  const { data: userRow } = await db.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = !!userRow?.is_admin;

  let query = db
    .from("sales_coach_analyses")
    .select("id, meeting_title, meeting_started_at, score_global, meeting_kind, analysis")
    .eq("status", "done")
    .order("meeting_started_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (dealId) {
    query = query.eq("hubspot_deal_id", dealId);
  } else if (scope !== "all" || !isAdmin) {
    query = query.eq("user_id", user.id);
  }

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as TrendRow[])
    .reverse() // oldest first for left-to-right timeline
    .map((r) => ({
      id: r.id,
      title: r.meeting_title,
      date: r.meeting_started_at,
      meeting_kind: r.meeting_kind,
      score_global: r.score_global,
      axes: projectAxes(r.analysis),
      meddic: projectMeddic(r.analysis),
    }));

  return NextResponse.json({ trends: rows });
}
