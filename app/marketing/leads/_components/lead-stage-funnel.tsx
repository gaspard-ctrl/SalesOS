"use client";

import { Loader2 } from "lucide-react";
import { useLeadsFunnel } from "@/lib/hooks/use-marketing";

const ACCENT = "#f01563";
const GREEN = "#10b981";
const BLUE = "#3b82f6";
const PURPLE = "#8b5cf6";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const GRAY = "#9ca3af";

const STAGE_PALETTE = [GRAY, PURPLE, BLUE, ACCENT, GREEN, AMBER, RED];

function pct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

export default function LeadStageFunnel() {
  const { funnel, isLoading } = useLeadsFunnel();

  if (isLoading || !funnel || !funnel.funnel) {
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
        <Loader2 size={16} className="animate-spin" /> Chargement du funnel lead…
      </div>
    );
  }

  const f = funnel.funnel;
  const buckets = f.byLeadStage ?? [];
  const totalLead = f.withLead ?? 0;

  const steps = [
    { label: "Avec lead", count: totalLead, color: ACCENT, base: f.validated },
    ...buckets.map((b, i) => ({
      label: b.stage_label,
      count: b.count,
      color: STAGE_PALETTE[i % STAGE_PALETTE.length],
      base: totalLead,
    })),
  ];

  const max = Math.max(1, ...steps.map((s) => s.count));

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
      <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
        Funnel leads → leads HubSpot
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.length === 1 ? (
          <div
            style={{
              fontSize: 12,
              color: "#888",
              padding: "12px 0",
              fontStyle: "italic",
            }}
          >
            Aucun lead HubSpot trouvé sur la période. Lance le backfill ou ré-analyse.
          </div>
        ) : (
          steps.map((s, i) => {
            const widthPct = (s.count / max) * 100;
            const conv = i === 0 ? null : pct(s.count, s.base);
            return (
              <div key={`${s.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 110,
                    fontSize: 12,
                    color: "#555",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={s.label}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    flex: 1,
                    background: "#f4f4f4",
                    borderRadius: 4,
                    height: 22,
                    position: "relative",
                  }}
                >
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
          })
        )}
      </div>
    </div>
  );
}
