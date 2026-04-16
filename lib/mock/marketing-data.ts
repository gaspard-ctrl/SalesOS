// ─── Types ───────────────────────────────────────────────────────────────────

// Tier 1 — Vue d'ensemble
export interface MarketingKPI {
  sessions: number;
  sessionsWoW: number;
  uniqueVisitors: number;
  uniqueVisitorsWoW: number;
  pageViews: number;
  pageViewsWoW: number;
  bounceRate: number;
  bounceRateWoW: number;
  avgDuration: number; // seconds
  avgDurationWoW: number;
  ctaConversions: number;
  ctaConversionsWoW: number;
}

export interface TrafficDataPoint {
  date: string;
  sessions: number;
  visitors: number;
  pageViews: number;
}

export interface ArticleMarker {
  date: string;
  title: string;
  slug: string;
}

export interface TrafficSource {
  source: string;
  sessions: number;
  percentage: number;
  color: string;
}

// Tier 2 — SEO
export interface Keyword {
  id: string;
  keyword: string;
  articleId: string | null;
  articleTitle: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  positionHistory: { week: string; position: number }[];
}

export interface CannibalizationAlert {
  keyword: string;
  articles: { id: string; title: string; position: number; impressions: number }[];
}

// Tier 3 — Articles
export interface ArticlePerformance {
  id: string;
  title: string;
  slug: string;
  publishedDate: string;
  sessions: number;
  organicClicks: number;
  ctr: number;
  avgPosition: number;
  ctaConversions: number;
  bounceRate: number;
  avgDuration: number;
  aiScore: number;
  badge: "star" | "declining" | "promising" | "needs_optimization";
  scoreBreakdown: { traffic: number; engagement: number; conversion: number; seo: number; seoBackend: number };
  ctaDetails: { ctaName: string; clicks: number; conversionRate: number }[];
}

// Tier 4 — Content Factory
export interface ContentAnalysis {
  topPerformers: { title: string; sessions: number; trend: number }[];
  risingTrends: { keyword: string; growth: number }[];
  contentGaps: { topic: string; competitorsCovering: string[] }[];
}

export interface ArticleRecommendation {
  id: string;
  topic: string;
  targetKeyword: string;
  justification: string;
  estimatedTraffic: number;
  difficulty: "easy" | "medium" | "hard";
  priority: "high" | "medium" | "low";
  status: "recommended" | "approved" | "writing" | "published";
}

export interface InternalLink {
  anchorText: string;
  targetArticleTitle: string;
  targetUrl: string;
}

export interface ArticleDraft {
  recommendationId: string;
  content: { fr: string; en: string };
  wordpressFormat: {
    fr: { category: string; tags: string[]; excerpt: string; slug: string };
    en: { category: string; tags: string[]; excerpt: string; slug: string };
  };
  styleMatchScore: number;
  internalLinks: { fr: InternalLink[]; en: InternalLink[] };
}

// Tier 5 — Recos
export interface RefreshRecommendation {
  articleId: string;
  title: string;
  publishedDate: string;
  currentSessions: number;
  peakSessions: number;
  trafficTrend: number[];
  suggestions: string[];
}

export interface MergeRecommendation {
  articles: { id: string; title: string; sessions: number; keyword: string }[];
  justification: string;
}

export interface InternalLinkSuggestion {
  sourceArticleId: string;
  sourceTitle: string;
  targetArticleId: string;
  targetTitle: string;
  anchorText: string;
}

export interface EditorialCalendarItem {
  week: number;
  weekLabel: string;
  topic: string;
  targetKeyword: string;
  priority: "high" | "medium" | "low";
  justification: string;
}

export interface CompetitorBenchmark {
  topic: string;
  coachello: boolean;
  coachHub: boolean;
  betterUp: boolean;
  mentorCity: boolean;
}

// Tier 6 — Bonus
export interface PublicationHeatmapCell {
  day: number; // 0=Lun, 6=Dim
  slot: number; // 0=0-4h, 1=4-8h, ..., 5=20-24h
  score: number; // 0-100
}

export interface Alert {
  id: string;
  type: "traffic_drop" | "keyword_lost" | "competitor_publish" | "cta_spike" | "new_ranking";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  date: string;
  articleId?: string;
}

export interface ArticleROI {
  articleId: string;
  title: string;
  writingTimeHours: number;
  leadsGenerated: number;
  costPerLead: number;
  roi: number;
}

export interface SocialPerformance {
  articleId: string;
  title: string;
  platform: "linkedin" | "twitter";
  shares: number;
  clicks: number;
  engagement: number;
  referralTraffic: number;
}

