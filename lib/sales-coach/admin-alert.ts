/**
 * Slack alert posted when a Claap webhook arrives but no HubSpot deal can be
 * resolved (4-stage resolver came back empty). The analysis is paused with
 * status `awaiting_manual_deal` and the recipient is invited to associate the
 * deal manually from the Sales Coach UI.
 *
 * Routing follows the same env-driven pattern as the meeting recap :
 *  - CLAAP_NOTE_SLACK_MODE=dm (default, test phase) -> DM to
 *    CLAAP_NOTE_SLACK_TEST_USER (defaults to "Arthur Czernichow")
 *  - CLAAP_NOTE_SLACK_MODE=channels (production) -> DM to the Claap recorder
 *    (the sales rep who recorded the meeting)
 */

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
  if (!data.ok) throw new Error(`Slack ${path} -> ${data.error}`);
  return data;
}

async function findDmChannelByDisplayName(displayName: string): Promise<string | null> {
  const res = await fetch(`https://slack.com/api/users.list?limit=200`, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  const data = await res.json();
  if (!data.ok) return null;
  type Member = { id: string; deleted?: boolean; is_bot?: boolean; profile?: { real_name?: string; display_name?: string } };
  const needle = displayName.toLowerCase().trim();
  const member = (data.members ?? []).find((m: Member) => {
    if (m.deleted || m.is_bot) return false;
    const realName = (m.profile?.real_name ?? "").toLowerCase();
    const dn = (m.profile?.display_name ?? "").toLowerCase();
    return realName.includes(needle) || dn.includes(needle);
  });
  if (!member) return null;
  const dm = await slackPost("/conversations.open", { users: member.id });
  return (dm as { channel: { id: string } }).channel.id ?? null;
}

async function findDmChannelByEmail(email: string): Promise<string | null> {
  const res = await fetch(
    `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } },
  );
  const data = await res.json();
  if (!data.ok || !data.user?.id) return null;
  const dm = await slackPost("/conversations.open", { users: data.user.id });
  return (dm as { channel: { id: string } }).channel.id ?? null;
}

export type ManualDealAlertContext = {
  analysisId: string;
  meetingTitle: string | null;
  meetingStartedAt: string | null;
  recorderEmail: string | null;
  participantEmails: string[];
};

export async function sendManualDealAlert(
  ctx: ManualDealAlertContext,
): Promise<{ ok: boolean; destination?: string; error?: string }> {
  if (!process.env.SLACK_BOT_TOKEN) {
    return { ok: false, error: "SLACK_BOT_TOKEN missing" };
  }

  const mode = process.env.CLAAP_NOTE_SLACK_MODE === "channels" ? "channels" : "dm";
  let channelId: string | null = null;
  let destination = "";

  if (mode === "dm") {
    const target = process.env.CLAAP_NOTE_SLACK_TEST_USER || "Arthur Czernichow";
    channelId = await findDmChannelByDisplayName(target);
    destination = `DM(${target})`;
    if (!channelId) return { ok: false, error: `Slack user "${target}" not found` };
  } else {
    if (!ctx.recorderEmail) {
      return { ok: false, error: "No recorder email -- cannot route to recorder in channels mode" };
    }
    channelId = await findDmChannelByEmail(ctx.recorderEmail);
    destination = `DM(${ctx.recorderEmail})`;
    if (!channelId) return { ok: false, error: `Slack user for ${ctx.recorderEmail} not found` };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "";
  const date = ctx.meetingStartedAt
    ? new Date(ctx.meetingStartedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : null;
  const participantsLine = ctx.participantEmails.length > 0
    ? ctx.participantEmails.join(", ")
    : "(aucun participant externe identifié)";

  const lines: string[] = [
    `:warning: *Meeting Claap sans deal HubSpot* — résolution manuelle nécessaire`,
    ``,
    `*Meeting :* ${ctx.meetingTitle ?? "Sans titre"}${date ? ` · ${date}` : ""}`,
    `*Participants externes :* ${participantsLine}`,
  ];
  if (ctx.recorderEmail) {
    lines.push(`*Recorder :* ${ctx.recorderEmail}`);
  }
  if (appUrl) {
    lines.push(``, `<${appUrl}/sales-coach?id=${ctx.analysisId}|Associer un deal et lancer l'analyse →>`);
  }
  const text = lines.join("\n");

  try {
    await slackPost("/chat.postMessage", {
      channel: channelId,
      text,
      unfurl_links: false,
      unfurl_media: false,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return { ok: true, destination };
}
