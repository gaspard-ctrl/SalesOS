import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getClaapRecording, pickTranscriptUrl, extractExternalParticipants } from "@/lib/claap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const { data: userRow } = await db.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = !!userRow?.is_admin;

  const { data: row } = await db
    .from("sales_coach_analyses")
    .select("user_id, claap_recording_id, recorder_email, participants")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && row.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!row.claap_recording_id) {
    return NextResponse.json({ error: "No Claap recording linked" }, { status: 400 });
  }

  if (!process.env.CLAAP_API_TOKEN) {
    return NextResponse.json({ error: "CLAAP_API_TOKEN not configured" }, { status: 500 });
  }

  const rec = await getClaapRecording(row.claap_recording_id).catch((e) => {
    throw new Error(`Claap fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (!rec) return NextResponse.json({ error: "Recording not found on Claap" }, { status: 404 });

  const transcriptUrl = pickTranscriptUrl(rec);
  if (!transcriptUrl) return NextResponse.json({ error: "Pas de transcript disponible sur Claap" }, { status: 400 });

  // Backfill participants if missing — Claap is already in hand
  const needsParticipants =
    !row.participants || (Array.isArray(row.participants) && row.participants.length === 0);
  const participants = needsParticipants && row.recorder_email
    ? extractExternalParticipants(rec.meeting?.participants, row.recorder_email)
    : [];

  const resetPayload: Record<string, unknown> = {
    status: "pending",
    error_message: null,
    updated_at: new Date().toISOString(),
  };
  if (participants.length > 0) resetPayload.participants = participants;

  // Reset status to pending so the analyzer processes it again
  await db.from("sales_coach_analyses").update(resetPayload).eq("id", id);

  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret) {
    return NextResponse.json({ error: "INTERNAL_SECRET not configured" }, { status: 500 });
  }

  const siteUrl = req.nextUrl.origin;
  // Await with short timeout: analyzer flips status to "analyzing" immediately,
  // then keeps running on its own 300s budget. Without await, serverless can
  // kill the outbound request before it leaves.
  try {
    const triggerRes = await fetch(`${siteUrl}/api/sales-coach/analyze/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({ transcriptUrl }),
      signal: AbortSignal.timeout(8000),
    });
    if (!triggerRes.ok) {
      const text = await triggerRes.text().catch(() => "");
      console.error(`[reanalyze] trigger non-2xx (${triggerRes.status}):`, text.slice(0, 200));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("aborted") && !msg.includes("timeout")) {
      console.error("[reanalyze] trigger fetch failed:", msg);
    }
  }

  return NextResponse.json({ ok: true });
}
