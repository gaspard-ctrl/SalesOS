import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { fetchArticleById } from "@/lib/wordpress";

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

  // Single article fetch with full content
  const articleId = req.nextUrl.searchParams.get("id");
  if (articleId) {
    const article = await fetchArticleById(parseInt(articleId, 10));
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    return NextResponse.json({ article });
  }

  // List articles (no full content for performance)
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const perPage = parseInt(req.nextUrl.searchParams.get("per_page") || "50", 10);
  const category = req.nextUrl.searchParams.get("category") || "";
  const search = req.nextUrl.searchParams.get("search") || "";

  const params = new URLSearchParams({
    per_page: String(Math.min(perPage, 100)),
    page: String(page),
    orderby: "date",
    order: "desc",
    _fields: "id,title,slug,date,excerpt,link,author,featured_media,categories,tags",
  });
  if (category) params.set("categories", category);
  if (search) params.set("search", search);

  try {
    const res = await fetch(`${WP_API}/posts?${params.toString()}`);
    if (!res.ok) return NextResponse.json({ error: `WordPress API error: ${res.status}` }, { status: 502 });

    const posts: WPPost[] = await res.json();
    const totalPosts = parseInt(res.headers.get("X-WP-Total") || "0", 10);
    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1", 10);

    const mediaIds = posts.map((p) => p.featured_media).filter((id) => id > 0);
    const [categories, mediaMap] = await Promise.all([fetchCategories(), fetchMediaUrls(mediaIds)]);

    const articles = posts.map((p) => ({
      id: p.id,
      title: p.title.rendered.replace(/&#038;/g, "&").replace(/&#8217;/g, "'").replace(/&#8211;/g, "–"),
      slug: p.slug,
      date: p.date,
      link: p.link,
      excerpt: p.excerpt.rendered.replace(/<[^>]*>/g, "").trim().slice(0, 200),
      image: mediaMap.get(p.featured_media) || null,
      categories: p.categories.map((cid) => categories.get(cid)?.name || "").filter(Boolean),
      categoryIds: p.categories,
    }));

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
  } catch {
    return NextResponse.json({ error: "Failed to fetch WordPress articles" }, { status: 500 });
  }
}
