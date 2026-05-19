import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchDealContext, resolveDealFromParticipants } from "@/lib/hubspot";
import { getClaapRecording, extractTitleSearchHint } from "@/lib/claap";
import { resolveAudience } from "@/lib/sales-coach/meeting-recap";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Fetch the latest HubSpot deal context for an analysis that already has a
// hubspot_deal_id but is missing (or stale) its deal_snapshot. Also recomputes
// the audience (prospect/client) from the fresh snapshot — cheaper than a full
// re-analyze when the deal moved to closed-won / Customer Success after the
// initial analysis.
//
// Self-healing: if the stored dealId is non-numeric (an artifact of older
// webhook runs that trusted Claap's internal id), we wipe it and try to
// re-resolve via participant emails + title (incl. the LLM stage 4) before
// giving up.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const { data: row } = await db
    .from("sales_coach_analyses")
    .select("hubspot_deal_id, claap_recording_id, recorder_email, meeting_title")
    .eq("id", id)
    .single();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!row.hubspot_deal_id) {
    return NextResponse.json({ error: "No deal linked" }, { status: 400 });
  }

  let dealId = row.hubspot_deal_id;

  // Stored dealId looks invalid (non-numeric) — attempt re-resolution before
  // declaring the deal "introuvable". This rescues rows poisoned by Claap's
  // internal deal ids when the meeting title and participants point at a real
  // HubSpot deal.
  if (!/^\d+$/.test(dealId)) {
    console.warn(`[refresh-snapshot/${id}] stored dealId "${dealId}" non-numeric, attempting re-resolve`);
    if (!row.claap_recording_id || !process.env.CLAAP_API_TOKEN) {
      await db.from("sales_coach_analyses").update({ hubspot_deal_id: null }).eq("id", id);
      return NextResponse.json(
        { error: "Stored deal id is invalid and no Claap recording is available to re-resolve.", reason: "invalid_id_no_claap" },
        { status: 400 },
      );
    }
    const rec = await getClaapRecording(row.claap_recording_id).catch((e) => {
      console.warn(`[refresh-snapshot/${id}] Claap fetch failed:`, e instanceof Error ? e.message : e);
      return null;
    });
    const recorderEmail = rec?.recorder?.email ?? row.recorder_email ?? "";
    const participantEmails = (rec?.meeting?.participants ?? [])
      .map((p) => p.email)
      .filter((e): e is string => !!e);
    const titleHint = extractTitleSearchHint(row.meeting_title, recorderEmail);

    const reResolved = recorderEmail
      ? await resolveDealFromParticipants(
          participantEmails,
          recorderEmail,
          titleHint,
          rec?.title ?? row.meeting_title ?? null,
        ).catch((e) => {
          console.warn(`[refresh-snapshot/${id}] re-resolve failed:`, e instanceof Error ? e.message : e);
          return null;
        })
      : null;

    if (!reResolved) {
      await db.from("sales_coach_analyses").update({ hubspot_deal_id: null }).eq("id", id);
      return NextResponse.json(
        { error: "No matching HubSpot deal found for this meeting.", reason: "no_match" },
        { status: 404 },
      );
    }
    console.log(
      `[refresh-snapshot/${id}] re-resolved deal "${reResolved}" replacing invalid "${dealId}"`,
    );
    dealId = reResolved;
    await db.from("sales_coach_analyses").update({ hubspot_deal_id: reResolved }).eq("id", id);
  }

  const snapshot = await fetchDealContext(dealId).catch((e) => {
    throw new Error(`HubSpot fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (!snapshot) {
    return NextResponse.json({ error: "Deal not found on HubSpot" }, { status: 404 });
  }

  const audience = resolveAudience(snapshot);

  const { error: updateErr } = await db
    .from("sales_coach_analyses")
    .update({
      deal_snapshot: snapshot,
      audience,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    snapshot,
    audience,
    pipeline_label: snapshot.pipeline_label,
    stage_label: snapshot.stage_label,
    is_closed_won: snapshot.is_closed_won,
  });
}
