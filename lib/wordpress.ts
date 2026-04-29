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
 * Workaround: the WP REST API on coachello.ai returns content.rendered=""
 * because the theme stores the article body in a custom post-meta layer that
 * the REST controller doesn't expose. The public HTML page does render the
 * body inside <div class="blog-inner__main">, so when we need the actual prose
 * (Content Factory style matching) we scrape that wrapper.
 *
 * Keep this strictly opt-in: callers should only invoke fetchArticleBody for
 * the handful of articles they need (e.g. the 3 style references), never in a
 * loop over fetchAllArticles output — that would mean ~100 HTML requests per
 * analysis and bust the 120s route budget.
 *
 * Remove once the WP-side mu-plugin lands and content.rendered is populated.
 */
const articleBodyCache = new Map<
  string,
  { contentHtml: string; contentText: string; cachedAt: number }
>();
const ARTICLE_BODY_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Remove a div whose opening tag matches `openRe` along with all its (possibly
 * nested) children, by walking the <div>/</div> balance from the opening tag.
 * Mutates and returns the resulting HTML string.
 */
function stripBalancedDiv(html: string, openRe: RegExp): string {
  let result = html;
  while (true) {
    const open = result.match(openRe);
    if (!open || open.index === undefined) return result;
    const start = open.index;
    const innerStart = start + open[0].length;
    const tagRe = /<\/?div\b[^>]*>/gi;
    tagRe.lastIndex = innerStart;
    let depth = 1;
    let endIdx = -1;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(result)) !== null) {
      if (m[0].startsWith("</")) {
        depth--;
        if (depth === 0) {
          endIdx = m.index + m[0].length;
          break;
        }
      } else {
        depth++;
      }
    }
    if (endIdx === -1) return result;
    result = result.slice(0, start) + result.slice(endIdx);
  }
}

function extractBlogInnerMain(html: string): { contentHtml: string; contentText: string } {
  const startMatch = html.match(/<div class="blog-inner__main"[^>]*>/);
  if (!startMatch || startMatch.index === undefined) {
    return { contentHtml: "", contentText: "" };
  }
  const innerStart = startMatch.index + startMatch[0].length;

  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = innerStart;
  let depth = 1;
  let endIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0) {
        endIdx = m.index;
        break;
      }
    } else {
      depth++;
    }
  }
  if (endIdx === -1) return { contentHtml: "", contentText: "" };

  let inner = html.slice(innerStart, endIdx);

  // Drop non-prose noise: JSON-LD schema dumped inline, inline styles/SVG icons,
  // the H1 (already in post.title).
  inner = inner.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  inner = inner.replace(/<style\b[\s\S]*?<\/style>/gi, "");
  inner = inner.replace(/<svg\b[\s\S]*?<\/svg>/gi, "");
  inner = inner.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, "");

  // Drop the meta/UI blocks (date, hero image, share, copy-link, back, toc) —
  // each is a top-level <div class="blog-inner__X"> with nested children, so
  // we balance-walk to find the matching close.
  for (const cls of ["date", "img", "social", "copy-link", "back", "aside"]) {
    inner = stripBalancedDiv(
      inner,
      new RegExp(`<div\\s+class="blog-inner__${cls}\\b[^"]*"[^>]*>`, "i"),
    );
  }

  inner = inner.trim();
  const text = stripHtml(inner);
  return { contentHtml: inner, contentText: text };
}

/**
 * Fetch and extract the article body from a Coachello blog post URL.
 * Cached in-memory for ARTICLE_BODY_TTL_MS.
 */
export async function fetchArticleBody(
  link: string,
): Promise<{ contentHtml: string; contentText: string }> {
  const now = Date.now();
  const cached = articleBodyCache.get(link);
  if (cached && now - cached.cachedAt < ARTICLE_BODY_TTL_MS) {
    return { contentHtml: cached.contentHtml, contentText: cached.contentText };
  }

  const res = await fetch(link, {
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
    headers: { Accept: "text/html" },
  });
  if (!res.ok) return { contentHtml: "", contentText: "" };

  const html = await res.text();
  const extracted = extractBlogInnerMain(html);
  articleBodyCache.set(link, { ...extracted, cachedAt: now });
  return extracted;
}

/**
 * Hydrate empty contentHtml/contentText fields on a batch of articles by
 * scraping their public URL in parallel. Skips articles that already have
 * content (e.g. once the WP-side fix lands).
 */
export async function hydrateArticleBodies(articles: WPArticle[]): Promise<void> {
  const targets = articles.filter((a) => !a.contentText && !!a.link);
  if (targets.length === 0) return;
  const results = await Promise.allSettled(targets.map((a) => fetchArticleBody(a.link)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.contentHtml) {
      targets[i].contentHtml = r.value.contentHtml;
      targets[i].contentText = r.value.contentText;
    }
  });
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
