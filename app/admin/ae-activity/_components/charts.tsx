"use client";

import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import type { ActivityBucket, FunnelStage, LostReason, RevenueQuarter } from "@/lib/ae-activity/types";
import { DISPOSITION_COLORS, dispositionLabels, fmtEUR } from "./helpers";

const GRID = "#f0f0f0";
const AXIS_TICK = { fontSize: 11, fill: "#888" } as const;
const TOOLTIP_STYLE = { background: "#fff", border: "1px solid #eee", borderRadius: 8, fontSize: 12 } as const;
const LEGEND_STYLE = { fontSize: 11 } as const;

function alpha(hex: string, suffix: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${suffix}` : hex;
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function ChartCard({
  title,
  subtitle,
  note,
  children,
}: {
  title: string;
  subtitle?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#eee", background: "#fff" }}>
      <h3 className="text-[13px] font-semibold mb-0.5" style={{ color: "#111" }}>
        {title}
      </h3>
      {subtitle && (
        <p className="text-[11px] mb-2" style={{ color: "#aaa" }}>
          {subtitle}
        </p>
      )}
      {children}
      {note && (
        <p className="text-[11px] mt-2 rounded-lg px-2.5 py-1.5" style={{ color: "#888", background: "#f7f7f8" }}>
          {note}
        </p>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex items-center justify-center text-xs" style={{ height: 200, color: "#bbb" }}>
      Pas de données sur cette période
    </div>
  );
}

export function VolumeChart({ buckets, accent }: { buckets: ActivityBucket[]; accent: string }) {
  if (buckets.length === 0) return <Empty />;
  const data = buckets.map((b) => ({ label: b.label, Appels: b.outboundCalls, Emails: b.emailsOut }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
        <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#fafafa" }} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" />
        <Bar dataKey="Appels" fill={accent} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Emails" fill={alpha(accent, "66")} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CallOutcomeChart({ buckets }: { buckets: ActivityBucket[] }) {
  const labels = dispositionLabels(buckets);
  if (buckets.length === 0 || labels.length === 0) return <Empty />;
  const data = buckets.map((b) => {
    const row: Record<string, string | number> = { label: b.label };
    for (const l of labels) row[l] = b.dispositions?.[l] || 0;
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={42} />
        <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#fafafa" }} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" />
        {labels.map((l) => (
          <Bar key={l} dataKey={l} stackId="calls" fill={DISPOSITION_COLORS[l] || "#94a3b8"} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MeetingsPipelineChart({ buckets, accent }: { buckets: ActivityBucket[]; accent: string }) {
  if (buckets.length === 0) return <Empty />;
  const data = buckets.map((b) => ({
    label: b.label,
    Bookés: b.meetingsScheduled,
    Tenus: b.meetingsHeld,
    "Deals fermés": b.closedWon + b.closedLost,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis yAxisId="l" tick={AXIS_TICK} axisLine={false} tickLine={false} width={42} />
        <YAxis yAxisId="r" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
        <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#fafafa" }} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" />
        <Bar yAxisId="l" dataKey="Bookés" fill={alpha(accent, "99")} radius={[3, 3, 0, 0]} />
        <Bar yAxisId="l" dataKey="Tenus" fill={accent} radius={[3, 3, 0, 0]} />
        <Line yAxisId="r" type="monotone" dataKey="Deals fermés" stroke="#111" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MeetingSourceChart({ buckets, accent }: { buckets: ActivityBucket[]; accent: string }) {
  if (buckets.length === 0) return <Empty />;
  const data = buckets.map((b) => ({
    label: b.label,
    "Self-sourced": b.meetingsSelfSourced,
    "Inbound lead": b.meetingsInboundSourced,
    "Slack déclarés": b.selfBookedSlack,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={42} />
        <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#fafafa" }} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" />
        <Bar dataKey="Self-sourced" stackId="m" fill={accent} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Inbound lead" stackId="m" fill="#94a3b8" radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="Slack déclarés" stroke="#111" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function FunnelChart({ funnel, accent }: { funnel: FunnelStage[]; accent: string }) {
  const data = (funnel ?? []).filter((s) => s.count > 0 || s.id === "closedwon");
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 10.5, fill: "#666" }}
          axisLine={false}
          tickLine={false}
          width={148}
        />
        <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#fafafa" }} />
        <Bar dataKey="count" name="Deals" fill={accent} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LostReasonsChart({ lostReasons, accent }: { lostReasons: LostReason[]; accent: string }) {
  const data = lostReasons.filter((r) => r.count > 0).slice(0, 8);
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(150, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="reason"
          tick={{ fontSize: 10.5, fill: "#666" }}
          axisLine={false}
          tickLine={false}
          width={148}
        />
        <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#fafafa" }} />
        <Bar dataKey="count" name="Deals perdus" fill={alpha(accent, "cc")} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ quarters, accent }: { quarters: RevenueQuarter[]; accent: string }) {
  const data = quarters.map((q) => ({ label: q.quarter, Objectif: q.newTarget ?? 0, Facturé: q.newBilled ?? 0 }));
  if (data.length === 0 || data.every((d) => d.Objectif === 0 && d.Facturé === 0)) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
        <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#fafafa" }} formatter={(v) => fmtEUR(Number(v))} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" />
        <Bar dataKey="Objectif" fill="#d1d5db" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#d1d5db" />
          ))}
        </Bar>
        <Bar dataKey="Facturé" fill={accent} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
