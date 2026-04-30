import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/auth";
import { logUsage } from "@/lib/log-usage";
import { db } from "@/lib/db";
import { fetchTopPages } from "@/lib/google-analytics";
import { fetchKeywords } from "@/lib/google-search-console";
import { fetchAllArticles, hydrateArticleBodies } from "@/lib/wordpress";
import { classifyKeywords } from "@/lib/keyword-relevance";
import { BUSINESS_CONTEXT_PROMPT_BLOCK } from "@/lib/business-context";
import type { Keyword, KeywordRelevance } from "@/lib/marketing-types";

const ANALYSIS_MODEL = "claude-haiku-4-5-20251001";

/**
 * GSC returns rows keyed by (query, page), so the same keyword can appear on
 * multiple pages. Collapse to one row per keyword: sum impressions/clicks,
 * recompute CTR, keep the best (lowest) position.
 */
function dedupeKeywords(keywords: Keyword[]): Keyword[] {
  const byKeyword = new Map<string, Keyword>();
  for (const k of keywords) {
    const key = k.keyword.trim().toLowerCase();
    const existing = byKeyword.get(key);
    if (!existing) {
      byKeyword.set(key, { ...k });
      continue;
    }
    existing.impressions += k.impressions;
    existing.clicks += k.clicks;
    existing.position = Math.min(existing.position, k.position);
    existing.ctr = existing.impressions > 0
      ? Math.round((existing.clicks / existing.impressions) * 1000) / 10
      : 0;
  }
  return Array.from(byKeyword.values());
}

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

interface ArticleAuthor {
  name: string | null;
  email: string;
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
  relevanceScore?: number;
  relevanceReason?: string;
  relevanceCategory?: "relevant" | "partial" | "irrelevant";
  createdAt?: string;
  author?: ArticleAuthor | null;
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
  author?: ArticleAuthor | null;
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function loadAnalysis(userId: string): Promise<Analysis | null> {
  const { data } = await db
    .from("marketing_content_analysis")
    .select("analysis")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.analysis as Analysis) ?? null;
}

async function saveAnalysis(userId: string, analysis: Analysis): Promise<void> {
  await db
    .from("marketing_content_analysis")
    .upsert({ user_id: userId, analysis, created_at: new Date().toISOString() }, { onConflict: "user_id" });
}

interface DbRec {
  id: string;
  user_id: string;
  topic: string;
  target_keyword: string;
  justification: string | null;
  estimated_traffic: number | null;
  difficulty: string | null;
  priority: string | null;
  status: string;
  relevance_score: number | null;
  relevance_reason: string | null;
  created_at: string;
}

const REC_SELECT =
  "id, user_id, topic, target_keyword, justification, estimated_traffic, difficulty, priority, status, relevance_score, relevance_reason, created_at";

async function fetchAuthors(userIds: string[]): Promise<Map<string, ArticleAuthor>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await db.from("users").select("id, name, email").in("id", unique);
  const m = new Map<string, ArticleAuthor>();
  for (const u of (data ?? []) as { id: string; name: string | null; email: string }[]) {
    m.set(u.id, { name: u.name, email: u.email });
  }
  return m;
}

function mapDbRec(r: DbRec): Recommendation {
  return {
    id: r.id,
    topic: r.topic,
    targetKeyword: r.target_keyword,
    justification: r.justification ?? "",
    estimatedTraffic: r.estimated_traffic ?? 0,
    difficulty: (r.difficulty as Recommendation["difficulty"]) ?? "medium",
    priority: (r.priority as Recommendation["priority"]) ?? "medium",
    status: (r.status as Recommendation["status"]) ?? "recommended",
    relevanceScore: r.relevance_score ?? undefined,
    relevanceReason: r.relevance_reason ?? undefined,
    createdAt: r.created_at,
  };
}

async function loadRecommendations(): Promise<Recommendation[]> {
  // Global read: all users see all recommendations across the team.
  const { data } = await db
    .from("marketing_content_recommendations")
    .select(REC_SELECT)
    .order("created_at", { ascending: false });

  const rows = (data as DbRec[] | null) ?? [];
  const authors = await fetchAuthors(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    ...mapDbRec(r),
    createdAt: r.created_at,
    author: authors.get(r.user_id) ?? null,
  }));
}

