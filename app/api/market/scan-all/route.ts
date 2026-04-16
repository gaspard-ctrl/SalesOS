import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { logUsage } from "@/lib/log-usage";
import {
  signalScoringTool,
  SIGNAL_ANALYSIS_PROMPT,
  GLOBAL_SCAN_QUERIES,
  buildTargetedQueries,
  deduplicateResults,
  type TavilyResult,
} from "@/lib/signal-scoring";
import { getTargetCompanies, getTargetRoles, getAlertConfig, LINKEDIN_KEYWORDS } from "@/lib/target-companies";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function searchTavily(query: string, days = 14): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[tavily] TAVILY_API_KEY manquante");
    return [];
  }
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", max_results: 8, days }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[tavily] ${res.status} pour "${query.slice(0, 60)}": ${text.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch (e) {
    console.error("[tavily] erreur réseau:", e);
    return [];
  }
}

// ── Slack alert helper ──────────────────────────────────────────────────────
async function sendSlackDigest(signals: { company_name: string; title: string; score: number; suggested_action: string; source_url: string | null; source_domain: string | null }[], configuredChannelId?: string | null) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || signals.length === 0) return;

  const channelId = configuredChannelId || null;
  if (!channelId) return;

  const emoji = (score: number) => score >= 70 ? "🟢" : score >= 50 ? "🟡" : "🔴";

  const lines = [
    `🔔 *${signals.length} signal${signals.length > 1 ? "ux" : ""} prioritaire${signals.length > 1 ? "s" : ""} détecté${signals.length > 1 ? "s" : ""}*`,
    "",
    ...signals.slice(0, 5).map((s) =>
      `${emoji(s.score)} *${s.score}/100* — ${s.company_name} : ${s.title}\n→ ${s.suggested_action}${s.source_url ? `\n📰 ${s.source_domain ?? "Source"} — ${s.source_url}` : ""}`
    ),
  ];

  if (signals.length > 5) {
    lines.push("", `_+ ${signals.length - 5} autres signaux dans SalesOS_`);
  }

  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: channelId, text: lines.join("\n") }),
    });
  } catch { /* ignore */ }
}

