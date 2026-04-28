"use client";

import { useSalesCoachTrends, type TrendPoint } from "@/lib/hooks/use-sales-coach";
import { TrendingUp } from "lucide-react";

const AXES = [
  { key: "opening", label: "Opening" },
  { key: "discovery", label: "Discovery" },
  { key: "active_listening", label: "Écoute" },
  { key: "value_articulation", label: "Value articulation" },
  { key: "objection_handling", label: "Objections" },
  { key: "next_steps", label: "Next steps" },
] as const;

const MEDDIC = [
  { key: "metrics", label: "M" },
  { key: "economic_buyer", label: "EB" },
  { key: "decision_criteria", label: "DC" },
  { key: "decision_process", label: "DP" },
  { key: "identify_pain", label: "IP" },
  { key: "champion", label: "C" },
] as const;

function scoreColor(score: number): string {
  if (score >= 7.5) return "#10b981";
  if (score >= 5) return "#d97706";
  if (score > 0) return "#dc2626";
  return "#e5e5e5";
}

function MiniBars({ values, max = 10 }: { values: number[]; max?: number }) {
  return (
    <div className="flex items-end gap-1 h-10">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end" style={{ minWidth: 12 }}>
          <div
            className="rounded-sm"
            style={{
              height: `${Math.max(4, (v / max) * 100)}%`,
              background: scoreColor(v),
              opacity: v > 0 ? 1 : 0.3,
            }}
            title={v.toFixed(1)}
          />
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

interface Props {
  analysisId: string;
  dealId: string | null;
}

export function TrendsTab({ analysisId, dealId }: Props) {
  const mine = useSalesCoachTrends({ excludeId: analysisId, limit: 5 });
  const onDeal = useSalesCoachTrends({ dealId, excludeId: analysisId, limit: 8 });

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} style={{ color: "#111" }} />
          <h3 className="text-base font-semibold" style={{ color: "#111" }}>Tes 5 derniers meetings</h3>
        </div>
        <p className="text-xs mb-3" style={{ color: "#888" }}>
          Évolution des 6 axes coaching sur tes meetings précédents (excluant celui-ci).
        </p>
        {mine.isLoading ? (
          <div className="text-xs" style={{ color: "#888" }}>Chargement…</div>
        ) : mine.trends.length === 0 ? (
          <div className="rounded-lg p-4 text-xs" style={{ background: "#fafafa", color: "#888", border: "1px dashed #e5e5e5" }}>
            Pas assez de meetings analysés pour calculer une tendance.
          </div>
        ) : (
          <AxisGrid trends={mine.trends} />
        )}
      </section>

      {dealId && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} style={{ color: "#111" }} />
            <h3 className="text-base font-semibold" style={{ color: "#111" }}>Évolution MEDDIC sur ce deal</h3>
          </div>
          <p className="text-xs mb-3" style={{ color: "#888" }}>
            Maturité MEDDIC meeting après meeting sur le deal.
          </p>
          {onDeal.isLoading ? (
            <div className="text-xs" style={{ color: "#888" }}>Chargement…</div>
          ) : onDeal.trends.length === 0 ? (
            <div className="rounded-lg p-4 text-xs" style={{ background: "#fafafa", color: "#888", border: "1px dashed #e5e5e5" }}>
              Pas d&apos;autre meeting analysé sur ce deal.
            </div>
          ) : (
            <MeddicGrid trends={onDeal.trends} />
          )}
        </section>
      )}
    </div>
  );
}

function AxisGrid({ trends }: { trends: TrendPoint[] }) {
  // For each axis, build values array across trends
  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: "#fff", border: "1px solid #f0f0f0" }}>
      {AXES.map((axis) => {
        const values = trends.map((t) => t.axes?.[axis.key] ?? 0);
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        return (
          <div key={axis.key} className="flex items-center gap-4">
            <div className="w-32 text-xs flex-shrink-0" style={{ color: "#444" }}>{axis.label}</div>
            <div className="flex-1">
              <MiniBars values={values} />
            </div>
            <div className="w-12 text-right text-xs font-semibold tabular-nums" style={{ color: scoreColor(avg) }}>
              {avg.toFixed(1)}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-1 mt-2 pt-2 border-t" style={{ borderColor: "#f0f0f0" }}>
        <div className="w-32 text-[11px]" style={{ color: "#888" }}>Meeting</div>
        <div className="flex-1 flex gap-1">
          {trends.map((t, i) => (
            <div key={i} className="flex-1 text-center text-[10px]" style={{ color: "#888", minWidth: 12 }}>
              {formatDate(t.date)}
            </div>
          ))}
        </div>
        <div className="w-12 text-right text-[11px]" style={{ color: "#888" }}>moy.</div>
      </div>
    </div>
  );
}

function MeddicGrid({ trends }: { trends: TrendPoint[] }) {
  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: "#fff", border: "1px solid #f0f0f0" }}>
      {MEDDIC.map((dim) => {
        const values = trends.map((t) => t.meddic?.[dim.key] ?? 0);
        return (
          <div key={dim.key} className="flex items-center gap-4">
            <div className="w-12 flex-shrink-0">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold"
                style={{ background: "#ede9fe", color: "#6d28d9" }}
              >
                {dim.label}
              </span>
            </div>
            <div className="flex-1">
              <MiniBars values={values} />
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-1 mt-2 pt-2 border-t" style={{ borderColor: "#f0f0f0" }}>
        <div className="w-12 text-[11px]" style={{ color: "#888" }}>—</div>
        <div className="flex-1 flex gap-1">
          {trends.map((t, i) => (
            <div key={i} className="flex-1 text-center text-[10px]" style={{ color: "#888", minWidth: 12 }}>
              {formatDate(t.date)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
