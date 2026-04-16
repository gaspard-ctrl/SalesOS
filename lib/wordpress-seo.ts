/**
 * SEO Backend scoring — analyses the technical SEO quality of a WordPress article.
 *
 * Score /20 breakdown:
 *   Structure  /5 : heading hierarchy (H1→H3) + word count ≥ 1 000
 *   Meta       /5 : title length 50-60 chars, meta description 120-160 chars, clean slug
 *   Médias     /4 : has images, all images have alt text
 *   Maillage   /3 : internal links (≥ 2) + external links present
 *   Fraîcheur  /3 : last modified within 6 months
 */

const WP_API = process.env.WORDPRESS_API_URL || "https://coachello.ai/wp-json/wp/v2";
const SITE_DOMAIN = "coachello.ai";

// ── WordPress response shapes ────────────────────────────────────────────────

interface WPPostFull {
  id: number;
  slug: string;
  link: string;
  date: string;
  modified: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  yoast_head_json?: {
    title?: string;
    description?: string;
    og_title?: string;
    og_description?: string;
  };
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface SeoBackendDetails {
  score: number;               // 0-20
  structure: number;           // 0-5
  meta: number;                // 0-5
  media: number;               // 0-4
  internalLinking: number;     // 0-3
  freshness: number;           // 0-3
  details: {
    wordCount: number;
    headingsH2: number;
    headingsH3: number;
    titleLength: number;
    metaDescriptionLength: number;
    slugLength: number;
    imageCount: number;
    imagesWithAlt: number;
    imagesWithoutAlt: number;
    internalLinks: number;
    externalLinks: number;
    lastModified: string;
    daysSinceModified: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
}

function countMatches(html: string, regex: RegExp): number {
  return (html.match(regex) || []).length;
}

function extractLinks(html: string): { internal: number; external: number } {
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let internal = 0;
  let external = 0;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];
    if (url.startsWith("#") || url.startsWith("mailto:") || url.startsWith("tel:")) continue;
    if (url.includes(SITE_DOMAIN) || url.startsWith("/")) {
      internal++;
    } else if (url.startsWith("http")) {
      external++;
    }
  }
  return { internal, external };
}

function extractImages(html: string): { total: number; withAlt: number; withoutAlt: number } {
  const imgRegex = /<img[^>]*>/gi;
  const imgs = html.match(imgRegex) || [];
  let withAlt = 0;
  let withoutAlt = 0;
  for (const img of imgs) {
    const altMatch = img.match(/alt=["']([^"']*)["']/i);
    if (altMatch && altMatch[1].trim().length > 0) {
      withAlt++;
    } else {
      withoutAlt++;
    }
  }
  return { total: imgs.length, withAlt, withoutAlt };
}

// ── Scoring functions ────────────────────────────────────────────────────────

function scoreStructure(wordCount: number, h2Count: number, h3Count: number): number {
  let s = 0;
  // Word count: 0-3 pts
  if (wordCount >= 1500) s += 3;
  else if (wordCount >= 1000) s += 2;
  else if (wordCount >= 500) s += 1;
  // H2 headings: 0-1 pt
  if (h2Count >= 2) s += 1;
  // H3 headings (sub-structure): 0-1 pt
  if (h3Count >= 1) s += 1;
  return s; // max 5
}

function scoreMeta(titleLen: number, metaDescLen: number, slugLen: number): number {
  let s = 0;
  // Title length: ideal 50-60 chars → 2 pts; acceptable 30-70 → 1 pt
  if (titleLen >= 50 && titleLen <= 60) s += 2;
  else if (titleLen >= 30 && titleLen <= 70) s += 1;
  // Meta description: ideal 120-160 → 2 pts; acceptable 80-200 → 1 pt
  if (metaDescLen >= 120 && metaDescLen <= 160) s += 2;
  else if (metaDescLen >= 80 && metaDescLen <= 200) s += 1;
  else if (metaDescLen === 0) s += 0; // no meta desc = 0
  // Slug: short & clean ≤ 60 chars → 1 pt
  if (slugLen > 0 && slugLen <= 60) s += 1;
  return s; // max 5
}

