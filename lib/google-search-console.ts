import { getGmailAccessToken } from "./gmail";
import type { Keyword, CannibalizationAlert, PageTrend } from "./marketing-types";

const SEARCH_CONSOLE_API = "https://www.googleapis.com/webmasters/v3";
const SEARCH_CONSOLE_SITE = process.env.SEARCH_CONSOLE_SITE_URL;

// ─── Search Analytics API ────────────────────────────────────────────────────

interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function querySearchAnalytics(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<SearchAnalyticsRow[]> {
  if (!SEARCH_CONSOLE_SITE) throw new Error("SEARCH_CONSOLE_SITE_URL not configured. Set it in your environment variables.");

  const encodedSite = encodeURIComponent(SEARCH_CONSOLE_SITE);
  const res = await fetch(
    `${SEARCH_CONSOLE_API}/sites/${encodedSite}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) {
      if (text.includes("insufficientPermissions") || text.includes("PERMISSION_DENIED")) {
        throw new Error("Your Google account does not have access to Search Console for this site. Go to Settings → Disconnect Google → Reconnect.");
      }
      throw new Error(`Search Console access denied. Make sure your Google account has access to ${SEARCH_CONSOLE_SITE} in Search Console.`);
    }
    if (res.status === 401) {
      throw new Error("Google session expired. Go to Settings → Disconnect Google → Reconnect.");
    }
    throw new Error(`Search Console API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.rows || [];
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── Exported functions ──────────────────────────────────────────────────────

/**
 * Fetch all keywords with metrics, optionally filtered to blog pages.
 */
export async function fetchKeywords(
  userId: string,
  days = 28,
  blogOnly = true,
): Promise<Keyword[]> {
  const accessToken = await getGmailAccessToken(userId);

  const body: Record<string, unknown> = {
    startDate: daysAgoISO(days),
    endDate: daysAgoISO(1), // Search Console data has 1-2 day lag
    dimensions: ["query", "page"],
    rowLimit: 2000,
    dataState: "all",
  };

  if (blogOnly) {
    body.dimensionFilterGroups = [{
      filters: [{
        dimension: "page",
        operator: "contains",
        expression: "/blog/",
      }],
    }];
  }

  const rows = await querySearchAnalytics(accessToken, body);

  return rows.map((row) => {
    const page = row.keys[1] || "";
    // Extract a readable title from the URL path
    const slug = page.replace(/.*\/blog\//, "").replace(/\/$/, "");
    const pageTitle = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .slice(0, 80);

    return {
      keyword: row.keys[0],
      page,
      pageTitle: pageTitle || null,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Math.round(row.ctr * 1000) / 10, // 0.032 → 3.2%
      position: Math.round(row.position * 10) / 10,
    };
  });
}

/** Either a number of days back from yesterday, or an explicit date range. */
export type SCPeriod = number | { startDate: string; endDate: string };

function resolveSCRange(p: SCPeriod): { startDate: string; endDate: string } {
  if (typeof p === "number") {
    return { startDate: daysAgoISO(p), endDate: daysAgoISO(1) };
  }
  return p;
}

export interface ImpressionsTimelinePoint {
  date: string;        // YYYY-MM-DD
  impressions: number;
  clicks: number;
}

/**
 * Fetch daily impressions + clicks over a period from Search Console.
 * Used by the marketing overview bar chart (yearly view).
 */
export async function fetchImpressionsTimeline(
  userId: string,
  period: SCPeriod,
  blogOnly = false,
): Promise<ImpressionsTimelinePoint[]> {
  const accessToken = await getGmailAccessToken(userId);
  const range = resolveSCRange(period);

  const body: Record<string, unknown> = {
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: ["date"],
    rowLimit: 10000,
    dataState: "all",
  };
  if (blogOnly) {
    body.dimensionFilterGroups = [{
      filters: [{ dimension: "page", operator: "contains", expression: "/blog/" }],
    }];
  }

  const rows = await querySearchAnalytics(accessToken, body);
  return rows
    .map((r) => ({
      date: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch per-page clicks & impressions for two consecutive windows and compute
 * winners (pages that gained the most clicks) and losers (pages that lost the
 * most clicks). Useful for spotting articles that are decaying or taking off.
 */
export async function fetchPageTrends(
  userId: string,
  days = 28,
  blogOnly = true,
  topN = 10,
): Promise<{ winners: PageTrend[]; losers: PageTrend[] }> {
  const accessToken = await getGmailAccessToken(userId);

  // Current window: [days..1] days ago. Previous: [2*days..days+1] days ago.
  const currentBody = buildPageQueryBody(days, 1, blogOnly);
  const previousBody = buildPageQueryBody(days * 2, days + 1, blogOnly);

  const [currentRows, previousRows] = await Promise.all([
    querySearchAnalytics(accessToken, currentBody),
    querySearchAnalytics(accessToken, previousBody),
  ]);

  const prevByPage = new Map<string, SearchAnalyticsRow>();
  for (const row of previousRows) {
    const page = row.keys[0];
    if (page) prevByPage.set(page, row);
  }

  const trends: PageTrend[] = [];
  const seen = new Set<string>();

  for (const row of currentRows) {
    const page = row.keys[0];
    if (!page) continue;
    seen.add(page);
    const prev = prevByPage.get(page);
    trends.push(buildTrend(page, row, prev));
  }

  // Pages that had traffic in previous window but NOT current → big losers
  for (const [page, prev] of prevByPage) {
    if (seen.has(page)) continue;
    trends.push(buildTrend(page, undefined, prev));
  }

  const byDelta = [...trends].sort((a, b) => b.deltaClicks - a.deltaClicks);
  return {
    winners: byDelta.filter((t) => t.deltaClicks > 0).slice(0, topN),
    losers: [...byDelta].reverse().filter((t) => t.deltaClicks < 0).slice(0, topN),
  };
}

function buildPageQueryBody(startDaysAgo: number, endDaysAgo: number, blogOnly: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    startDate: daysAgoISO(startDaysAgo),
    endDate: daysAgoISO(endDaysAgo),
    dimensions: ["page"],
    rowLimit: 500,
    dataState: "all",
  };
  if (blogOnly) {
    body.dimensionFilterGroups = [{
      filters: [{
        dimension: "page",
        operator: "contains",
        expression: "/blog/",
      }],
    }];
  }
  return body;
}

function buildTrend(page: string, current: SearchAnalyticsRow | undefined, previous: SearchAnalyticsRow | undefined): PageTrend {
  const cur = current ?? { keys: [page], clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const prev = previous ?? { keys: [page], clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const slug = page.replace(/.*\/blog\//, "").replace(/\/$/, "");
  const title = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80)
    : page;
  return {
    page,
    title,
    currentClicks: cur.clicks,
    previousClicks: prev.clicks,
    deltaClicks: cur.clicks - prev.clicks,
    currentImpressions: cur.impressions,
    previousImpressions: prev.impressions,
    deltaImpressions: cur.impressions - prev.impressions,
    currentPosition: cur.position ? Math.round(cur.position * 10) / 10 : 0,
    deltaPosition: prev.position && cur.position
      ? Math.round((cur.position - prev.position) * 10) / 10
      : 0,
  };
}

/**
 * Detect keyword cannibalization: same keyword ranking for multiple pages.
 */
export function detectCannibalization(keywords: Keyword[]): CannibalizationAlert[] {
  // Group keywords by query
  const byQuery = new Map<string, Keyword[]>();
  for (const kw of keywords) {
    if (!kw.page) continue;
    const existing = byQuery.get(kw.keyword) || [];
    existing.push(kw);
    byQuery.set(kw.keyword, existing);
  }

  // Find queries that appear on multiple pages
  const alerts: CannibalizationAlert[] = [];
  for (const [keyword, entries] of byQuery) {
    // Deduplicate by page
    const uniquePages = new Map<string, Keyword>();
    for (const e of entries) {
      if (!uniquePages.has(e.page!)) uniquePages.set(e.page!, e);
    }
    if (uniquePages.size >= 2) {
      alerts.push({
        keyword,
        articles: Array.from(uniquePages.values()).map((e) => ({
          page: e.page!,
          title: e.pageTitle || e.page!,
          position: e.position,
          impressions: e.impressions,
        })),
      });
    }
  }

  // Sort by total impressions (most impactful cannibalization first)
  return alerts
    .sort((a, b) => {
      const aImp = a.articles.reduce((s, x) => s + x.impressions, 0);
      const bImp = b.articles.reduce((s, x) => s + x.impressions, 0);
      return bImp - aImp;
    })
    .slice(0, 10);
}