export interface TitleVariant {
  articleId: string;
  originalTitle: string;
  variants: { title: string; estimatedCtr: number; isRecommended: boolean }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateTrafficData(): TrafficDataPoint[] {
  const data: TrafficDataPoint[] = [];
  const now = new Date("2026-04-09");
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
    const seasonal = Math.sin((dayOfYear / 365) * Math.PI * 2 - 1) * 15;
    const weekday = d.getDay();
    const weekendDip = (weekday === 0 || weekday === 6) ? -12 : 0;
    const trend = (364 - i) * 0.08;
    const noise = (seededRandom(i * 7 + 3) - 0.5) * 20;
    const base = 35 + seasonal + weekendDip + trend + noise;
    const sessions = Math.max(8, Math.round(base));
    const visitors = Math.max(5, Math.round(sessions * (0.72 + seededRandom(i * 13) * 0.1)));
    const pageViews = Math.round(sessions * (1.4 + seededRandom(i * 17) * 0.4));
    data.push({
      date: d.toISOString().slice(0, 10),
      sessions,
      visitors,
      pageViews,
    });
  }
  return data;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

// Tier 1
export const MOCK_KPIS: MarketingKPI = {
  sessions: 12450,
  sessionsWoW: 8.2,
  uniqueVisitors: 9120,
  uniqueVisitorsWoW: 6.5,
  pageViews: 18930,
  pageViewsWoW: 11.4,
  bounceRate: 42.3,
  bounceRateWoW: -2.1,
  avgDuration: 154,
  avgDurationWoW: 4.8,
  ctaConversions: 287,
  ctaConversionsWoW: 12.6,
};

export const MOCK_TRAFFIC_DATA: TrafficDataPoint[] = generateTrafficData();

export const MOCK_ARTICLE_MARKERS: ArticleMarker[] = [
  { date: "2025-06-15", title: "Comment le coaching transforme la performance commerciale", slug: "coaching-performance-commerciale" },
  { date: "2025-08-22", title: "ROI du coaching en entreprise : chiffres clés 2025", slug: "roi-coaching-entreprise" },
  { date: "2025-10-10", title: "Leadership et coaching : les 5 compétences essentielles", slug: "leadership-coaching-competences" },
  { date: "2025-12-05", title: "Coaching digital vs présentiel : le comparatif complet", slug: "coaching-digital-vs-presentiel" },
  { date: "2026-01-18", title: "Onboarding et coaching : réduire le turnover de 40%", slug: "onboarding-coaching-turnover" },
  { date: "2026-02-12", title: "Comment mesurer l'impact du coaching sur vos équipes", slug: "mesurer-impact-coaching" },
  { date: "2026-03-08", title: "Intelligence artificielle et coaching : le duo gagnant", slug: "ia-coaching-duo-gagnant" },
  { date: "2026-04-01", title: "Coaching commercial : 7 techniques pour closer plus", slug: "coaching-commercial-closer" },
];

export const MOCK_TRAFFIC_SOURCES: TrafficSource[] = [
  { source: "Organic", sessions: 6848, percentage: 55, color: "#16a34a" },
  { source: "Social", sessions: 2241, percentage: 18, color: "#3b82f6" },
  { source: "Direct", sessions: 1868, percentage: 15, color: "#f01563" },
  { source: "Referral", sessions: 996, percentage: 8, color: "#8b5cf6" },
  { source: "Email", sessions: 497, percentage: 4, color: "#f59e0b" },
];

// Tier 2
export const MOCK_KEYWORDS: Keyword[] = [
  { id: "kw1", keyword: "coaching entreprise", articleId: "a1", articleTitle: "Comment le coaching transforme la performance commerciale", impressions: 8400, clicks: 420, ctr: 5.0, position: 4.2, positionHistory: [{ week: "S1", position: 6.1 }, { week: "S2", position: 5.8 }, { week: "S3", position: 5.5 }, { week: "S4", position: 5.2 }, { week: "S5", position: 4.9 }, { week: "S6", position: 4.7 }, { week: "S7", position: 4.5 }, { week: "S8", position: 4.4 }, { week: "S9", position: 4.3 }, { week: "S10", position: 4.2 }, { week: "S11", position: 4.2 }, { week: "S12", position: 4.2 }] },
  { id: "kw2", keyword: "roi coaching", articleId: "a2", articleTitle: "ROI du coaching en entreprise : chiffres clés 2025", impressions: 5200, clicks: 312, ctr: 6.0, position: 3.1, positionHistory: [{ week: "S1", position: 5.0 }, { week: "S2", position: 4.6 }, { week: "S3", position: 4.2 }, { week: "S4", position: 3.9 }, { week: "S5", position: 3.7 }, { week: "S6", position: 3.5 }, { week: "S7", position: 3.4 }, { week: "S8", position: 3.3 }, { week: "S9", position: 3.2 }, { week: "S10", position: 3.1 }, { week: "S11", position: 3.1 }, { week: "S12", position: 3.1 }] },
  { id: "kw3", keyword: "leadership coaching", articleId: "a3", articleTitle: "Leadership et coaching : les 5 compétences essentielles", impressions: 6100, clicks: 244, ctr: 4.0, position: 5.8, positionHistory: [{ week: "S1", position: 7.2 }, { week: "S2", position: 7.0 }, { week: "S3", position: 6.8 }, { week: "S4", position: 6.5 }, { week: "S5", position: 6.3 }, { week: "S6", position: 6.1 }, { week: "S7", position: 6.0 }, { week: "S8", position: 5.9 }, { week: "S9", position: 5.9 }, { week: "S10", position: 5.8 }, { week: "S11", position: 5.8 }, { week: "S12", position: 5.8 }] },
  { id: "kw4", keyword: "coaching digital", articleId: "a4", articleTitle: "Coaching digital vs présentiel : le comparatif complet", impressions: 4300, clicks: 215, ctr: 5.0, position: 6.4, positionHistory: [{ week: "S1", position: 8.0 }, { week: "S2", position: 7.6 }, { week: "S3", position: 7.3 }, { week: "S4", position: 7.0 }, { week: "S5", position: 6.8 }, { week: "S6", position: 6.7 }, { week: "S7", position: 6.6 }, { week: "S8", position: 6.5 }, { week: "S9", position: 6.5 }, { week: "S10", position: 6.4 }, { week: "S11", position: 6.4 }, { week: "S12", position: 6.4 }] },
  { id: "kw5", keyword: "onboarding coaching", articleId: "a5", articleTitle: "Onboarding et coaching : réduire le turnover de 40%", impressions: 3800, clicks: 190, ctr: 5.0, position: 7.1, positionHistory: [{ week: "S1", position: 12.0 }, { week: "S2", position: 11.2 }, { week: "S3", position: 10.5 }, { week: "S4", position: 9.8 }, { week: "S5", position: 9.2 }, { week: "S6", position: 8.6 }, { week: "S7", position: 8.1 }, { week: "S8", position: 7.7 }, { week: "S9", position: 7.4 }, { week: "S10", position: 7.2 }, { week: "S11", position: 7.1 }, { week: "S12", position: 7.1 }] },
  { id: "kw6", keyword: "mesurer impact coaching", articleId: "a6", articleTitle: "Comment mesurer l'impact du coaching sur vos équipes", impressions: 2900, clicks: 116, ctr: 4.0, position: 8.3, positionHistory: [{ week: "S1", position: 11.0 }, { week: "S2", position: 10.5 }, { week: "S3", position: 10.1 }, { week: "S4", position: 9.7 }, { week: "S5", position: 9.3 }, { week: "S6", position: 9.0 }, { week: "S7", position: 8.8 }, { week: "S8", position: 8.6 }, { week: "S9", position: 8.5 }, { week: "S10", position: 8.4 }, { week: "S11", position: 8.3 }, { week: "S12", position: 8.3 }] },
  { id: "kw7", keyword: "ia coaching", articleId: "a7", articleTitle: "Intelligence artificielle et coaching : le duo gagnant", impressions: 7200, clicks: 504, ctr: 7.0, position: 2.8, positionHistory: [{ week: "S1", position: 5.5 }, { week: "S2", position: 5.0 }, { week: "S3", position: 4.5 }, { week: "S4", position: 4.1 }, { week: "S5", position: 3.8 }, { week: "S6", position: 3.5 }, { week: "S7", position: 3.3 }, { week: "S8", position: 3.1 }, { week: "S9", position: 3.0 }, { week: "S10", position: 2.9 }, { week: "S11", position: 2.8 }, { week: "S12", position: 2.8 }] },
  { id: "kw8", keyword: "coaching commercial", articleId: "a8", articleTitle: "Coaching commercial : 7 techniques pour closer plus", impressions: 5800, clicks: 348, ctr: 6.0, position: 3.5, positionHistory: [{ week: "S1", position: 8.0 }, { week: "S2", position: 7.2 }, { week: "S3", position: 6.5 }, { week: "S4", position: 5.9 }, { week: "S5", position: 5.3 }, { week: "S6", position: 4.8 }, { week: "S7", position: 4.4 }, { week: "S8", position: 4.1 }, { week: "S9", position: 3.8 }, { week: "S10", position: 3.6 }, { week: "S11", position: 3.5 }, { week: "S12", position: 3.5 }] },
  // Opportunity keywords — high impressions, low CTR, position 5-20
  { id: "kw9", keyword: "coaching professionnel prix", articleId: "a2", articleTitle: "ROI du coaching en entreprise : chiffres clés 2025", impressions: 9200, clicks: 184, ctr: 2.0, position: 11.3, positionHistory: [{ week: "S1", position: 14.0 }, { week: "S2", position: 13.5 }, { week: "S3", position: 13.1 }, { week: "S4", position: 12.7 }, { week: "S5", position: 12.3 }, { week: "S6", position: 12.0 }, { week: "S7", position: 11.8 }, { week: "S8", position: 11.6 }, { week: "S9", position: 11.5 }, { week: "S10", position: 11.4 }, { week: "S11", position: 11.3 }, { week: "S12", position: 11.3 }] },
  { id: "kw10", keyword: "formation coaching en ligne", articleId: "a4", articleTitle: "Coaching digital vs présentiel : le comparatif complet", impressions: 7800, clicks: 156, ctr: 2.0, position: 14.7, positionHistory: [{ week: "S1", position: 18.0 }, { week: "S2", position: 17.5 }, { week: "S3", position: 17.0 }, { week: "S4", position: 16.5 }, { week: "S5", position: 16.1 }, { week: "S6", position: 15.8 }, { week: "S7", position: 15.5 }, { week: "S8", position: 15.2 }, { week: "S9", position: 15.0 }, { week: "S10", position: 14.8 }, { week: "S11", position: 14.7 }, { week: "S12", position: 14.7 }] },
  { id: "kw11", keyword: "développement leadership", articleId: "a3", articleTitle: "Leadership et coaching : les 5 compétences essentielles", impressions: 6500, clicks: 130, ctr: 2.0, position: 12.1, positionHistory: [{ week: "S1", position: 15.0 }, { week: "S2", position: 14.5 }, { week: "S3", position: 14.0 }, { week: "S4", position: 13.6 }, { week: "S5", position: 13.2 }, { week: "S6", position: 12.9 }, { week: "S7", position: 12.6 }, { week: "S8", position: 12.4 }, { week: "S9", position: 12.2 }, { week: "S10", position: 12.1 }, { week: "S11", position: 12.1 }, { week: "S12", position: 12.1 }] },
  { id: "kw12", keyword: "bien-être au travail coaching", articleId: null, articleTitle: null, impressions: 8100, clicks: 162, ctr: 2.0, position: 16.4, positionHistory: [{ week: "S1", position: 19.0 }, { week: "S2", position: 18.5 }, { week: "S3", position: 18.0 }, { week: "S4", position: 17.6 }, { week: "S5", position: 17.2 }, { week: "S6", position: 16.9 }, { week: "S7", position: 16.7 }, { week: "S8", position: 16.5 }, { week: "S9", position: 16.5 }, { week: "S10", position: 16.4 }, { week: "S11", position: 16.4 }, { week: "S12", position: 16.4 }] },
  { id: "kw13", keyword: "coaching manager", articleId: "a3", articleTitle: "Leadership et coaching : les 5 compétences essentielles", impressions: 5400, clicks: 108, ctr: 2.0, position: 9.7, positionHistory: [{ week: "S1", position: 12.0 }, { week: "S2", position: 11.5 }, { week: "S3", position: 11.1 }, { week: "S4", position: 10.7 }, { week: "S5", position: 10.4 }, { week: "S6", position: 10.1 }, { week: "S7", position: 9.9 }, { week: "S8", position: 9.8 }, { week: "S9", position: 9.8 }, { week: "S10", position: 9.7 }, { week: "S11", position: 9.7 }, { week: "S12", position: 9.7 }] },
  { id: "kw14", keyword: "turnover entreprise solutions", articleId: "a5", articleTitle: "Onboarding et coaching : réduire le turnover de 40%", impressions: 4600, clicks: 92, ctr: 2.0, position: 13.5, positionHistory: [{ week: "S1", position: 16.0 }, { week: "S2", position: 15.5 }, { week: "S3", position: 15.1 }, { week: "S4", position: 14.7 }, { week: "S5", position: 14.3 }, { week: "S6", position: 14.0 }, { week: "S7", position: 13.8 }, { week: "S8", position: 13.6 }, { week: "S9", position: 13.5 }, { week: "S10", position: 13.5 }, { week: "S11", position: 13.5 }, { week: "S12", position: 13.5 }] },
  // Additional regular keywords
  { id: "kw15", keyword: "coaching performance", articleId: "a1", articleTitle: "Comment le coaching transforme la performance commerciale", impressions: 4100, clicks: 205, ctr: 5.0, position: 5.3, positionHistory: [{ week: "S1", position: 7.0 }, { week: "S2", position: 6.7 }, { week: "S3", position: 6.4 }, { week: "S4", position: 6.1 }, { week: "S5", position: 5.9 }, { week: "S6", position: 5.7 }, { week: "S7", position: 5.5 }, { week: "S8", position: 5.4 }, { week: "S9", position: 5.3 }, { week: "S10", position: 5.3 }, { week: "S11", position: 5.3 }, { week: "S12", position: 5.3 }] },
  { id: "kw16", keyword: "coaching équipe commerciale", articleId: "a8", articleTitle: "Coaching commercial : 7 techniques pour closer plus", impressions: 3600, clicks: 180, ctr: 5.0, position: 6.1, positionHistory: [{ week: "S1", position: 9.0 }, { week: "S2", position: 8.5 }, { week: "S3", position: 8.0 }, { week: "S4", position: 7.5 }, { week: "S5", position: 7.1 }, { week: "S6", position: 6.8 }, { week: "S7", position: 6.5 }, { week: "S8", position: 6.3 }, { week: "S9", position: 6.2 }, { week: "S10", position: 6.1 }, { week: "S11", position: 6.1 }, { week: "S12", position: 6.1 }] },
  { id: "kw17", keyword: "coaching ia entreprise", articleId: "a7", articleTitle: "Intelligence artificielle et coaching : le duo gagnant", impressions: 4800, clicks: 336, ctr: 7.0, position: 3.2, positionHistory: [{ week: "S1", position: 6.0 }, { week: "S2", position: 5.5 }, { week: "S3", position: 5.0 }, { week: "S4", position: 4.6 }, { week: "S5", position: 4.2 }, { week: "S6", position: 3.9 }, { week: "S7", position: 3.7 }, { week: "S8", position: 3.5 }, { week: "S9", position: 3.4 }, { week: "S10", position: 3.3 }, { week: "S11", position: 3.2 }, { week: "S12", position: 3.2 }] },
  { id: "kw18", keyword: "techniques closing vente", articleId: "a8", articleTitle: "Coaching commercial : 7 techniques pour closer plus", impressions: 3200, clicks: 192, ctr: 6.0, position: 4.8, positionHistory: [{ week: "S1", position: 7.5 }, { week: "S2", position: 7.0 }, { week: "S3", position: 6.5 }, { week: "S4", position: 6.1 }, { week: "S5", position: 5.7 }, { week: "S6", position: 5.4 }, { week: "S7", position: 5.2 }, { week: "S8", position: 5.0 }, { week: "S9", position: 4.9 }, { week: "S10", position: 4.8 }, { week: "S11", position: 4.8 }, { week: "S12", position: 4.8 }] },
  { id: "kw19", keyword: "KPI coaching", articleId: "a6", articleTitle: "Comment mesurer l'impact du coaching sur vos équipes", impressions: 2400, clicks: 120, ctr: 5.0, position: 6.9, positionHistory: [{ week: "S1", position: 10.0 }, { week: "S2", position: 9.5 }, { week: "S3", position: 9.0 }, { week: "S4", position: 8.6 }, { week: "S5", position: 8.2 }, { week: "S6", position: 7.8 }, { week: "S7", position: 7.5 }, { week: "S8", position: 7.3 }, { week: "S9", position: 7.1 }, { week: "S10", position: 7.0 }, { week: "S11", position: 6.9 }, { week: "S12", position: 6.9 }] },
  { id: "kw20", keyword: "coaching vs formation", articleId: "a4", articleTitle: "Coaching digital vs présentiel : le comparatif complet", impressions: 3900, clicks: 156, ctr: 4.0, position: 7.5, positionHistory: [{ week: "S1", position: 10.0 }, { week: "S2", position: 9.6 }, { week: "S3", position: 9.2 }, { week: "S4", position: 8.8 }, { week: "S5", position: 8.5 }, { week: "S6", position: 8.2 }, { week: "S7", position: 8.0 }, { week: "S8", position: 7.8 }, { week: "S9", position: 7.6 }, { week: "S10", position: 7.5 }, { week: "S11", position: 7.5 }, { week: "S12", position: 7.5 }] },
  // Opportunity keywords without articles
  { id: "kw21", keyword: "coaching développement personnel entreprise", articleId: null, articleTitle: null, impressions: 6800, clicks: 136, ctr: 2.0, position: 18.2, positionHistory: [{ week: "S1", position: 22.0 }, { week: "S2", position: 21.5 }, { week: "S3", position: 21.0 }, { week: "S4", position: 20.5 }, { week: "S5", position: 20.0 }, { week: "S6", position: 19.6 }, { week: "S7", position: 19.3 }, { week: "S8", position: 19.0 }, { week: "S9", position: 18.7 }, { week: "S10", position: 18.4 }, { week: "S11", position: 18.3 }, { week: "S12", position: 18.2 }] },
  { id: "kw22", keyword: "soft skills coaching", articleId: null, articleTitle: null, impressions: 5500, clicks: 110, ctr: 2.0, position: 15.8, positionHistory: [{ week: "S1", position: 19.0 }, { week: "S2", position: 18.5 }, { week: "S3", position: 18.0 }, { week: "S4", position: 17.5 }, { week: "S5", position: 17.1 }, { week: "S6", position: 16.7 }, { week: "S7", position: 16.4 }, { week: "S8", position: 16.1 }, { week: "S9", position: 15.9 }, { week: "S10", position: 15.8 }, { week: "S11", position: 15.8 }, { week: "S12", position: 15.8 }] },
  // Cannibalization keywords — appear in multiple articles
  { id: "kw23", keyword: "coaching professionnel", articleId: "a1", articleTitle: "Comment le coaching transforme la performance commerciale", impressions: 7100, clicks: 355, ctr: 5.0, position: 5.1, positionHistory: [{ week: "S1", position: 6.5 }, { week: "S2", position: 6.2 }, { week: "S3", position: 6.0 }, { week: "S4", position: 5.8 }, { week: "S5", position: 5.6 }, { week: "S6", position: 5.4 }, { week: "S7", position: 5.3 }, { week: "S8", position: 5.2 }, { week: "S9", position: 5.2 }, { week: "S10", position: 5.1 }, { week: "S11", position: 5.1 }, { week: "S12", position: 5.1 }] },
  { id: "kw24", keyword: "retour sur investissement coaching", articleId: "a6", articleTitle: "Comment mesurer l'impact du coaching sur vos équipes", impressions: 3100, clicks: 93, ctr: 3.0, position: 8.9, positionHistory: [{ week: "S1", position: 11.0 }, { week: "S2", position: 10.5 }, { week: "S3", position: 10.1 }, { week: "S4", position: 9.8 }, { week: "S5", position: 9.5 }, { week: "S6", position: 9.3 }, { week: "S7", position: 9.1 }, { week: "S8", position: 9.0 }, { week: "S9", position: 8.9 }, { week: "S10", position: 8.9 }, { week: "S11", position: 8.9 }, { week: "S12", position: 8.9 }] },
  { id: "kw25", keyword: "plateforme coaching digital", articleId: "a7", articleTitle: "Intelligence artificielle et coaching : le duo gagnant", impressions: 4200, clicks: 252, ctr: 6.0, position: 4.1, positionHistory: [{ week: "S1", position: 6.5 }, { week: "S2", position: 6.1 }, { week: "S3", position: 5.8 }, { week: "S4", position: 5.5 }, { week: "S5", position: 5.2 }, { week: "S6", position: 4.9 }, { week: "S7", position: 4.7 }, { week: "S8", position: 4.5 }, { week: "S9", position: 4.3 }, { week: "S10", position: 4.2 }, { week: "S11", position: 4.1 }, { week: "S12", position: 4.1 }] },
];

export const MOCK_CANNIBALIZATION_ALERTS: CannibalizationAlert[] = [
  {
    keyword: "coaching professionnel",
    articles: [
      { id: "a1", title: "Comment le coaching transforme la performance commerciale", position: 5.1, impressions: 7100 },
      { id: "a2", title: "ROI du coaching en entreprise : chiffres clés 2025", position: 8.4, impressions: 3200 },
    ],
  },
  {
    keyword: "retour sur investissement coaching",
    articles: [
      { id: "a2", title: "ROI du coaching en entreprise : chiffres clés 2025", position: 6.2, impressions: 3100 },
      { id: "a6", title: "Comment mesurer l'impact du coaching sur vos équipes", position: 8.9, impressions: 2100 },
    ],
  },
  {
    keyword: "plateforme coaching digital",
    articles: [
      { id: "a4", title: "Coaching digital vs présentiel : le comparatif complet", position: 7.3, impressions: 4200 },
      { id: "a7", title: "Intelligence artificielle et coaching : le duo gagnant", position: 4.1, impressions: 3800 },
    ],
  },
];

// Tier 3
export const MOCK_ARTICLES: ArticlePerformance[] = [
  { id: "a7", title: "Intelligence artificielle et coaching : le duo gagnant", slug: "ia-coaching-duo-gagnant", publishedDate: "2026-03-08", sessions: 2340, organicClicks: 504, ctr: 7.0, avgPosition: 2.8, ctaConversions: 67, bounceRate: 34.2, avgDuration: 198, aiScore: 93, badge: "star", scoreBreakdown: { traffic: 18, engagement: 19, conversion: 18, seo: 19, seoBackend: 19 }, ctaDetails: [{ ctaName: "Demander une démo", clicks: 45, conversionRate: 8.2 }, { ctaName: "Télécharger le guide IA", clicks: 22, conversionRate: 4.1 }] },
  { id: "a8", title: "Coaching commercial : 7 techniques pour closer plus", slug: "coaching-commercial-closer", publishedDate: "2026-04-01", sessions: 1890, organicClicks: 348, ctr: 6.0, avgPosition: 3.5, ctaConversions: 54, bounceRate: 36.8, avgDuration: 185, aiScore: 87, badge: "star", scoreBreakdown: { traffic: 17, engagement: 18, conversion: 17, seo: 18, seoBackend: 17 }, ctaDetails: [{ ctaName: "Demander une démo", clicks: 38, conversionRate: 7.5 }, { ctaName: "Essai gratuit", clicks: 16, conversionRate: 3.2 }] },
  { id: "a2", title: "ROI du coaching en entreprise : chiffres clés 2025", slug: "roi-coaching-entreprise", publishedDate: "2025-08-22", sessions: 1650, organicClicks: 312, ctr: 6.0, avgPosition: 3.1, ctaConversions: 41, bounceRate: 38.5, avgDuration: 172, aiScore: 76, badge: "promising", scoreBreakdown: { traffic: 15, engagement: 16, conversion: 14, seo: 17, seoBackend: 14 }, ctaDetails: [{ ctaName: "Calculer votre ROI", clicks: 28, conversionRate: 6.1 }, { ctaName: "Demander une démo", clicks: 13, conversionRate: 2.8 }] },
  { id: "a1", title: "Comment le coaching transforme la performance commerciale", slug: "coaching-performance-commerciale", publishedDate: "2025-06-15", sessions: 1420, organicClicks: 420, ctr: 5.0, avgPosition: 4.2, ctaConversions: 32, bounceRate: 41.2, avgDuration: 165, aiScore: 71, badge: "promising", scoreBreakdown: { traffic: 14, engagement: 14, conversion: 13, seo: 16, seoBackend: 14 }, ctaDetails: [{ ctaName: "Demander une démo", clicks: 22, conversionRate: 4.8 }, { ctaName: "Voir les cas clients", clicks: 10, conversionRate: 2.2 }] },
  { id: "a5", title: "Onboarding et coaching : réduire le turnover de 40%", slug: "onboarding-coaching-turnover", publishedDate: "2026-01-18", sessions: 1280, organicClicks: 190, ctr: 5.0, avgPosition: 7.1, ctaConversions: 38, bounceRate: 39.1, avgDuration: 156, aiScore: 75, badge: "promising", scoreBreakdown: { traffic: 13, engagement: 15, conversion: 15, seo: 16, seoBackend: 16 }, ctaDetails: [{ ctaName: "Demander une démo", clicks: 25, conversionRate: 5.4 }, { ctaName: "Guide onboarding", clicks: 13, conversionRate: 2.8 }] },
  { id: "a3", title: "Leadership et coaching : les 5 compétences essentielles", slug: "leadership-coaching-competences", publishedDate: "2025-10-10", sessions: 980, organicClicks: 244, ctr: 4.0, avgPosition: 5.8, ctaConversions: 18, bounceRate: 45.6, avgDuration: 142, aiScore: 55, badge: "needs_optimization", scoreBreakdown: { traffic: 11, engagement: 12, conversion: 10, seo: 13, seoBackend: 9 }, ctaDetails: [{ ctaName: "Demander une démo", clicks: 12, conversionRate: 2.6 }, { ctaName: "Webinaire leadership", clicks: 6, conversionRate: 1.3 }] },
  { id: "a6", title: "Comment mesurer l'impact du coaching sur vos équipes", slug: "mesurer-impact-coaching", publishedDate: "2026-02-12", sessions: 890, organicClicks: 116, ctr: 4.0, avgPosition: 8.3, ctaConversions: 21, bounceRate: 43.8, avgDuration: 148, aiScore: 62, badge: "needs_optimization", scoreBreakdown: { traffic: 10, engagement: 13, conversion: 11, seo: 14, seoBackend: 14 }, ctaDetails: [{ ctaName: "Demander une démo", clicks: 14, conversionRate: 3.1 }, { ctaName: "Télécharger le template KPI", clicks: 7, conversionRate: 1.5 }] },
  { id: "a4", title: "Coaching digital vs présentiel : le comparatif complet", slug: "coaching-digital-vs-presentiel", publishedDate: "2025-12-05", sessions: 760, organicClicks: 215, ctr: 5.0, avgPosition: 6.4, ctaConversions: 14, bounceRate: 47.2, avgDuration: 135, aiScore: 50, badge: "needs_optimization", scoreBreakdown: { traffic: 10, engagement: 11, conversion: 8, seo: 13, seoBackend: 8 }, ctaDetails: [{ ctaName: "Demander une démo", clicks: 9, conversionRate: 2.0 }, { ctaName: "Comparatif PDF", clicks: 5, conversionRate: 1.1 }] },
  { id: "a9", title: "Les tendances du coaching en 2025", slug: "tendances-coaching-2025", publishedDate: "2025-04-20", sessions: 420, organicClicks: 63, ctr: 2.1, avgPosition: 18.4, ctaConversions: 5, bounceRate: 58.3, avgDuration: 95, aiScore: 30, badge: "declining", scoreBreakdown: { traffic: 6, engagement: 6, conversion: 5, seo: 8, seoBackend: 5 }, ctaDetails: [{ ctaName: "Demander une démo", clicks: 3, conversionRate: 0.7 }, { ctaName: "Newsletter", clicks: 2, conversionRate: 0.5 }] },
  { id: "a10", title: "Pourquoi investir dans le coaching d'équipe", slug: "investir-coaching-equipe", publishedDate: "2025-03-10", sessions: 310, organicClicks: 47, ctr: 1.8, avgPosition: 22.1, ctaConversions: 3, bounceRate: 62.1, avgDuration: 82, aiScore: 22, badge: "declining", scoreBreakdown: { traffic: 4, engagement: 5, conversion: 3, seo: 7, seoBackend: 3 }, ctaDetails: [{ ctaName: "Demander une démo", clicks: 2, conversionRate: 0.4 }, { ctaName: "Newsletter", clicks: 1, conversionRate: 0.2 }] },
];

// Tier 4
export const MOCK_CONTENT_ANALYSIS: ContentAnalysis = {
  topPerformers: [
    { title: "Intelligence artificielle et coaching : le duo gagnant", sessions: 2340, trend: 18.5 },
    { title: "Coaching commercial : 7 techniques pour closer plus", sessions: 1890, trend: 24.2 },
    { title: "ROI du coaching en entreprise : chiffres clés 2025", sessions: 1650, trend: 6.3 },
  ],
  risingTrends: [
    { keyword: "coaching ia générative", growth: 340 },
    { keyword: "coaching hybride remote", growth: 180 },
    { keyword: "coaching data driven", growth: 125 },
  ],
  contentGaps: [
    { topic: "Coaching et santé mentale en entreprise", competitorsCovering: ["CoachHub", "BetterUp"] },
    { topic: "Coaching pour les équipes tech / développeurs", competitorsCovering: ["BetterUp", "MentorCity"] },
    { topic: "Coaching intergénérationnel en entreprise", competitorsCovering: ["CoachHub"] },
  ],
};

export const MOCK_ARTICLE_RECOMMENDATIONS: ArticleRecommendation[] = [
  { id: "rec1", topic: "Comment l'IA générative révolutionne le coaching en entreprise", targetKeyword: "coaching ia générative", justification: "Le keyword 'coaching ia générative' a +340% de croissance ce trimestre. Votre article sur l'IA et le coaching (score 92) est votre meilleur performer — capitaliser sur cette dynamique avec un angle plus spécifique.", estimatedTraffic: 1200, difficulty: "medium", priority: "high", status: "recommended" },
  { id: "rec2", topic: "Coaching et bien-être mental : le guide complet pour les RH", targetKeyword: "bien-être au travail coaching", justification: "8 100 impressions/mois sur ce keyword mais 0 article dédié. CoachHub et BetterUp couvrent déjà ce sujet. Gap de contenu critique à combler.", estimatedTraffic: 800, difficulty: "easy", priority: "high", status: "recommended" },
  { id: "rec3", topic: "Coaching hybride : comment accompagner les équipes remote et présentiel", targetKeyword: "coaching hybride remote", justification: "Tendance montante (+180%). Votre article digital vs présentiel (score 52) est sous-performant — un nouvel angle 'hybride' moderniserait votre couverture du sujet.", estimatedTraffic: 650, difficulty: "medium", priority: "medium", status: "recommended" },
  { id: "rec4", topic: "Développer les soft skills de vos managers avec le coaching", targetKeyword: "soft skills coaching", justification: "5 500 impressions mais aucun article dédié. Position 15.8 — un article ciblé pourrait atteindre le top 5 rapidement vu votre autorité de domaine.", estimatedTraffic: 550, difficulty: "easy", priority: "medium", status: "recommended" },
  { id: "rec5", topic: "Coaching data-driven : mesurer et optimiser avec les KPIs", targetKeyword: "coaching data driven", justification: "Croissance +125%. Se différencie de la concurrence qui reste sur du contenu générique. Cross-sell naturel avec votre plateforme Coachello.", estimatedTraffic: 480, difficulty: "hard", priority: "low", status: "recommended" },
];

export const MOCK_ARTICLE_DRAFTS: ArticleDraft[] = [
  {
    recommendationId: "rec1",
    content: {
      fr: `<h2>L'IA générative transforme le coaching professionnel</h2>
<p>En 2026, l'intelligence artificielle générative ne remplace pas les coachs — elle les rend plus efficaces. Les entreprises qui combinent coaching humain et IA observent des résultats 3x supérieurs.</p>

<h3>1. Personnalisation à grande échelle</h3>
<p>L'IA analyse les patterns comportementaux de chaque collaborateur pour adapter le parcours de coaching en temps réel. Fini les programmes one-size-fits-all. Pour comprendre comment cela <a href="https://coachello.ai/blog/coaching-performance-commerciale" style="color:#f01563;text-decoration:underline">transforme la performance de vos commerciaux</a>, lisez notre guide dédié.</p>

<h3>2. Préparation intelligente des sessions</h3>
<p>Avant chaque session, l'IA compile les données de performance, les feedbacks 360° et les objectifs pour que le coach arrive avec un brief complet.</p>

<h3>3. Suivi continu entre les sessions</h3>
<p>Des micro-exercices générés par IA maintiennent l'engagement entre deux sessions. Le collaborateur progresse même quand le coach n'est pas là. Découvrez comment <a href="https://coachello.ai/blog/mesurer-impact-coaching" style="color:#f01563;text-decoration:underline">mesurer l'impact de votre programme de coaching</a> pour quantifier ces progrès.</p>

<h3>4. Mesure d'impact en temps réel</h3>
<p>Plus besoin d'attendre 6 mois pour mesurer le ROI. L'IA détecte les changements de comportement et quantifie les progrès semaine après semaine. Notre article sur le <a href="https://coachello.ai/blog/roi-coaching-entreprise" style="color:#f01563;text-decoration:underline">ROI du coaching en entreprise</a> détaille les chiffres clés à suivre.</p>

<div style="background:#f0f7ff;padding:20px;border-radius:12px;text-align:center;margin:24px 0">
  <p style="font-weight:600;margin-bottom:8px">Découvrez comment Coachello combine IA et coaching humain</p>
  <button style="background:#f01563;color:white;padding:10px 24px;border:none;border-radius:8px;font-weight:600;cursor:pointer">Demander une démo</button>
</div>

<h3>Conclusion</h3>
<p>L'IA générative n'est pas l'avenir du coaching — c'est son présent. Les entreprises qui n'adoptent pas cette approche risquent de prendre du retard sur leurs concurrents.</p>`,
      en: `<h2>Generative AI is transforming professional coaching</h2>
<p>In 2026, generative artificial intelligence isn't replacing coaches — it's making them more effective. Companies combining human coaching and AI are seeing 3x better results.</p>

<h3>1. Personalization at scale</h3>
<p>AI analyzes each employee's behavioral patterns to adapt the coaching journey in real time. No more one-size-fits-all programs. Learn how this <a href="https://coachello.ai/blog/coaching-performance-commerciale" style="color:#f01563;text-decoration:underline">transforms your sales team's performance</a> in our dedicated guide.</p>

<h3>2. Intelligent session preparation</h3>
<p>Before each session, AI compiles performance data, 360° feedback, and goals so the coach arrives with a complete brief.</p>

<h3>3. Continuous follow-up between sessions</h3>
<p>AI-generated micro-exercises maintain engagement between sessions. The employee keeps progressing even when the coach isn't there. Discover how to <a href="https://coachello.ai/blog/mesurer-impact-coaching" style="color:#f01563;text-decoration:underline">measure the impact of your coaching program</a> to quantify this progress.</p>

<h3>4. Real-time impact measurement</h3>
<p>No more waiting 6 months to measure ROI. AI detects behavioral changes and quantifies progress week by week. Our article on <a href="https://coachello.ai/blog/roi-coaching-entreprise" style="color:#f01563;text-decoration:underline">coaching ROI for businesses</a> details the key metrics to track.</p>

<div style="background:#f0f7ff;padding:20px;border-radius:12px;text-align:center;margin:24px 0">
  <p style="font-weight:600;margin-bottom:8px">Discover how Coachello combines AI and human coaching</p>
  <button style="background:#f01563;color:white;padding:10px 24px;border:none;border-radius:8px;font-weight:600;cursor:pointer">Request a demo</button>
</div>

<h3>Conclusion</h3>
<p>Generative AI isn't the future of coaching — it's the present. Companies that don't adopt this approach risk falling behind their competitors.</p>`,
    },
    wordpressFormat: {
      fr: { category: "Coaching & IA", tags: ["intelligence artificielle", "coaching digital", "innovation RH", "coaching entreprise"], excerpt: "Découvrez comment l'IA générative transforme le coaching professionnel en 2026 : personnalisation, suivi continu et mesure d'impact en temps réel.", slug: "ia-generative-coaching-entreprise" },
      en: { category: "Coaching & AI", tags: ["artificial intelligence", "digital coaching", "HR innovation", "corporate coaching"], excerpt: "Discover how generative AI is transforming professional coaching in 2026: personalization, continuous follow-up, and real-time impact measurement.", slug: "generative-ai-corporate-coaching" },
    },
    styleMatchScore: 87,
    internalLinks: {
      fr: [
        { anchorText: "transforme la performance de vos commerciaux", targetArticleTitle: "Comment le coaching transforme la performance commerciale", targetUrl: "https://coachello.ai/blog/coaching-performance-commerciale" },
        { anchorText: "mesurer l'impact de votre programme de coaching", targetArticleTitle: "Comment mesurer l'impact du coaching sur vos équipes", targetUrl: "https://coachello.ai/blog/mesurer-impact-coaching" },
        { anchorText: "ROI du coaching en entreprise", targetArticleTitle: "ROI du coaching en entreprise : chiffres clés 2025", targetUrl: "https://coachello.ai/blog/roi-coaching-entreprise" },
      ],
      en: [
        { anchorText: "transforms your sales team's performance", targetArticleTitle: "How coaching transforms sales performance", targetUrl: "https://coachello.ai/blog/coaching-performance-commerciale" },
        { anchorText: "measure the impact of your coaching program", targetArticleTitle: "How to measure coaching impact on your teams", targetUrl: "https://coachello.ai/blog/mesurer-impact-coaching" },
        { anchorText: "coaching ROI for businesses", targetArticleTitle: "Coaching ROI: key figures 2025", targetUrl: "https://coachello.ai/blog/roi-coaching-entreprise" },
      ],
    },
  },
];

// Tier 5
export const MOCK_REFRESH_RECOMMENDATIONS: RefreshRecommendation[] = [
  { articleId: "a9", title: "Les tendances du coaching en 2025", publishedDate: "2025-04-20", currentSessions: 420, peakSessions: 1100, trafficTrend: [1100, 980, 870, 780, 700, 640, 580, 530, 490, 460, 430, 420], suggestions: ["Mettre à jour le titre pour 2026", "Ajouter une section sur l'IA générative", "Actualiser les statistiques avec les données 2026", "Ajouter des liens vers vos articles récents"] },
  { articleId: "a10", title: "Pourquoi investir dans le coaching d'équipe", publishedDate: "2025-03-10", currentSessions: 310, peakSessions: 850, trafficTrend: [850, 760, 680, 610, 550, 500, 450, 410, 380, 350, 330, 310], suggestions: ["Ajouter des cas clients concrets avec des chiffres", "Intégrer une infographie ROI", "Ajouter un CTA vers le calculateur de ROI", "Restructurer avec des H2 plus orientés bénéfices"] },
  { articleId: "a4", title: "Coaching digital vs présentiel : le comparatif complet", publishedDate: "2025-12-05", currentSessions: 760, peakSessions: 1050, trafficTrend: [1050, 1010, 970, 940, 910, 880, 850, 830, 810, 790, 770, 760], suggestions: ["Ajouter la dimension 'hybride' au comparatif", "Mettre à jour les prix et les solutions du marché", "Ajouter un tableau comparatif visuel"] },
];

export const MOCK_MERGE_RECOMMENDATIONS: MergeRecommendation[] = [
  { articles: [{ id: "a2", title: "ROI du coaching en entreprise : chiffres clés 2025", sessions: 1650, keyword: "roi coaching" }, { id: "a6", title: "Comment mesurer l'impact du coaching sur vos équipes", sessions: 890, keyword: "mesurer impact coaching" }], justification: "Ces deux articles couvrent le même sujet (mesure du ROI du coaching) sous des angles différents. Fusionner en un article pilier 'Guide complet : mesurer et maximiser le ROI du coaching' permettrait d'éliminer la cannibalisation et de créer un contenu plus complet (3000+ mots) qui rankerait mieux." },
  { articles: [{ id: "a9", title: "Les tendances du coaching en 2025", sessions: 420, keyword: "tendances coaching" }, { id: "a10", title: "Pourquoi investir dans le coaching d'équipe", sessions: 310, keyword: "coaching équipe" }], justification: "Deux articles courts et datés. Fusionner en 'Coaching d'équipe en 2026 : tendances, ROI et mise en place' créerait un contenu frais et complet à partir de deux articles en déclin." },
];

export const MOCK_INTERNAL_LINKS: InternalLinkSuggestion[] = [
  { sourceArticleId: "a7", sourceTitle: "Intelligence artificielle et coaching", targetArticleId: "a6", targetTitle: "Comment mesurer l'impact du coaching", anchorText: "mesurer l'impact de votre programme de coaching" },
  { sourceArticleId: "a8", sourceTitle: "Coaching commercial : 7 techniques", targetArticleId: "a1", targetTitle: "Comment le coaching transforme la performance", anchorText: "transformer la performance de vos commerciaux" },
  { sourceArticleId: "a5", sourceTitle: "Onboarding et coaching", targetArticleId: "a2", targetTitle: "ROI du coaching en entreprise", anchorText: "calculer le ROI de votre programme de coaching" },
  { sourceArticleId: "a1", sourceTitle: "Comment le coaching transforme la performance", targetArticleId: "a8", targetTitle: "Coaching commercial : 7 techniques pour closer", anchorText: "techniques concrètes pour closer plus de deals" },
  { sourceArticleId: "a3", sourceTitle: "Leadership et coaching", targetArticleId: "a7", targetTitle: "Intelligence artificielle et coaching", anchorText: "comment l'IA amplifie l'impact du coaching" },
];

export const MOCK_EDITORIAL_CALENDAR: EditorialCalendarItem[] = [
  { week: 1, weekLabel: "7-13 avr", topic: "Comment l'IA générative révolutionne le coaching", targetKeyword: "coaching ia générative", priority: "high", justification: "Keyword en forte croissance (+340%), capitaliser sur le momentum de votre article IA (score 92)" },
  { week: 1, weekLabel: "7-13 avr", topic: "Coaching et bien-être mental : guide RH", targetKeyword: "bien-être au travail coaching", priority: "high", justification: "8 100 impressions sans article dédié, gap critique face à CoachHub/BetterUp" },
  { week: 2, weekLabel: "14-20 avr", topic: "Développer les soft skills avec le coaching", targetKeyword: "soft skills coaching", priority: "medium", justification: "5 500 impressions, aucun article dédié, difficulté faible" },
  { week: 3, weekLabel: "21-27 avr", topic: "Coaching hybride : équipes remote et présentiel", targetKeyword: "coaching hybride remote", priority: "medium", justification: "Tendance +180%, modernise votre couverture du digital" },
  { week: 4, weekLabel: "28 avr-4 mai", topic: "Coaching data-driven : KPIs et optimisation", targetKeyword: "coaching data driven", priority: "low", justification: "Croissance +125%, différenciation vs concurrence" },
];

export const MOCK_COMPETITOR_BENCHMARKS: CompetitorBenchmark[] = [
  { topic: "Coaching et performance commerciale", coachello: true, coachHub: true, betterUp: true, mentorCity: false },
  { topic: "ROI du coaching", coachello: true, coachHub: true, betterUp: true, mentorCity: true },
  { topic: "Coaching et IA", coachello: true, coachHub: false, betterUp: true, mentorCity: false },
  { topic: "Coaching et santé mentale", coachello: false, coachHub: true, betterUp: true, mentorCity: false },
  { topic: "Coaching pour équipes tech", coachello: false, coachHub: false, betterUp: true, mentorCity: true },
  { topic: "Coaching intergénérationnel", coachello: false, coachHub: true, betterUp: false, mentorCity: false },
  { topic: "Coaching et onboarding", coachello: true, coachHub: true, betterUp: false, mentorCity: false },
  { topic: "Leadership et coaching", coachello: true, coachHub: true, betterUp: true, mentorCity: true },
  { topic: "Coaching digital / hybride", coachello: true, coachHub: true, betterUp: true, mentorCity: false },
  { topic: "Soft skills et développement", coachello: false, coachHub: true, betterUp: true, mentorCity: true },
  { topic: "Coaching et diversité / inclusion", coachello: false, coachHub: true, betterUp: true, mentorCity: false },
  { topic: "Mesure d'impact du coaching", coachello: true, coachHub: false, betterUp: true, mentorCity: false },
];

// Tier 6
export const MOCK_HEATMAP: PublicationHeatmapCell[] = (() => {
  const cells: PublicationHeatmapCell[] = [];
  const scores = [
    // Lun  Mar  Mer  Jeu  Ven  Sam  Dim
    [12, 15, 18, 14, 10, 5, 3],   // 0-4h
    [35, 40, 42, 38, 30, 15, 10], // 4-8h
    [78, 85, 92, 82, 70, 35, 20], // 8-12h
    [65, 72, 75, 70, 60, 28, 18], // 12-16h
    [50, 55, 58, 52, 45, 22, 15], // 16-20h
    [25, 30, 32, 28, 22, 12, 8],  // 20-24h
  ];
  for (let slot = 0; slot < 6; slot++) {
    for (let day = 0; day < 7; day++) {
      cells.push({ day, slot, score: scores[slot][day] });
    }
  }
  return cells;
})();

export const MOCK_ALERTS: Alert[] = [
  { id: "al1", type: "traffic_drop", severity: "high", title: "Chute de trafic sur 'Les tendances du coaching en 2025'", description: "Le trafic a chuté de 28% cette semaine (420 → 302 sessions). L'article est en position 18.4 et continue de descendre.", date: "2026-04-08", articleId: "a9" },
  { id: "al2", type: "keyword_lost", severity: "high", title: "'coaching professionnel prix' sorti du top 10", description: "Ce keyword est passé de la position 10 à la position 11.3. Il génère 9 200 impressions/mois — une optimisation rapide pourrait le remonter.", date: "2026-04-07", articleId: "a2" },
  { id: "al3", type: "competitor_publish", severity: "medium", title: "CoachHub a publié un article sur le coaching IA", description: "CoachHub vient de publier 'AI-Powered Coaching: The Future of Employee Development'. Sujet qui chevauche votre article star.", date: "2026-04-06" },
  { id: "al4", type: "cta_spike", severity: "low", title: "Pic de conversions sur 'Coaching commercial'", description: "Le CTA 'Demander une démo' a eu +45% de clics cette semaine sur l'article coaching commercial. Potentiel viral LinkedIn détecté.", date: "2026-04-05", articleId: "a8" },
  { id: "al5", type: "new_ranking", severity: "low", title: "Nouveau ranking : 'coaching ia entreprise' en position 3.2", description: "Votre article IA est maintenant en position 3.2 pour ce keyword à 4 800 impressions/mois. En progression constante depuis 12 semaines.", date: "2026-04-04", articleId: "a7" },
];

export const MOCK_ARTICLE_ROI: ArticleROI[] = [
  { articleId: "a7", title: "Intelligence artificielle et coaching", writingTimeHours: 6, leadsGenerated: 67, costPerLead: 8.96, roi: 420 },
  { articleId: "a8", title: "Coaching commercial : 7 techniques", writingTimeHours: 5, leadsGenerated: 54, costPerLead: 9.26, roi: 380 },
  { articleId: "a5", title: "Onboarding et coaching", writingTimeHours: 4, leadsGenerated: 38, costPerLead: 10.53, roi: 310 },
  { articleId: "a2", title: "ROI du coaching en entreprise", writingTimeHours: 8, leadsGenerated: 41, costPerLead: 19.51, roi: 175 },
  { articleId: "a1", title: "Comment le coaching transforme la performance", writingTimeHours: 7, leadsGenerated: 32, costPerLead: 21.88, roi: 145 },
  { articleId: "a6", title: "Comment mesurer l'impact du coaching", writingTimeHours: 5, leadsGenerated: 21, costPerLead: 23.81, roi: 120 },
  { articleId: "a3", title: "Leadership et coaching", writingTimeHours: 6, leadsGenerated: 18, costPerLead: 33.33, roi: 80 },
  { articleId: "a4", title: "Coaching digital vs présentiel", writingTimeHours: 7, leadsGenerated: 14, costPerLead: 50.0, roi: 45 },
  { articleId: "a9", title: "Les tendances du coaching en 2025", writingTimeHours: 4, leadsGenerated: 5, costPerLead: 80.0, roi: -12 },
  { articleId: "a10", title: "Pourquoi investir dans le coaching d'équipe", writingTimeHours: 5, leadsGenerated: 3, costPerLead: 166.67, roi: -35 },
];

export const MOCK_SOCIAL_PERFORMANCE: SocialPerformance[] = [
  { articleId: "a7", title: "Intelligence artificielle et coaching", platform: "linkedin", shares: 142, clicks: 890, engagement: 8.4, referralTraffic: 456 },
  { articleId: "a7", title: "Intelligence artificielle et coaching", platform: "twitter", shares: 67, clicks: 340, engagement: 4.2, referralTraffic: 178 },
  { articleId: "a8", title: "Coaching commercial : 7 techniques", platform: "linkedin", shares: 98, clicks: 620, engagement: 7.1, referralTraffic: 312 },
  { articleId: "a8", title: "Coaching commercial : 7 techniques", platform: "twitter", shares: 45, clicks: 210, engagement: 3.5, referralTraffic: 98 },
  { articleId: "a2", title: "ROI du coaching en entreprise", platform: "linkedin", shares: 76, clicks: 480, engagement: 6.2, referralTraffic: 234 },
  { articleId: "a2", title: "ROI du coaching en entreprise", platform: "twitter", shares: 32, clicks: 160, engagement: 2.8, referralTraffic: 72 },
  { articleId: "a5", title: "Onboarding et coaching", platform: "linkedin", shares: 54, clicks: 320, engagement: 5.4, referralTraffic: 156 },
  { articleId: "a5", title: "Onboarding et coaching", platform: "twitter", shares: 21, clicks: 95, engagement: 2.1, referralTraffic: 42 },
  { articleId: "a1", title: "Comment le coaching transforme la performance", platform: "linkedin", shares: 68, clicks: 410, engagement: 5.8, referralTraffic: 198 },
  { articleId: "a1", title: "Comment le coaching transforme la performance", platform: "twitter", shares: 28, clicks: 130, engagement: 2.4, referralTraffic: 58 },
];

export const MOCK_TITLE_VARIANTS: TitleVariant[] = [
  { articleId: "a3", originalTitle: "Leadership et coaching : les 5 compétences essentielles", variants: [{ title: "Les 5 compétences de leadership que le coaching développe (données 2026)", estimatedCtr: 6.2, isRecommended: true }, { title: "Coaching de leadership : 5 compétences clés pour vos managers", estimatedCtr: 5.8, isRecommended: false }, { title: "Développer le leadership par le coaching : guide pratique", estimatedCtr: 4.5, isRecommended: false }] },
  { articleId: "a4", originalTitle: "Coaching digital vs présentiel : le comparatif complet", variants: [{ title: "Coaching digital ou présentiel ? Le comparatif basé sur les données", estimatedCtr: 6.8, isRecommended: true }, { title: "Digital vs présentiel : quel format de coaching choisir en 2026 ?", estimatedCtr: 6.4, isRecommended: false }, { title: "Comparatif coaching : digital, présentiel ou hybride ?", estimatedCtr: 5.9, isRecommended: false }] },
  { articleId: "a9", originalTitle: "Les tendances du coaching en 2025", variants: [{ title: "Coaching en entreprise : les 7 tendances qui dominent 2026", estimatedCtr: 5.5, isRecommended: true }, { title: "Tendances coaching 2026 : ce qui a changé et ce qui arrive", estimatedCtr: 5.1, isRecommended: false }, { title: "L'état du coaching professionnel en 2026 : chiffres et tendances", estimatedCtr: 4.8, isRecommended: false }] },
];
