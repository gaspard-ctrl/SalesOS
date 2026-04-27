import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getClaapRecording, pickTranscriptUrl, extractExternalParticipants } from "@/lib/claap";
import { resolveDealFromParticipants } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  recordingId?: string;
  hubspotDealId?: string;
  force?: boolean;
};

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!process.env.CLAAP_API_TOKEN) {
    return NextResponse.json({ error: "CLAAP_API_TOKEN not configured" }, { status: 500 });
  }

  const { recordingId, hubspotDealId, force } = (await req.json().catch(() => ({}))) as Body;
  if (!recordingId) return NextResponse.json({ error: "recordingId missing" }, { status: 400 });

  const { data: userRow } = await db.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = !!userRow?.is_admin;

  // Fetch fresh recording (for transcript URL + metadata)
  const rec = await getClaapRecording(recordingId).catch((e) => {
    throw new Error(`Claap fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (!rec) return NextResponse.json({ error: "Recording not found on Claap" }, { status: 404 });

  // Ownership check: user can only backfill their own recordings unless admin
  const recorderEmail = (rec.recorder?.email ?? "").toLowerCase();
  if (!isAdmin && recorderEmail !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Tu ne peux analyser que tes propres meetings" }, { status: 403 });
  }

  const transcriptUrl = pickTranscriptUrl(rec);
  if (!transcriptUrl) return NextResponse.json({ error: "Pas de transcript disponible sur Claap" }, { status: 400 });

  if (rec.meeting?.type !== "external") {
    return NextResponse.json({ error: "Meeting interne — non analysable" }, { status: 400 });
  }

  // Check if already analyzed (idempotency)
  const { data: existing } = await db
    .from("sales_coach_analyses")
    .select("id, status")
    .eq("claap_recording_id", rec.id)
    .maybeSingle();

  if (existing && !force && (existing.status === "done" || existing.status === "analyzing")) {
    return NextResponse.json({ ok: true, id: existing.id, already: existing.status });
  }

  // Resolve user_id from recorder email
  const { data: recorderUser } = await db
    .from("users")
    .select("id")
    .eq("email", recorderEmail)
    .maybeSingle();

  // If user didn't provide a deal ID, try to auto-resolve via participants
  let resolvedDealId: string | null = hubspotDealId?.trim() || null;
  if (!resolvedDealId && recorderEmail) {
    const participantEmails = (rec.meeting?.participants ?? [])
      .map((p) => p.email)
      .filter((e): e is string => !!e);
    resolvedDealId = await resolveDealFromParticipants(participantEmails, recorderEmail).catch((e) => {
      console.warn("[backfill] deal auto-resolve failed:", e);
      return null;
    });
    if (resolvedDealId) {
      console.log(`[backfill] auto-resolved deal ${resolvedDealId} for recording ${rec.id}`);
    }
  }

  const externalParticipants = recorderEmail
    ? extractExternalParticipants(rec.meeting?.participants, recorderEmail)
    : [];

  const baseRow = {
    claap_recording_id: rec.id,
    claap_event_id: null,
    recorder_email: recorderEmail || "unknown",
    hubspot_deal_id: resolvedDealId,
    meeting_title: rec.title ?? null,
    meeting_started_at: rec.meeting?.startingAt ?? rec.createdAt ?? null,
    meeting_type: rec.meeting?.type ?? null,
    participants: externalParticipants.length > 0 ? externalParticipants : null,
    user_id: recorderUser?.id ?? null,
    status: "pending" as const,
    error_message: null,
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: upsertErr } = await db
    .from("sales_coach_analyses")
    .upsert(baseRow, { onConflict: "claap_recording_id" })
    .select("id")
    .single();

  if (upsertErr || !inserted) {
    return NextResponse.json({ error: upsertErr?.message ?? "Insert failed" }, { status: 500 });
  }

  // Trigger the analyzer (fire-and-forget, same pattern as webhook)
  const siteUrl = req.nextUrl.origin;
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret) {
    return NextResponse.json({ error: "INTERNAL_SECRET not configured — can't trigger analyzer" }, { status: 500 });
  }

  void fetch(`${siteUrl}/api/sales-coach/analyze/${inserted.id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({ transcriptUrl }),
  }).catch((e) => console.error("[backfill] trigger fetch failed:", e));

  return NextResponse.json({ ok: true, id: inserted.id });
}
