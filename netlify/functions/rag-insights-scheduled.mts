import type { Config } from "@netlify/functions";

/**
 * Cron hebdo de RAG Insights (lundi 07:00 UTC).
 *
 * Déclencheur léger : POST vers la Background Function qui fait le travail
 * (analyse LLM de tous les tours neufs + rapport de gaps + recap Slack). On
 * découple pour ne pas tenir la durée d'un scheduled function classique.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!siteUrl || !cronSecret) {
    console.error("[rag-insights-scheduled] missing URL/SITE_URL or CRON_SECRET");
    return;
  }

  try {
    const res = await fetch(`${siteUrl}/.netlify/functions/rag-insights-background`, {
      method: "POST",
      headers: { authorization: `Bearer ${cronSecret}`, "content-type": "application/json" },
      body: JSON.stringify({ sinceDays: 30, sendSlack: true }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok && res.status !== 202) {
      console.error(`[rag-insights-scheduled] trigger HTTP ${res.status}`);
    } else {
      console.log("[rag-insights-scheduled] background triggered");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("aborted") && !msg.includes("timeout")) {
      console.error("[rag-insights-scheduled] trigger failed:", msg);
    }
  }
};

export const config: Config = {
  schedule: "0 7 * * 1", // tous les lundis à 07:00 UTC
};
