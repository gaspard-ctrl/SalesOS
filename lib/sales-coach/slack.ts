import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesCoachAnalysis, MeetingKind } from "@/lib/guides/sales-coach";
import { MEETING_KIND_LABELS, isDiscoveryKind } from "@/lib/guides/sales-coach";
import type { DealSnapshot } from "@/lib/hubspot";

async function slackPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack ${path} → ${data.error}`);
  return data;
}

async function findSlackMemberId(displayName: string): Promise<string | null> {
  const res = await fetch(`https://slack.com/api/users.list?limit=200`, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  const data = await res.json();
  if (!data.ok) return null;

  const needle = displayName.toLowerCase().trim();
  type SlackMember = {
    id: string;
    deleted?: boolean;
    is_bot?: boolean;
    profile?: { real_name?: string; display_name?: string };
  };
  const member = (data.members ?? []).find((m: SlackMember) => {
    if (m.deleted || m.is_bot) return false;
    const realName = (m.profile?.real_name ?? "").toLowerCase();
    const displayNameSlack = (m.profile?.display_name ?? "").toLowerCase();
    return realName.includes(needle) || displayNameSlack.includes(needle);
  });
  return member?.id ?? null;
}

function formatAxisLine(emoji: string, label: string, axis: { score: number; notes: string }): string {
  return `${emoji} *${label} :* ${axis.score}/10 — ${axis.notes}`;
}

function formatAnalysisMessage(args: {
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
}): string {
  const { dealName, dealStage, meetingTitle, meetingStartedAt, meetingKind, scoreGlobal, analysis, appUrl, analysisId, salesName } = args;
  const a = analysis.axes;
  const m = analysis.meddic;
  const b = analysis.bosche;

  const date = meetingStartedAt ? new Date(meetingStartedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
  const kindLabel = meetingKind ? MEETING_KIND_LABELS[meetingKind] : null;

  const hasDealLabel = !!dealName && dealName !== "—";
  const lines: string[] = [
    `:dart: *Debrief de ton meeting${hasDealLabel ? ` — ${dealName}` : ""}*${dealStage ? ` · _${dealStage}_` : ""}`,
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

/**
 * Send the sales coach debrief as a Slack DM to the user who ran the meeting.
 * Returns true if sent, false otherwise (with reason in error_message).
 */
export async function sendSalesCoachSlack(
  db: SupabaseClient,
  analysisId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await db
    .from("sales_coach_analyses")
    .select("id, user_id, hubspot_deal_id, meeting_title, meeting_started_at, meeting_kind, analysis, score_global, deal_snapshot")
    .eq("id", analysisId)
    .single();

  if (!row) return { ok: false, error: "Analysis not found" };
  if (!row.user_id) return { ok: false, error: "No user linked to analysis" };
  if (!row.analysis) return { ok: false, error: "Analysis data missing" };

  const { data: userRow } = await db
    .from("users")
    .select("slack_display_name, name, email")
    .eq("id", row.user_id)
    .single();

  const slackDisplayName = userRow?.slack_display_name?.trim();
  const salesName = (userRow?.name?.trim() || userRow?.email?.trim()) ?? null;
  if (!slackDisplayName) {
    return { ok: false, error: "User has no slack_display_name configured" };
  }

  const memberId = await findSlackMemberId(slackDisplayName);
  if (!memberId) {
    return { ok: false, error: `Slack user "${slackDisplayName}" not found` };
  }

  const dm = await slackPost("/conversations.open", { users: memberId });
  const channel = dm.channel.id;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "";
  const snapshot = row.deal_snapshot as DealSnapshot | null;
  const dealName = snapshot?.name || (row.hubspot_deal_id ? `Deal ${row.hubspot_deal_id}` : "—");
  const dealStage = snapshot?.stage_label ?? null;

  const text = formatAnalysisMessage({
    dealName,
    dealStage,
    meetingTitle: row.meeting_title ?? "Meeting",
    meetingStartedAt: row.meeting_started_at,
    meetingKind: row.meeting_kind as MeetingKind | null,
    scoreGlobal: Number(row.score_global ?? 0),
    analysis: row.analysis as SalesCoachAnalysis,
    appUrl,
    analysisId: row.id,
    salesName,
  });

  await slackPost("/chat.postMessage", { channel, text });

  await db
    .from("sales_coach_analyses")
    .update({ slack_sent_at: new Date().toISOString() })
    .eq("id", analysisId);

  return { ok: true };
}
