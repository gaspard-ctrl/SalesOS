import type { Config } from "@netlify/functions";

export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL;
  const res = await fetch(`${siteUrl}/api/competitive/analyze-all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const data = await res.json().catch(() => null);
  console.log("Competitive analysis result:", res.status, data);
};

export const config: Config = {
  schedule: "0 7 * * 1", // Lundi 7h UTC
};
