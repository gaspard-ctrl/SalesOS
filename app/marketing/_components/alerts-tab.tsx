"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, Linkedin, Twitter } from "lucide-react";
import { useMarketingAlerts } from "@/lib/hooks/use-marketing";

const ALERT_ICONS = {
  traffic_drop: { icon: AlertTriangle, color: "#dc2626" },
  keyword_lost: { icon: AlertTriangle, color: "#dc2626" },
  competitor_publish: { icon: AlertCircle, color: "#d97706" },
  cta_spike: { icon: Info, color: "#3b82f6" },
  new_ranking: { icon: Info, color: "#3b82f6" },
};

const SEVERITY_BORDER = { high: "#dc2626", medium: "#d97706", low: "#3b82f6" };

const HEATMAP_COLORS = (score: number) => {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#4ade80";
  if (score >= 40) return "#bbf7d0";
  if (score >= 20) return "#dcfce7";
  return "#f0f0f0";
};

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const SLOTS = ["0-4h", "4-8h", "8-12h", "12-16h", "16-20h", "20-24h"];

function formatNumber(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export default function AlertsTab() {
  const { alerts, heatmap, roi, socialPerformance, titleVariants, isLoading } = useMarketingAlerts();
  const [socialTab, setSocialTab] = useState<"linkedin" | "twitter">("linkedin");
  const [hoveredCell, setHoveredCell] = useState<{ day: number; slot: number } | null>(null);

  if (isLoading) return <div className="text-sm" style={{ color: "#888" }}>Chargement...</div>;

  const socialData = socialPerformance.filter((s) => s.platform === socialTab);
  const hoveredHeatmap = hoveredCell ? heatmap.find((h) => h.day === hoveredCell.day && h.slot === hoveredCell.slot) : null;

  return (
    <div className="space-y-8">
      {/* Section 1: Alerts */}
      <section>
        <h3 className="font-semibold text-sm mb-3" style={{ color: "#111" }}>Alertes actives</h3>
        <div className="space-y-2">
          {alerts.map((alert) => {
            const config = ALERT_ICONS[alert.type];
            const Icon = config.icon;
            return (
              <div
                key={alert.id}
                className="rounded-lg flex items-center gap-3"
                style={{
                  background: "#fff",
                  borderLeft: `3px solid ${SEVERITY_BORDER[alert.severity]}`,
                  border: "1px solid #eeeeee",
                  borderLeftWidth: 3,
                  borderLeftColor: SEVERITY_BORDER[alert.severity],
                  padding: "14px 16px",
                }}
              >
                <Icon size={18} style={{ color: config.color }} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "#111" }}>{alert.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#666" }}>{alert.description}</p>
                </div>
                <span className="text-xs shrink-0" style={{ color: "#aaa" }}>
                  {new Date(alert.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
                <button className="text-xs font-medium shrink-0" style={{ color: "#f01563" }}>Voir</button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: Publication Heatmap */}
      <section>
        <div className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "20px" }}>
          <h3 className="font-semibold text-sm mb-4" style={{ color: "#111" }}>Meilleur moment pour publier</h3>
          <div className="overflow-x-auto">
            <table className="mx-auto" style={{ borderCollapse: "separate", borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th style={{ width: 50 }} />
                  {DAYS.map((d) => (
                    <th key={d} className="text-[10px] font-medium text-center pb-1" style={{ color: "#888", width: 44 }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot, si) => (
                  <tr key={si}>
                    <td className="text-[10px] font-medium pr-2 text-right" style={{ color: "#888" }}>{slot}</td>
                    {DAYS.map((_, di) => {
                      const cell = heatmap.find((h) => h.day === di && h.slot === si);
                      const score = cell?.score || 0;
                      const isHovered = hoveredCell?.day === di && hoveredCell?.slot === si;
                      return (
                        <td
                          key={di}
                          className="relative"
                          onMouseEnter={() => setHoveredCell({ day: di, slot: si })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div
                            className="rounded-md cursor-pointer transition-transform"
                            style={{
                              width: 40, height: 28,
                              background: HEATMAP_COLORS(score),
                              transform: isHovered ? "scale(1.15)" : "scale(1)",
                            }}
                          />
                          {isHovered && hoveredHeatmap && (
                            <div
                              className="absolute z-10 text-[10px] font-medium rounded-md px-2 py-1 whitespace-nowrap pointer-events-none"
                              style={{ bottom: "110%", left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
                            >
                              {DAYS[di]} {SLOTS[si]} — Score {hoveredHeatmap.score}/100
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-[10px]" style={{ color: "#888" }}>Faible</span>
            {[0, 25, 50, 75, 100].map((s) => (
              <div key={s} className="rounded-sm" style={{ width: 16, height: 10, background: HEATMAP_COLORS(s) }} />
            ))}
            <span className="text-[10px]" style={{ color: "#888" }}>Fort</span>
          </div>
        </div>
      </section>

      {/* Section 3: ROI */}
      <section>
        <h3 className="font-semibold text-sm mb-3" style={{ color: "#111" }}>ROI par article</h3>
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #eeeeee" }}>
                {["ARTICLE", "TEMPS RÉDACTION", "LEADS", "COÛT/LEAD", "ROI"].map((h) => (
                  <th key={h} className={`px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider ${h === "ARTICLE" ? "text-left" : "text-right"}`} style={{ color: "#888" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roi.map((r, i) => (
                <tr key={r.articleId} style={{ borderTop: i > 0 ? "1px solid #f5f5f5" : undefined, background: i % 2 === 1 ? "#fafafa" : "#fff" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "#111", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{r.writingTimeHours}h</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{r.leadsGenerated}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{r.costPerLead.toFixed(0)}€</td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: r.roi >= 0 ? "#f0fdf4" : "#fee2e2",
                        color: r.roi >= 0 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      ROI {r.roi > 0 ? "+" : ""}{r.roi}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4: Social Performance */}
      <section>
        <h3 className="font-semibold text-sm mb-3" style={{ color: "#111" }}>Performance sociale</h3>
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
          <div className="flex gap-0 px-4 pt-3" style={{ borderBottom: "1px solid #eeeeee" }}>
            {(["linkedin", "twitter"] as const).map((platform) => (
              <button
                key={platform}
                onClick={() => setSocialTab(platform)}
                className="flex items-center gap-1.5 text-sm px-3 py-2 font-medium"
                style={{
                  color: socialTab === platform ? "#f01563" : "#888",
                  borderBottom: socialTab === platform ? "2px solid #f01563" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {platform === "linkedin" ? <Linkedin size={14} /> : <Twitter size={14} />}
                {platform === "linkedin" ? "LinkedIn" : "Twitter"}
              </button>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #eeeeee" }}>
                {["ARTICLE", "PARTAGES", "CLICS", "ENGAGEMENT", "TRAFIC RÉFÉRÉ"].map((h) => (
                  <th key={h} className={`px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider ${h === "ARTICLE" ? "text-left" : "text-right"}`} style={{ color: "#888" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {socialData.map((s, i) => (
                <tr key={s.articleId} style={{ borderTop: i > 0 ? "1px solid #f5f5f5" : undefined }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "#111", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{s.shares}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{s.clicks}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{s.engagement}%</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{formatNumber(s.referralTraffic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5: A/B Title Testing */}
      <section>
        <h3 className="font-semibold text-sm mb-3" style={{ color: "#111" }}>A/B Testing titres</h3>
        <div className="space-y-4">
          {titleVariants.map((tv) => (
            <div key={tv.articleId} className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "20px" }}>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "#888" }}>Titre original</p>
              <p className="text-sm font-medium mb-3" style={{ color: "#555" }}>{tv.originalTitle}</p>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "#888" }}>Variantes générées</p>
              <div className="space-y-2">
                {tv.variants.map((v, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg"
                    style={{
                      background: v.isRecommended ? "#f0fdf4" : "#fafafa",
                      border: v.isRecommended ? "1px solid #bbf7d0" : "1px solid #f0f0f0",
                      padding: "10px 14px",
                    }}
                  >
                    <p className="flex-1 text-sm" style={{ color: "#111" }}>{v.title}</p>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: v.isRecommended ? "#dcfce7" : "#f5f5f5",
                        color: v.isRecommended ? "#16a34a" : "#888",
                      }}
                    >
                      CTR {v.estimatedCtr}%
                    </span>
                    {v.isRecommended && (
                      <>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: "#dcfce7", color: "#16a34a" }}>Recommandé</span>
                        <button className="text-xs font-medium px-3 py-1 rounded-lg shrink-0" style={{ background: "#f01563", color: "#fff" }}>
                          Appliquer
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
