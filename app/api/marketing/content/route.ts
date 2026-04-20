import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/auth";
import { logUsage } from "@/lib/log-usage";
import { fetchTopPages, fetchKPIs } from "@/lib/google-analytics";
import { fetchKeywords } from "@/lib/google-search-console";
import { fetchAllArticles } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// In-memory state for the content factory pipeline
interface Analysis {
  topPerformers: { title: string; sessions: number; trend: number }[];
  risingTrends: { keyword: string; growth: number }[];
  contentGaps: { topic: string; rationale: string }[];
  summary: string;
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
    fetchTopPages(userId, 30, 15),
    fetchKeywords(userId, 28, true),
    fetchAllArticles(100),
  ]);

  const topPages = topPagesResult.status === "fulfilled" ? topPagesResult.value : [];
  const keywords = keywordsResult.status === "fulfilled" ? keywordsResult.value : [];
  const articles = articlesResult.status === "fulfilled" ? articlesResult.value : [];

  // Also get KPIs for trend (current 30d vs previous)
  let trendSummary = "";
  try {
    const kpis = await fetchKPIs(userId, 30);
    const sessionsChange = kpis.previous.sessions === 0 ? 0 : ((kpis.current.sessions - kpis.previous.sessions) / kpis.previous.sessions) * 100;
    trendSummary = `Sessions: ${kpis.current.sessions} (${sessionsChange > 0 ? "+" : ""}${sessionsChange.toFixed(1)}% vs previous 30d)`;
  } catch {
    trendSummary = "Sessions trend unavailable";
  }

  // Check if we have enough data
  if (topPages.length === 0 && keywords.length === 0 && articles.length === 0) {
    return NextResponse.json({
      error: "No data available. Connect Google Analytics, Search Console, and WordPress first.",
    }, { status: 400 });
  }

  // Build prompt for Claude
  const topPagesText = topPages.slice(0, 10).map((p) => `- ${p.title} (${p.sessions} sessions, ${p.pageViews} views) — ${p.path}`).join("\n") || "No GA4 data available";
  const topKeywordsText = keywords.slice(0, 20).map((k) => `- "${k.keyword}" — ${k.impressions} impressions, ${k.clicks} clicks, ${k.ctr}% CTR, position ${k.position}`).join("\n") || "No Search Console data available";
  const articlesText = articles.slice(0, 40).map((a) => `- ${a.title}`).join("\n") || "No articles found";

  const prompt = `You are a senior content strategist for Coachello, a B2B leadership coaching platform that combines human coaches + AI.

Analyze the following real data from the Coachello blog and identify actionable insights.

## Current performance (last 30 days)
${trendSummary}

## Top performing blog pages (GA4)
${topPagesText}

## Top search queries bringing traffic (Google Search Console, last 28 days)
${topKeywordsText}

## All published blog articles
${articlesText}

---

Your task: analyze this data and return a structured JSON with:
1. **topPerformers** (3 items): the articles with the best traffic right now. For each: title, sessions, and an estimated trend % (you can set to 0 if unknown).
2. **risingTrends** (3 items): keyword queries that show opportunity — either high impressions but low CTR, or ranking well but underutilized. Each has a "keyword" and a growth indicator (positive %).
3. **contentGaps** (3 items): topics or angles missing from Coachello's blog based on the keyword queries vs published articles. Each has a "topic" (specific article idea) and a "rationale" (why it matters, based on the data).
4. **summary**: 2-3 sentences summarizing the biggest opportunity right now.

Return ONLY valid JSON, no markdown, no commentary:
{
  "topPerformers": [{"title": "...", "sessions": 0, "trend": 0}],
  "risingTrends": [{"keyword": "...", "growth": 0}],
  "contentGaps": [{"topic": "...", "rationale": "..."}],
  "summary": "..."
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

  const parsed = JSON.parse(jsonMatch[0]) as Analysis;
  analysisResult = parsed;

  // Also auto-generate recommendations based on the analysis
  recommendations = parsed.contentGaps.map((gap, i) => ({
    id: `rec-${Date.now()}-${i}`,
    topic: gap.topic,
    targetKeyword: parsed.risingTrends[i]?.keyword || gap.topic.toLowerCase().slice(0, 40),
    justification: gap.rationale,
    estimatedTraffic: Math.round(500 + Math.random() * 1500),
    difficulty: (["easy", "medium", "hard"] as const)[i % 3],
    priority: i === 0 ? "high" : i === 1 ? "medium" : "low",
    status: "recommended",
  }));

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

  // Fetch top 5 articles to use as style reference
  const articles = await fetchAllArticles(5);
  if (articles.length === 0) {
    return NextResponse.json({ error: "No WordPress articles available as style reference" }, { status: 400 });
  }

  // Build style reference from top articles
  const styleReference = articles.slice(0, 3).map((a) => {
    return `--- Article: ${a.title} ---\n${a.contentText.slice(0, 2000)}`;
  }).join("\n\n");

  // Build available articles for internal linking
  const availableForLinking = articles.map((a) => `- "${a.title}" → ${a.link}`).join("\n");

  const prompt = `You are Coachello's senior content writer. Write a NEW blog article in two languages (French + English).

## Topic
${rec.topic}

## Target keyword
${rec.targetKeyword}

## Data-driven justification
${rec.justification}

## Style reference — match this tone, structure, and voice
${styleReference}

## Available articles for internal linking (use 2-4 links in EACH language version)
${availableForLinking}

---

Instructions:
- Write the complete article in both French and English (NOT translations, each language adapted to its audience)
- Use the same tone, structure, headings style (H2, H3), bullet lists, and CTA patterns as the style reference
- Natural length: 800-1500 words
- Include internal links from the available list — natural placement, 2-4 per language version
- Add a CTA section near the end ("Book a demo with Coachello" pattern)
- Do NOT use mock data or generic statistics — if you cite numbers, make them believable for the coaching industry (ICF, PwC, Gartner are fine sources)

Also propose WordPress metadata for each language (category, 3-5 tags, 150-char excerpt, URL slug).

Return ONLY valid JSON, no markdown:
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
