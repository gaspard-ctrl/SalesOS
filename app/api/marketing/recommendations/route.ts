import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  MOCK_REFRESH_RECOMMENDATIONS,
  MOCK_MERGE_RECOMMENDATIONS,
  MOCK_INTERNAL_LINKS,
  MOCK_EDITORIAL_CALENDAR,
} from "@/lib/mock/marketing-data";

export const dynamic = "force-dynamic";

// ─── Tavily search ───────────────────────────────────────────────────────────

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
};

async function searchTavily(query: string, days = 365): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
        days,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

// ─── Configuration : concurrents & sujets ────────────────────────────────────

export const COMPETITORS = [
  { name: "CoachHub", domain: "coachhub.com" },
  { name: "BetterUp", domain: "betterup.com" },
  { name: "Ezra", domain: "ezra.com" },
  { name: "Simundia", domain: "simundia.com" },
];

export const COACHING_TOPICS: { query: string; label: string }[] = [
  { query: "coaching performance commerciale", label: "Coaching et performance commerciale" },
  { query: "ROI coaching entreprise", label: "ROI du coaching" },
  { query: "coaching intelligence artificielle IA", label: "Coaching et IA" },
  { query: "coaching santé mentale bien-être travail", label: "Coaching et santé mentale" },
  { query: "coaching équipes tech développeurs", label: "Coaching pour équipes tech" },
  { query: "coaching intergénérationnel", label: "Coaching intergénérationnel" },
  { query: "coaching onboarding intégration", label: "Coaching et onboarding" },
  { query: "leadership coaching management", label: "Leadership et coaching" },
  { query: "coaching digital hybride remote", label: "Coaching digital / hybride" },
  { query: "soft skills développement compétences", label: "Soft skills et développement" },
  { query: "coaching diversité inclusion", label: "Coaching et diversité / inclusion" },
  { query: "mesure impact coaching KPI", label: "Mesure d'impact du coaching" },
];

const COACHELLO_TOPICS_COVERED = new Set([
  "coaching performance commerciale",
  "ROI coaching entreprise",
  "coaching intelligence artificielle IA",
  "coaching onboarding intégration",
  "leadership coaching management",
  "coaching digital hybride remote",
  "mesure impact coaching KPI",
]);

// ─── Benchmark type ──────────────────────────────────────────────────────────

export interface DynamicCompetitorBenchmark {
  topic: string;
  coachello: boolean;
  competitors: Record<string, boolean>;
}

// ─── Default benchmarks (no Tavily) ──────────────────────────────────────────

function getDefaultBenchmarks(): DynamicCompetitorBenchmark[] {
  return COACHING_TOPICS.map((topic) => ({
    topic: topic.label,
    coachello: COACHELLO_TOPICS_COVERED.has(topic.query),
    competitors: Object.fromEntries(COMPETITORS.map((c) => [c.name, false])),
  }));
}

// ─── GET: return recommendations (no Tavily scan, instant) ───────────────────

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  return NextResponse.json({
    refresh: MOCK_REFRESH_RECOMMENDATIONS,
    merge: MOCK_MERGE_RECOMMENDATIONS,
    internalLinks: MOCK_INTERNAL_LINKS,
    editorialCalendar: MOCK_EDITORIAL_CALENDAR,
    competitors: getDefaultBenchmarks(),
    competitorNames: COMPETITORS.map((c) => c.name),
  });
}

// ─── POST: trigger Tavily scan (user clicks "Scanner") ───────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Accept extra topics from frontend
  let extraTopics: string[] = [];
  try {
    const body = await req.json();
    extraTopics = Array.isArray(body.extraTopics) ? body.extraTopics : [];
  } catch {
    // No body or invalid JSON — fine, proceed with default topics
  }

  // Merge extra topics into the scan
  const allTopics = [
    ...COACHING_TOPICS,
    ...extraTopics.map((t) => ({ query: t, label: t })),
  ];

  try {
    const competitors = await fetchCompetitorBenchmarksWithTopics(allTopics);
    return NextResponse.json({
      competitors,
      competitorNames: COMPETITORS.map((c) => c.name),
    });
  } catch (e) {
    console.error("[marketing/recommendations] Tavily scan failed:", e);
    return NextResponse.json({
      competitors: getDefaultBenchmarks(),
      competitorNames: COMPETITORS.map((c) => c.name),
      error: "Scan échoué, données par défaut affichées",
    });
  }
}

// ─── Scan with custom topics ─────────────────────────────────────────────────

async function fetchCompetitorBenchmarksWithTopics(
  topics: { query: string; label: string }[],
): Promise<DynamicCompetitorBenchmark[]> {
  const results: Map<string, Map<string, boolean>> = new Map();
  for (const comp of COMPETITORS) {
    results.set(comp.name, new Map());
  }

  const queries: { competitor: string; topicQuery: string; searchQuery: string }[] = [];
  for (const comp of COMPETITORS) {
    for (const topic of topics) {
      queries.push({
        competitor: comp.name,
        topicQuery: topic.query,
        searchQuery: `site:${comp.domain} ${topic.query}`,
      });
    }
  }

  const batchSize = 4;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((q) => searchTavily(q.searchQuery)),
    );
    batch.forEach((q, j) => {
      results.get(q.competitor)!.set(q.topicQuery, batchResults[j].length > 0);
    });
  }

  return topics.map((topic) => {
    const competitors: Record<string, boolean> = {};
    for (const comp of COMPETITORS) {
      competitors[comp.name] = results.get(comp.name)?.get(topic.query) ?? false;
    }
    return {
      topic: topic.label,
      coachello: COACHELLO_TOPICS_COVERED.has(topic.query),
      competitors,
    };
  });
}
