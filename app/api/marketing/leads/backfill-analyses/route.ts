import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { runLeadAnalysis } from "@/lib/lead-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LEADS_SINCE = "2025-01-01T00:00:00Z";

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { limit?: number; force?: boolean; olderThan?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body OK
  }

  const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);
  const force = body.force === true;
  const olderThan = typeof body.olderThan === "string" ? body.olderThan : null;

  // When force=true we re-analyze leads ordered by analyzed_at asc (nulls first),
  // so successive calls progress through the queue. Caller may pass `olderThan`
  // (an ISO timestamp) to only retry leads whose last analysis is older than X.
  let q = db
    .from("leads")
    .select("id, analyzed_at")
    .eq("validation_status", "validated")
    .gte("posted_at", LEADS_SINCE)
    .order("analyzed_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (!force) {
    q = q.is("last_analysis_id", null);
  } else if (olderThan) {
    q = q.or(`analyzed_at.is.null,analyzed_at.lt.${olderThan}`);
  }

  const { data: leads, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (leads ?? []) as Array<{ id: string }>;
  let ok = 0;
  let errors = 0;
  for (const lead of items) {
    try {
      await runLeadAnalysis(lead.id, { userId: user.id });
      ok++;
    } catch (e) {
      console.error(`[backfill ${lead.id}]`, e instanceof Error ? e.message : e);
      errors++;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({ processed: items.length, ok, errors });
}
