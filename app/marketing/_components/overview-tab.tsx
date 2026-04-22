"use client";

import { useState, useMemo, useEffect } from "react";
import { TrendingUp, TrendingDown, Info, BarChart3, LineChart as LineChartIcon, X, Calendar } from "lucide-react";
import { useMarketingOverview, useMarketingSeoTrends, useMarketingEvents, type OverviewPeriod } from "@/lib/hooks/use-marketing";
import type { PageTrend, DeviceBreakdown, CountryBreakdown, MarketingEvent, MarketingEventType, ArticleTimelinePoint, TrafficSource } from "@/lib/marketing-types";
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  Scatter,
} from "recharts";
import { EventsButton } from "./events-panel";
import { FilterRow, DEFAULT_FILTERS, type FilterState } from "./overview-tab-filters";
import { BarView } from "./bar-view";

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatNumber(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}


const PERIODS = [
  { value: 7 as const, label: "7d" },
  { value: 14 as const, label: "14d" },
  { value: 30 as const, label: "30d" },
  { value: 90 as const, label: "90d" },
  { value: 365 as const, label: "1y" },
];

const EVENT_COLORS: Record<MarketingEventType, string> = {
  salon:              "#16a34a",
  linkedin_pro:       "#3b82f6",
  linkedin_perso:     "#8b5cf6",
  nurturing_campaign: "#14b8a6",
};

const EVENT_TYPE_LABEL: Record<MarketingEventType, string> = {
  salon:              "Salon",
  linkedin_pro:       "LinkedIn Pro",
  linkedin_perso:     "LinkedIn Perso",
  nurturing_campaign: "Nurturing",
};

type MarkerType = "lead" | "article" | "salon" | "linkedin_pro" | "linkedin_perso" | "nurturing_campaign";
type MarkerGroup = {
  type: MarkerType;
  color: string;
  count: number;
  tooltip: string;  // multi-line tooltip listing the details
};

const MARKER_COLORS: Record<MarkerType, string> = {
  lead:               "#facc15",
  article:            "#0ea5e9",
  salon:              "#16a34a",
  linkedin_pro:       "#3b82f6",
  linkedin_perso:     "#8b5cf6",
  nurturing_campaign: "#14b8a6",
};