function scoreMedia(imageCount: number, imagesWithAlt: number, imagesWithoutAlt: number): number {
  let s = 0;
  // Has images: 0-2 pts
  if (imageCount >= 3) s += 2;
  else if (imageCount >= 1) s += 1;
  // Alt text coverage: 0-2 pts
  if (imageCount > 0) {
    const ratio = imagesWithAlt / imageCount;
    if (ratio === 1) s += 2;
    else if (ratio >= 0.5) s += 1;
  }
  return s; // max 4
}

function scoreInternalLinking(internal: number, external: number): number {
  let s = 0;
  // Internal links: 0-2 pts
  if (internal >= 3) s += 2;
  else if (internal >= 1) s += 1;
  // External links: 0-1 pt
  if (external >= 1) s += 1;
  return s; // max 3
}

function scoreFreshness(daysSinceModified: number): number {
  // Last modified within 3 months → 3, 6 months → 2, 12 months → 1, older → 0
  if (daysSinceModified <= 90) return 3;
  if (daysSinceModified <= 180) return 2;
  if (daysSinceModified <= 365) return 1;
  return 0; // max 3
}

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Fetch a WordPress post by slug and compute its SEO Backend score /20.
 * Returns null if the post cannot be found or the API is unreachable.
 */
export async function computeSeoBackendScore(slug: string): Promise<SeoBackendDetails | null> {
  try {
    const res = await fetch(
      `${WP_API}/posts?slug=${encodeURIComponent(slug)}&_fields=id,slug,link,date,modified,title,content,excerpt,yoast_head_json`,
      { next: { revalidate: 3600 } } // cache 1h
    );
    if (!res.ok) return null;

    const posts: WPPostFull[] = await res.json();
    if (posts.length === 0) return null;

    const post = posts[0];
    const html = post.content.rendered;
    const plainText = stripHtml(html);

    // Extract metrics
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    const h2Count = countMatches(html, /<h2[\s>]/gi);
    const h3Count = countMatches(html, /<h3[\s>]/gi);

    const rawTitle = post.yoast_head_json?.title || stripHtml(post.title.rendered);
    const titleLen = rawTitle.length;
    const rawMetaDesc = post.yoast_head_json?.description || stripHtml(post.excerpt.rendered);
    const metaDescLen = rawMetaDesc.length;
    const slugLen = post.slug.length;

    const images = extractImages(html);
    const links = extractLinks(html);

    const modified = post.modified || post.date;
    const daysSinceModified = Math.floor(
      (Date.now() - new Date(modified).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Compute sub-scores
    const structure = scoreStructure(wordCount, h2Count, h3Count);
    const meta = scoreMeta(titleLen, metaDescLen, slugLen);
    const media = scoreMedia(images.total, images.withAlt, images.withoutAlt);
    const internalLinking = scoreInternalLinking(links.internal, links.external);
    const freshness = scoreFreshness(daysSinceModified);

    return {
      score: structure + meta + media + internalLinking + freshness,
      structure,
      meta,
      media,
      internalLinking,
      freshness,
      details: {
        wordCount,
        headingsH2: h2Count,
        headingsH3: h3Count,
        titleLength: titleLen,
        metaDescriptionLength: metaDescLen,
        slugLength: slugLen,
        imageCount: images.total,
        imagesWithAlt: images.withAlt,
        imagesWithoutAlt: images.withoutAlt,
        internalLinks: links.internal,
        externalLinks: links.external,
        lastModified: modified,
        daysSinceModified,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Batch compute SEO Backend scores for multiple slugs.
 * Returns a Map<slug, SeoBackendDetails>.
 */
export async function computeSeoBackendScores(
  slugs: string[]
): Promise<Map<string, SeoBackendDetails>> {
  const results = new Map<string, SeoBackendDetails>();
  // Run in parallel batches of 5 to avoid overwhelming the WP API
  const batchSize = 5;
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const scores = await Promise.all(batch.map((slug) => computeSeoBackendScore(slug)));
    batch.forEach((slug, idx) => {
      if (scores[idx]) results.set(slug, scores[idx]!);
    });
  }
  return results;
}
