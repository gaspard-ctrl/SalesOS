import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  fetchKPIs,
  fetchTrafficData,
  fetchTrafficSources,
  fetchTopPages,
  fetchDeviceBreakdown,
  fetchCountryBreakdown,
  type Period,
} from "@/lib/google-analytics";
import { countIncomingLeads } from "@/lib/slack-leads";
import { fetchImpressionsTimeline } from "@/lib/google-search-console";
import { fetchArticlesTimeline } from "@/lib/wordpress";

export const dynamic = "force-dynamic";

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const periodParam = parseInt(req.nextUrl.searchParams.get("period") || "30", 10);

  let period: Period;
  if (fromParam && toParam && isValidDate(fromParam) && isValidDate(toParam)) {
    period = { startDate: fromParam, endDate: toParam };
  } else {
    const validPeriod = [7, 14, 30, 90, 365].includes(periodParam) ? periodParam : 30;
    period = validPeriod;
  }

  if (!process.env.GA4_PROPERTY_ID) {
    return NextResponse.json({
      kpis: null,
      trafficData: [], trafficSources: [], topPages: [], devices: [], countries: [],
      leadsTimeline: [], impressionsTimeline: [], articlesTimeline: [],
      source: "none",
      ga4Error: "GA4_PROPERTY_ID not set. Add it in your environment variables.",
    });
  }

  const [kpiResult, trafficResult, sourcesResult, pagesResult, devicesResult, countriesResult, leadsResult, impressionsResult, articlesResult] = await Promise.allSettled([
    fetchKPIs(user.id, period),
    fetchTrafficData(user.id, period),
    fetchTrafficSources(user.id, period),
    fetchTopPages(user.id, period, 10),
    fetchDeviceBreakdown(user.id, period),
    fetchCountryBreakdown(user.id, period, 10),
    countIncomingLeads(period),
    fetchImpressionsTimeline(user.id, period, false),
    fetchArticlesForPeriod(period),
  ]);

  const errorSet = new Set<string>();
  for (const r of [kpiResult, trafficResult, sourcesResult, pagesResult, devicesResult, countriesResult]) {
    if (r.status === "rejected") errorSet.add(r.reason?.message || String(r.reason));
  }
  const ga4Errors = Array.from(errorSet);

  if (kpiResult.status === "rejected") {
    return NextResponse.json({
      kpis: null,
      trafficData: [], trafficSources: [], topPages: [], devices: [], countries: [],
      leadsTimeline: [], impressionsTimeline: [], articlesTimeline: [],
      source: "none",
      ga4Error: ga4Errors.join(" | "),
    });
  }

  const { current: cur, previous: prev } = kpiResult.value;
  const wow = (c: number, p: number) => p === 0 ? 0 : Math.round(((c - p) / p) * 1000) / 10;

  const leads = leadsResult.status === "fulfilled"
    ? leadsResult.value
    : { current: 0, previous: 0, channelFound: false, dailyCounts: {} as Record<string, number> };

  const leadsTimeline = Object.entries(leads.dailyCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    kpis: {
      sessions: cur.sessions, sessionsWoW: wow(cur.sessions, prev.sessions),
      activeUsers: cur.activeUsers, activeUsersWoW: wow(cur.activeUsers, prev.activeUsers),
      newUsers: cur.newUsers, newUsersWoW: wow(cur.newUsers, prev.newUsers),
      pageViews: cur.pageViews, pageViewsWoW: wow(cur.pageViews, prev.pageViews),
      engagedSessions: cur.engagedSessions, engagedSessionsWoW: wow(cur.engagedSessions, prev.engagedSessions),
      avgDuration: cur.avgDuration, avgDurationWoW: wow(cur.avgDuration, prev.avgDuration),
      keyEvents: cur.keyEvents, keyEventsWoW: wow(cur.keyEvents, prev.keyEvents),
      incomingLeads: leads.current,
      incomingLeadsWoW: wow(leads.current, leads.previous),
      incomingLeadsChannelMissing: !leads.channelFound,
    },
    trafficData: trafficResult.status === "fulfilled" ? trafficResult.value : [],
    trafficSources: sourcesResult.status === "fulfilled" ? sourcesResult.value : [],
    topPages: pagesResult.status === "fulfilled" ? pagesResult.value : [],
    devices: devicesResult.status === "fulfilled" ? devicesResult.value : [],
    countries: countriesResult.status === "fulfilled" ? countriesResult.value : [],
    leadsTimeline,
    impressionsTimeline: impressionsResult.status === "fulfilled" ? impressionsResult.value : [],
    articlesTimeline: articlesResult.status === "fulfilled" ? articlesResult.value : [],
    source: "ga4",
    ga4Error: ga4Errors.length > 0 ? ga4Errors.join(" | ") : undefined,
  });
}

async function fetchArticlesForPeriod(period: Period) {
  let start: string;
  let end: string;
  if (typeof period === "number") {
    const now = new Date();
    end = now.toISOString().slice(0, 10);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period);
    start = startDate.toISOString().slice(0, 10);
  } else {
    start = period.startDate;
    end = period.endDate;
  }
  return fetchArticlesTimeline(start, end);
}
