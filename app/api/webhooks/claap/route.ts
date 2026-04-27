import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveDealFromParticipants } from "@/lib/hubspot";
import { extractExternalParticipants } from "@/lib/claap";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

type ClaapParticipant = {
  id?: string;
  name?: string;
  email?: string;
  attended?: boolean;
};

type ClaapRecording = {
  id: string;
  createdAt?: string;
  title?: string;
  meeting?: {
    type?: "external" | "internal";
    startingAt?: string;
    endingAt?: string;
    participants?: ClaapParticipant[];
  };
  deal?: { id?: string; name?: string };
  crmInfo?: { crm?: string };
  transcripts?: { url?: string; textUrl?: string; langIso2?: string; isActive?: boolean }[];
  recorder?: ClaapParticipant;
};

type ClaapPayload = {
  eventId?: string;
  event?: {
    type?: "recording_added" | "recording_updated";
    recording?: ClaapRecording;
  };
};

export async function POST(req: NextRequest) {
  try {
    // ── Signature check (shared secret) ─────────────────────────────────
    const secret = process.env.CLAAP_WEBHOOK_SECRET;
    if (secret) {
      const received = req.headers.get("x-claap-webhook-secret");
      if (received !== secret) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = (await req.json()) as ClaapPayload;
    const evt = payload.event;
    const rec = evt?.recording;

    if (!evt?.type || !rec?.id) {
      return NextResponse.json({ ok: true, ignored: "missing event/recording" });
    }

    // Only process new recordings. Updates would re-trigger analysis — skip them.
    if (evt.type !== "recording_added") {
      return NextResponse.json({ ok: true, ignored: `event type ${evt.type}` });
    }

    // Scope filter: external meeting + linked to a HubSpot deal
    const meetingType = rec.meeting?.type ?? "";
    let dealId = rec.deal?.id ?? null;
    const recorderEmail = rec.recorder?.email ?? "";
    const transcriptUrl = rec.transcripts?.find((t) => t.isActive)?.textUrl ?? rec.transcripts?.[0]?.textUrl ?? null;

    // Fallback: if Claap didn't link a deal, try to resolve via participant emails
    if (!dealId && meetingType === "external" && recorderEmail) {
      const participantEmails = (rec.meeting?.participants ?? [])
        .map((p) => p.email)
        .filter((e): e is string => !!e);
      dealId = await resolveDealFromParticipants(participantEmails, recorderEmail).catch((e) => {
        console.warn("[claap-webhook] deal auto-resolve failed:", e);
        return null;
      });
      if (dealId) {
        console.log(`[claap-webhook] auto-resolved deal ${dealId} for recording ${rec.id}`);
      }
    }

    const shouldSkip =
      meetingType !== "external" ||
      !dealId ||
      !recorderEmail ||
      !transcriptUrl;

    const externalParticipants = recorderEmail
      ? extractExternalParticipants(rec.meeting?.participants, recorderEmail)
      : [];

    const baseRow = {
      claap_recording_id: rec.id,
      claap_event_id: payload.eventId ?? null,
      recorder_email: recorderEmail || "unknown",
      hubspot_deal_id: dealId,
      meeting_title: rec.title ?? null,
      meeting_started_at: rec.meeting?.startingAt ?? null,
      meeting_type: meetingType || null,
      participants: externalParticipants.length > 0 ? externalParticipants : null,
      updated_at: new Date().toISOString(),
    };

    if (shouldSkip) {
      const reason = !dealId
        ? "no_deal"
        : meetingType !== "external"
          ? `meeting_type_${meetingType}`
          : !recorderEmail
            ? "no_recorder_email"
            : "no_transcript";
      await db.from("sales_coach_analyses").upsert(
        { ...baseRow, status: "skipped", error_message: reason },
        { onConflict: "claap_recording_id" },
      );
      return NextResponse.json({ ok: true, skipped: reason });
    }

    // Resolve user_id from recorder email (nullable — user might not exist yet)
    const { data: userRow } = await db
      .from("users")
      .select("id")
      .eq("email", recorderEmail)
      .maybeSingle();

    // Upsert — keyed on claap_recording_id for idempotency against Claap retries
    const { data: inserted, error: insertErr } = await db
      .from("sales_coach_analyses")
      .upsert(
        {
          ...baseRow,
          user_id: userRow?.id ?? null,
          status: "pending",
          error_message: null,
        },
        { onConflict: "claap_recording_id" },
      )
      .select("id, status")
      .single();

    if (insertErr || !inserted) {
      console.error("[claap-webhook] upsert error:", insertErr);
      return NextResponse.json({ error: "Storage error" }, { status: 500 });
    }

    // Fire-and-forget trigger analysis. Pass transcriptUrl so the analyzer doesn't
    // have to re-fetch recording metadata from Claap (textUrl is valid 24h).
    // Use the actual request origin so dev and prod both route back to themselves,
    // instead of accidentally hitting the prod URL from local dev.
    const siteUrl = req.nextUrl.origin;
    const internalSecret = process.env.INTERNAL_SECRET;

    if (siteUrl && internalSecret) {
      // No await — let it run in background. No AbortSignal: we don't await the
      // response, and aborting prematurely would truncate the request body
      // before the analyze endpoint can read it.
      void fetch(`${siteUrl}/api/sales-coach/analyze/${inserted.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({ transcriptUrl }),
      }).catch((e) => console.error("[claap-webhook] trigger fetch failed:", e));
    } else {
      console.warn("[claap-webhook] missing SITE_URL or INTERNAL_SECRET — analysis will not start");
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (e) {
    console.error("[claap-webhook] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
