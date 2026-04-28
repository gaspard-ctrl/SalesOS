import type { Config } from "@netlify/functions";

export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!siteUrl || !cronSecret) {
    console.error("[lead-orphan-alerts-bg] missing SITE_URL or CRON_SECRET");
    return;
  }

  try {
    const res = await fetch(`${siteUrl}/api/marketing/leads/orphan-alerts`, {
      method: "POST",
      headers: { "X-Cron-Secret": cronSecret },
    });
    const text = await res.text().catch(() => "");
    console.log("[lead-orphan-alerts-bg]", res.status, text.slice(0, 500));
  } catch (e) {
    console.error("[lead-orphan-alerts-bg] fatal:", e);
  }
};

export const config: Config = {
  schedule: "0 9 * * *", // every day at 9h UTC
};