async function saveRecommendations(userId: string, recs: Recommendation[]): Promise<Recommendation[]> {
  // Delete old pending ones (keep approved/published)
  await db
    .from("marketing_content_recommendations")
    .delete()
    .eq("user_id", userId)
    .in("status", ["recommended"]);

  if (recs.length === 0) return [];

  const rows = recs.map((r) => ({
    user_id: userId,
    topic: r.topic,
    target_keyword: r.targetKeyword,
    justification: r.justification,
    estimated_traffic: r.estimatedTraffic,
    difficulty: r.difficulty,
    priority: r.priority,
    status: r.status,
    relevance_score: r.relevanceScore ?? null,
    relevance_reason: r.relevanceReason ?? null,
  }));

  const { data } = await db
    .from("marketing_content_recommendations")
    .insert(rows)
    .select(REC_SELECT);

  return ((data as DbRec[] | null) ?? []).map(mapDbRec);
}

async function updateRecStatus(recId: string, status: Recommendation["status"]): Promise<void> {
  // Writes are global (team-wide): any authenticated user can transition status.
  await db
    .from("marketing_content_recommendations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", recId);
}

async function deleteRec(recId: string): Promise<void> {
  await db
    .from("marketing_content_recommendations")
    .delete()
    .eq("id", recId);
}

async function deleteDraftsForRec(recId: string): Promise<void> {
  await db
    .from("marketing_content_drafts")
    .delete()
    .eq("recommendation_id", recId);
}

async function getRec(recId: string): Promise<Recommendation | null> {
  const { data } = await db
    .from("marketing_content_recommendations")
    .select(REC_SELECT)
    .eq("id", recId)
    .maybeSingle();
  if (!data) return null;
  return mapDbRec(data as DbRec);
}

interface DbDraft {
  user_id: string;
  recommendation_id: string | null;
  content: Draft["content"];
  wordpress_format: Draft["wordpressFormat"];
  internal_links: Draft["internalLinks"] | null;
  style_match_score: number | null;
}

async function loadDrafts(): Promise<Draft[]> {
  // Global read: drafts from all users.
  const { data } = await db
    .from("marketing_content_drafts")
    .select("user_id, recommendation_id, content, wordpress_format, internal_links, style_match_score")
    .order("created_at", { ascending: false });

  const rows = (data as DbDraft[] | null) ?? [];
  const authors = await fetchAuthors(rows.map((d) => d.user_id));
  return rows.map((d) => ({
    recommendationId: d.recommendation_id ?? "",
    content: d.content,
    wordpressFormat: d.wordpress_format,
    internalLinks: d.internal_links ?? { fr: [], en: [] },
    styleMatchScore: d.style_match_score ?? 0,
    author: authors.get(d.user_id) ?? null,
  }));
}

