import useSWR from "swr";
import type {
  MarketingKPI,
  TrafficDataPoint,
  ArticleMarker,
  TrafficSource,
  ArticlePerformance,
  Keyword,
  CannibalizationAlert,
  ContentAnalysis,
  ArticleRecommendation,
  ArticleDraft,
  RefreshRecommendation,
  MergeRecommendation,
  InternalLinkSuggestion,
  EditorialCalendarItem,
  Alert,
  PublicationHeatmapCell,
  ArticleROI,
  SocialPerformance,
  TitleVariant,
} from "@/lib/mock/marketing-data";

const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 30_000 } as const;

// ─── Tier 1 — Overview ──────────────────────────────────────────────────────

interface GA4TopArticle {
  path: string;
  title: string;
  sessions: number;
  pageViews: number;
}

interface OverviewResponse {
  kpis: MarketingKPI;
  trafficData: TrafficDataPoint[];
  articleMarkers: ArticleMarker[];
  trafficSources: TrafficSource[];
  topPages?: GA4TopArticle[];
  source?: "ga4" | "mock";
  ga4Error?: string;
}

export function useMarketingOverview(period: 7 | 14 | 30 | 90 | 365) {
  const { data, error, isLoading } = useSWR<OverviewResponse>(
    `/api/marketing/overview?period=${period}`,
    SWR_OPTS,
  );
  return {
    kpis: data?.kpis ?? null,
    trafficData: data?.trafficData ?? [],
    articleMarkers: data?.articleMarkers ?? [],
    trafficSources: data?.trafficSources ?? [],
    topPages: data?.topPages ?? [],
    source: data?.source ?? "mock",
    ga4Error: data?.ga4Error ?? null,
    isLoading,
    error: error ? "Loading error" : "",
  };
}

// ─── Tier 2 — SEO ───────────────────────────────────────────────────────────

interface SeoResponse {
  keywords: Keyword[];
  cannibalizationAlerts: CannibalizationAlert[];
}

export function useMarketingSeo(articleId?: string, opportunitiesOnly?: boolean) {
  const params = new URLSearchParams();
  if (articleId) params.set("articleId", articleId);
  if (opportunitiesOnly) params.set("opportunities", "true");
  const { data, error, isLoading } = useSWR<SeoResponse>(
    `/api/marketing/seo?${params.toString()}`,
    SWR_OPTS,
  );
  return {
    keywords: data?.keywords ?? [],
    cannibalizationAlerts: data?.cannibalizationAlerts ?? [],
    isLoading,
    error: error ? "Erreur de chargement" : "",
  };
}

// ─── Tier 3 — Articles ──────────────────────────────────────────────────────

interface ArticlesResponse {
  articles: ArticlePerformance[];
  article?: ArticlePerformance;
}

export function useMarketingArticles(
  sort: string = "aiScore",
  order: string = "desc",
  articleId?: string,
) {
  const params = new URLSearchParams({ sort, order });
  if (articleId) params.set("id", articleId);
  const { data, error, isLoading } = useSWR<ArticlesResponse>(
    `/api/marketing/articles?${params.toString()}`,
    SWR_OPTS,
  );
  return {
    articles: data?.articles ?? [],
    article: data?.article ?? null,
    isLoading,
    error: error ? "Erreur de chargement" : "",
  };
}

// ─── Tier 4 — Content Factory ────────────────────────────────────────────────

interface ContentResponse {
  analysis: ContentAnalysis;
  recommendations: ArticleRecommendation[];
  drafts: ArticleDraft[];
}

export function useMarketingContent() {
  const { data, error, isLoading, mutate } = useSWR<ContentResponse>(
    `/api/marketing/content`,
    SWR_OPTS,
  );
  return {
    analysis: data?.analysis ?? null,
    recommendations: data?.recommendations ?? [],
    drafts: data?.drafts ?? [],
    isLoading,
    error: error ? "Erreur de chargement" : "",
    reload: () => mutate(),
  };
}

// ─── Tier 5 — Recommendations ────────────────────────────────────────────────

export interface DynamicCompetitorBenchmark {
  topic: string;
  coachello: boolean;
  competitors: Record<string, boolean>;
}

interface RecommendationsResponse {
  refresh: RefreshRecommendation[];
  merge: MergeRecommendation[];
  internalLinks: InternalLinkSuggestion[];
  editorialCalendar: EditorialCalendarItem[];
  competitors: DynamicCompetitorBenchmark[];
  competitorNames: string[];
}

export function useMarketingRecommendations() {
  const { data, error, isLoading } = useSWR<RecommendationsResponse>(
    `/api/marketing/recommendations`,
    SWR_OPTS,
  );
  return {
    refresh: data?.refresh ?? [],
    merge: data?.merge ?? [],
    internalLinks: data?.internalLinks ?? [],
    editorialCalendar: data?.editorialCalendar ?? [],
    competitors: data?.competitors ?? [],
    competitorNames: data?.competitorNames ?? [],
    isLoading,
    error: error ? "Erreur de chargement" : "",
  };
}

// ─── Tier 6 — Alerts & Bonus ────────────────────────────────────────────────

interface AlertsResponse {
  alerts: Alert[];
  heatmap: PublicationHeatmapCell[];
  roi: ArticleROI[];
  socialPerformance: SocialPerformance[];
  titleVariants: TitleVariant[];
}

export function useMarketingAlerts() {
  const { data, error, isLoading } = useSWR<AlertsResponse>(
    `/api/marketing/alerts`,
    SWR_OPTS,
  );
  return {
    alerts: data?.alerts ?? [],
    heatmap: data?.heatmap ?? [],
    roi: data?.roi ?? [],
    socialPerformance: data?.socialPerformance ?? [],
    titleVariants: data?.titleVariants ?? [],
    isLoading,
    error: error ? "Erreur de chargement" : "",
  };
}
