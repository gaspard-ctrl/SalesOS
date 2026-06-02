/**
 * Client Bright Data partagé — zone SERP + appel /request.
 *
 * La zone SERP `salesos_serp` route vers Google et renvoie le JSON déjà parsé
 * par Bright Data quand l'URL contient `brd_json=1`. Le même endpoint
 * (`https://api.brightdata.com/request`) sert pour tous les verticaux Google
 * (Web, News, Maps, Shopping, Images, Trends) et pour la recherche de profils
 * LinkedIn via `site:linkedin.com/in`.
 */

export const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
export const SERP_ZONE = process.env.BRIGHTDATA_SERP_ZONE || "salesos_serp";
const REQUEST_ENDPOINT = "https://api.brightdata.com/request";

export function authHeaders() {
  return {
    Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export interface SerpResult {
  /** Code HTTP renvoyé par Bright Data. */
  status: number;
  ok: boolean;
  /** Latence de l'appel en millisecondes. */
  ms: number;
  /** Body JSON envoyé à `/request` (pour l'inspecteur de requête). */
  sentBody: Record<string, unknown>;
  /** Réponse Bright Data : JSON Google parsé, ou texte brut si non-JSON. */
  data: unknown;
  /** True si `data` a pu être parsé en JSON. */
  isJson: boolean;
}

/**
 * Appelle la SERP API Bright Data avec une URL Google déjà construite.
 * Ne lève jamais sur un statut HTTP non-2xx : renvoie le détail dans `SerpResult`
 * pour que l'appelant décide quoi en faire (le front lit `data` même en erreur).
 */
export async function fetchSerp(googleUrl: string): Promise<SerpResult> {
  const sentBody = { zone: SERP_ZONE, url: googleUrl, format: "raw" };
  const start = performance.now();
  const res = await fetch(REQUEST_ENDPOINT, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(sentBody),
  });
  const text = await res.text();
  const ms = Math.round(performance.now() - start);

  let data: unknown = text;
  let isJson = false;
  try {
    data = JSON.parse(text);
    isJson = true;
  } catch {
    // garde le texte brut (HTML d'erreur, page non parsée, etc.)
  }

  return { status: res.status, ok: res.ok, ms, sentBody, data, isJson };
}

// ── Veille marché d'une entreprise via Google News (zone SERP) ──────────────
export interface MarketArticle {
  title: string;
  url: string;
  source: string;
  date: string; // libellé renvoyé par Google (ex. "13 oct. 2025", "Il y a 1 semaine")
  excerpt: string;
}

interface GoogleNewsItem {
  title?: string;
  link?: string;
  url?: string;
  source?: string;
  date?: string;
  time?: string;
  description?: string;
  snippet?: string;
}

// Clé de dédup d'un article (hostname + titre normalisé).
function articleKey(a: MarketArticle): string {
  let host = a.url;
  try {
    host = new URL(a.url).hostname.replace(/^www\./, "");
  } catch {
    /* garde l'url brute */
  }
  return `${host}|${a.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80)}`;
}

/**
 * Récupère les actualités marché d'une entreprise via la SERP API (Google News).
 * Lance 2 requêtes en parallèle (actu générale + signaux business) puis dédup.
 * Best-effort : ne lève jamais, renvoie [] si la zone/credits échouent.
 */
export async function fetchCompanyMarketNews(
  company: string,
  opts: { country?: string; lang?: string; since?: string; num?: number } = {},
): Promise<MarketArticle[]> {
  if (!BRIGHTDATA_API_KEY || !company.trim()) return [];

  const country = (opts.country || "fr").toLowerCase();
  const lang = (opts.lang || "fr").toLowerCase();
  const num = opts.num ?? 15;
  // Fenêtre de fraîcheur : 12 derniers mois par défaut.
  const since =
    opts.since ||
    (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().slice(0, 10);
    })();

  const name = `"${company.trim()}"`;
  const signals = `(levée OR "tour de table" OR rachat OR acquisition OR fusion OR nomination OR recrute OR licenciement OR restructuration OR partenariat OR expansion)`;
  const queries = [`${name} after:${since}`, `${name} ${signals} after:${since}`];

  const urls = queries.map(
    (q) =>
      `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=nws&brd_json=1&num=${num}&hl=${lang}&gl=${country}`,
  );

  const results = await Promise.allSettled(urls.map((u) => fetchSerp(u)));

  const seen = new Set<string>();
  const articles: MarketArticle[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value.isJson) continue;
    const data = r.value.data as { news?: GoogleNewsItem[] } | null;
    const news = Array.isArray(data?.news) ? data!.news : [];
    for (const n of news) {
      const url = n.link || n.url || "";
      const title = (n.title || "").trim();
      if (!url || !title) continue;
      const article: MarketArticle = {
        title,
        url,
        source: (n.source || "").trim(),
        date: (n.date || n.time || "").trim(),
        excerpt: (n.description || n.snippet || "").trim(),
      };
      const key = articleKey(article);
      if (seen.has(key)) continue;
      seen.add(key);
      articles.push(article);
    }
  }

  return articles;
}