async function saveDraft(userId: string, rec: Recommendation, draft: Draft, structureNotes?: string): Promise<void> {
  await db.from("marketing_content_drafts").insert({
    user_id: userId,
    recommendation_id: rec.id,
    topic: rec.topic,
    target_keyword: rec.targetKeyword,
    content: draft.content,
    wordpress_format: draft.wordpressFormat,
    internal_links: draft.internalLinks,
    style_match_score: draft.styleMatchScore,
    structure_notes: structureNotes ?? null,
  });
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [analysis, recommendations, drafts] = await Promise.all([
    loadAnalysis(user.id),
    loadRecommendations(),
    loadDrafts(),
  ]);

  return NextResponse.json({ analysis, recommendations, drafts });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { action, recommendationId } = body;

  if ((action === "analyze" || action === "suggest_theme" || action === "generate") && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Set ANTHROPIC_API_KEY in your environment to use the Content Factory." },
      { status: 503 },
    );
  }

  if (action === "analyze") {
    try {
      return await runAnalysis(user.id);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Analysis failed" }, { status: 500 });
    }
  }

  if (action === "suggest_theme") {
    const theme = (body.theme || "").toString().trim();
    if (!theme) return NextResponse.json({ error: "Theme is required" }, { status: 400 });
    try {
      return await runThemeSuggestion(user.id, theme);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Theme suggestion failed" }, { status: 500 });
    }
  }

  if (action === "approve" && recommendationId) {
    await updateRecStatus(recommendationId, "approved");
    const recs = await loadRecommendations();
    return NextResponse.json({ success: true, recommendations: recs });
  }

  if (action === "reject" && recommendationId) {
    await deleteRec(recommendationId);
    const recs = await loadRecommendations();
    return NextResponse.json({ success: true, recommendations: recs });
  }

  if (action === "delete" && recommendationId) {
    await deleteDraftsForRec(recommendationId);
    await deleteRec(recommendationId);
    const [recs, drafts] = await Promise.all([
      loadRecommendations(),
      loadDrafts(),
    ]);
    return NextResponse.json({ success: true, recommendations: recs, drafts });
  }

  // Drop the generated draft and put the recommendation back to "approved" so
  // the user can rewrite without losing the recommendation itself.
  if (action === "delete_draft" && recommendationId) {
    await deleteDraftsForRec(recommendationId);
    await updateRecStatus(recommendationId, "approved");
    const [recs, drafts] = await Promise.all([
      loadRecommendations(),
      loadDrafts(),
    ]);
    return NextResponse.json({ success: true, recommendations: recs, drafts });
  }

  if (action === "generate" && recommendationId) {
    try {
      return await runGeneration(user.id, recommendationId);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 500 });
    }
  }

  if (action === "publish" && recommendationId) {
    await updateRecStatus(recommendationId, "published");
    const recs = await loadRecommendations();
    return NextResponse.json({ success: true, recommendations: recs });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ─── Analysis ────────────────────────────────────────────────────────────────

async function runAnalysis(userId: string) {
  // Gather data in parallel
  const [topPagesResult, keywordsResult, articlesResult] = await Promise.allSettled([
    fetchTopPages(userId, 30, 10),
    fetchKeywords(userId, 28, true),
    fetchAllArticles(5000),
  ]);

  const topPages = topPagesResult.status === "fulfilled" ? topPagesResult.value : [];
  const rawKeywords = keywordsResult.status === "fulfilled" ? keywordsResult.value : [];
  const keywords = dedupeKeywords(rawKeywords);
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

  // ── Classify keywords by business relevance (cache-backed) ─────────────────
  // Only classify the top-impressions slice — classifying all 500 GSC rows would
  // exceed the 120s route timeout on first run. 150 is enough: we only surface
  // the top ~30 eligible downstream.
  const CLASSIFY_TOP_N = 150;
  const keywordsToClassify = [...keywords]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, CLASSIFY_TOP_N);
  const relevanceMap = keywordsToClassify.length > 0
    ? await classifyKeywords(userId, keywordsToClassify)
    : new Map<string, KeywordRelevance>();
  const relOf = (kw: string) => relevanceMap.get(kw.trim().toLowerCase());
  const isEligible = (rel: KeywordRelevance | undefined) =>
    !!rel && rel.category !== "irrelevant" && rel.relevanceScore >= 35;
  const eligibleKeywords = keywordsToClassify.filter((k) => isEligible(relOf(k.keyword)));

  // ── 2. RISING TRENDS: only from business-relevant keywords ─────────────────
  const risingTrends = eligibleKeywords
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

  // ── 3. CONTENT GAPS: Claude proposes ideas — can pick from GSC or propose new angles ─
  const topPerformersText = topPerformers.length > 0
    ? topPerformers.map((p) => `- "${p.title}" — ${p.sessions} sessions`).join("\n")
    : "(none)";

  const topEligibleForPrompt = eligibleKeywords
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  const gscKeywordsText = topEligibleForPrompt.length > 0
    ? topEligibleForPrompt.map((k) => {
        const rel = relOf(k.keyword)!;
        return `- "${k.keyword}" — ${k.impressions} imp., pos ${k.position}, CTR ${k.ctr}% · relevance ${rel.relevanceScore}/100`;
      }).join("\n")
    : "(no relevant keywords in Search Console)";

  const articlesText = articles.slice(0, 40).map((a) => `- ${a.title}`).join("\n");

  const analysisTool: Anthropic.Tool = {
    name: "propose_content_gaps",
    description: "Propose 3 article ideas Coachello should write next, with data-driven rationale",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "2-3 sentences on the biggest content opportunity this cycle",
        },
        contentGaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: {
                type: "string",
                description: "Specific article title — distinctive angle, not a banal listicle",
              },
              targetKeyword: {
                type: "string",
                description: "Target keyword. Can be from the Search Console list OR a new keyword you think Coachello should target.",
              },
              source: {
                type: "string",
                enum: ["search_console", "organic_insight"],
                description: "search_console = keyword from GSC list; organic_insight = your proposal based on business context + article patterns",
              },
              rationale: {
                type: "string",
                description: "Why this article — cite GSC numbers when from search_console; for organic_insight, explain the gap and why it extends a winning pattern",
              },
              relevanceReason: {
                type: "string",
                description: "One line on why this moves an HR/L&D buyer toward Coachello",
              },
            },
            required: ["topic", "targetKeyword", "source", "rationale", "relevanceReason"],
          },
        },
      },
      required: ["summary", "contentGaps"],
    },
  };

  const prompt = `You are Coachello's senior content strategist. Propose the 3 best next articles.

${BUSINESS_CONTEXT_PROMPT_BLOCK}

## What already works for us (GA4 top pages, 30d)
${topPerformersText}

## Already published (avoid duplicating these)
${articlesText}

## Relevant Search Console keywords (pre-filtered by business relevance)
${gscKeywordsText}

## Your job
Propose 3 article ideas. At least 1 MUST be an organic_insight (your own keyword proposal, NOT from the GSC list). The others can be from GSC or organic.

Rules:
- Build on what already works — pick angles that extend a top-performing pattern, not random new bets
- No banal listicles, no generic "what is X" definitions, no "top 10 tips" filler
- Each article must have a distinctive angle that positions Coachello as the expert HR/L&D buyers should hire
- For search_console picks: cite the impressions/position numbers
- For organic_insight picks: name a keyword an HR buyer would actually type, and explain why it's a gap (high buyer intent + no existing Coachello article)
- Avoid duplicating already-published articles

Call \`propose_content_gaps\`.`;

  const client = new Anthropic();
  const message = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2000,
    tools: [analysisTool],
    tool_choice: { type: "tool", name: "propose_content_gaps" },
    messages: [{ role: "user", content: prompt }],
  });

  logUsage(userId, ANALYSIS_MODEL, message.usage.input_tokens, message.usage.output_tokens, "marketing_content_analyze");

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`propose_content_gaps: no tool_use block. stop_reason=${message.stop_reason}`);
  }

  const parsed = toolUse.input as {
    summary: string;
    contentGaps: Array<{
      topic: string;
      targetKeyword: string;
      source: "search_console" | "organic_insight";
      rationale: string;
      relevanceReason: string;
    }>;
  };

  const analysis: Analysis = {
    topPerformers,
    risingTrends,
    contentGaps: parsed.contentGaps.map((g) => ({
      topic: g.topic,
      rationale: g.rationale,
      targetKeyword: g.targetKeyword,
    })),
    summary: parsed.summary,
    dataSources: {
      ga4: { ok: topPages.length > 0, error: ga4Error, pagesCount: topPages.length },
      searchConsole: { ok: keywords.length > 0, error: scError, keywordsCount: keywords.length },
      wordpress: { ok: articles.length > 0, error: wpError, articlesCount: articles.length },
    },
  };

  await saveAnalysis(userId, analysis);

  // Build recommendations from content gaps, enriched with relevance metadata
  const newRecs: Recommendation[] = parsed.contentGaps.map((gap, i) => {
    const kwLower = gap.targetKeyword.trim().toLowerCase();
    const matchedKw = keywords.find((k) => k.keyword.toLowerCase() === kwLower);
    const rel = relOf(gap.targetKeyword);
    const estimatedTraffic = matchedKw ? Math.round(matchedKw.impressions * 0.05) : 0;
    return {
      id: "",
      topic: gap.topic,
      targetKeyword: gap.targetKeyword,
      justification: gap.rationale,
      estimatedTraffic,
      difficulty: (["easy", "medium", "hard"] as const)[i % 3],
      priority: i === 0 ? "high" : i === 1 ? "medium" : "low",
      status: "recommended",
      relevanceScore: rel?.relevanceScore,
      relevanceReason: gap.relevanceReason || rel?.reason,
      relevanceCategory: rel?.category,
    };
  });

  await saveRecommendations(userId, newRecs);
  const allRecs = await loadRecommendations();

  return NextResponse.json({ analysis, recommendations: allRecs });
}

