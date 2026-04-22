import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { fetchArticleById } from "@/lib/wordpress";
import { fetchArticleStats, fetchTopPages } from "@/lib/google-analytics";

export const dynamic = "force-dynamic";

const WP_API = process.env.WORDPRESS_API_URL || "https://coachello.ai/wp-json/wp/v2";

interface WPPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  author: number;
  featured_media: number;
  categories: number[];
  tags: number[];
}

interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

interface WPMedia {
  id: number;
  source_url: string;
}

let categoriesCache: Map<number, WPCategory> | null = null;
const mediaCacheMap: Map<number, string> = new Map();

async function fetchCategories(): Promise<Map<number, WPCategory>> {
  if (categoriesCache) return categoriesCache;
  try {
    const res = await fetch(`${WP_API}/categories?per_page=100&_fields=id,name,slug,count`);
    if (!res.ok) return new Map();
    const cats: WPCategory[] = await res.json();
    categoriesCache = new Map(cats.map((c) => [c.id, c]));
    return categoriesCache;
  } catch {
    return new Map();
  }
}

async function fetchMediaUrls(ids: number[]): Promise<Map<number, string>> {
  const missing = ids.filter((id) => id > 0 && !mediaCacheMap.has(id));
  if (missing.length > 0) {
    for (let i = 0; i < missing.length; i += 20) {
      const batch = missing.slice(i, i + 20);
      try {
        const res = await fetch(`${WP_API}/media?include=${batch.join(",")}&_fields=id,source_url,alt_text&per_page=20`);
        if (res.ok) {
          const media: WPMedia[] = await res.json();
          media.forEach((m) => mediaCacheMap.set(m.id, m.source_url));
        }
      } catch {
        // skip
      }
    }
  }
  return mediaCacheMap;
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Single article fetch with full content + GA4 stats
  const articleId = req.nextUrl.searchParams.get("id");
  if (articleId) {
    try {
      const article = await fetchArticleById(parseInt(articleId, 10));
      if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

      // Try to fetch stats — non-blocking if GA4 fails (bounded to 5s so a slow GA4 never blocks the article view).
      let stats = null;
      let statsError: string | null = null;
      if (process.env.GA4_PROPERTY_ID) {
        try {
          const pagePath = `/blog/${article.slug}/`;
          const statsPromise = fetchArticleStats(user.id, pagePath, 30).catch((e) => {
            // Swallow late rejection to avoid unhandledRejection if Promise.race times out first.
            console.warn("[marketing/blog] late article stats error:", e instanceof Error ? e.message : String(e));
            return null;
          });
          stats = await Promise.race([
            statsPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);
        } catch (e) {
          statsError = e instanceof Error ? e.message : String(e);
        }
      }

      return NextResponse.json({ article, stats, statsError });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[marketing/blog] single article failed:", msg);
      return NextResponse.json({ error: "Failed to load article", detail: msg }, { status: 500 });
    }
  }

  // List articles (no full content for performance)
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const perPage = parseInt(req.nextUrl.searchParams.get("per_page") || "50", 10);
  const category = req.nextUrl.searchParams.get("category") || "";
  const search = req.nextUrl.searchParams.get("search") || "";
  const sort = req.nextUrl.searchParams.get("sort") || "date";

  // WP-side ordering: "date" sorts at the API level; perf sorts happen after merge.
  const wpOrderBy = sort === "date" ? "date" : "date";
  const params = new URLSearchParams({
    per_page: String(Math.min(perPage, 100)),
    page: String(page),
    orderby: wpOrderBy,
    order: "desc",
    _fields: "id,title,slug,date,excerpt,link,author,featured_media,categories,tags",
  });
  if (category) params.set("categories", category);
  if (search) params.set("search", search);

  try {
    // WP sometimes takes > 30s when starved → bound the call so the endpoint never hangs.
    const res = await fetch(`${WP_API}/posts?${params.toString()}`, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[marketing/blog] WP error", res.status, body.slice(0, 300));
      return NextResponse.json({ error: `WordPress API error: ${res.status}`, detail: body.slice(0, 300) }, { status: 502 });
    }

    const posts: WPPost[] = await res.json();
    const totalPosts = parseInt(res.headers.get("X-WP-Total") || "0", 10);
    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1", 10);

    const mediaIds = posts.map((p) => p.featured_media).filter((id) => id > 0);
    const [categories, mediaMap] = await Promise.all([fetchCategories(), fetchMediaUrls(mediaIds)]);

    // GA4 metrics — best-effort, bounded to 5s so a slow GA4 never blocks the
    // articles list. If it times out, cards show 0 sessions/views.
    const ga4Map = new Map<string, { sessions: number; pageViews: number }>();
    try {
      // Swallow late rejection (the call might still be in flight when the race timeout fires)
      // to avoid unhandledRejection from DOMException when AbortSignal aborts later.
      const topPagesPromise = fetchTopPages(user.id, 30, 200).catch((e) => {
        console.warn("[marketing/blog] late GA4 error:", e instanceof Error ? e.message : String(e));
        return null;
      });
      const topPages = await Promise.race([
        topPagesPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (topPages) {
        for (const p of topPages) {
          const slug = p.path.replace(/^\/blog\//, "").replace(/\/$/, "");
          ga4Map.set(slug, { sessions: p.sessions, pageViews: p.pageViews });
        }
      }
    } catch (e) {
      console.warn("[marketing/blog] GA4 metrics unavailable:", e instanceof Error ? e.message : String(e));
    }

    const articles = posts.map((p) => {
      const ga4 = ga4Map.get(p.slug);
      return {
        id: p.id,
        title: (p.title?.rendered ?? "").replace(/&#038;/g, "&").replace(/&#8217;/g, "'").replace(/&#8211;/g, "–"),
        slug: p.slug,
        date: p.date,
        link: p.link,
        excerpt: (p.excerpt?.rendered ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 200),
        image: mediaMap.get(p.featured_media) || null,
        categories: (p.categories ?? []).map((cid) => categories.get(cid)?.name || "").filter(Boolean),
        categoryIds: p.categories ?? [],
        sessions: ga4?.sessions ?? 0,
        pageViews: ga4?.pageViews ?? 0,
      };
    });

    if (sort === "sessions") articles.sort((a, b) => b.sessions - a.sessions);
    else if (sort === "pageViews") articles.sort((a, b) => b.pageViews - a.pageViews);

    const allCategories = Array.from(categories.values())
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((c) => ({ id: c.id, name: c.name, count: c.count }));

    return NextResponse.json({
      articles,
      totalPosts,
      totalPages,
      currentPage: page,
      categories: allCategories,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[marketing/blog] Unexpected error:", msg);
    return NextResponse.json({ error: "Failed to fetch WordPress articles", detail: msg }, { status: 500 });
  }
}
