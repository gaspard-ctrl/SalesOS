"use client";

import { useState, useMemo, useEffect } from "react";
import { Star, TrendingDown, Rocket, Wrench } from "lucide-react";
import { useMarketingArticles } from "@/lib/hooks/use-marketing";
import type { ArticlePerformance } from "@/lib/mock/marketing-data";

interface ArticlesTabProps {
  initialSelectedId: string | null;
  onClearSelection: () => void;
}

const BADGE_CONFIG = {
  star: { label: "Star Performer", color: "#16a34a", bg: "#f0fdf4", icon: Star },
  declining: { label: "Declining", color: "#dc2626", bg: "#fee2e2", icon: TrendingDown },
  promising: { label: "Promising", color: "#3b82f6", bg: "#eff6ff", icon: Rocket },
  needs_optimization: { label: "Needs Work", color: "#d97706", bg: "#fff7ed", icon: Wrench },
};

function scoreColor(score: number) {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

function formatNumber(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function ArticlesTab({ initialSelectedId, onClearSelection }: ArticlesTabProps) {
  const [sort, setSort] = useState("aiScore");
  const { articles, isLoading } = useMarketingArticles(sort, "desc");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  const selected = useMemo(() => articles.find((a) => a.id === selectedId) || null, [articles, selectedId]);
  const compareArticle = useMemo(() => articles.find((a) => a.id === compareId) || null, [articles, compareId]);

  if (isLoading) return <div className="text-sm" style={{ color: "#888" }}>Loading...</div>;

  return (
    <div className="flex gap-5 h-full" style={{ minHeight: "calc(100vh - 200px)" }}>
      {/* Left: Article List */}
      <div className="w-2/5 shrink-0 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm" style={{ color: "#111" }}>Articles</h3>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs rounded-lg px-2 py-1.5 outline-none"
            style={{ border: "1px solid #ddd", color: "#555", background: "#fff" }}
          >
            <option value="aiScore">AI Score</option>
            <option value="sessions">Sessions</option>
            <option value="ctr">CTR</option>
            <option value="ctaConversions">Conversions</option>
          </select>
        </div>
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
          {articles.map((a) => {
            const badge = BADGE_CONFIG[a.badge];
            const BadgeIcon = badge.icon;
            const isSelected = selectedId === a.id;
            return (
              <div
                key={a.id}
                onClick={() => { setSelectedId(a.id); onClearSelection(); }}
                className="rounded-xl cursor-pointer transition-all"
                style={{
                  background: "#fff",
                  border: isSelected ? "1.5px solid #f01563" : "1px solid #eeeeee",
                  boxShadow: isSelected ? "0 0 0 1px #f01563" : "none",
                  padding: "14px 16px",
                }}
              >
                {/* Badge + Title */}
                <div className="flex items-start gap-2 mb-2">
                  <span
                    className="shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    <BadgeIcon size={10} />
                    {badge.label}
                  </span>
                </div>
                <p className="text-sm font-medium leading-tight mb-2" style={{ color: "#111", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {a.title}
                </p>

                {/* Score circle + mini metrics */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ border: `3px solid ${scoreColor(a.aiScore)}`, color: scoreColor(a.aiScore) }}
                  >
                    {a.aiScore}
                  </div>
                  <div className="flex-1 text-xs" style={{ color: "#888" }}>
                    {formatNumber(a.sessions)} sessions · {a.ctr}% CTR · Pos. {a.avgPosition.toFixed(1)}
                  </div>
                </div>

                <p className="text-[10px] mt-2 text-right" style={{ color: "#bbb" }}>
                  {new Date(a.publishedDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Article Detail */}
      <div className="flex-1">
        {!selected ? (
          <div className="flex items-center justify-center h-full rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
            <p className="text-sm" style={{ color: "#bbb" }}>Select an article</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-y-auto" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "24px", maxHeight: "calc(100vh - 200px)" }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex-1">
                <h2 className="text-lg font-bold" style={{ color: "#111" }}>{selected.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs" style={{ color: "#888" }}>
                    {new Date(selected.publishedDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  {(() => {
                    const badge = BADGE_CONFIG[selected.badge];
                    const BadgeIcon = badge.icon;
                    return (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                        <BadgeIcon size={10} />{badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                onClick={() => setShowCompare(!showCompare)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  border: showCompare ? "1px solid #f01563" : "1px solid #ddd",
                  color: showCompare ? "#f01563" : "#555",
                  background: showCompare ? "#fff0f4" : "#fff",
                }}
              >
                Compare
              </button>
            </div>

            {/* Comparison selector */}
            {showCompare && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: "#f9f9f9", border: "1px solid #eee" }}>
                <select
                  value={compareId || ""}
                  onChange={(e) => setCompareId(e.target.value || null)}
                  className="text-sm rounded-lg px-3 py-1.5 outline-none w-full"
                  style={{ border: "1px solid #ddd", color: "#555", background: "#fff" }}
                >
                  <option value="">Choose an article to compare</option>
                  {articles.filter((a) => a.id !== selectedId).map((a) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Metrics Grid */}
            <MetricsGrid article={selected} compareArticle={showCompare ? compareArticle : null} />

            {/* Score Breakdown */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-3" style={{ color: "#111" }}>AI Score — Breakdown</h4>
              <ScoreBreakdown breakdown={selected.scoreBreakdown} total={selected.aiScore} />
              {showCompare && compareArticle && (
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid #f0f0f0" }}>
                  <p className="text-xs font-medium mb-2" style={{ color: "#888" }}>vs {compareArticle.title.slice(0, 40)}...</p>
                  <ScoreBreakdown breakdown={compareArticle.scoreBreakdown} total={compareArticle.aiScore} />
                </div>
              )}
            </div>

            {/* CTA Analysis */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-3" style={{ color: "#111" }}>CTA Analysis</h4>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #eeeeee" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f9f9f9" }}>
                      <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: "#888" }}>CTA</th>
                      <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: "#888" }}>Clicks</th>
                      <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: "#888" }}>Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.ctaDetails.map((cta, i) => {
                      const isBest = i === 0;
                      return (
                        <tr key={cta.ctaName} style={{ background: isBest ? "#f0fdf4" : i % 2 === 0 ? "#fff" : "#fafafa", borderTop: "1px solid #f5f5f5" }}>
                          <td className="px-4 py-2.5 font-medium" style={{ color: "#111" }}>
                            {cta.ctaName}
                            {isBest && <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#16a34a" }}>Top CTA</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{cta.clicks}</td>
                          <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{cta.conversionRate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricsGrid({ article, compareArticle }: { article: ArticlePerformance; compareArticle: ArticlePerformance | null }) {
  const metrics = [
    { label: "Sessions", value: formatNumber(article.sessions), compareValue: compareArticle ? formatNumber(compareArticle.sessions) : null, rawA: article.sessions, rawB: compareArticle?.sessions },
    { label: "Organic Clicks", value: formatNumber(article.organicClicks), compareValue: compareArticle ? formatNumber(compareArticle.organicClicks) : null, rawA: article.organicClicks, rawB: compareArticle?.organicClicks },
    { label: "CTR", value: `${article.ctr}%`, compareValue: compareArticle ? `${compareArticle.ctr}%` : null, rawA: article.ctr, rawB: compareArticle?.ctr },
    { label: "Bounce Rate", value: `${article.bounceRate}%`, compareValue: compareArticle ? `${compareArticle.bounceRate}%` : null, rawA: article.bounceRate, rawB: compareArticle?.bounceRate, invert: true },
    { label: "Avg. Duration", value: formatDuration(article.avgDuration), compareValue: compareArticle ? formatDuration(compareArticle.avgDuration) : null, rawA: article.avgDuration, rawB: compareArticle?.avgDuration },
    { label: "CTA Conversions", value: String(article.ctaConversions), compareValue: compareArticle ? String(compareArticle.ctaConversions) : null, rawA: article.ctaConversions, rawB: compareArticle?.ctaConversions },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {metrics.map((m) => {
        let diffColor = "";
        let diffText = "";
        if (compareArticle && m.rawB != null) {
          const diff = ((m.rawA - m.rawB) / m.rawB) * 100;
          const isPositive = m.invert ? diff < 0 : diff > 0;
          diffColor = isPositive ? "#16a34a" : "#dc2626";
          diffText = `${diff > 0 ? "+" : ""}${diff.toFixed(0)}%`;
        }
        return (
          <div key={m.label} className="rounded-lg" style={{ background: "#fafafa", border: "1px solid #f0f0f0", padding: "12px" }}>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#999" }}>{m.label}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-lg font-bold" style={{ color: "#111" }}>{m.value}</p>
              {compareArticle && m.compareValue && (
                <>
                  <span className="text-xs" style={{ color: "#bbb" }}>vs {m.compareValue}</span>
                  <span className="text-[10px] font-medium" style={{ color: diffColor }}>{diffText}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreBreakdown({ breakdown, total }: { breakdown: { traffic: number; engagement: number; conversion: number; seo: number; seoBackend: number }; total: number }) {
  const bars = [
    { label: "Traffic", value: breakdown.traffic, max: 20 },
    { label: "Engagement", value: breakdown.engagement, max: 20 },
    { label: "Conversion", value: breakdown.conversion, max: 20 },
    { label: "SEO", value: breakdown.seo, max: 20 },
    { label: "SEO Backend", value: breakdown.seoBackend, max: 20 },
  ];

  return (
    <div className="space-y-2">
      {bars.map((bar) => {
        const pct = (bar.value / bar.max) * 100;
        return (
          <div key={bar.label} className="flex items-center gap-2">
            <span className="text-[10px] font-medium w-20 shrink-0" style={{ color: "#888" }}>{bar.label}</span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: "#f0f0f0" }}>
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: scoreColor(pct) }} />
            </div>
            <span className="text-[10px] font-medium w-10 text-right" style={{ color: "#555" }}>{bar.value}/{bar.max}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid #f0f0f0" }}>
        <span className="text-[10px] font-semibold w-20 shrink-0" style={{ color: "#111" }}>Total</span>
        <div className="flex-1 h-2 rounded-full" style={{ background: "#f0f0f0" }}>
          <div className="h-2 rounded-full transition-all" style={{ width: `${total}%`, background: scoreColor(total) }} />
        </div>
        <span className="text-xs font-bold w-10 text-right" style={{ color: scoreColor(total) }}>{total}</span>
      </div>
    </div>
  );
}
