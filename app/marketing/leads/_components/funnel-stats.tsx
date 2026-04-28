"use client";

import { Loader2 } from "lucide-react";
import { useLeadsFunnel } from "@/lib/hooks/use-marketing";

const ACCENT = "#f01563";
const GREEN = "#10b981";
const BLUE = "#3b82f6";
const PURPLE = "#8b5cf6";

function formatAmount(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + "€";
}

function pct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

export default function FunnelStats() {
  const { funnel, isLoading } = useLeadsFunnel();

  if (isLoading || !funnel) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 24,
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#888",
        }}
      >
        <Loader2 size={16} className="animate-spin" /> Chargement du funnel…
      </div>
    );
  }

  const { funnel: f, openPipelineAmount } = funnel;
  const steps = [
    { label: "Leads totaux", count: f.totalLeads, color: "#9ca3af", base: f.totalLeads },
    { label: "Validés", count: f.validated, color: ACCENT, base: f.totalLeads },
    { label: "Avec deal", count: f.withDeal, color: BLUE, base: f.validated },
    { label: "Closed won", count: f.closedWon, color: GREEN, base: f.withDeal },
  ];

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 8,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>Funnel des leads</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => {
          const widthPct = f.totalLeads > 0 ? (s.count / f.totalLeads) * 100 : 0;
          const conv = i === 0 ? null : pct(s.count, s.base);
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 110, fontSize: 12, color: "#555" }}>{s.label}</div>
              <div style={{ flex: 1, background: "#f4f4f4", borderRadius: 4, height: 22, position: "relative" }}>
                <div
                  style={{
                    width: `${Math.max(widthPct, 2)}%`,
                    background: s.color,
                    height: "100%",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 8,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {s.count}
                </div>
              </div>
              <div style={{ width: 60, textAlign: "right", fontSize: 12, color: "#555" }}>
                {conv ?? ""}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <KpiCard
          label="% leads → disco"
          value={pct(f.disco, f.validated)}
          subtitle={`${f.disco} / ${f.validated} validés`}
          color={BLUE}
        />
        <KpiCard
          label="% leads → won"
          value={pct(f.closedWon, f.validated)}
          subtitle={`${f.closedWon} / ${f.validated} validés`}
          color={GREEN}
        />
        <KpiCard
          label="Pipeline ouvert"
          value={formatAmount(openPipelineAmount)}
          subtitle="Deals en cours liés aux leads"
          color={PURPLE}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #eee",
        borderRadius: 6,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {subtitle && <div style={{ fontSize: 11, color: "#888" }}>{subtitle}</div>}
    </div>
  );
}