export default function OverviewTab() {
  const [period, setPeriod] = useState<OverviewPeriod>({ kind: "days", days: 30 });
  const [view, setView] = useState<"line" | "bar">("line");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Bar view always fetches 365 days; line view uses the selected period.
  const dataPeriod: OverviewPeriod = view === "bar" ? { kind: "days", days: 365 } : period;

  const { kpis, trafficData, trafficSources, topPages, devices, countries, leadsTimeline, impressionsTimeline, articlesTimeline, source, ga4Error, isLoading } = useMarketingOverview(dataPeriod);
  const periodLen = period.kind === "days" ? period.days : Math.max(1, Math.round((new Date(period.to).getTime() - new Date(period.from).getTime()) / 86400000) + 1);
  const seoTrendsDays = periodLen <= 14 ? 14 : 28;
  const { winners, losers, seoTrendsError } = useMarketingSeoTrends(seoTrendsDays);
  const { events: marketingEvents } = useMarketingEvents();

  // Aggregate markers by type for each day. For long periods we also bucket
  // leads to weekly so the dots don't overlap across days (at 365d, each day
  // is ~3px wide so even a r=3 dot bleeds into neighbours).
  const chartData = useMemo(() => {
    // Leads bucket: aggregate weekly for periods > 90d, every 2 days for >30d, else daily.
    const leadBucketSize = periodLen > 90 ? 7 : periodLen > 30 ? 2 : 1;
    // Build bucket → { anchor date, total count }. Anchor = last day of the bucket
    // that exists in trafficData, so the dot lands on a real X position.
    const leadsByBucket = new Map<string, { anchorDate: string; count: number }>();
    const trafficDates = new Set(trafficData.map((p) => p.date));
    function bucketKey(date: string): string {
      if (leadBucketSize === 1) return date;
      const d = new Date(date + "T12:00:00Z");
      const bucketStart = new Date(d);
      bucketStart.setUTCDate(d.getUTCDate() - (bucketStart.getUTCDate() % leadBucketSize));
      return bucketStart.toISOString().slice(0, 10);
    }
    for (const p of leadsTimeline) {
      if (p.count === 0) continue;
      const key = bucketKey(p.date);
      const entry = leadsByBucket.get(key) ?? { anchorDate: p.date, count: 0 };
      entry.count += p.count;
      // Keep latest date in the bucket as anchor (as long as it's in trafficData)
      if (p.date > entry.anchorDate && trafficDates.has(p.date)) entry.anchorDate = p.date;
      leadsByBucket.set(key, entry);
    }
    // Map: anchorDate → total leads in bucket
    const leadsAnchorMap = new Map<string, number>();
    for (const { anchorDate, count } of leadsByBucket.values()) {
      leadsAnchorMap.set(anchorDate, (leadsAnchorMap.get(anchorDate) ?? 0) + count);
    }

    const articlesByDate = new Map<string, ArticleTimelinePoint[]>();
    for (const a of articlesTimeline) {
      const list = articlesByDate.get(a.date) ?? [];
      list.push(a);
      articlesByDate.set(a.date, list);
    }
    const eventsByDate = new Map<string, MarketingEvent[]>();
    for (const e of marketingEvents) {
      const list = eventsByDate.get(e.event_date) ?? [];
      list.push(e);
      eventsByDate.set(e.event_date, list);
    }
    return trafficData.map((p) => {
      const groups: MarkerGroup[] = [];
      const leadCount = filters.leads ? (leadsAnchorMap.get(p.date) ?? 0) : 0;
      if (leadCount > 0) {
        const bucketLabel = leadBucketSize === 1 ? "today" : leadBucketSize === 2 ? "on 2 days" : "this week";
        groups.push({
          type: "lead",
          color: MARKER_COLORS.lead,
          count: leadCount,
          tooltip: `${leadCount} lead${leadCount > 1 ? "s" : ""} ${bucketLabel}`,
        });
      }
      const articlesForDay = filters.articles ? (articlesByDate.get(p.date) ?? []) : [];
      if (articlesForDay.length > 0) {
        groups.push({
          type: "article",
          color: MARKER_COLORS.article,
          count: articlesForDay.length,
          tooltip: `${articlesForDay.length} article${articlesForDay.length > 1 ? "s" : ""}: ${articlesForDay.map((a) => a.title).join(" · ")}`,
        });
      }
      const byType: Record<MarketingEventType, MarketingEvent[]> = {
        salon: [], linkedin_pro: [], linkedin_perso: [], nurturing_campaign: [],
      };
      for (const ev of eventsByDate.get(p.date) ?? []) byType[ev.event_type].push(ev);
      (["salon", "linkedin_pro", "linkedin_perso", "nurturing_campaign"] as MarketingEventType[]).forEach((t) => {
        if (!filters[t]) return;
        const list = byType[t];
        if (list.length === 0) return;
        groups.push({
          type: t,
          color: EVENT_COLORS[t],
          count: list.length,
          tooltip: `${EVENT_TYPE_LABEL[t]}: ${list.map((e) => e.label).join(" · ")}`,
        });
      });
      return {
        date: p.date,
        users: p.visitors,
        groups,
        // Y for the markers Scatter = users value (on the curve); undefined skips the day.
        markersY: groups.length > 0 ? p.visitors : undefined,
      };
    });
  }, [trafficData, leadsTimeline, articlesTimeline, marketingEvents, filters, periodLen]);

  function handleMonthClick(start: string, end: string) {
    setPeriod({ kind: "range", from: start, to: end });
    setView("line");
  }

  // Dot sizing adapts to period length — more room per day = bigger dots.
  const dotSizing = periodLen <= 30
    ? { baseR: 3.8, growth: 1.0, maxR: 7.5, spacing: 7, showCountThreshold: 8 }
    : periodLen <= 90
    ? { baseR: 2.8, growth: 0.75, maxR: 6, spacing: 5, showCountThreshold: 10 }
    : { baseR: 1.8, growth: 0.55, maxR: 4.5, spacing: 4, showCountThreshold: Infinity };

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    const leadsTooltip = kpis.incomingLeadsChannelMissing
      ? "Channel Slack #1a-new-incoming-leads introuvable (le bot n'y est peut-être pas invité). Invite le bot dans le channel pour compter les messages."
      : "Compte les messages postés dans le channel Slack #1a-new-incoming-leads sur la période (hors system events comme joins/leaves, hors thread replies). Chaque message = 1 lead entrant.";
    return [
      { label: "SESSIONS", value: formatNumber(kpis.sessions), wow: kpis.sessionsWoW, invertColor: false, tooltip: "GA4: sessions — nombre total de sessions démarrées sur le site." },
      { label: "ENGAGED SESSIONS", value: formatNumber(kpis.engagedSessions), wow: kpis.engagedSessionsWoW, invertColor: false, tooltip: "GA4: engagedSessions — sessions qui ont (1) duré plus de 10 secondes, OU (2) déclenché au moins 1 key event (conversion), OU (3) vu au moins 2 pages. Indicateur clé de qualité du trafic : une session non engagée = un visiteur qui part vite sans interagir." },
      { label: "ACTIVE USERS", value: formatNumber(kpis.activeUsers), wow: kpis.activeUsersWoW, invertColor: false, tooltip: "GA4: activeUsers — users qui ont eu au moins une session engagée." },
      { label: "NEW USERS", value: formatNumber(kpis.newUsers), wow: kpis.newUsersWoW, invertColor: false, tooltip: "GA4: newUsers — première visite sur le site." },
      { label: "PAGE VIEWS", value: formatNumber(kpis.pageViews), wow: kpis.pageViewsWoW, invertColor: false, tooltip: "GA4: screenPageViews — nombre total de pages vues." },
      { label: "AVG. DURATION", value: formatDuration(kpis.avgDuration), wow: kpis.avgDurationWoW, invertColor: false, tooltip: "GA4: averageSessionDuration — durée moyenne d'une session en secondes." },
      { label: "KEY EVENTS", value: formatNumber(kpis.keyEvents), wow: kpis.keyEventsWoW, invertColor: false, tooltip: "GA4: keyEvents — events marqués comme clés dans GA4 Admin → Events (remplace `conversions` depuis mars 2024)." },
      { label: "INCOMING LEADS", value: formatNumber(kpis.incomingLeads), wow: kpis.incomingLeadsWoW, invertColor: false, tooltip: leadsTooltip },
    ];
  }, [kpis]);

  const hasLiveTopPages = topPages.length > 0;

  if (isLoading) return <div className="text-sm" style={{ color: "#888" }}>Loading...</div>;

  const totalSessions = trafficSources.reduce((s, t) => s + t.sessions, 0);
  const hasData = kpis !== null;

  return (
    <div className="space-y-5">
      {/* Date filter + source badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {PERIODS.map((p) => {
            const active = period.kind === "days" && period.days === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setPeriod({ kind: "days", days: p.value })}
                className="text-xs font-medium rounded-full px-3 py-1 transition-colors"
                style={{
                  background: active ? "#f01563" : "#fff",
                  color: active ? "#fff" : "#888",
                  border: active ? "1px solid #f01563" : "1px solid #eee",
                }}
              >
                {p.label}
              </button>
            );
          })}
          {period.kind === "range" && (
            <span
              className="text-xs font-medium rounded-full px-3 py-1 inline-flex items-center gap-1.5"
              style={{ background: "#f01563", color: "#fff", border: "1px solid #f01563" }}
            >
              {formatRange(period.from, period.to)}
              <button
                onClick={() => setPeriod({ kind: "days", days: 30 })}
                className="inline-flex items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.25)", width: 14, height: 14 }}
                aria-label="Annuler le filtre custom"
              >
                <X size={10} />
              </button>
            </span>
          )}
          <CustomPeriodButton
            active={period.kind === "range"}
            initialFrom={period.kind === "range" ? period.from : undefined}
            initialTo={period.kind === "range" ? period.to : undefined}
            onApply={(from, to) => setPeriod({ kind: "range", from, to })}
          />
        </div>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            background: source === "ga4" ? "#f0fdf4" : "#f5f5f5",
            color: source === "ga4" ? "#16a34a" : "#888",
          }}
        >
          {source === "ga4" ? "Live — Google Analytics" : "Mock Data"}
        </span>
      </div>

      {/* GA4 Error Banner */}
      {ga4Error && (
        <div className="rounded-xl flex items-start gap-3" style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "14px 18px" }}>
          <span className="text-sm shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-medium" style={{ color: "#dc2626" }}>Google Analytics connection issue</p>
            <p className="text-xs mt-1" style={{ color: "#888" }}>{ga4Error}</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k) => {
          const isPositive = k.invertColor ? k.wow < 0 : k.wow > 0;
          return (
            <div
              key={k.label}
              className="rounded-xl"
              style={{ background: "#fff", border: "1px solid #eeeeee", padding: "16px 20px" }}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium tracking-wide" style={{ color: "#999" }}>{k.label}</p>
                <InfoTooltip text={k.tooltip} />
              </div>
              <p className="text-2xl font-bold mt-1" style={{ color: "#111" }}>{k.value}</p>
              <div
                className="flex items-center gap-1 mt-1.5 text-xs font-medium rounded-full px-2 py-0.5 w-fit"
                style={{
                  background: isPositive ? "#f0fdf4" : "#fef2f2",
                  color: isPositive ? "#16a34a" : "#dc2626",
                }}
              >
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {k.wow > 0 ? "+" : ""}{k.wow}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Traffic Chart (line or bar view, with filters) */}
      <div className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "20px" }}>
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold" style={{ color: "#111" }}>
              {view === "bar" ? "Yearly overview" : "Traffic"}
            </h3>
            <InfoTooltip text="Line: courbe rose = active users, dots verts = leads, cyan = articles publiés, orange/bleu/violet = events marketing (salons, LinkedIn pro/perso). Tous les dots sont positionnés sur la courbe. — Bar: vue annuelle agrégée par mois. Clique une barre pour zoomer sur ce mois dans la vue ligne." />
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <EventsButton />
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <FilterRow
            filters={filters}
            onChange={setFilters}
            hiddenKeys={view === "line" ? ["impressions"] : []}
          />
        </div>

        {view === "bar" ? (
          <BarView
            trafficData={trafficData}
            leadsTimeline={leadsTimeline}
            impressionsTimeline={impressionsTimeline}
            articlesTimeline={articlesTimeline}
            marketingEvents={marketingEvents}
            filters={filters}
            onMonthClick={handleMonthClick}
          />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f01563" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#f01563" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#aaa" }}
                tickFormatter={(d: string) => {
                  const date = new Date(d);
                  if (periodLen >= 365) return date.toLocaleDateString("en-US", { month: "short" });
                  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
                }}
                interval={periodLen >= 365 ? 30 : periodLen >= 90 ? 7 : periodLen >= 30 ? 3 : 1}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <RechartsTooltip content={<TrafficTooltip />} cursor={{ stroke: "#eee" }} />
              {filters.users && (
                <Area type="monotone" dataKey="users" stroke="#f01563" strokeWidth={2} fill="url(#gradUsers)" />
              )}
              <Scatter
                dataKey="markersY"
                isAnimationActive={false}
                shape={(props: unknown) => {
                  const p = props as { cx?: number; cy?: number; payload?: { groups?: MarkerGroup[] } };
                  const gs = p.payload?.groups ?? [];
                  const cx = p.cx ?? 0;
                  const cy = p.cy ?? 0;
                  if (gs.length === 0 || !Number.isFinite(cx) || !Number.isFinite(cy)) return <g />;
                  const start = cx - ((gs.length - 1) * dotSizing.spacing) / 2;
                  return (
                    <g>
                      {gs.map((g, i) => {
                        const r = Math.min(dotSizing.maxR, dotSizing.baseR + Math.sqrt(Math.max(0, g.count - 1)) * dotSizing.growth);
                        const dx = start + i * dotSizing.spacing;
                        const showCount = g.count >= dotSizing.showCountThreshold && r >= 5;
                        return (
                          <g key={g.type}>
                            <circle
                              cx={dx}
                              cy={cy}
                              r={r}
                              fill={g.color}
                              stroke={r >= 3 ? "#fff" : "none"}
                              strokeWidth={r >= 3 ? 1.2 : 0}
                              fillOpacity={0.9}
                            >
                              <title>{g.tooltip}</title>
                            </circle>
                            {showCount && (
                              <text
                                x={dx}
                                y={cy + 3}
                                textAnchor="middle"
                                style={{ fontSize: 9, fontWeight: 700, fill: "#fff", pointerEvents: "none" }}
                              >
                                {g.count}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sources + Top Articles */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Sources */}
        <div className="lg:col-span-2 rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "20px" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold" style={{ color: "#111" }}>Traffic Sources</h3>
              <InfoTooltip text="GA4: dimension `sessionDefaultChannelGroup` × metric `sessions`. Groupes : Organic Search, Direct, Social, Referral, Email, Paid Search, Unassigned." />
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: source === "ga4" ? "#f0fdf4" : "#f5f5f5", color: source === "ga4" ? "#16a34a" : "#888" }}>
              {source === "ga4" ? "Live" : "Mock"}
            </span>
          </div>
          <div className="flex justify-center">
            <PieChart width={200} height={200}>
              <Pie
                data={trafficSources}
                dataKey="sessions"
                nameKey="source"
                cx={100}
                cy={100}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
              >
                {trafficSources.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <RechartsTooltip content={<TrafficSourceTooltip />} wrapperStyle={{ outline: "none" }} />
              <text x={100} y={95} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: "#111" }}>
                {formatNumber(totalSessions)}
              </text>
              <text x={100} y={112} textAnchor="middle" style={{ fontSize: 10, fill: "#888" }}>sessions</text>
            </PieChart>
          </div>
          <div className="space-y-2 mt-2">
            {trafficSources.map((s) => (
              <div key={s.source} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span style={{ color: "#555" }}>{s.source}</span>
                <span className="ml-auto font-medium" style={{ color: "#111" }}>{s.percentage}%</span>
                <span className="text-xs" style={{ color: "#aaa" }}>{formatNumber(s.sessions)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Articles */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#f9f9f9", borderBottom: "1px solid #eeeeee" }}>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm" style={{ color: "#111" }}>Top Blog Articles</h3>
              <InfoTooltip text="GA4: dimensions `pagePath` + `pageTitle`, metrics `sessions` + `screenPageViews`. Filtré sur les pages `/blog/*`, top 10 par sessions." />
            </div>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: hasLiveTopPages ? "#f0fdf4" : "#f5f5f5",
                color: hasLiveTopPages ? "#16a34a" : "#888",
              }}
            >
              {hasLiveTopPages ? `Live — ${topPages.length} pages from GA4` : "No data"}
            </span>
          </div>
          {topPages.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #eeeeee" }}>
                  <th className="text-left px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>#</th>
                  <th className="text-left px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>Title</th>
                  <th className="text-left px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>Path</th>
                  <th className="text-right px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>Sessions</th>
                  <th className="text-right px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>Page Views</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((page, i) => (
                  <tr
                    key={page.path}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <td className="px-4 py-2.5 font-medium" style={{ color: "#bbb" }}>{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "#111", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {page.title || page.path}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#aaa", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <code className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#f5f5f5" }}>{page.path}</code>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{formatNumber(page.sessions)}</td>
                    <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{formatNumber(page.pageViews)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center py-10">
              <p className="text-xs" style={{ color: "#aaa" }}>Connect Google Analytics to see your top blog articles</p>
            </div>
          )}
        </div>
      </div>

      {/* Device split + Top countries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DeviceBlock devices={devices} />
        <CountryBlock countries={countries} />
      </div>

      {/* Search Console Winners & Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendList
          title={`Top Gainers (last ${seoTrendsDays}d)`}
          subtitle="Pages qui gagnent le plus de clics vs période précédente"
          info={`Search Console: dimension \`page\` × metric \`clicks\`, filtre /blog/*. Compare les ${seoTrendsDays} derniers jours vs les ${seoTrendsDays} jours précédents. Top 10 par Δclicks positif.`}
          trends={winners}
          emptyLabel={seoTrendsError ? seoTrendsError : "Pas de données Search Console pour cette période"}
          positive
        />
        <TrendList
          title={`Top Losers (last ${seoTrendsDays}d)`}
          subtitle="Pages qui perdent le plus de clics — candidates à refresh"
          info={`Même requête Search Console que Top Gainers mais trié par Δclicks négatif. Utile pour détecter les articles qui décrochent et méritent un refresh.`}
          trends={losers}
          emptyLabel={seoTrendsError ? seoTrendsError : "Pas de données Search Console pour cette période"}
          positive={false}
        />
      </div>
    </div>
  );
}

function TrendList({
  title, subtitle, info, trends, emptyLabel, positive,
}: {
  title: string;
  subtitle: string;
  info: string;
  trends: PageTrend[];
  emptyLabel: string;
  positive: boolean;
}) {
  const accent = positive ? "#16a34a" : "#dc2626";
  const bg = positive ? "#f0fdf4" : "#fef2f2";
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
      <div className="px-4 py-3" style={{ background: "#f9f9f9", borderBottom: "1px solid #eeeeee" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm" style={{ color: "#111" }}>{title}</h3>
            <InfoTooltip text={info} />
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: bg, color: accent }}>
            Search Console
          </span>
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: "#888" }}>{subtitle}</p>
      </div>
      {trends.length === 0 ? (
        <div className="flex items-center justify-center py-10 px-4">
          <p className="text-xs text-center" style={{ color: "#aaa" }}>{emptyLabel}</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #eeeeee" }}>
              <th className="text-left px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>Page</th>
              <th className="text-right px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>Clicks</th>
              <th className="text-right px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>Δ Clicks</th>
              <th className="text-right px-4 py-2 font-medium text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>Pos.</th>
            </tr>
          </thead>
          <tbody>
            {trends.map((t) => {
              const deltaSign = t.deltaClicks > 0 ? "+" : "";
              return (
                <tr key={t.page} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td className="px-4 py-2" style={{ color: "#111", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <div className="font-medium text-[13px]" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                    <code className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#f5f5f5", color: "#888" }}>{shortPath(t.page)}</code>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: "#555" }}>{t.currentClicks}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs font-semibold" style={{ color: accent }}>
                    {deltaSign}{t.deltaClicks}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: "#888" }}>{t.currentPosition || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "..." : url;
  }
}

const MARKER_ORDER_LABEL: Record<MarkerType, string> = {
  lead: "Leads",
  article: "Articles",
  salon: "Salons",
  linkedin_pro: "LinkedIn Pro",
  linkedin_perso: "LinkedIn Perso",
  nurturing_campaign: "Nurturing",
};

function TrafficTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { date: string; users: number; groups?: MarkerGroup[] } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const date = new Date(data.date + "T12:00:00Z");
  const formattedDate = date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const groups = data.groups ?? [];

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        padding: "10px 12px",
        fontSize: 12,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8, color: "#111" }}>{formattedDate}</div>
      <Row color="#f01563" label="Active users" value={data.users} />
      {groups.map((g) => (
        <Row
          key={g.type}
          color={g.color}
          label={MARKER_ORDER_LABEL[g.type]}
          value={g.count}
          detail={g.tooltip}
        />
      ))}
    </div>
  );
}

function Row({ color, label, value, detail }: { color: string; label: string; value: number; detail?: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ color: "#555" }}>{label}</span>
        <span style={{ marginLeft: "auto", fontWeight: 600, color: "#111" }}>{value}</span>
      </div>
      {detail && detail.includes(":") && (
        <div style={{ marginLeft: 14, marginTop: 2, color: "#888", fontSize: 11, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
          {detail.split(":").slice(1).join(":").trim()}
        </div>
      )}
    </div>
  );
}

function CustomPeriodButton({
  active, initialFrom, initialTo, onApply,
}: {
  active: boolean;
  initialFrom?: string;
  initialTo?: string;
  onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toLocaleDateString("fr-CA");
  const defaultFrom = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toLocaleDateString("fr-CA");
  })();
  const [from, setFrom] = useState<string>(initialFrom ?? defaultFrom);
  const [to, setTo] = useState<string>(initialTo ?? today);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function apply() {
    if (!from || !to) {
      setError("Choisis une date de début et de fin.");
      return;
    }
    if (from > to) {
      setError("La date de début doit être avant la date de fin.");
      return;
    }
    setError(null);
    onApply(from, to);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium rounded-full px-3 py-1 inline-flex items-center gap-1 transition-colors"
        style={{
          background: active ? "#fff7ed" : "#fff",
          color: active ? "#c2410c" : "#666",
          border: active ? "1px solid #fdba74" : "1px solid #eee",
        }}
        aria-label="Filtre date custom"
      >
        <Calendar size={12} />
        Custom
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(17,17,17,0.35)" }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="rounded-xl overflow-hidden shadow-xl"
            style={{ background: "#fff", border: "1px solid #eeeeee", width: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#f9f9f9", borderBottom: "1px solid #eeeeee" }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "#111" }}>Période custom</h3>
                <p className="text-[11px]" style={{ color: "#888" }}>Choisis une plage de dates précise</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded transition-colors"
                style={{ color: "#888" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#eeeeee"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#888" }}>Du</label>
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full text-xs px-3 py-2 mt-1 rounded-lg outline-none"
                    style={{ border: "1px solid #e5e5e5", background: "#fafafa", color: "#111" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#888" }}>Au</label>
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    max={today}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full text-xs px-3 py-2 mt-1 rounded-lg outline-none"
                    style={{ border: "1px solid #e5e5e5", background: "#fafafa", color: "#111" }}
                  />
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  { label: "Ce mois", from: firstOfCurrentMonth(), to: today },
                  { label: "Mois dernier", from: firstOfPreviousMonth(), to: lastOfPreviousMonth() },
                  { label: "Année en cours", from: `${new Date().getFullYear()}-01-01`, to: today },
                ]).map((q) => (
                  <button
                    key={q.label}
                    onClick={() => { setFrom(q.from); setTo(q.to); }}
                    className="text-[11px] px-2 py-1 rounded-full"
                    style={{ background: "#fafafa", color: "#444", border: "1px solid #e5e5e5" }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {error && (
                <div className="text-xs" style={{ color: "#dc2626" }}>{error}</div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: "#fafafa", color: "#666", border: "1px solid #e5e5e5" }}
                >
                  Annuler
                </button>
                <button
                  onClick={apply}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: "#f01563", color: "#fff" }}
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function firstOfCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function firstOfPreviousMonth(): string {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function lastOfPreviousMonth(): string {
  const d = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TrafficSourceTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TrafficSource }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  const details = data.details ?? [];
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        padding: "10px 12px",
        fontSize: 12,
        minWidth: 220,
        maxWidth: 320,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: data.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: "#111" }}>{data.source}</span>
      </div>
      <div style={{ color: "#555", marginBottom: details.length > 0 ? 8 : 0 }}>
        <strong style={{ color: "#111" }}>{data.sessions.toLocaleString("fr-FR")}</strong> sessions · {data.percentage}%
      </div>
      {details.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
            Détails
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {details.slice(0, 10).map((d, i) => (
              <div
                key={i}
                style={{ display: "flex", justifyContent: "space-between", gap: 10, color: "#555" }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                  {d.label}
                </span>
                <span style={{ fontWeight: 500, color: "#111", flexShrink: 0 }}>
                  {d.sessions.toLocaleString("fr-FR")}
                </span>
              </div>
            ))}
            {details.length > 10 && (
              <div style={{ color: "#aaa", fontSize: 11, marginTop: 2 }}>
                + {details.length - 10} autres
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatRange(from: string, to: string): string {
  const f = new Date(from + "T12:00:00Z");
  const t = new Date(to + "T12:00:00Z");
  if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
    return f.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  return `${f.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${t.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
}

function ViewToggle({ view, onChange }: { view: "line" | "bar"; onChange: (v: "line" | "bar") => void }) {
  return (
    <div className="inline-flex rounded-full" style={{ background: "#fafafa", border: "1px solid #e5e5e5" }}>
      {([
        { id: "line" as const, label: "Line", Icon: LineChartIcon },
        { id: "bar"  as const, label: "Bar",  Icon: BarChart3 },
      ]).map(({ id, label, Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="text-xs font-medium px-3 py-1 inline-flex items-center gap-1.5 transition-colors"
            style={{
              background: active ? "#111" : "transparent",
              color: active ? "#fff" : "#666",
              borderRadius: 9999,
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <Info size={13} className="cursor-help" style={{ color: "#bbb" }} aria-label="info" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: "#111",
          color: "#fff",
          fontSize: 11,
          lineHeight: 1.4,
          padding: "8px 10px",
          borderRadius: 6,
          width: 260,
          boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
          whiteSpace: "normal",
          fontWeight: 400,
          letterSpacing: "normal",
          textTransform: "none",
        }}
      >
        {text}
      </span>
    </span>
  );
}

const DEVICE_COLORS: Record<string, string> = {
  desktop: "#3b82f6",
  mobile: "#f01563",
  tablet: "#8b5cf6",
};

function DeviceBlock({ devices }: { devices: DeviceBreakdown[] }) {
  const hasData = devices.length > 0;
  return (
    <div className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "20px" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold" style={{ color: "#111" }}>Device Split</h3>
          <InfoTooltip text="GA4: dimension `deviceCategory` × metrics `sessions`, `activeUsers`, `engagementRate`, `averageSessionDuration`. Révèle souvent de gros écarts mobile/desktop." />
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: hasData ? "#f0fdf4" : "#f5f5f5", color: hasData ? "#16a34a" : "#888" }}>
          {hasData ? "Live — GA4 deviceCategory" : "No data"}
        </span>
      </div>
      {!hasData ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-xs" style={{ color: "#aaa" }}>No device data available</p>
        </div>
      ) : (
        <>
          <div className="flex justify-center">
            <PieChart width={200} height={200}>
              <Pie data={devices} dataKey="sessions" nameKey="device" cx={100} cy={100} innerRadius={60} outerRadius={80} paddingAngle={2}>
                {devices.map((d, i) => (
                  <Cell key={i} fill={DEVICE_COLORS[d.device] ?? "#9ca3af"} />
                ))}
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-2 mt-2">
            {devices.map((d) => (
              <div key={d.device} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DEVICE_COLORS[d.device] ?? "#9ca3af" }} />
                <span className="capitalize" style={{ color: "#555" }}>{d.device}</span>
                <span className="ml-auto font-medium" style={{ color: "#111" }}>{d.percentage}%</span>
                <span className="text-xs" style={{ color: "#aaa" }}>{formatNumber(d.sessions)} sess · {d.engagementRate}% eng.</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CountryBlock({ countries }: { countries: CountryBreakdown[] }) {
  const hasData = countries.length > 0;
  const top = countries.slice(0, 10);
  return (
    <div className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "20px" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold" style={{ color: "#111" }}>Top Countries</h3>
          <InfoTooltip text="GA4: dimension `country` × metrics `sessions`, `activeUsers`. Top 10 par sessions. Utile pour valider le mix FR/EN/autres." />
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: hasData ? "#f0fdf4" : "#f5f5f5", color: hasData ? "#16a34a" : "#888" }}>
          {hasData ? "Live — GA4 country" : "No data"}
        </span>
      </div>
      {!hasData ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-xs" style={{ color: "#aaa" }}>No country data available</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={top} layout="vertical" margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#aaa" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="country" tick={{ fontSize: 11, fill: "#555" }} axisLine={false} tickLine={false} width={100} />
            <RechartsTooltip
              contentStyle={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, fontSize: 13 }}
              formatter={(value, _name, item) => {
                const payload = item?.payload as CountryBreakdown | undefined;
                return [`${value} sess · ${payload?.percentage ?? 0}%`, "Sessions"];
              }}
            />
            <Bar dataKey="sessions" fill="#f01563" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
