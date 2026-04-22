import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchLeadMessagesPage, resolveLeadsChannelId } from "@/lib/slack-leads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Slow-leaking deadline: stop fetching new pages a few seconds before the
// platform timeout so the final DB commit has room to finish.
const DEADLINE_MS = 55_000;

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 500 });
  }

  const channelId = await resolveLeadsChannelId();
  if (!channelId) {
    return NextResponse.json({ error: "Slack channel #1a-new-incoming-leads not found" }, { status: 404 });
  }

  const { data: latest, error: latestErr } = await db
    .from("leads")
    .select("slack_ts")
    .order("slack_ts", { ascending: false })
    .limit(1);

  if (latestErr) {
    return NextResponse.json({ error: latestErr.message }, { status: 500 });
  }

  const latestTs = latest?.[0]?.slack_ts ?? null;

  const startedAt = Date.now();
  const userCache = new Map();
  let cursor: string | null = null;
  let totalInserted = 0;
  let complete = false;

  // Slack's conversations.history returns pages in reverse-chronological order.
  // We commit each page before requesting the next so partial progress is
  // preserved if the function times out.
  do {
    if (Date.now() - startedAt > DEADLINE_MS) break;

    const { messages, nextCursor } = await fetchLeadMessagesPage(channelId, latestTs, cursor, userCache);

    if (messages.length > 0) {
      const { error: upsertErr } = await db
        .from("leads")
        .upsert(messages, { onConflict: "slack_ts", ignoreDuplicates: true });
      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message, inserted: totalInserted }, { status: 500 });
      }
      totalInserted += messages.length;
    }

    cursor = nextCursor;
    if (!cursor) complete = true;
  } while (cursor);

  return NextResponse.json({ inserted: totalInserted, complete });
}
