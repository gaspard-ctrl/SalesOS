import type { Config } from "@netlify/functions";

/**
 * Safety net for the Sales Coach analysis pipeline.
 *
 * The Claap webhook triggers the analysis bg function directly, but a few
 * legitimate failure modes still leave a row in `pending`/`analyzing`:
 *   - Claap delivered the webhook before the transcript was ready (Claap
 *     occasionally fires `recording_added` a few seconds before the transcript
 *     URL is populated).
 *   - Cold start + network hiccup aborted the trigger fetch before the bg
 *     function received it.
 *   - The bg function itself OOM/timed out before flipping status.
 *
 * Every 10 min we scan rows stuck > 5 min and re-trigger them. Idempotent:
 * `runSalesCoachAnalysis` short-circuits if the row is already `done`, and the
 * recover-stuck route also re-fetches a fresh transcript URL from Claap.
 */

export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!siteUrl || !cronSecret) {
    console.error("[sales-coach-recover-stuck] missing URL/SITE_URL or CRON_SECRET");
    return;
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${siteUrl}/api/sales-coach/recover-stuck`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cronSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[sales-coach-recover-stuck] HTTP ${res.status}:`, text.slice(0, 500));
      return;
    }
    console.log(`[sales-coach-recover-stuck] done in ${Date.now() - t0}ms — ${text.slice(0, 300)}`);
  } catch (e) {
    console.error("[sales-coach-recover-stuck] fatal:", e instanceof Error ? e.message : e);
  }
};

export const config: Config = {
  schedule: "*/10 * * * *", // every 10 min
};
