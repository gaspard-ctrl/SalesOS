import type { Config } from "@netlify/functions";

/**
 * Cron quotidien des signaux (05:00 UTC).
 *
 * Déclencheur léger : POST vers la Background Function qui fait le gros du travail
 * (sweep complet watchlist + discovery, avec les datasets LinkedIn). On découple
 * pour ne pas tenir la durée d'un scheduled function classique : le sweep enchaîne
 * beaucoup d'appels Claude + scraping, c'est un job long.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!siteUrl || !cronSecret) {
    console.error("[signals-sweep-scheduled] missing URL/SITE_URL or CRON_SECRET");
    return;
  }

  try {
    const res = await fetch(`${siteUrl}/.netlify/functions/signals-sweep-background`, {
      method: "POST",
      headers: { authorization: `Bearer ${cronSecret}`, "content-type": "application/json" },
      body: JSON.stringify({ feed: "both", includeSlowSources: true }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok && res.status !== 202) {
      console.error(`[signals-sweep-scheduled] trigger HTTP ${res.status}`);
    } else {
      console.log("[signals-sweep-scheduled] background triggered");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("aborted") && !msg.includes("timeout")) {
      console.error("[signals-sweep-scheduled] trigger failed:", msg);
    }
  }
};

export const config: Config = {
  schedule: "0 5 * * *", // tous les jours à 05:00 UTC
};
