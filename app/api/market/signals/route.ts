import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logUsage } from "@/lib/log-usage";
import {
  signalScoringTool,
  SIGNAL_ANALYSIS_PROMPT,
  deduplicateResults,
  type TavilyResult,
} from "@/lib/signal-scoring";

export const dynamic = "force-dynamic";

async function searchTavily(query: string, days = 14): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", max_results: 8, days }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

// GET — list signals with advanced filters
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const minScore = searchParams.get("minScore");
  const isRead = searchParams.get("isRead");
  const isActioned = searchParams.get("isActioned");
  const limit = parseInt(searchParams.get("limit") ?? "100", 10);

  let query = db
    .from("market_signals")
    .select("*")
    .eq("user_id", user.id)
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) query = query.eq("signal_type", type);
  if (minScore) query = query.gte("score", parseInt(minScore, 10));
  if (isRead === "true") query = query.eq("is_read", true);
  if (isRead === "false") query = query.eq("is_read", false);
  if (isActioned === "true") query = query.eq("is_actioned", true);
  if (isActioned === "false") query = query.eq("is_actioned", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Stats for dashboard
  const allSignals = data ?? [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = allSignals.filter((s) => new Date(s.created_at) >= weekAgo);

  return NextResponse.json({
    signals: allSignals,
    stats: {
      total: allSignals.length,
      thisWeek: thisWeek.length,
      highPriority: allSignals.filter((s) => (s.score ?? 0) >= 70).length,
      actioned: allSignals.filter((s) => s.is_actioned).length,
      actionRate: allSignals.length > 0 ? Math.round((allSignals.filter((s) => s.is_actioned).length / allSignals.length) * 100) : 0,
    },
  });
}

// POST — generate signals for a specific company (with scoring)
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { company } = await req.json();
  if (!company?.trim()) return NextResponse.json({ error: "company manquant" }, { status: 400 });

  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const searches = [
    `${company} actualités 2026`,
    `${company} levée de fonds financement`,
    `${company} recrutement DRH CPO nominations leadership`,
    `${company} expansion partenariat croissance`,
    `${company} restructuration transformation`,
  ];

  const allResultsNested = await Promise.all(searches.map((q) => searchTavily(q, 14)));
  const uniqueResults = deduplicateResults(allResultsNested.flat());

  const sourcesText = uniqueResults.length > 0
    ? uniqueResults.map((r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}${r.published_date ? `\nDate: ${r.published_date}` : ""}\n${r.content.slice(0, 400)}`
      ).join("\n\n---\n\n")
    : "Aucun résultat trouvé.";

  const { data: modelPrefs } = await db.from("guide_defaults").select("content").eq("key", "model_preferences").single();
  const marketModel = (() => { try { return (JSON.parse(modelPrefs?.content ?? "{}") as Record<string, string>).market ?? "claude-haiku-4-5-20251001"; } catch { return "claude-haiku-4-5-20251001"; } })();

  const client = new Anthropic();
  const message = await client.messages.create({
    model: marketModel,
    max_tokens: 4096,
    system: SIGNAL_ANALYSIS_PROMPT,
    messages: [{
      role: "user",
      content: `Nous sommes le ${today}.\n\nEntreprise ciblée : ${company}\n\nSources trouvées :\n${sourcesText}\n\nAnalyse ces sources pour ${company}. Utilise l'outil score_signals.`,
    }],
    tools: [signalScoringTool],
    tool_choice: { type: "tool" as const, name: "score_signals" },
  });

  logUsage(user.id, marketModel, message.usage.input_tokens, message.usage.output_tokens, "market_signals");

  const toolBlock = message.content.find((b) => b.type === "tool_use");
  if (!toolBlock || !("input" in toolBlock)) {
    return NextResponse.json({ signals: 0 });
  }

  const result = toolBlock.input as { signals: {
    company_name: string; signal_type: string; title: string; summary: string;
    signal_date: string | null; source_url: string | null; source_domain: string | null;
    score: number; score_breakdown: Record<string, number>;
    why_relevant: string; suggested_action: string; action_type: string;
  }[] };

  const signals = result.signals ?? [];

  await db.from("market_signals").delete().eq("user_id", user.id).eq("company_name", company);

  if (signals.length > 0) {
    await db.from("market_signals").insert(
      signals.map((s) => ({
        user_id: user.id,
        company_name: s.company_name ?? company,
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
  }

  return NextResponse.json({ signals: signals.length });
}

// PATCH — update signal state (read, actioned)
export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id, is_read, is_actioned } = await req.json();
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  const update: Record<string, boolean> = {};
  if (is_read !== undefined) update.is_read = is_read;
  if (is_actioned !== undefined) update.is_actioned = is_actioned;

  const { error } = await db.from("market_signals").update(update).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