// ─── Theme-based suggestion ──────────────────────────────────────────────────

async function runThemeSuggestion(userId: string, theme: string) {
  // Fetch the same real data context as runAnalysis
  const [keywordsResult, articlesResult] = await Promise.allSettled([
    fetchKeywords(userId, 28, true),
    fetchAllArticles(5000),
  ]);

  const rawThemeKeywords = keywordsResult.status === "fulfilled" ? keywordsResult.value : [];
  const keywords = dedupeKeywords(rawThemeKeywords);
  const articles = articlesResult.status === "fulfilled" ? articlesResult.value : [];

  if (articles.length === 0) {
    return NextResponse.json({ error: "Cannot suggest: WordPress articles unavailable." }, { status: 400 });
  }

  // Classify + filter keywords by business relevance (top slice only to stay under route timeout)
  const CLASSIFY_TOP_N = 150;
  const keywordsToClassify = [...keywords]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, CLASSIFY_TOP_N);
  const relevanceMap = keywordsToClassify.length > 0
    ? await classifyKeywords(userId, keywordsToClassify)
    : new Map<string, KeywordRelevance>();
  const relOf = (kw: string) => relevanceMap.get(kw.trim().toLowerCase());
  const isEligible = (rel: KeywordRelevance | undefined) =>
    !!rel && rel.category !== "irrelevant" && rel.relevanceScore >= 35;
  const eligibleKeywords = keywordsToClassify
    .filter((k) => isEligible(relOf(k.keyword)))
    .sort((a, b) => b.impressions - a.impressions);

  const articlesText = articles.slice(0, 60).map((a) => `- ${a.title}`).join("\n");
  const keywordsText = eligibleKeywords.length > 0
    ? eligibleKeywords.slice(0, 50).map((k) => {
        const rel = relOf(k.keyword)!;
        return `- "${k.keyword}" — ${k.impressions} imp., ${k.clicks} clicks, CTR ${k.ctr}%, pos. ${k.position} · relevance ${rel.relevanceScore}/100 (${rel.category}): ${rel.reason}`;
      }).join("\n")
    : "No business-relevant Search Console keywords after filtering — suggest based on topic relevance and existing article gaps.";

  const themeTool: Anthropic.Tool = {
    name: "suggest_articles_on_theme",
    description: "Suggests 3-5 specific article ideas aligned with the user's theme, grounded in Coachello's real data",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "1-2 sentence explanation of how these suggestions fit the theme" },
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: { type: "string", description: "Specific article title, not a generic topic" },
              targetKeyword: { type: "string", description: "Target keyword — prefer one from the filtered Search Console list if relevant, otherwise a natural keyword for the theme" },
              rationale: { type: "string", description: "Data-backed justification citing real numbers when available, or explaining how it fills a content gap" },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              relevanceScore: { type: "integer", description: "0-100 business relevance for Coachello's ICP. Reuse the provided score if the keyword is from the filtered list." },
              relevanceReason: { type: "string", description: "One line explaining the business angle for Coachello's ICP" },
            },
            required: ["topic", "targetKeyword", "rationale", "difficulty", "priority", "relevanceScore", "relevanceReason"],
          },
        },
      },
      required: ["summary", "recommendations"],
    },
  };

  const prompt = `You are a senior content strategist for Coachello (B2B leadership coaching platform, human coaches + AI).

${BUSINESS_CONTEXT_PROMPT_BLOCK}

The user wants article recommendations around this theme: "${theme}"

Generate 3-5 specific article ideas that:
1. Fit the user's theme closely — do not stray into unrelated topics
2. Complement what Coachello has already published (avoid duplicates)
3. Leverage real search demand when possible (use keywords from the filtered list)
4. Are specific article TITLES, not vague topics
5. Align with Coachello's B2B leadership-coaching ICP — reject any angle that targets consumer / wellness / job-seeker audiences

## All published Coachello articles (${articles.length} total — avoid duplicating these)
${articlesText}

## Business-relevant Search Console keywords (pre-filtered)
${keywordsText}

## Rules
- Do NOT invent metrics. If citing a number, cite from the keywords list above.
- Each recommendation needs a data-backed rationale (keyword impressions, content gap vs existing articles, etc.)
- Target keyword should come from the filtered Search Console list when there's a relevant match
- Provide a relevanceScore (0-100) and one-line relevanceReason per recommendation
- Write in English, for a B2B HR/L&D audience

Call the \`suggest_articles_on_theme\` tool with your output.`;

  const client = new Anthropic();
  const message = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 3000,
    tools: [themeTool],
    tool_choice: { type: "tool", name: "suggest_articles_on_theme" },
    messages: [{ role: "user", content: prompt }],
  });

  logUsage(userId, ANALYSIS_MODEL, message.usage.input_tokens, message.usage.output_tokens, "marketing_content_theme");

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Claude did not return a tool_use block. stop_reason: ${message.stop_reason}`);
  }

  const parsed = toolUse.input as {
    summary: string;
    recommendations: {
      topic: string;
      targetKeyword: string;
      rationale: string;
      difficulty: string;
      priority: string;
      relevanceScore: number;
      relevanceReason: string;
    }[];
  };

  // Build new recommendations and persist them (appending to existing, not replacing approved ones)
  const newRecs: Recommendation[] = parsed.recommendations.map((r) => {
    const matchedKw = keywords.find((k) => k.keyword.toLowerCase() === r.targetKeyword.toLowerCase());
    const rel = relOf(r.targetKeyword);
    const estimatedTraffic = matchedKw ? Math.round(matchedKw.impressions * 0.05) : 0;
    return {
      id: "",
      topic: r.topic,
      targetKeyword: r.targetKeyword,
      justification: r.rationale,
      estimatedTraffic,
      difficulty: (r.difficulty as Recommendation["difficulty"]) || "medium",
      priority: (r.priority as Recommendation["priority"]) || "medium",
      status: "recommended",
      relevanceScore: rel?.relevanceScore ?? r.relevanceScore,
      relevanceReason: r.relevanceReason || rel?.reason,
      relevanceCategory: rel?.category,
    };
  });

  // Insert new recs (keep existing approved/writing/published, replace only recommended)
  await saveRecommendations(userId, newRecs);
  const allRecs = await loadRecommendations();

  return NextResponse.json({
    success: true,
    summary: parsed.summary,
    recommendations: allRecs,
  });
}

// ─── Generation ──────────────────────────────────────────────────────────────

/**
 * Analyze article structure: count headings, average paragraph length,
 * detect CTA patterns, word count, key elements.
 */
function analyzeStructure(html: string): {
  wordCount: number;
  h2Count: number;
  h3Count: number;
  paragraphCount: number;
  bulletLists: number;
  tables: number;
  internalLinks: number;
  hasIntroHook: boolean;
  hasStatsOrData: boolean;
  hasCTA: boolean;
  outline: string[];
} {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = text.split(" ").filter(Boolean).length;

  const h2Matches = html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
  const h3Matches = html.match(/<h3[^>]*>(.*?)<\/h3>/gi) || [];
  const paragraphCount = (html.match(/<p[^>]*>/gi) || []).length;
  const bulletLists = (html.match(/<ul[^>]*>/gi) || []).length;
  const tables = (html.match(/<table[^>]*>/gi) || []).length;
  const internalLinks = (html.match(/href="https:\/\/coachello\.ai/gi) || []).length;

  const outline = [
    ...h2Matches.map((h) => "H2: " + h.replace(/<[^>]*>/g, "").trim()),
    ...h3Matches.map((h) => "  H3: " + h.replace(/<[^>]*>/g, "").trim()),
  ];

  const hasStatsOrData = /\d+%|\d+x|\d+ (sessions|users|ROI|coaches|managers)/i.test(text);
  const hasCTA = /book a demo|request a demo|talk to|get started|contact us|learn more/i.test(text);
  const hasIntroHook = /^[^.]{0,200}\?/.test(text.slice(0, 400)) || /\d+%/.test(text.slice(0, 500));

  return {
    wordCount,
    h2Count: h2Matches.length,
    h3Count: h3Matches.length,
    paragraphCount,
    bulletLists,
    tables,
    internalLinks,
    hasIntroHook,
    hasStatsOrData,
    hasCTA,
    outline,
  };
}

async function runGeneration(userId: string, recommendationId: string) {
  const rec = await getRec(recommendationId);
  if (!rec) return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });

  await updateRecStatus(rec.id, "writing");

  // ── Fetch all articles (we'll pick the top performers) ─────────────────────
  const allArticles = await fetchAllArticles(5000);
  if (allArticles.length === 0) {
    return NextResponse.json({ error: "No WordPress articles available as style reference" }, { status: 400 });
  }

  // ── Fetch GA4 top pages to identify BEST performing articles ───────────────
  let topPerformingSlugs: string[] = [];
  let ga4Available = false;
  try {
    const topPages = await fetchTopPages(userId, 30, 20);
    topPerformingSlugs = topPages
      .map((p) => p.path.replace(/^\/blog\//, "").replace(/\/$/, ""))
      .filter(Boolean);
    ga4Available = topPages.length > 0;
  } catch {
    // GA4 unavailable — fall back to most recent
  }

  // ── Pick style reference articles: top 3 by GA4 sessions, fallback to recent ─
  let styleArticles = topPerformingSlugs.length > 0
    ? topPerformingSlugs
        .map((slug) => allArticles.find((a) => a.slug === slug))
        .filter((a): a is NonNullable<typeof a> => !!a)
        .slice(0, 3)
    : [];

  if (styleArticles.length < 3) {
    // Fill with most recent if we don't have enough
    const existing = new Set(styleArticles.map((a) => a.id));
    for (const a of allArticles) {
      if (styleArticles.length >= 3) break;
      if (!existing.has(a.id)) styleArticles.push(a);
    }
  }

  // ── Fetch real metrics for the target keyword ──────────────────────────────
  let targetKeywordMetrics: { impressions: number; clicks: number; ctr: number; position: number } | null = null;
  let searchConsoleAvailable = false;
  try {
    const keywords = await fetchKeywords(userId, 28, false);
    searchConsoleAvailable = keywords.length > 0;
    const matched = keywords.find((k) => k.keyword.toLowerCase() === rec.targetKeyword.toLowerCase());
    if (matched) {
      targetKeywordMetrics = {
        impressions: matched.impressions,
        clicks: matched.clicks,
        ctr: matched.ctr,
        position: matched.position,
      };
    }
  } catch {
    // Search Console unavailable
  }

  // ── Hydrate empty bodies (workaround until WP REST exposes content.rendered) ─
  // The REST API on coachello.ai returns content.rendered="" today, so the
  // 3 style references would have no prose to teach the LLM voice. Scrape
  // just these 3 from their public URL — never the whole list.
  await hydrateArticleBodies(styleArticles);

  // ── Build structure analysis for each reference article ────────────────────
  const structureAnalyses = styleArticles.map((a) => {
    const s = analyzeStructure(a.contentHtml);
    return {
      title: a.title,
      slug: a.slug,
      structure: s,
    };
  });

  // Average structure across top articles
  const avgStructure = {
    wordCount: Math.round(structureAnalyses.reduce((s, a) => s + a.structure.wordCount, 0) / Math.max(structureAnalyses.length, 1)),
    h2Count: Math.round(structureAnalyses.reduce((s, a) => s + a.structure.h2Count, 0) / Math.max(structureAnalyses.length, 1)),
    h3Count: Math.round(structureAnalyses.reduce((s, a) => s + a.structure.h3Count, 0) / Math.max(structureAnalyses.length, 1)),
    paragraphCount: Math.round(structureAnalyses.reduce((s, a) => s + a.structure.paragraphCount, 0) / Math.max(structureAnalyses.length, 1)),
    bulletLists: Math.round(structureAnalyses.reduce((s, a) => s + a.structure.bulletLists, 0) / Math.max(structureAnalyses.length, 1)),
    tables: Math.round(structureAnalyses.reduce((s, a) => s + a.structure.tables, 0) / Math.max(structureAnalyses.length, 1)),
    internalLinks: Math.round(structureAnalyses.reduce((s, a) => s + a.structure.internalLinks, 0) / Math.max(structureAnalyses.length, 1)),
  };

  // ── Build prompt sections ──────────────────────────────────────────────────
  const styleReferenceText = styleArticles.slice(0, 3).map((a, i) => {
    const struct = structureAnalyses[i];
    return `### Reference article #${i + 1}: ${a.title}
