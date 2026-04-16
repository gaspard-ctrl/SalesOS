import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  fetchKPIs,
  fetchTrafficData,
  fetchTrafficSources,
  fetchTopPages,
} from "@/lib/google-analytics";
import {
  MOCK_KPIS,
  MOCK_TRAFFIC_DATA,
  MOCK_ARTICLE_MARKERS,
  MOCK_TRAFFIC_SOURCES,
} from "@/lib/mock/marketing-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const period = parseInt(req.nextUrl.searchParams.get("period") || "30", 10);
  const validPeriod = [7, 14, 30, 90, 365].includes(period) ? period : 30;

  // Try real GA4 data, fall back to mock
  const hasGA4 = !!process.env.GA4_PROPERTY_ID;

  if (hasGA4) {
    try {
      const [kpiData, trafficData, trafficSources, topPages] = await Promise.all([
        fetchKPIs(user.id, validPeriod),
        fetchTrafficData(user.id, validPeriod),
        fetchTrafficSources(user.id, validPeriod),
        fetchTopPages(user.id, validPeriod, 10),
      ]);

      // Compute WoW changes
      const cur = kpiData.current;
      const prev = kpiData.previous;

      function wow(current: number, previous: number, invert = false): number {
        if (previous === 0) return 0;
        const change = Math.round(((current - previous) / previous) * 1000) / 10;
        return change;
      }

      const kpis = {
        sessions: cur.sessions,
        sessionsWoW: wow(cur.sessions, prev.sessions),
        uniqueVisitors: cur.uniqueVisitors,
        uniqueVisitorsWoW: wow(cur.uniqueVisitors, prev.uniqueVisitors),
        pageViews: cur.pageViews,
        pageViewsWoW: wow(cur.pageViews, prev.pageViews),
        bounceRate: cur.bounceRate,
        bounceRateWoW: wow(cur.bounceRate, prev.bounceRate),
        avgDuration: cur.avgDuration,
        avgDurationWoW: wow(cur.avgDuration, prev.avgDuration),
        ctaConversions: cur.ctaConversions,
        ctaConversionsWoW: wow(cur.ctaConversions, prev.ctaConversions),
      };

      return NextResponse.json({
        kpis,
        trafficData,
        trafficSources,
        topPages,
        articleMarkers: MOCK_ARTICLE_MARKERS, // Still mock until WordPress content is available
        source: "ga4",
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[marketing/overview] GA4 failed, falling back to mock:", errMsg);
      // Return mock but include the error so we can debug
      const trafficData = MOCK_TRAFFIC_DATA.slice(-validPeriod);
      return NextResponse.json({
        kpis: MOCK_KPIS,
        trafficData,
        trafficSources: MOCK_TRAFFIC_SOURCES,
        topPages: [],
        articleMarkers: MOCK_ARTICLE_MARKERS,
        source: "mock",
        ga4Error: errMsg,
      });
    }
  }

  // Mock fallback
  const trafficData = MOCK_TRAFFIC_DATA.slice(-validPeriod);

  return NextResponse.json({
    kpis: MOCK_KPIS,
    trafficData,
    trafficSources: MOCK_TRAFFIC_SOURCES,
    topPages: [],
    articleMarkers: MOCK_ARTICLE_MARKERS,
    source: "mock",
  });
}
