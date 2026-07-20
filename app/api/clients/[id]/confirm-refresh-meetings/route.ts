import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { runClientRefresh } from "@/lib/clients/run-refresh";
import type { ConfirmedRecording, MeetingCandidate } from "@/lib/clients/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/clients/[id]/confirm-refresh-meetings
// Body: { confirmed_ids: string[] }
//
// Résout un popup de confirmation de refresh (nouveau meeting Claap détecté
// lors d'un refresh manuel, cf. runClientRefresh). Les ids listés dans
// confirmed_ids sont gardés parmi pending_refresh_meeting_candidates, le
// reste est décliné DÉFINITIVEMENT (jamais reproposé, jamais utilisé). Relance
// ensuite le refresh, qui cette fois va jusqu'au bout (les candidats ne sont
// plus "nouveaux" : ils sont dans confirmed_claap_recordings ou
// declined_claap_recording_ids).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  let confirmedIds: string[] = [];
  try {
    const body = (await req.json().catch(() => ({}))) as { confirmed_ids?: unknown };
    if (Array.isArray(body.confirmed_ids)) {
      confirmedIds = body.confirmed_ids.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // body invalide -> confirmedIds vide (equivalent à "Ignore all")
  }

  const { data: client, error: clientErr } = await db
    .from("clients")
    .select("id, pending_refresh_meeting_candidates, confirmed_claap_recordings, declined_claap_recording_ids")
    .eq("id", id)
    .single();
  if (clientErr || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const pending: MeetingCandidate[] = Array.isArray(client.pending_refresh_meeting_candidates)
    ? client.pending_refresh_meeting_candidates
    : [];
  if (pending.length === 0) {
    return NextResponse.json({ error: "No pending meeting candidate for this client" }, { status: 404 });
  }

  const confirmedSet = new Set(confirmedIds);
  const confirmed: ConfirmedRecording[] = pending
    .filter((c) => confirmedSet.has(c.recording_id))
    .map((c) => ({
      recording_id: c.recording_id,
      meeting_title: c.meeting_title,
      meeting_started_at: c.meeting_started_at,
      claap_url: c.claap_url,
      added_manually: false,
    }));
  const declinedIds = pending.filter((c) => !confirmedSet.has(c.recording_id)).map((c) => c.recording_id);

  const existingDeclined = Array.isArray(client.declined_claap_recording_ids)
    ? client.declined_claap_recording_ids
    : [];
  const mergedDeclined = Array.from(new Set([...existingDeclined, ...declinedIds]));

  const existingConfirmed = Array.isArray(client.confirmed_claap_recordings)
    ? client.confirmed_claap_recordings
    : [];

  const { error: updErr } = await db
    .from("clients")
    .update({
      confirmed_claap_recordings: [...existingConfirmed, ...confirmed],
      declined_claap_recording_ids: mergedDeclined,
      pending_refresh_meeting_candidates: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const isNetlifyEnv = !!(process.env.NETLIFY || process.env.URL || process.env.DEPLOY_URL);

  if (!isNetlifyEnv) {
    void runClientRefresh(id, user.id, { trigger: "manual" }).catch((e) => {
      console.error(`[clients/confirm-refresh-meetings/${id}] inline run failed:`, e instanceof Error ? e.message : e);
    });
    return NextResponse.json({ ok: true, mode: "inline", confirmed: confirmed.length, declined: declinedIds.length }, { status: 202 });
  }

  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret) {
    return NextResponse.json({ error: "INTERNAL_SECRET missing" }, { status: 500 });
  }

  const triggerUrl = `${req.nextUrl.origin}/.netlify/functions/clients-refresh-background`;
  try {
    const res = await fetch(triggerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
      body: JSON.stringify({ id, userId: user.id, trigger: "manual" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok && res.status !== 202) {
      const text = await res.text().catch(() => "");
      console.error(`[clients/confirm-refresh-meetings/${id}] bg trigger ${res.status}:`, text.slice(0, 200));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("aborted") && !msg.includes("timeout")) {
      console.error(`[clients/confirm-refresh-meetings/${id}] bg trigger failed:`, msg);
    }
  }

  return NextResponse.json({ ok: true, mode: "background", confirmed: confirmed.length, declined: declinedIds.length }, { status: 202 });
}
