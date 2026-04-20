import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/auth";
import { logUsage } from "@/lib/log-usage";
import { fetchTopPages, fetchKPIs } from "@/lib/google-analytics";
import { fetchKeywords } from "@/lib/google-search-console";
import { fetchAllArticles } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Analysis {
  topPerformers: { title: string; sessions: number; path: string }[];
  risingTrends: { keyword: string; impressions: number; clicks: number; ctr: number; position: number }[];
  contentGaps: { topic: string; rationale: string; targetKeyword: string }[];
  summary: string;
  dataSources: {
    ga4: { ok: boolean; error?: string; pagesCount: number };
    searchConsole: { ok: boolean; error?: string; keywordsCount: number };
    wordpress: { ok: boolean; error?: string; articlesCount: number };
  };
}

interface Recommendation {
  id: string;
  topic: string;
  targetKeyword: string;
  justification: string;
  estimatedTraffic: number;
  difficulty: "easy" | "medium" | "hard";
  priority: "high" | "medium" | "low";
  status: "recommended" | "approved" | "writing" | "published";
}

interface InternalLink {
  anchorText: string;
  targetArticleTitle: string;
  targetUrl: string;
}

interface Draft {
  recommendationId: string;
  content: { fr: string; en: string };
  wordpressFormat: {
    fr: { category: string; tags: string[]; excerpt: string; slug: string };
    en: { category: string; tags: string[]; excerpt: string; slug: string };
  };
  styleMatchScore: number;
  internalLinks: { fr: InternalLink[]; en: InternalLink[] };
}