async function sendSlackDm(slackName: string, signals: { company_name: string; title: string; score: number; suggested_action: string; source_url: string | null; source_domain: string | null }[]) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || signals.length === 0) return;

  try {
    // Find user by name
    const usersRes = await fetch("https://slack.com/api/users.list?limit=200", { headers: { Authorization: `Bearer ${token}` } });
    const usersData = await usersRes.json();
    if (!usersData.ok) return;
    const member = (usersData.members ?? []).find((m: { real_name?: string; profile?: { display_name?: string } }) =>
      m.real_name === slackName || m.profile?.display_name === slackName
    );
    if (!member) return;

    // Open DM
    const dmRes = await fetch("https://slack.com/api/conversations.open", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ users: member.id }),
    });
    const dmData = await dmRes.json();
    if (!dmData.ok) return;

    const emoji = (score: number) => score >= 70 ? "🟢" : score >= 50 ? "🟡" : "🔴";
    const lines = [
      `🔔 *${signals.length} signal${signals.length > 1 ? "ux" : ""} prioritaire${signals.length > 1 ? "s" : ""}*`,
      "",
      ...signals.slice(0, 5).map((s) =>
        `${emoji(s.score)} *${s.score}/100* — ${s.company_name} : ${s.title}\n→ ${s.suggested_action}`
      ),
    ];

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: dmData.channel.id, text: lines.join("\n") }),
    });
  } catch { /* ignore */ }
}

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    let callerUserId: string | null = null;
    if (!isCron) {
      const user = await getAuthenticatedUser();
      if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      callerUserId = user.id;
    }

    const targetCompanies = await getTargetCompanies();
    const targetRoles = await getTargetRoles();

    // ── Phase 1: Scan global ────────────────────────────────────────────
    const globalResponses = await Promise.allSettled(GLOBAL_SCAN_QUERIES.map((q) => searchTavily(q, 14)));
    const allResults: TavilyResult[] = [];
    for (const r of globalResponses) {
      if (r.status === "fulfilled") allResults.push(...r.value);
    }

    // ── Phase 2: Scan ciblé (changements poste + LinkedIn L&D) ────────
    const batchSize = 10;
    for (let i = 0; i < targetCompanies.length; i += batchSize) {
      const batch = targetCompanies.slice(i, i + batchSize);
      const batchQueries = batch.flatMap((company: string) =>
        buildTargetedQueries(company, targetRoles, LINKEDIN_KEYWORDS)
      );
      const batchResponses = await Promise.allSettled(batchQueries.map((q: string) => searchTavily(q, 14)));
      for (const r of batchResponses) {
        if (r.status === "fulfilled") allResults.push(...r.value);
      }
    }

    const uniqueResults = deduplicateResults(allResults);
    if (uniqueResults.length === 0) {
      return NextResponse.json({ signals: 0, companies: 0, users: 0, debug: "tavily_empty" });
    }

    // ── Claude analysis with tool use ──────────────────────────────────────
    const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const sourcesText = uniqueResults
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}${r.published_date ? `\nDate: ${r.published_date}` : ""}\n${r.content.slice(0, 400)}`)
      .join("\n\n---\n\n");

    const { data: modelPrefs } = await db.from("guide_defaults").select("content").eq("key", "model_preferences").single();
    const marketModel = (() => { try { return (JSON.parse(modelPrefs?.content ?? "{}") as Record<string, string>).market ?? "claude-haiku-4-5-20251001"; } catch { return "claude-haiku-4-5-20251001"; } })();

    const client = new Anthropic();
    const message = await client.messages.create({
      model: marketModel,
      max_tokens: 8192,
      system: SIGNAL_ANALYSIS_PROMPT,
      messages: [{
        role: "user",
        content: `Nous sommes le ${today}.\n\nENTREPRISES CIBLES (grands comptes) : ${targetCompanies.slice(0, 50).join(", ")}...\nPour ces entreprises, les changements de poste RH/L&D/People sont des signaux TRÈS forts (signal_type: "job_change", score 80+).\n\nVoici ${uniqueResults.length} articles collectés :\n\n${sourcesText}\n\nAnalyse ces articles et score chaque signal détecté. Utilise l'outil score_signals.`,
      }],
      tools: [signalScoringTool],
      tool_choice: { type: "tool" as const, name: "score_signals" },
    });

    const logUserId = callerUserId ?? "cron";
    if (callerUserId) {
      logUsage(callerUserId, marketModel, message.usage.input_tokens, message.usage.output_tokens, "market_scan_all");
    }

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || !("input" in toolBlock)) {
      return NextResponse.json({ signals: 0, companies: 0, users: 0, debug: "no_tool_response" });
    }

    const result = toolBlock.input as { signals: {
      company_name: string; signal_type: string; title: string; summary: string;
      signal_date: string | null; source_url: string | null; source_domain: string | null;
      score: number; score_breakdown: Record<string, number>;
      why_relevant: string; suggested_action: string; action_type: string;
    }[] };

    const signals = result.signals ?? [];
    if (signals.length === 0) {
      return NextResponse.json({ signals: 0, companies: 0, users: 0, debug: "no_signals" });
    }

    // ── Broadcast to all users ─────────────────────────────────────────────
    const { data: allUsers } = await db.from("users").select("id");
    const userIds = (allUsers ?? []).map((u: { id: string }) => u.id);
    if (userIds.length === 0) return NextResponse.json({ signals: 0, companies: 0, users: 0 });

    const companies = [...new Set(signals.map((s) => s.company_name))];

    await Promise.allSettled(
      userIds.map(async (userId) => {
        await Promise.allSettled(
          companies.map((company) => db.from("market_signals").delete().eq("user_id", userId).eq("company_name", company))
        );
        await db.from("market_signals").insert(
          signals.map((s) => ({
            user_id: userId,
            company_name: s.company_name,
            signal_type: s.signal_type,
            title: s.title,
            summary: s.summary,
            signal_date: s.signal_date ?? null,
            strength: s.score >= 70 ? 3 : s.score >= 40 ? 2 : 1,
            source_url: s.source_url ?? null,
            source_domain: s.source_domain ?? null,
            score: s.score,
            score_breakdown: s.score_breakdown,
            why_relevant: s.why_relevant,
            suggested_action: s.suggested_action,
            action_type: s.action_type,
            is_read: false,
            is_actioned: false,
          }))
        );
      })
    );

    // ── Slack alerts ────────────────────────────────────────────────────
    // 1. Canal partagé (config admin globale)
    const alertConfig = await getAlertConfig();
    let slackSent = false;

    if (alertConfig.enabled !== false) {
      const minScore = alertConfig.min_score ?? 70;
      const highPriority = signals
        .filter((s) => s.score >= minScore)
        .sort((a, b) => b.score - a.score);

      if (highPriority.length > 0) {
        // 1. Canal partagé (seulement si configuré)
        if (alertConfig.slack_channel) {
          await sendSlackDigest(highPriority, alertConfig.slack_channel);
          slackSent = true;
        }

        // 2. Canal privé ou DM (si configuré par l'admin)
        const privateTarget = (alertConfig as { slack_channel_private?: string }).slack_channel_private;
        if (privateTarget) {
          if (privateTarget.startsWith("U")) {
            // It's a user ID — open DM first
            try {
              const dmRes = await fetch("https://slack.com/api/conversations.open", {
                method: "POST",
                headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({ users: privateTarget }),
              });
              const dmData = await dmRes.json();
              if (dmData.ok) await sendSlackDigest(highPriority, dmData.channel.id);
            } catch { /* ignore */ }
          } else {
            await sendSlackDigest(highPriority, privateTarget);
          }
        }

        // 3. DM individuels (pour chaque user qui a activé dm_enabled)
        const { data: usersWithDm } = await db.from("users").select("id, slack_display_name, alert_config").not("alert_config", "is", null);
        for (const u of usersWithDm ?? []) {
          const userAlertCfg = u.alert_config as { dm_enabled?: boolean } | null;
          if (!userAlertCfg?.dm_enabled || !u.slack_display_name) continue;
          await sendSlackDm(u.slack_display_name, highPriority);
        }
      }
    }

    return NextResponse.json({
      signals: signals.length,
      companies: companies.length,
      users: userIds.length,
      slackSent,
    });
  } catch (e) {
    console.error("scan-all error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
