"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type {
  TrafficDataPoint, LeadsTimelinePoint, ImpressionsTimelinePoint,
  ArticleTimelinePoint, MarketingEvent,
} from "@/lib/marketing-types";
import type { FilterState } from "./overview-tab-filters";

interface MonthBucket {
  key: string;       // YYYY-MM
  label: string;     // "Apr 2026"
  start: string;     // YYYY-MM-DD (first day)
  end: string;       // YYYY-MM-DD (last day)
  impressions: number;
  users: number;
  leads: number;
  articles: number;
  salons: number;
  linkedinPosts: number;
  nurturingCampaigns: number;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function buildBuckets(): MonthBucket[] {
  // Last 12 months — including current month.
  const buckets: MonthBucket[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: start.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      impressions: 0,
      users: 0,
      leads: 0,
      articles: 0,
      salons: 0,
      linkedinPosts: 0,
      nurturingCampaigns: 0,
    });
  }
  return buckets;
}

export function BarView({
  trafficData,
  leadsTimeline,
  impressionsTimeline,
  articlesTimeline,
  marketingEvents,
  filters,
  onMonthClick,
}: {
  trafficData: TrafficDataPoint[];
  leadsTimeline: LeadsTimelinePoint[];
  impressionsTimeline: ImpressionsTimelinePoint[];
  articlesTimeline: ArticleTimelinePoint[];
  marketingEvents: MarketingEvent[];
  filters: FilterState;
  onMonthClick: (start: string, end: string) => void;
}) {
  const data = useMemo(() => {
    const buckets = buildBuckets();
    const byKey = new Map(buckets.map((b) => [b.key, b]));

    for (const p of trafficData) {
      const b = byKey.get(monthKey(p.date));
      if (b) b.users += p.visitors;
    }
    for (const p of leadsTimeline) {
      const b = byKey.get(monthKey(p.date));
      if (b) b.leads += p.count;
    }
    for (const p of impressionsTimeline) {
      const b = byKey.get(monthKey(p.date));
      if (b) b.impressions += p.impressions;
    }
    for (const a of articlesTimeline) {
      const b = byKey.get(monthKey(a.date));
      if (b) b.articles += 1;
    }
    for (const e of marketingEvents) {
      const b = byKey.get(monthKey(e.event_date));
      if (!b) continue;
      if (e.event_type === "salon") b.salons += 1;
      else if (e.event_type === "nurturing_campaign") b.nurturingCampaigns += 1;
      else b.linkedinPosts += 1; // linkedin_pro + linkedin_perso grouped
    }

    return buckets;
  }, [trafficData, leadsTimeline, impressionsTimeline, articlesTimeline, marketingEvents]);

  // Recharts fires onClick on the chart only when the click lands on the plot
  // background — individual <Bar> swallow the event. Handling it per-Bar makes
  // the whole column clickable.
  const handleBarClick = (payload: unknown) => {
    const p = payload as MonthBucket | undefined;
    if (p?.start && p?.end) onMonthClick(p.start, p.end);
  };

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        {/* Three distinct scales: impressions (huge), users (medium), counts (small).
           Giving each its own axis avoids "users looks like 0 next to impressions". */}
        <YAxis yAxisId="impressions" orientation="left" tick={{ fontSize: 10, fill: "#06b6d4" }} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={50} />
        <YAxis yAxisId="users" orientation="right" tick={{ fontSize: 10, fill: "#f01563" }} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={50} />
        <YAxis yAxisId="counts" orientation="right" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} width={32} />
        <RechartsTooltip
          contentStyle={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "#fafafa" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        {filters.impressions && (
          <Bar yAxisId="impressions" dataKey="impressions" name="Impressions" fill="#06b6d4" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} />
        )}
        {filters.users && (
          <Bar yAxisId="users" dataKey="users" name="Active users" fill="#f01563" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} />
        )}
        {filters.leads && (
          <Bar yAxisId="counts" dataKey="leads" name="Leads" fill="#facc15" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} />
        )}
        {filters.articles && (
          <Bar yAxisId="counts" dataKey="articles" name="Articles" fill="#0ea5e9" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} />
        )}
        {filters.salon && (
          <Bar yAxisId="counts" dataKey="salons" name="Salons" fill="#16a34a" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} />
        )}
        {(filters.linkedin_pro || filters.linkedin_perso) && (
          <Bar yAxisId="counts" dataKey="linkedinPosts" name="LinkedIn posts" fill="#8b5cf6" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} />
        )}
        {filters.nurturing_campaign && (
          <Bar yAxisId="counts" dataKey="nurturingCampaigns" name="Nurturing" fill="#14b8a6" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
