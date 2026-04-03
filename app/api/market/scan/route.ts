import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logUsage } from "@/lib/log-usage";
import {
  signalScoringTool,
  SIGNAL_ANALYSIS_PROMPT,
  GLOBAL_SCAN_QUERIES,
  buildTargetedQueries,
  deduplicateResults,
  type TavilyResult,
} from "@/lib/signal-scoring";
import { getTargetCompanies, getTargetRoles, LINKEDIN_KEYWORDS } from "@/lib/target-companies";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function searchTavily(query: string, days = 14): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: 8,
        days,
        include_answer: false,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scope: string = body.scope ?? "France";

    const targetCompanies = await getTargetCompanies();
    const targetRoles = await getTargetRoles();

    // ── Phase 1 : Scan GLOBAL (levées, restructurations, expansions) ──────
    const globalQueries = GLOBAL_SCAN_QUERIES.map((q) =>
      q.includes("France") || q.includes("Europe") ? q : `${q} ${scope}`
    );
    const globalResponses = await Promise.allSettled(globalQueries.map((q) => searchTavily(q, 14)));

    const allResults: TavilyResult[] = [];
    const debug: { phase: string; query: string; results: number }[] = [];

    for (let i = 0; i < globalResponses.length; i++) {
      const r = globalResponses[i];
      const count = r.status === "fulfilled" ? r.value.length : 0;
      debug.push({ phase: "global", query: globalQueries[i], results: count });
      if (r.status === "fulfilled") allResults.push(...r.value);
    }

    // ── Phase 2 : Scan CIBLÉ (changements de poste) ──────────────────────
    // Note: les requêtes site:linkedin.com ne fonctionnent pas via Tavily
    // On utilise des requêtes web classiques pour détecter les nominations
    const batchSize = 10;
    const maxTargets = Math.min(targetCompanies.length, 30); // Limiter pour ne pas timeout
    for (let i = 0; i < maxTargets; i += batchSize) {
      const batch = targetCompanies.slice(i, i + batchSize);
      const batchQueries = batch.flatMap((company) =>
        buildTargetedQueries(company, targetRoles, LINKEDIN_KEYWORDS)
      );

      const batchResponses = await Promise.allSettled(
        batchQueries.map((q) => searchTavily(q, 14))
      );

      for (let j = 0; j < batchResponses.length; j++) {
        const r = batchResponses[j];
        const count = r.status === "fulfilled" ? r.value.length : 0;
        debug.push({ phase: "targeted", query: batchQueries[j], results: count });
        if (r.status === "fulfilled") allResults.push(...r.value);
      }
    }

    console.log("[scan] Debug:", JSON.stringify({
      globalQueries: debug.filter((d) => d.phase === "global").length,
      globalResults: debug.filter((d) => d.phase === "global").reduce((s, d) => s + d.results, 0),
      targetedQueries: debug.filter((d) => d.phase === "targeted").length,
      targetedResults: debug.filter((d) => d.phase === "targeted").reduce((s, d) => s + d.results, 0),
      totalRaw: allResults.length,
    }));

    // ── Déduplication + analyse ────────────────────────────────────────────
    const uniqueResults = deduplicateResults(allResults);

    if (uniqueResults.length === 0) {
      return NextResponse.json({
        signals: 0, companies: 0, sources: 0,
        debug: {
          status: "tavily_empty",
          globalResults: debug.filter((d) => d.phase === "global").reduce((s, d) => s + d.results, 0),
          targetedResults: debug.filter((d) => d.phase === "targeted").reduce((s, d) => s + d.results, 0),
          queries: debug,
        },
      });
    }

    const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const sourcesText = uniqueResults
      .map((r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}${r.published_date ? `\nDate: ${r.published_date}` : ""}\n${r.content.slice(0, 400)}`
      )
      .join("\n\n---\n\n");

    // ── Claude analysis with tool use ──────────────────────────────────────
    const { data: modelPrefs } = await db.from("guide_defaults").select("content").eq("key", "model_preferences").single();
    const marketModel = (() => { try { return (JSON.parse(modelPrefs?.content ?? "{}") as Record<string, string>).market ?? "claude-haiku-4-5-20251001"; } catch { return "claude-haiku-4-5-20251001"; } })();

    const targetCompanyList = targetCompanies.slice(0, 50).join(", ");

    const client = new Anthropic();
    const message = await client.messages.create({
      model: marketModel,
      max_tokens: 8192,
      system: SIGNAL_ANALYSIS_PROMPT,
      messages: [{
        role: "user",
        content: `Nous sommes le ${today}.

Voici ${uniqueResults.length} articles collectés.

ENTREPRISES CIBLES (grands comptes) : ${targetCompanyList}...
Pour ces entreprises, les changements de poste RH/L&D/People sont des signaux TRÈS forts (signal_type: "job_change", score 80+).

Pour les autres entreprises, les levées de fonds et restructurations sont les signaux principaux.

Articles :
${sourcesText}

Analyse ces articles et score chaque signal détecté. Utilise l'outil score_signals.`,
      }],
      tools: [signalScoringTool],
      tool_choice: { type: "tool" as const, name: "score_signals" },
    });

    logUsage(user.id, marketModel, message.usage.input_tokens, message.usage.output_tokens, "market_scan");

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || !("input" in toolBlock)) {
      return NextResponse.json({ signals: 0, companies: 0, debug: "no_tool_response", sources: uniqueResults.length });
    }

    const result = toolBlock.input as { signals: {
      company_name: string; signal_type: string; title: string; summary: string;
      signal_date: string | null; source_url: string | null; source_domain: string | null;
      score: number; score_breakdown: Record<string, number>;
      why_relevant: string; suggested_action: string; action_type: string;
    }[] };

    const signals = result.signals ?? [];

    if (signals.length === 0) {
      return NextResponse.json({ signals: 0, companies: 0, debug: "no_signals", sources: uniqueResults.length });
    }

    // ── Store signals ──────────────────────────────────────────────────────
    const companies = [...new Set(signals.map((s) => s.company_name))];

    for (const company of companies) {
      await db.from("market_signals").delete().eq("user_id", user.id).eq("company_name", company);
    }

    const { error: insertError } = await db.from("market_signals").insert(
      signals.map((s) => ({
        user_id: user.id,
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

    if (insertError) {
      console.error("market_signals insert error:", insertError);
      return NextResponse.json({ signals: 0, companies: 0, debug: "db_error", message: insertError.message });
    }

    return NextResponse.json({
      signals: signals.length,
      companies: companies.length,
      sources: uniqueResults.length,
      targetedCompaniesScanned: Math.min(targetCompanies.length, 30),
      avgScore: Math.round(signals.reduce((sum, s) => sum + s.score, 0) / signals.length),
      highPriority: signals.filter((s) => s.score >= 70).length,
      debug: {
        globalResults: debug.filter((d) => d.phase === "global").reduce((s, d) => s + d.results, 0),
        targetedResults: debug.filter((d) => d.phase === "targeted").reduce((s, d) => s + d.results, 0),
        queriesWithResults: debug.filter((d) => d.results > 0).map((d) => ({ query: d.query.slice(0, 80), results: d.results })),
        queriesEmpty: debug.filter((d) => d.results === 0).length,
      },
    });
  } catch (e) {
    console.error("scan route error:", e);
    return NextResponse.json({ signals: 0, companies: 0, debug: "server_error", message: String(e) });
  }
}
