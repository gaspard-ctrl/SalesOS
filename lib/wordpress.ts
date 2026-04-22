// WordPress API helpers — fetch articles with full content from ACF Post Builder

const WP_API = process.env.WORDPRESS_API_URL || "https://coachello.ai/wp-json/wp/v2";

interface ACFPostBuilderBlock {
  acf_fc_layout: string;
  text?: string;
}

interface WPPostRaw {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  featured_media: number;
  categories: number[];
  tags: number[];
  acf?: { post_builder?: ACFPostBuilderBlock[] } | [];
}

export interface WPArticle {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  featured_media: number;
  categoryIds: number[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#038;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extract the full article HTML from ACF Post Builder blocks,
 * falling back to the standard content.rendered field.
 */
export function extractArticleContent(post: WPPostRaw): { html: string; text: string } {
  const builder = Array.isArray(post.acf) ? null : post.acf?.post_builder;

  if (builder && builder.length > 0) {
    const html = builder
      .filter((b) => b.acf_fc_layout === "content" && b.text)
      .map((b) => b.text!)
      .join("\n\n");
    if (html) return { html, text: stripHtml(html) };
    // Builder present but no "content" blocks — fall through to content.rendered.
  }

  // Fallback to standard content field
  const html = post.content?.rendered || "";
  return { html, text: stripHtml(html) };
}

/**
 * Fetch all blog articles with full content extracted from ACF Post Builder.
 */
export async function fetchAllArticles(limit = 100): Promise<WPArticle[]> {
  const articles: WPArticle[] = [];
  let page = 1;
  const perPage = 50;

  while (articles.length < limit) {
    const res = await fetch(
      `${WP_API}/posts?per_page=${perPage}&page=${page}&orderby=date&order=desc&_fields=id,title,slug,date,link,excerpt,content,featured_media,categories,tags,acf`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) break;

    const posts: WPPostRaw[] = await res.json();
    if (posts.length === 0) break;

    for (const p of posts) {
      const { html, text } = extractArticleContent(p);
      articles.push({
        id: p.id,
        date: p.date,
        slug: p.slug,
        link: p.link,
        title: decodeEntities(p.title.rendered),
        excerpt: decodeEntities(stripHtml(p.excerpt.rendered)),
        contentHtml: html,
        contentText: text,
        featured_media: p.featured_media,
        categoryIds: p.categories,
      });

      if (articles.length >= limit) break;
    }

    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1", 10);
    if (page >= totalPages) break;
    page++;
  }

  return articles;
}

export interface ArticleTimelineEntry {
  date: string;   // YYYY-MM-DD (publish date)
  id: number;
  title: string;
  link: string;
  slug: string;
}

/**
 * Lightweight fetch of articles published within a date range — returns just
 * date + title + link for each. Used by the marketing overview to place a dot
 * on the traffic chart for every published article.
 */
export async function fetchArticlesTimeline(
  startDate: string,
  endDate: string,
): Promise<ArticleTimelineEntry[]> {
  const entries: ArticleTimelineEntry[] = [];
  const perPage = 50;
  let page = 1;

  const after = `${startDate}T00:00:00`;
  const before = `${endDate}T23:59:59`;

  while (true) {
    const url = `${WP_API}/posts?per_page=${perPage}&page=${page}&orderby=date&order=desc&after=${encodeURIComponent(after)}&before=${encodeURIComponent(before)}&_fields=id,title,date,link,slug`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) break;
    const posts: { id: number; title: { rendered: string }; date: string; link: string; slug: string }[] = await res.json();
    if (posts.length === 0) break;
    for (const p of posts) {
      entries.push({
        date: p.date.slice(0, 10),
        id: p.id,
        title: decodeEntities(p.title.rendered),
        link: p.link,
        slug: p.slug,
      });
    }
    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1", 10);
    if (page >= totalPages) break;
    page++;
  }

  return entries;
}

/**
 * Fetch a single article by ID with full content.
 */
export async function fetchArticleById(id: number): Promise<WPArticle | null> {
  const res = await fetch(
    `${WP_API}/posts/${id}?_fields=id,title,slug,date,link,excerpt,content,featured_media,categories,tags,acf`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!res.ok) return null;

  const post: WPPostRaw = await res.json();
  const { html, text } = extractArticleContent(post);

  return {
    id: post.id,
    date: post.date,
    slug: post.slug,
    link: post.link,
    title: decodeEntities(post.title.rendered),
    excerpt: decodeEntities(stripHtml(post.excerpt.rendered)),
    contentHtml: html,
    contentText: text,
    featured_media: post.featured_media,
    categoryIds: post.categories,
  };
}
