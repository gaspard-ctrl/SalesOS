import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnySalesCoachAnalysis,
  ClientMeetingKind,
  ClientSalesCoachAnalysis,
  MeetingKind,
  SalesCoachAnalysis,
} from "@/lib/guides/sales-coach";
import {
  CLIENT_MEETING_KIND_LABELS,
  MEETING_KIND_LABELS,
  isClientAnalysis,
  isDiscoveryKind,
} from "@/lib/guides/sales-coach";
import type { DealSnapshot } from "@/lib/hubspot";
import type { Audience } from "./meeting-recap";
import {
  dmRecipient,
  findArthurFallbackRecipient,
  formatTestModeHeader,
  resolveMeetingParticipantRecipients,
  type MeetingRecipient,
} from "./slack-recipients";

function formatAxisLine(emoji: string, label: string, axis: { score: number; notes: string }): string {
  return `${emoji} *${label} :* ${axis.score}/10 — ${axis.notes}`;
}

function formatProspectAnalysis(
  args: {
    dealName: string;
    dealStage: string | null;
    meetingTitle: string;
    meetingStartedAt: string | null;
    meetingKind: MeetingKind | null;
    scoreGlobal: number;
    analysis: SalesCoachAnalysis;
    appUrl: string;
    analysisId: string;
    salesName: string | null;
  },
): string {
  const { dealName, dealStage, meetingTitle, meetingStartedAt, meetingKind, scoreGlobal, analysis, appUrl, analysisId, salesName } = args;
  const a = analysis.axes;
  const m = analysis.meddic;
  const b = analysis.bosche;

  const date = meetingStartedAt ? new Date(meetingStartedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
  const kindLabel = meetingKind ? MEETING_KIND_LABELS[meetingKind] : null;

  const hasDealLabel = !!dealName && dealName !== "—";
  const lines: string[] = [
    `:dart: *DEBRIEF COACHING${hasDealLabel ? ` — ${dealName}` : ""}*${dealStage ? ` · _${dealStage}_` : ""}`,
    `${meetingTitle}${date ? ` · ${date}` : ""}${salesName ? ` · ${salesName}` : ""}${kindLabel ? ` · _${kindLabel}_` : ""}`,
    ``,
    `*Note globale :* ${scoreGlobal}/10`,
  ];
  if (analysis.summary) {
    lines.push(``, `*Points forts / à travailler :*`, analysis.summary);
  }
  if (a) {
    lines.push(
      ``,
      `*6 axes coaching :*`,
      formatAxisLine("•", "Opening", a.opening),
      formatAxisLine("•", "Discovery", a.discovery),
      formatAxisLine("•", "Écoute active", a.active_listening),
      formatAxisLine("•", "Value articulation", a.value_articulation),
      formatAxisLine("•", "Objection handling", a.objection_handling),
      formatAxisLine("•", "Next steps", a.next_steps),
    );
  }
  if (m) {
    lines.push(
      ``,
      `*MEDDIC :*`,
      `M : ${m.metrics.score}/10 — ${m.metrics.notes}`,
      `EB : ${m.economic_buyer.score}/10 — ${m.economic_buyer.notes}`,
      `DC : ${m.decision_criteria.score}/10 — ${m.decision_criteria.notes}`,
      `DP : ${m.decision_process.score}/10 — ${m.decision_process.notes}`,
      `IP : ${m.identify_pain.score}/10 — ${m.identify_pain.notes}`,
      `C  : ${m.champion.score}/10 — ${m.champion.notes}`,
    );
  }

  if (isDiscoveryKind(meetingKind) && b?.trigger_identified) {
    lines.push(
      ``,
      `*BOSCHE — discovery :*`,
      `Trigger détecté : ${b.trigger_identified}`,
      `B : ${b.business.score}/10 — ${b.business.notes}`,
      `O : ${b.organization.score}/10 — ${b.organization.notes}`,
      `S : ${b.skills.score}/10 — ${b.skills.notes}`,
      `C : ${b.consequences.score}/10 — ${b.consequences.notes}`,
      `H.E : ${b.human_economic.score}/10 — ${b.human_economic.notes}`,
      `Exit criteria : ${b.exit_criteria_met ? ":white_check_mark:" : ":x:"}`,
    );
  }

  if ((analysis.coaching_priorities?.length ?? 0) > 0) {
    lines.push(``, `:rocket: *Top priorités pour ton prochain call :*`);
    (analysis.coaching_priorities ?? []).forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }

  if (appUrl) {
    lines.push(``, `<${appUrl}/sales-coach?id=${analysisId}|Voir l'analyse complète →>`);
  }

  return lines.join("\n");
}

function formatClientAnalysis(
  args: {
    dealName: string;
    dealStage: string | null;
    meetingTitle: string;
    meetingStartedAt: string | null;
    meetingKind: ClientMeetingKind | null;
    scoreGlobal: number;
    analysis: ClientSalesCoachAnalysis;
    appUrl: string;
    analysisId: string;
    salesName: string | null;
  },
): string {
  const { dealName, dealStage, meetingTitle, meetingStartedAt, meetingKind, scoreGlobal, analysis, appUrl, analysisId, salesName } = args;
  const a = analysis.axes;
  const ch = analysis.customer_health;

  const date = meetingStartedAt ? new Date(meetingStartedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
  const kindLabel = meetingKind ? CLIENT_MEETING_KIND_LABELS[meetingKind] : null;

  const hasDealLabel = !!dealName && dealName !== "—";
  const lines: string[] = [
    `:handshake: *DEBRIEF CS COACHING — ${hasDealLabel ? dealName : "client"}*${dealStage ? ` · _${dealStage}_` : ""}`,
    `${meetingTitle}${date ? ` · ${date}` : ""}${salesName ? ` · ${salesName}` : ""}${kindLabel ? ` · _${kindLabel}_` : ""}`,
    ``,
    `*Note globale :* ${scoreGlobal}/10`,
  ];
  if (analysis.summary) {
    lines.push(``, `*Synthèse :*`, analysis.summary);
  }
  if (a) {
    lines.push(
      ``,
      `*6 axes coaching CS :*`,
      formatAxisLine("•", "Opening & rapport", a.opening),
      formatAxisLine("•", "Discovery (évolution)", a.discovery),
      formatAxisLine("•", "Écoute active", a.active_listening),
      formatAxisLine("•", "Value reinforcement", a.value_reinforcement),
      formatAxisLine("•", "Expansion discovery", a.expansion_discovery),
      formatAxisLine("•", "Next steps", a.next_steps),
    );
  }
  if (ch) {
    lines.push(
      ``,
      `*Customer Health :*`,
      `• *Relation :* ${ch.relationship}`,
      `• *Adoption :* ${ch.adoption}`,
      `• *Sentiment :* ${ch.sentiment}`,
      `• *Signaux expansion :* ${ch.expansion_signals}`,
      `• *Risk flags :* ${ch.risk_flags}`,
    );
  }

  if ((analysis.coaching_priorities?.length ?? 0) > 0) {
    lines.push(``, `:rocket: *Top priorités pour ton prochain touchpoint :*`);
    (analysis.coaching_priorities ?? []).forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }

  if (appUrl) {
    lines.push(``, `<${appUrl}/sales-coach?id=${analysisId}|Voir l'analyse complète →>`);
  }

  return lines.join("\n");
}

/**
 * Envoie le debrief coaching en DM Slack.
 *
 * - Mode `dm` (test) : DM à Arthur uniquement, préfixé d'un header `🧪 *Test*`
 *   qui montre à qui le DM partirait en mode channels (pour valider le
 *   routing avant la bascule prod).
 * - Mode `channels` (prod) : DM à chaque participant Coachello présent dans
 *   le meeting Claap (même domaine que le recorder). Pas de fallback sur le
 *   deal owner — si la personne n'était pas dans le meeting, elle ne reçoit
 *   pas. Si aucun participant détecté : fallback Arthur.
 *
 * Gated globalement par `SALES_COACH_SLACK_ENABLED` côté run-analysis.
 */
export async function sendSalesCoachSlack(
  db: SupabaseClient,
  analysisId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await db
    .from("sales_coach_analyses")
    .select("id, user_id, hubspot_deal_id, meeting_title, meeting_started_at, meeting_kind, audience, analysis, score_global, deal_snapshot, claap_recording_id, recorder_email")
    .eq("id", analysisId)
    .single();

  if (!row) return { ok: false, error: "Analysis not found" };
  if (!row.analysis) return { ok: false, error: "Analysis data missing" };

  const mode = process.env.CLAAP_NOTE_SLACK_MODE === "channels" ? "channels" : "dm";
  const audience = (row.audience as Audience | null) ?? null;

  // Résout d'abord les participants Coachello du meeting. Utilisé :
  //  - en mode channels : pour DM directement chacun
  //  - en mode dm : juste pour afficher la liste dans le header test
  const meetingParticipants: MeetingRecipient[] = row.claap_recording_id
    ? await resolveMeetingParticipantRecipients(
        row.claap_recording_id,
        row.recorder_email,
      ).catch((e) => {
        console.warn(`[sales-coach/slack/${analysisId}] participant resolution failed:`, e);
        return [] as MeetingRecipient[];
      })
    : [];

  let recipients: MeetingRecipient[];
  let isFallback = false;

  if (mode === "dm") {
    const arthur = await findArthurFallbackRecipient();
    if (!arthur) {
      return { ok: false, error: `Slack user "${process.env.CLAAP_NOTE_SLACK_TEST_USER ?? "Arthur Czernichow"}" not found (mode=dm)` };
    }
    recipients = [arthur];
  } else if (meetingParticipants.length > 0) {
    recipients = meetingParticipants;
  } else {
    const arthur = await findArthurFallbackRecipient();
    if (!arthur) {
      return { ok: false, error: "No Coachello participants in meeting and fallback user not found" };
    }
    recipients = [arthur];
    isFallback = true;
    console.warn(`[sales-coach/slack/${analysisId}] no Coachello participant detected — falling back to Arthur`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "";
  const snapshot = row.deal_snapshot as DealSnapshot | null;
  const dealName = snapshot?.name || (row.hubspot_deal_id ? `Deal ${row.hubspot_deal_id}` : "—");
  const dealStage = snapshot?.stage_label ?? null;

  const rawAnalysis = row.analysis as AnySalesCoachAnalysis;
  const body = isClientAnalysis(rawAnalysis)
    ? formatClientAnalysis({
        dealName,
        dealStage,
        meetingTitle: row.meeting_title ?? "Meeting",
        meetingStartedAt: row.meeting_started_at,
        meetingKind: row.meeting_kind as ClientMeetingKind | null,
        scoreGlobal: Number(row.score_global ?? 0),
        analysis: rawAnalysis,
        appUrl,
        analysisId: row.id,
        salesName: null,
      })
    : formatProspectAnalysis({
        dealName,
        dealStage,
        meetingTitle: row.meeting_title ?? "Meeting",
        meetingStartedAt: row.meeting_started_at,
        meetingKind: row.meeting_kind as MeetingKind | null,
        scoreGlobal: Number(row.score_global ?? 0),
        analysis: rawAnalysis as SalesCoachAnalysis,
        appUrl,
        analysisId: row.id,
        salesName: null,
      });

  // Header test : uniquement en mode dm. En mode channels, on envoie le DM
  // directement aux concernés, pas besoin d'expliquer.
  const text = mode === "dm"
    ? `${formatTestModeHeader({
        theoreticalRecipientEmails: isFallback ? [] : meetingParticipants.map((r) => r.email),
        audience,
        kind: "coaching",
      })}\n\n${body}`
    : body;

  let sentCount = 0;
  const failures: string[] = [];
  for (const r of recipients) {
    try {
      await dmRecipient(r.memberId, text);
      sentCount++;
      console.log(`[sales-coach/slack/${analysisId}] coaching sent to ${r.email} (${r.memberId})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${r.email}: ${msg}`);
      console.warn(`[sales-coach/slack/${analysisId}] coaching send failed for ${r.email}:`, msg);
    }
  }

  if (sentCount === 0) {
    return { ok: false, error: `All recipients failed: ${failures.join("; ")}` };
  }

  await db
    .from("sales_coach_analyses")
    .update({ slack_sent_at: new Date().toISOString() })
    .eq("id", analysisId);

  return { ok: true };
}
