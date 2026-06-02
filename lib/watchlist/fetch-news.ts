import { getCompanyPosts } from "@/lib/brightdata/linkedin";
import { slugifyCompany } from "@/lib/slugify-company";
import { fetchCompanyMarketNews } from "@/lib/brightdata/serp";
import { analyzeMarketNews } from "@/lib/watchlist/analyze-market-news";
import type { NewsContent } from "@/lib/watchlist/briefs";

interface FetchNewsInput {
  scopeCompanyId: string;
  userId: string;
  companyName: string;
}

// Posts LinkedIn via Bright Data (dataset posts, discover by company URL).
// Best-effort : renvoie [] si l'entreprise est introuvable ou si le scrape
// n'aboutit pas à temps (ne lève pas).
async function fetchLinkedInPosts(slug: string): Promise<{ posts: NewsContent["posts"]; creditsUsed: number }> {
  if (!slug) return { posts: [], creditsUsed: 0 };
  const res = await getCompanyPosts(slug, { timeoutMs: 25_000 });
  const posts = res.data ?? [];
  return { posts, creditsUsed: posts.length > 0 ? 1 : 0 };
}

/**
 * Fetch des news pour un compte Watch List :
 * - posts LinkedIn récents via Bright Data getCompanyPosts (dataset, discover by URL)
 * - veille marché (presse) via la SERP API Bright Data (Google News), catégorisée
 *   et synthétisée par Claude → `signals` + `intel_summary`.
 *
 * Les deux sources tournent en parallèle. La veille Bright Data est best-effort :
 * un échec (zone/credits/API) ne fait pas planter la brief, on garde les posts.
 */
export async function fetchWatchlistNews(input: FetchNewsInput): Promise<NewsContent> {
  const { companyName, userId } = input;
  const slug = slugifyCompany(companyName);

  // Veille marché (SERP) et posts LinkedIn (dataset) en parallèle, tous deux
  // best-effort via Bright Data (ne lèvent pas).
  const marketPromise = fetchCompanyMarketNews(companyName).catch(() => []);
  const { posts, creditsUsed } = await fetchLinkedInPosts(slug);

  const articles = await marketPromise;
  const intel = await analyzeMarketNews(articles, { companyName, userId });

  return {
    posts,
    signals: intel.signals,
    intel_summary: intel.summary,
    fetched_at: new Date().toISOString(),
    credits_used: creditsUsed,
  };
}
