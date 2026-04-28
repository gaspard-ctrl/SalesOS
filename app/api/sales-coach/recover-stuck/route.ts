import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getClaapRecording, pickTranscriptUrl } from "@/lib/claap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PENDING_THRESHOLD_MIN = 10;
const ANALYZING_THRESHOLD_MIN = 15;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: userRow } = await db.from("users").select("is_admin").eq("id", user.id).single();
  if (!userRow?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret) {
    return NextResponse.json({ error: "INTERNAL_SECRET not configured" }, { status: 500 });
  }
  if (!process.env.CLAAP_API_TOKEN) {
    return NextResponse.json({ error: "CLAAP_API_TOKEN not configured" }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - PENDING_THRESHOLD_MIN * 60_000).toISOString();
  const { data: candidates } = await db
    .from("sales_coach_analyses")
    .select("id, claap_recording_id, status, updated_at")
    .in("status", ["pending", "analyzing"])
    .lt("updated_at", cutoff);

  const stuck = (candidates ?? []).filter((r) => {
    const ageMin = (Date.now() - new Date(r.updated_at).getTime()) / 60_000;
    return (
      (r.status === "pending" && ageMin > PENDING_THRESHOLD_MIN) ||
      (r.status === "analyzing" && ageMin > ANALYZING_THRESHOLD_MIN)
    );
  });

  const siteUrl = req.nextUrl.origin;
  const recovered: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const row of stuck) {
    if (!row.claap_recording_id) {
      failed.push({ id: row.id, error: "no Claap recording" });
      continue;
    }
    try {
      const rec = await getClaapRecording(row.claap_recording_id);
      const transcriptUrl = rec ? pickTranscriptUrl(rec) : null;
      if (!transcriptUrl) {
        failed.push({ id: row.id, error: "no transcript on Claap" });
        continue;
      }

      await db
        .from("sales_coach_analyses")
        .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
        .eq("id", row.id);

      try {
        await fetch(`${siteUrl}/api/sales-coach/analyze/${row.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
          },
          body: JSON.stringify({ transcriptUrl }),
          signal: AbortSignal.timeout(8000),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("aborted") && !msg.includes("timeout")) throw e;
      }
      recovered.push(row.id);
    } catch (e) {
      failed.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    recovered: recovered.length,
    recoveredIds: recovered,
    failed,
    scanned: stuck.length,
  });
}