URL: ${a.link}
Published: ${new Date(a.date).toLocaleDateString("en-US")}
Structure: ${struct.structure.wordCount} words, ${struct.structure.h2Count} H2 sections, ${struct.structure.h3Count} H3 subsections, ${struct.structure.paragraphCount} paragraphs, ${struct.structure.bulletLists} bullet lists, ${struct.structure.tables} table(s), ${struct.structure.internalLinks} internal links.
Outline:
${struct.structure.outline.join("\n")}

Full content:
${a.contentText.slice(0, 3500)}
`;
  }).join("\n---\n\n");

  const availableForLinking = allArticles.slice(0, 30).map((a) => `- "${a.title}" → ${a.link}`).join("\n");

  const metricsSection = targetKeywordMetrics
    ? `## REAL Search Console data for the target keyword "${rec.targetKeyword}" (last 28 days)
- Impressions: ${targetKeywordMetrics.impressions}
- Clicks: ${targetKeywordMetrics.clicks}
- CTR: ${targetKeywordMetrics.ctr}%
- Current ranking position: ${targetKeywordMetrics.position}

This means the keyword already has real search demand. Your article must target this exact keyword and satisfy the search intent behind it.`
    : searchConsoleAvailable
      ? `## Note: "${rec.targetKeyword}" is a priority keyword but has no Search Console history yet — it's an emerging opportunity.`
      : `## Note: Search Console data unavailable — optimize for the target keyword based on topic relevance.`;

  // Shared context for both languages
  const sharedContext = `## Topic
${rec.topic}

## Target keyword
${rec.targetKeyword}

## Data-driven justification for this article (from real analytics)
${rec.justification}

${metricsSection}

## Source of style reference
${ga4Available
  ? `The 3 articles below are Coachello's TOP-PERFORMING articles by GA4 sessions (last 30 days). Match their structure, tone, and voice precisely — this is what works with Coachello's audience.`
  : `The 3 articles below are recent Coachello articles. Match their structure, tone, and voice.`}

## Reference articles with structure analysis

${styleReferenceText}

## Structural baseline (match the top articles' rhythm, but respect the HARD word/link constraints below)
- Target word count: **between 1500 and 2000 words** (HARD constraint — do not go under 1500 or over 2000)
- H2 sections: ~${avgStructure.h2Count}
- H3 subsections: ~${avgStructure.h3Count}
- Paragraphs: ~${avgStructure.paragraphCount}
- Bullet lists: ~${avgStructure.bulletLists}
- Tables: ~${avgStructure.tables}
- Internal links: **between 6 and 8** (HARD constraint — do not go under 6 or over 8)

## All Coachello articles — pick 6-8 for internal links
${availableForLinking}

---

STRICT RULES:
1. Follow the structure pattern of the reference articles: same use of H2/H3 heading density, same paragraph rhythm, same presence of bullet lists and tables.
2. Match the tone, voice, and opening style of the top references.
3. Use ONLY real numbers. If you cite a statistic, source it from ICF, PwC/ICF study, Gartner, McKinsey, HBR, BCG, or Deloitte — never invent %. If you don't have a verifiable number, use a qualitative statement.
4. Never mention "one in X companies", fake ROI figures, or fabricated study names.
5. **Word count MUST be between 1500 and 2000 words.** Count carefully. This overrides any reference-article length signal.
6. **Include between 6 and 8 internal links** picked from the "All Coachello articles" list above. Distribute them naturally across the article — do not cluster them.
7. End with a CTA section pointing to Coachello.
8. Output valid HTML only (use <h2>, <h3>, <p>, <ul><li>, <table>, <strong>, <a href="...">), no <html>/<body> wrappers.
`;

  // ── Tool schema for writing a single language ──────────────────────────────
  const writeLanguageTool: Anthropic.Tool = {
    name: "write_article_language",
    description: "Writes a complete blog article in one language with WordPress metadata and internal links",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Full article HTML" },
        wordpressFormat: {
          type: "object",
          properties: {
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            excerpt: { type: "string", description: "Max 155 characters" },
            slug: { type: "string" },
          },
          required: ["category", "tags", "excerpt", "slug"],
        },
        internalLinks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              anchorText: { type: "string" },
              targetArticleTitle: { type: "string" },
              targetUrl: { type: "string" },
            },
            required: ["anchorText", "targetArticleTitle", "targetUrl"],
          },
        },
      },
      required: ["content", "wordpressFormat", "internalLinks"],
    },
  };

  const client = new Anthropic();

  // Generate FR and EN in parallel — each gets a full 16k token budget
  async function writeLanguage(lang: "fr" | "en"): Promise<{
    content: string;
    wordpressFormat: { category: string; tags: string[]; excerpt: string; slug: string };
    internalLinks: InternalLink[];
  }> {
    const langInstruction = lang === "fr"
      ? "Write this article in French, adapted to a French-speaking HR/L&D audience. Do not translate — write natively for this audience."
      : "Write this article in English, adapted to an English-speaking HR/L&D audience. Do not translate — write natively for this audience.";

    const langPrompt = `You are Coachello's senior content writer. Write a NEW blog article in ${lang === "fr" ? "French" : "English"}.

${langInstruction}

${sharedContext}

Call the \`write_article_language\` tool with your complete output.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      tools: [writeLanguageTool],
      tool_choice: { type: "tool", name: "write_article_language" },
      messages: [{ role: "user", content: langPrompt }],
    });

    logUsage(userId, "claude-sonnet-4-6", response.usage.input_tokens, response.usage.output_tokens, `marketing_content_generate_${lang}`);

    if (response.stop_reason === "max_tokens") {
      throw new Error(`${lang.toUpperCase()}: Claude hit max_tokens limit. Try a shorter topic or reduce reference article length.`);
    }

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error(`${lang.toUpperCase()}: no tool_use block. stop_reason: ${response.stop_reason}`);
    }

    const out = toolUse.input as {
      content: string;
      wordpressFormat: { category: string; tags: string[]; excerpt: string; slug: string };
      internalLinks: InternalLink[];
    };

    if (!out.content || out.content.length < 100) {
      throw new Error(`${lang.toUpperCase()}: content too short (${out.content?.length || 0} chars). stop_reason: ${response.stop_reason}`);
    }

    return out;
  }

  const [frResult, enResult] = await Promise.all([writeLanguage("fr"), writeLanguage("en")]);

  const draft: Draft = {
    recommendationId: rec.id,
    content: { fr: frResult.content, en: enResult.content },
    wordpressFormat: { fr: frResult.wordpressFormat, en: enResult.wordpressFormat },
    styleMatchScore: 85,
    internalLinks: { fr: frResult.internalLinks || [], en: enResult.internalLinks || [] },
  };

  // Wipe any previous drafts for this rec so regenerations don't pile up in DB
  await deleteDraftsForRec(rec.id);
  await saveDraft(userId, rec, draft);

  const recs = await loadRecommendations();

  return NextResponse.json({
    success: true,
    draft,
    recommendations: recs,
  });
}
