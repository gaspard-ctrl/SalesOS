import type { Context } from "@netlify/functions";
import { runWeeklyPostScrape, collectPostsByUrl, type ScrapeOptions } from "../../lib/marketing/linkedin-posts";

// Background function : scrape des posts LinkedIn propres via Bright Data (datasets,
// plusieurs minutes ; runtime Background Function ~15 min). Met à jour la liste des
// posts (réactions + commentaires) et les marqueurs du graphe Trafic.
//
// Auth : Bearer CRON_SECRET (cron planifié, /api/marketing/posts/refresh ou /collect).
// Body (optionnel) :
//  - ScrapeOptions { syncEvents?, sinceDays?, timeoutMs? } → discovery hebdo (défaut).
//  - { collectUrls: string[] } → collecte directe par URL (rattrapage d'un post raté).
export default async (req: Request, _ctx: Context) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  let scrapeOpts: ScrapeOptions = {};
  let collectUrls: string[] | null = null;
  try {
    const body = ((await req.json()) as ScrapeOptions & { collectUrls?: unknown }) ?? {};
    const { collectUrls: cu, ...rest } = body;
    if (Array.isArray(cu) && cu.length) collectUrls = cu.map(String);
    scrapeOpts = rest;
  } catch {
    /* pas de body → comportement cron hebdo par défaut */
  }

  try {
    if (collectUrls) {
      const res = await collectPostsByUrl(collectUrls);
      console.log("[marketing-posts-scrape-background] collect done:", JSON.stringify(res));
    } else {
      const res = await runWeeklyPostScrape(scrapeOpts);
      console.log("[marketing-posts-scrape-background] scrape done:", JSON.stringify(res));
    }
  } catch (e) {
    console.error("[marketing-posts-scrape-background] unexpected:", e);
  }

  return new Response(null, { status: 200 });
};
