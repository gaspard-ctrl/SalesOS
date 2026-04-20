import type { Config } from "@netlify/functions";

export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL;
  const res = await fetch(`${siteUrl}/api/deals/score-all`, {
    method: "POST",
    headers: {
      "X-Cron-Secret": process.env.CRON_SECRET ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ forceAll: false }),
  });

  const data = await res.json().catch(() => null);
  console.log("Score deals result:", res.status, data);
};

export const config: Config = {
  schedule: "0 22 * * 0", // Dimanche 22h UTC
};
