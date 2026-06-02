import { searchTavily } from "../tavily";
import type { News } from "./types";

// News entreprise via Tavily — simple, agnostic, pas d'enrichissement
// Watchlist. On cherche les actualités récentes sur le
// nom de la company + son industrie (si dispo) sur les 90 derniers jours.

const MAX_RESULTS = 8;
const SEARCH_DAYS = 90;

export async function fetchClientNews(opts: {
  companyName: string;
  industry?: string | null;
}): Promise<News | null> {
  if (!opts.companyName.trim()) return null;
  if (!process.env.TAVILY_API_KEY) {
    console.warn("[clients/news] TAVILY_API_KEY missing — news skipped");
    return null;
  }

  // Query type "Acme Corp news 2026" / "Acme Corp fintech funding hiring acquisition"
  // — on combine entreprise + industrie quand on l'a pour réduire les faux
  // positifs (companies homonymes).
  const queryParts = [`"${opts.companyName}"`, "news"];
  if (opts.industry) queryParts.push(opts.industry);
  queryParts.push("funding OR hiring OR acquisition OR launch");
  const query = queryParts.join(" ");

  const results = await searchTavily(query, {
    days: SEARCH_DAYS,
    maxResults: MAX_RESULTS,
    depth: "basic",
  });

  if (results.length === 0) {
    return {
      refreshed_at: new Date().toISOString(),
      items: [],
    };
  }

  return {
    refreshed_at: new Date().toISOString(),
    items: results.map((r) => ({
      title: r.title,
      url: r.url,
      published_at: r.published_date,
      summary: r.content?.slice(0, 280),
      relevance: r.score,
    })),
  };
}
