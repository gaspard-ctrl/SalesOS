import useSWR from "swr";
import type {
  MarketingKPI,
  TrafficDataPoint,
  TrafficSource,
  GA4TopArticle,
  Keyword,
  CannibalizationAlert,
  ContentAnalysis,
  ArticleRecommendation,
  ArticleDraft,
  PageTrend,
  SeoTrendsResponse,
  DeviceBreakdown,
  CountryBreakdown,
  LeadsTimelinePoint,
  ImpressionsTimelinePoint,
  ArticleTimelinePoint,
  MarketingEvent,
  MarketingEventType,
  Lead,
  LeadsCounts,
  LeadValidationStatus,
} from "@/lib/marketing-types";

const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 30_000 } as const;

// ─── Overview ────────────────────────────────────────────────────────────────

interface OverviewResponse {
  kpis: MarketingKPI | null;
  trafficData: TrafficDataPoint[];
  trafficSources: TrafficSource[];
  topPages: GA4TopArticle[];
  devices: DeviceBreakdown[];
  countries: CountryBreakdown[];
  leadsTimeline: LeadsTimelinePoint[];
  impressionsTimeline: ImpressionsTimelinePoint[];
  articlesTimeline: ArticleTimelinePoint[];
  source: "ga4" | "mock" | "none";
  ga4Error?: string;
}

export type OverviewPeriod =
  | { kind: "days"; days: 7 | 14 | 30 | 90 | 365 }
  | { kind: "range"; from: string; to: string };

export function useMarketingOverview(period: OverviewPeriod) {
  const query = period.kind === "days"
    ? `period=${period.days}`
    : `from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`;
  const { data, error, isLoading } = useSWR<OverviewResponse>(
    `/api/marketing/overview?${query}`,
    SWR_OPTS,
  );
  return {
    kpis: data?.kpis ?? null,
    trafficData: data?.trafficData ?? [],
    trafficSources: data?.trafficSources ?? [],
    topPages: data?.topPages ?? [],
    devices: data?.devices ?? [],
    countries: data?.countries ?? [],
    leadsTimeline: data?.leadsTimeline ?? [],
    impressionsTimeline: data?.impressionsTimeline ?? [],
    articlesTimeline: data?.articlesTimeline ?? [],
    source: data?.source ?? "none",
    ga4Error: data?.ga4Error ?? null,
    isLoading,
    error: error ? "Loading error" : "",
  };
}

// ─── Marketing events (salons, LinkedIn posts) ──────────────────────────────

interface EventsResponse {
  events: MarketingEvent[];
  error?: string;
}

export function useMarketingEvents() {
  const { data, error, isLoading, mutate } = useSWR<EventsResponse>(
    `/api/marketing/events`,
    SWR_OPTS,
  );

  async function addEvent(input: { event_date: string; event_type: MarketingEventType; label: string }) {
    const res = await fetch("/api/marketing/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const { error: err } = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err || "Failed to add event");
    }
    await mutate();
  }

  async function deleteEvent(id: string) {
    const res = await fetch(`/api/marketing/events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const { error: err } = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err || "Failed to delete event");
    }
    await mutate();
  }

  return {
    events: data?.events ?? [],
    eventsError: data?.error ?? null,
    isLoading,
    error: error ? "Loading error" : "",
    addEvent,
    deleteEvent,
  };
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

interface SeoResponse {
  keywords: Keyword[];
  cannibalizationAlerts: CannibalizationAlert[];
  error?: string;
}

export function useMarketingSeo(days = 28, opportunitiesOnly = false) {
  const params = new URLSearchParams({ days: String(days) });
  if (opportunitiesOnly) params.set("opportunities", "true");
  const { data, error, isLoading } = useSWR<SeoResponse>(
    `/api/marketing/seo?${params.toString()}`,
    SWR_OPTS,
  );
  return {
    keywords: data?.keywords ?? [],
    cannibalizationAlerts: data?.cannibalizationAlerts ?? [],
    seoError: data?.error ?? null,
    isLoading,
    error: error ? "Loading error" : "",
  };
}

// ─── SEO trends (Winners / Losers) ───────────────────────────────────────────

export function useMarketingSeoTrends(days = 28) {
  const { data, error, isLoading } = useSWR<SeoTrendsResponse>(
    `/api/marketing/seo-trends?days=${days}`,
    SWR_OPTS,
  );
  return {
    winners: (data?.winners ?? []) as PageTrend[],
    losers: (data?.losers ?? []) as PageTrend[],
    seoTrendsError: data?.error ?? null,
    isLoading,
    error: error ? "Loading error" : "",
  };
}

// ─── Content Factory ─────────────────────────────────────────────────────────

interface ContentResponse {
  analysis: ContentAnalysis | null;
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
    error: error ? "Loading error" : "",
    reload: () => mutate(),
  };
}

// ─── Leads (admin) ───────────────────────────────────────────────────────────

export type LeadsStatusFilter = LeadValidationStatus | "all";

interface LeadsResponse {
  leads: Lead[];
  counts: LeadsCounts;
  error?: string;
}

export function useLeads(status: LeadsStatusFilter) {
  const { data, error, isLoading, mutate } = useSWR<LeadsResponse>(
    `/api/marketing/leads?status=${status}`,
    { revalidateOnFocus: false, dedupingInterval: 10_000 },
  );

  async function validateLead(id: string, newStatus: LeadValidationStatus) {
    const res = await fetch("/api/marketing/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    if (!res.ok) {
      const { error: err } = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err || "Failed to validate lead");
    }
    await mutate();
  }

  async function syncLeads() {
    const res = await fetch("/api/marketing/leads/sync", { method: "POST" });
    if (!res.ok) {
      const { error: err } = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err || "Failed to sync leads");
    }
    const json = await res.json();
    await mutate();
    return json as { inserted: number };
  }

  return {
    leads: data?.leads ?? [],
    counts: data?.counts ?? { pending: 0, validated: 0, rejected: 0 },
    leadsError: data?.error ?? null,
    isLoading,
    error: error ? "Loading error" : "",
    validateLead,
    syncLeads,
    refresh: () => mutate(),
  };
}

