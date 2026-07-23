import type { Config } from "@netlify/functions";

/**
 * Cron hebdo (lundi 06:00 UTC) du refresh du dashboard AE Sales Activity.
 *
 * Déclencheur léger : POST vers la Background Function qui fait le gros du
 * travail (fetch HubSpot + Sheet + Claap + Slack + coaching, plusieurs minutes).
 * On découple pour ne pas tenir la durée d'un scheduled function classique.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!siteUrl || !cronSecret) {
    console.error("[ae-activity-refresh-scheduled] missing URL/SITE_URL or CRON_SECRET");
    return;
  }

  try {
    const res = await fetch(`${siteUrl}/.netlify/functions/ae-activity-refresh-background`, {
      method: "POST",
      headers: { authorization: `Bearer ${cronSecret}`, "content-type": "application/json" },
      body: JSON.stringify({ trigger: "cron" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok && res.status !== 202) {
      console.error(`[ae-activity-refresh-scheduled] trigger HTTP ${res.status}`);
    } else {
      console.log("[ae-activity-refresh-scheduled] background triggered");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("aborted") && !msg.includes("timeout")) {
      console.error("[ae-activity-refresh-scheduled] trigger failed:", msg);
    }
  }
};

export const config: Config = {
  schedule: "0 6 * * 1", // tous les lundis à 06:00 UTC
};
