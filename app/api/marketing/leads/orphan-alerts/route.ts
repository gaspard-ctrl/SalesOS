import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface OrphanRow {
  id: string;
  slack_permalink: string | null;
  author_name: string | null;
  validated_at: string | null;
  posted_at: string;
  analysis: {
    extracted_name: string | null;
    extracted_email: string | null;
    extracted_company: string | null;
    hubspot_deal_id: string | null;
  } | null;
}

async function slackPost(channel: string, text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!data?.ok) throw new Error(`Slack chat.postMessage → ${data?.error ?? "unknown"}`);
}

function formatDigest(orphans: OrphanRow[]): string {
  const lines: string[] = [
    `:warning: *${orphans.length} lead${orphans.length > 1 ? "s" : ""} orphelin${orphans.length > 1 ? "s" : ""}* (validé${orphans.length > 1 ? "s" : ""} il y a plus de 7 jours, sans deal HubSpot associé)`,
    ``,
  ];
  for (const o of orphans) {
    const name = o.analysis?.extracted_name ?? "?";
    const company = o.analysis?.extracted_company ?? "?";
    const email = o.analysis?.extracted_email ?? "?";
    const since = o.validated_at
      ? new Date(o.validated_at).toLocaleDateString("fr-FR")
      : "?";
    const author = o.author_name ?? "?";
    const link = o.slack_permalink ? ` <${o.slack_permalink}|→ Slack>` : "";
    lines.push(`• *${name}* — ${company} — ${email} (validé le ${since} par ${author})${link}`);
  }
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("x-cron-secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channel = process.env.LEADS_ORPHAN_CHANNEL;
  if (!channel) {
    return NextResponse.json({ error: "LEADS_ORPHAN_CHANNEL not set" }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data, error } = await db
    .from("leads")
    .select(
      `id, slack_permalink, author_name, validated_at, posted_at,
       analysis:lead_analyses!leads_last_analysis_id_fkey (
         extracted_name, extracted_email, extracted_company, hubspot_deal_id
       )`,
    )
    .eq("validation_status", "validated")
    .lte("validated_at", cutoff)
    .is("orphan_alerted_at", null)
    .in("analysis_status", ["done", "no_match"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as OrphanRow[];
  const orphans = rows.filter((r) => !r.analysis?.hubspot_deal_id);

  if (orphans.length === 0) {
    return NextResponse.json({ alerted: 0 });
  }

  try {
    await slackPost(channel, formatDigest(orphans));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "slack post failed" },
      { status: 500 },
    );
  }

  await db
    .from("leads")
    .update({ orphan_alerted_at: new Date().toISOString() })
    .in(
      "id",
      orphans.map((o) => o.id),
    );

  return NextResponse.json({ alerted: orphans.length });
}
