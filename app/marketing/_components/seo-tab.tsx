"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Zap, AlertTriangle } from "lucide-react";
import { useMarketingSeo } from "@/lib/hooks/use-marketing";
import { useMarketingArticles } from "@/lib/hooks/use-marketing";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceArea,
} from "recharts";

function positionBadgeStyle(pos: number) {
  if (pos <= 3) return { background: "#f0fdf4", color: "#16a34a" };
  if (pos <= 10) return { background: "#fef9c3", color: "#ca8a04" };
  if (pos <= 20) return { background: "#ffedd5", color: "#ea580c" };
  return { background: "#fee2e2", color: "#dc2626" };
}

type SortKey = "keyword" | "impressions" | "clicks" | "ctr" | "position";

export default function SeoTab() {
  const [articleFilter, setArticleFilter] = useState<string>("");
  const [opportunitiesOnly, setOpportunitiesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);

  const { keywords, cannibalizationAlerts, isLoading } = useMarketingSeo(
    articleFilter || undefined,
    opportunitiesOnly,
  );
  const { articles } = useMarketingArticles();

  const sorted = useMemo(() => {
    return [...keywords].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [keywords, sortKey, sortDir]);

  const selectedKeyword = useMemo(
    () => keywords.find((k) => k.id === selectedKeywordId),
    [keywords, selectedKeywordId],
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  if (isLoading) return <div className="text-sm" style={{ color: "#888" }}>Loading...</div>;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center justify-between py-3">
        <select
          value={articleFilter}
          onChange={(e) => setArticleFilter(e.target.value)}
          className="text-sm rounded-lg px-3 py-2 outline-none"
          style={{ border: "1px solid #ddd", color: "#555", background: "#fff" }}
        >
          <option value="">All articles</option>
          {articles.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "#555" }}>
          <span>Opportunities only</span>
          <button
            onClick={() => setOpportunitiesOnly(!opportunitiesOnly)}
            className="relative rounded-full transition-colors"
            style={{
              width: 40, height: 22,
              background: opportunitiesOnly ? "#f01563" : "#e5e5e5",
            }}
          >
            <span
              className="absolute top-0.5 rounded-full bg-white transition-transform"
              style={{
                width: 18, height: 18,
                left: opportunitiesOnly ? 19 : 3,
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
          </button>
        </label>
      </div>

      {/* Keywords Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #eeeeee" }}>
              <th style={{ width: 20 }} />
              {([
                { key: "keyword" as SortKey, label: "KEYWORD", align: "left" as const, noSort: false },
                { key: "keyword" as SortKey, label: "ARTICLE", align: "left" as const, noSort: true },
                { key: "impressions" as SortKey, label: "IMPRESSIONS", align: "right" as const, noSort: false },
                { key: "clicks" as SortKey, label: "CLICKS", align: "right" as const, noSort: false },
                { key: "ctr" as SortKey, label: "CTR", align: "right" as const, noSort: false },
                { key: "position" as SortKey, label: "POSITION", align: "right" as const, noSort: false },
              ]).map((col, i) => (
                <th
                  key={i}
                  onClick={col.noSort ? undefined : () => handleSort(col.key)}
                  className={`px-4 py-2.5 font-medium text-[10px] uppercase tracking-wider ${!col.noSort ? "cursor-pointer select-none" : ""}`}
                  style={{ color: "#888", textAlign: col.align }}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {col.label}
                    {!col.noSort && <SortIcon col={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((kw, i) => {
              const isOpportunity = kw.position >= 5 && kw.position <= 20 && kw.ctr < 3;
              const posStyle = positionBadgeStyle(kw.position);
              return (
                <tr
                  key={kw.id}
                  className="cursor-pointer transition-colors"
                  style={{
                    background: isOpportunity ? "#fffbeb" : i % 2 === 1 ? "#fafafa" : "#fff",
                    borderBottom: "1px solid #f5f5f5",
                  }}
                  onClick={() => setSelectedKeywordId(kw.id)}
                  onMouseEnter={(e) => { if (!isOpportunity) (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
                  onMouseLeave={(e) => { if (!isOpportunity) (e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? "#fafafa" : "#fff"; }}
                >
                  <td className="pl-3">{isOpportunity && <Zap size={14} style={{ color: "#d97706" }} />}</td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "#111" }}>{kw.keyword}</td>
                  <td className="px-4 py-2.5" style={{ color: "#555", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {kw.articleTitle || <span style={{ color: "#ccc" }}>—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{kw.impressions.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{kw.clicks.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#555" }}>{kw.ctr}%</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={posStyle}>{kw.position.toFixed(1)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cannibalization Alerts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-sm" style={{ color: "#111" }}>Cannibalization</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#fee2e2", color: "#dc2626" }}>
            {cannibalizationAlerts.length}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cannibalizationAlerts.map((alert, i) => (
            <div key={i} className="rounded-xl relative" style={{ background: "#fff", border: "1px solid #fecaca", padding: "16px" }}>
              <AlertTriangle size={16} className="absolute top-4 right-4" style={{ color: "#dc2626" }} />
              <p className="font-semibold text-sm mb-2" style={{ color: "#111" }}>{alert.keyword}</p>
              <div className="space-y-1.5">
                {alert.articles.map((a) => {
                  const posStyle = positionBadgeStyle(a.position);
                  return (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <span style={{ color: "#555", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                      <span className="font-medium px-1.5 py-0.5 rounded-full shrink-0" style={posStyle}>Pos. {a.position.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Position Tracking */}
      <div className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "20px" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm" style={{ color: "#111" }}>Position Tracking</h3>
          <select
            value={selectedKeywordId || ""}
            onChange={(e) => setSelectedKeywordId(e.target.value || null)}
            className="text-sm rounded-lg px-3 py-1.5 outline-none"
            style={{ border: "1px solid #ddd", color: "#555", background: "#fff" }}
          >
            <option value="">Select a keyword</option>
            {keywords.map((k) => (
              <option key={k.id} value={k.id}>{k.keyword}</option>
            ))}
          </select>
        </div>
        {selectedKeyword ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={selectedKeyword.positionHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#aaa" }} axisLine={false} tickLine={false} />
              <YAxis reversed domain={[1, 30]} tick={{ fontSize: 11, fill: "#aaa" }} axisLine={false} tickLine={false} />
              <RechartsTooltip
                contentStyle={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 13 }}
                formatter={(value) => [`Position ${Number(value).toFixed(1)}`, ""]}
              />
              <ReferenceArea y1={1} y2={3} fill="#f0fdf4" fillOpacity={0.5} />
              <ReferenceArea y1={3} y2={10} fill="#fef9c3" fillOpacity={0.3} />
              <Line type="monotone" dataKey="position" stroke="#f01563" strokeWidth={2} dot={{ r: 3, fill: "#f01563" }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color: "#bbb" }}>
            Select a keyword to see its position history
          </div>
        )}
      </div>
    </div>
  );
}
