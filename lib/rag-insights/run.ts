/**
 * Orchestration de RAG Insights : collecte -> analyse -> rapport de gaps ->
 * recap Slack (optionnel). Best-effort, ne throw jamais, et laisse toujours
 * rag_insights_meta dans un état terminal (même contrat que
 * lib/ae-activity/build-snapshot.ts).
 */

import { db } from "@/lib/db";
import { analyzeTurns, syncExplicitFeedback } from "./analyze";
import { collectTurns } from "./collect";
import { buildGapReport } from "./gaps";
import { sendRagRecap } from "./slack-recap";
import { fetchAnalyses } from "./stats";

export type RagRefreshResult = {
  ok: boolean;
  collected: number;
  analyzed: number;
  feedbackSynced: number;
  gapsFound: number;
  slackSent: boolean;
  error?: string;
};

async function setMeta(fields: Record<string, unknown>): Promise<void> {
  await db
    .from("rag_insights_meta")
    .update(fields)
    .eq("id", 1)
    .then(undefined, () => {});
}

export async function runRagInsightsRefresh(
  opts: { sinceDays?: number; sendSlack?: boolean } = {},
): Promise<RagRefreshResult> {
  const sinceDays = opts.sinceDays ?? 30;
  const result: RagRefreshResult = {
    ok: false,
    collected: 0,
    analyzed: 0,
    feedbackSynced: 0,
    gapsFound: 0,
    slackSent: false,
  };

  await setMeta({
    status: "running",
    started_at: new Date().toISOString(),
    finished_at: null,
    error_message: null,
  });

  try {
    const turns = await collectTurns({ sinceDays });
    result.collected = turns.length;
    console.log(`[rag-insights] ${turns.length} nouveaux tours à analyser (${sinceDays}j)`);

    result.analyzed = await analyzeTurns(turns);
    result.feedbackSynced = await syncExplicitFeedback(sinceDays);

    // Le rapport de gaps se calcule sur la fenêtre COMPLÈTE (pas seulement les
    // tours neufs) : un trou récurrent doit rester visible tant qu'il persiste.
    const rows = await fetchAnalyses({ sinceDays });
    const periodEnd = new Date().toISOString();
    const periodStart = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
    const report = await buildGapReport({ rows, periodStart, periodEnd });
    result.gapsFound = report?.payload.gaps.length ?? 0;

    if (opts.sendSlack) {
      const recap = await sendRagRecap({ force: true });
      result.slackSent = recap.sent;
      if (!recap.sent) console.log(`[rag-insights] recap non envoyé: ${recap.reason}`);
    }

    result.ok = true;
    await setMeta({
      status: "done",
      finished_at: new Date().toISOString(),
      analyzed_count: result.analyzed,
    });
    console.log(
      `[rag-insights] done: ${result.analyzed} analysés, ${result.gapsFound} gaps, slack=${result.slackSent}`,
    );
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[rag-insights] run failed:", message);
    result.error = message;
    await setMeta({
      status: "error",
      finished_at: new Date().toISOString(),
      error_message: message,
    });
    return result;
  }
}