let analysisResult: Analysis | null = null;
let recommendations: Recommendation[] = [];
const drafts = new Map<string, Draft>();

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return NextResponse.json({
    analysis: analysisResult,
    recommendations,
    drafts: Array.from(drafts.values()),
  });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { action, recommendationId } = body;

  if (action === "analyze") {
    try {
      return await runAnalysis(user.id);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Analysis failed" }, { status: 500 });
    }
  }

  if (action === "approve" && recommendationId) {
    const rec = recommendations.find((r) => r.id === recommendationId);
    if (rec) rec.status = "approved";
    return NextResponse.json({ success: true, recommendations });
  }

  if (action === "reject" && recommendationId) {
    recommendations = recommendations.filter((r) => r.id !== recommendationId);
    return NextResponse.json({ success: true, recommendations });
  }

  if (action === "generate" && recommendationId) {
    try {
      return await runGeneration(user.id, recommendationId);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 500 });
    }
  }

  if (action === "publish" && recommendationId) {
    const rec = recommendations.find((r) => r.id === recommendationId);
    if (rec) rec.status = "published";
    return NextResponse.json({ success: true, recommendations });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ─── Analysis ────────────────────────────────────────────────────────────────

async function runAnalysis(userId: string) {
  // Gather data in parallel
  const [topPagesResult, keywordsResult, articlesResult] = await Promise.allSettled([
    fetchTopPages(userId, 30, 10),
    fetchKeywords(userId, 28, true),
    fetchAllArticles(100),
  ]);

  const topPages = topPagesResult.status === "fulfilled" ? topPagesResult.value : [];
  const keywords = keywordsResult.status === "fulfilled" ? keywordsResult.value : [];
  const articles = articlesResult.status === "fulfilled" ? articlesResult.value : [];

  const ga4Error = topPagesResult.status === "rejected"
    ? (topPagesResult.reason?.message || String(topPagesResult.reason))
    : undefined;
  const scError = keywordsResult.status === "rejected"
    ? (keywordsResult.reason?.message || String(keywordsResult.reason))
    : undefined;
  const wpError = articlesResult.status === "rejected"
    ? (articlesResult.reason?.message || String(articlesResult.reason))
    : undefined;

  // Need at least WordPress + one of GA4 or Search Console
  if (articles.length === 0) {
    return NextResponse.json({
      error: "Cannot analyze: WordPress articles unavailable. " + (wpError || ""),
    }, { status: 400 });
  }
  if (topPages.length === 0 && keywords.length === 0) {
    return NextResponse.json({
      error: "Cannot analyze: both GA4 and Search Console are unavailable. " + [ga4Error, scError].filter(Boolean).join(" | "),
    }, { status: 400 });
  }

  // ── 1. TOP PERFORMERS: directly from GA4, no Claude hallucination ──────────
  const topPerformers = topPages.slice(0, 5).map((p) => ({
    title: p.title || p.path,
    sessions: p.sessions,
    path: p.path,
  }));

  // ── 2. RISING TRENDS: real Search Console keywords sorted by opportunity ───
  // "Rising trend" = high impressions but not yet in top positions (still growing)
  // We pick keywords with >100 impressions and position 4-20 (opportunity zone)
  const risingTrends = keywords
    .filter((k) => k.impressions >= 50 && k.position >= 4 && k.position <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map((k) => ({
      keyword: k.keyword,
      impressions: k.impressions,
      clicks: k.clicks,
      ctr: k.ctr,
      position: k.position,
    }));

  // ── 3. CONTENT GAPS: Claude analyzes based on real data ────────────────────
  // Build a rich prompt with real numbers and real article titles
  const topPerformersText = topPerformers.length > 0
    ? topPerformers.map((p) => `- "${p.title}" — ${p.sessions} sessions`).join("\n")
    : "GA4 data unavailable";

  const topKeywordsText = keywords.length > 0
    ? keywords.slice(0, 30).map((k) => `- "${k.keyword}" — ${k.impressions} impressions, ${k.clicks} clicks, CTR ${k.ctr}%, position ${k.position}`).join("\n")
    : "Search Console data unavailable";

  const articlesText = articles.slice(0, 50).map((a) => `- ${a.title}`).join("\n");

  const prompt = `You are a senior content strategist for Coachello, a B2B leadership coaching platform (human coaches + AI).

I have REAL data. Do NOT invent numbers or facts. Only analyze what is given.

## All published blog articles (${articles.length} articles)
${articlesText}

## Top search queries sending traffic (Google Search Console, last 28 days)
${topKeywordsText}

## Top performing pages (GA4, last 30 days)
${topPerformersText}

---

Task: identify 3 content gaps — article ideas Coachello should write but hasn't.

Criteria:
- Based on the search queries people use vs what Coachello has published
- Each gap must be a SPECIFIC article title, not a generic topic
- Justify each with data from the lists above (cite the exact numbers, e.g. "keyword X has Y impressions")
- Pick a target keyword from the Search Console list for each gap
- Also write a 2-3 sentence summary of the single biggest opportunity

Return ONLY valid JSON:
{
  "contentGaps": [
    {
      "topic": "specific article title",
      "rationale": "data-backed justification citing real numbers from the lists above",
      "targetKeyword": "exact keyword from the Search Console list"
    }
  ],
  "summary": "2-3 sentences"
}`;

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  logUsage(userId, "claude-sonnet-4-6", message.usage.input_tokens, message.usage.output_tokens, "marketing_content_analyze");

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude returned invalid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as { contentGaps: Analysis["contentGaps"]; summary: string };

  analysisResult = {
    topPerformers,
    risingTrends,
    contentGaps: parsed.contentGaps,
    summary: parsed.summary,
    dataSources: {
      ga4: { ok: topPages.length > 0, error: ga4Error, pagesCount: topPages.length },
      searchConsole: { ok: keywords.length > 0, error: scError, keywordsCount: keywords.length },
      wordpress: { ok: articles.length > 0, error: wpError, articlesCount: articles.length },
    },
  };

  // Build recommendations from content gaps
  recommendations = parsed.contentGaps.map((gap, i) => {
    // Find matching keyword for traffic estimate
    const matchedKw = keywords.find((k) => k.keyword === gap.targetKeyword);
    const estimatedTraffic = matchedKw
      ? Math.round(matchedKw.impressions * 0.05) // assume 5% of impressions converting to clicks if we rank well
      : 0;

    return {
      id: `rec-${Date.now()}-${i}`,
      topic: gap.topic,
      targetKeyword: gap.targetKeyword,
      justification: gap.rationale,
      estimatedTraffic,
      difficulty: (["easy", "medium", "hard"] as const)[i % 3],
      priority: i === 0 ? "high" : i === 1 ? "medium" : "low",
      status: "recommended",
    };
  });

  return NextResponse.json({
    analysis: analysisResult,
    recommendations,
  });
}

// ─── Generation ──────────────────────────────────────────────────────────────

async function runGeneration(userId: string, recommendationId: string) {
  const rec = recommendations.find((r) => r.id === recommendationId);
  if (!rec) return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });

  rec.status = "writing";

  const articles = await fetchAllArticles(5);
  if (articles.length === 0) {
    return NextResponse.json({ error: "No WordPress articles available as style reference" }, { status: 400 });
  }

  const styleReference = articles.slice(0, 3).map((a) => {
    return `--- Article: ${a.title} ---\n${a.contentText.slice(0, 2000)}`;
  }).join("\n\n");

  const availableForLinking = articles.map((a) => `- "${a.title}" → ${a.link}`).join("\n");

  const prompt = `You are Coachello's senior content writer. Write a NEW blog article in two languages (French + English).

## Topic
${rec.topic}

## Target keyword
${rec.targetKeyword}

## Data-driven justification (why this article matters)
${rec.justification}

## Style reference — match this tone, structure, and voice
${styleReference}

## Available articles for internal linking (use 2-4 links in EACH language version)
${availableForLinking}

---

Instructions:
- Write the complete article in both French and English (NOT translations, each language adapted)
- Match the tone, structure, headings (H2, H3), bullet lists, and CTA patterns of the style reference
- Natural length: 800-1500 words
- Include 2-4 internal links per language from the available list (natural placement)
- Add a CTA section near the end ("Book a demo with Coachello" pattern)
- Only cite credible industry sources (ICF, PwC, Gartner, HBR, McKinsey) if needed

Return ONLY valid JSON:
{
  "content": {
    "fr": "<h2>...</h2><p>...</p>...",
    "en": "<h2>...</h2><p>...</p>..."
  },
  "wordpressFormat": {
    "fr": {"category": "...", "tags": ["..."], "excerpt": "...", "slug": "..."},
    "en": {"category": "...", "tags": ["..."], "excerpt": "...", "slug": "..."}
  },
  "internalLinks": {
    "fr": [{"anchorText": "...", "targetArticleTitle": "...", "targetUrl": "..."}],
    "en": [{"anchorText": "...", "targetArticleTitle": "...", "targetUrl": "..."}]
  },
  "styleMatchScore": 85
}`;

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  logUsage(userId, "claude-sonnet-4-6", message.usage.input_tokens, message.usage.output_tokens, "marketing_content_generate");

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude returned invalid JSON");

  const parsed = JSON.parse(jsonMatch[0]);
  const draft: Draft = {
    recommendationId: rec.id,
    content: parsed.content,
    wordpressFormat: parsed.wordpressFormat,
    styleMatchScore: parsed.styleMatchScore || 80,
    internalLinks: parsed.internalLinks || { fr: [], en: [] },
  };

  drafts.set(rec.id, draft);

  return NextResponse.json({
    success: true,
    draft,
    recommendations,
  });
}
