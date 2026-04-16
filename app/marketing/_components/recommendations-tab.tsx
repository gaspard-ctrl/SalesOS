"use client";

import { RefreshCw, GitMerge, Copy, Check as CheckIcon, X as XIcon, Search, Plus, Trash2, Loader2 } from "lucide-react";
import { useState, useCallback, Component, type ReactNode } from "react";
import { useMarketingRecommendations, type DynamicCompetitorBenchmark } from "@/lib/hooks/use-marketing";
import dynamic from "next/dynamic";

const RechartsLine = dynamic(
  () => import("recharts").then((mod) => {
    const { LineChart, Line, ResponsiveContainer } = mod;
    return {
      default: ({ data }: { data: number[] }) => (
        <ResponsiveContainer width="100%" height={30}>
          <LineChart data={data.map((v, i) => ({ v, i }))}>
            <Line type="monotone" dataKey="v" stroke="#dc2626" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ),
    };
  }),
  { ssr: false, loading: () => <div style={{ height: 30 }} /> },
);

// Error boundary to catch rendering errors and show useful message
class TabErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl p-6 text-center" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <p className="text-sm font-medium" style={{ color: "#dc2626" }}>Error in Recommendations tab</p>
          <p className="text-xs mt-1" style={{ color: "#888" }}>{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })} className="text-xs mt-3 px-3 py-1 rounded-lg" style={{ background: "#f01563", color: "#fff" }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RecommendationsTabWrapper() {
  return (
    <TabErrorBoundary>
      <RecommendationsTabInner />
    </TabErrorBoundary>
  );
}

function RecommendationsTabInner() {
  const { refresh, merge, internalLinks, competitors: defaultCompetitors, competitorNames: defaultNames, isLoading } = useMarketingRecommendations();
  const [copiedLink, setCopiedLink] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedCompetitors, setScannedCompetitors] = useState<DynamicCompetitorBenchmark[] | null>(null);
  const [scannedNames, setScannedNames] = useState<string[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Custom topics added by user from frontend
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");

  const competitors = scannedCompetitors ?? defaultCompetitors;
  const competitorNames = scannedNames ?? defaultNames;

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const body: Record<string, unknown> = {};
      if (customTopics.length > 0) body.extraTopics = customTopics;
      const res = await fetch("/api/marketing/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) setScanError(data.error);
      setScannedCompetitors(data.competitors);
      setScannedNames(data.competitorNames);
    } catch {
      setScanError("Network error during scan");
    } finally {
      setScanning(false);
    }
  }, [customTopics]);

  const addTopic = useCallback(() => {
    const trimmed = newTopic.trim();
    if (trimmed && !customTopics.includes(trimmed)) {
      setCustomTopics((prev) => [...prev, trimmed]);
      setNewTopic("");
    }
  }, [newTopic, customTopics]);

  const removeTopic = useCallback((topic: string) => {
    setCustomTopics((prev) => prev.filter((t) => t !== topic));
  }, []);

  const handleCopy = (i: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(i);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  if (isLoading) return <div className="text-sm" style={{ color: "#888" }}>Loading...</div>;

  const gapCount = competitors.filter((c) => !c.coachello && Object.values(c.competitors).some(Boolean)).length;

  return (
    <div className="space-y-8">
      {/* Section 1: Articles to refresh */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-sm" style={{ color: "#111" }}>Articles to Refresh</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#fff7ed", color: "#d97706" }}>{refresh.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {refresh.map((r) => (
            <div key={r.articleId} className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "20px" }}>
              <div className="flex items-start gap-3 mb-3">
                <RefreshCw size={16} className="shrink-0 mt-0.5" style={{ color: "#d97706" }} />
                <div className="flex-1">
                  <p className="font-medium text-sm" style={{ color: "#111" }}>{r.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                    Published {new Date(r.publishedDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}{Math.round((Date.now() - new Date(r.publishedDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months ago
                  </p>
                </div>
              </div>
              {/* Sparkline */}
              <div className="mb-3">
                <RechartsLine data={r.trafficTrend} />
                <div className="flex justify-between text-[10px]" style={{ color: "#bbb" }}>
                  <span>{r.peakSessions} sessions (peak)</span>
                  <span>{r.currentSessions} sessions (current)</span>
                </div>
              </div>
              <div className="mb-3">
                <p className="text-xs font-semibold mb-1.5" style={{ color: "#111" }}>Suggested changes:</p>
                <ul className="space-y-1">
                  {r.suggestions.map((s, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: "#555" }}>
                      <span style={{ color: "#d97706" }}>•</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <button className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ border: "1px solid #d97706", color: "#d97706" }}>
                Apply Suggestions
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Articles to merge */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-sm" style={{ color: "#111" }}>Articles to Merge</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#3b82f6" }}>{merge.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {merge.map((m, i) => (
            <div key={i} className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "20px" }}>
              <div className="flex items-center gap-3 mb-3">
                {m.articles.map((a, j) => (
                  <div key={a.id} className="flex-1">
                    {j === 1 && <GitMerge size={16} className="mx-auto mb-2" style={{ color: "#3b82f6" }} />}
                    <div className="rounded-lg" style={{ background: "#f9f9f9", border: "1px solid #f0f0f0", padding: "10px" }}>
                      <p className="text-xs font-medium" style={{ color: "#111" }}>{a.title}</p>
                      <p className="text-[10px] mt-1" style={{ color: "#888" }}>{a.sessions} sessions · "{a.keyword}"</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs mb-3" style={{ color: "#666" }}>{m.justification}</p>
              <button className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ border: "1px solid #3b82f6", color: "#3b82f6" }}>
                Plan Merge
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Internal linking */}
      <section>
        <h3 className="font-semibold text-sm mb-3" style={{ color: "#111" }}>Internal Linking</h3>
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #eeeeee" }}>
                <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>Source Article</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>Anchor Text</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>Target Article</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {internalLinks.map((link, i) => (
                <tr key={i} style={{ borderTop: i > 0 ? "1px solid #f5f5f5" : undefined }}>
                  <td className="px-4 py-2.5" style={{ color: "#555", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.sourceTitle}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs italic px-2 py-0.5 rounded" style={{ background: "#f5f5f5", color: "#555" }}>{link.anchorText}</span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "#555", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.targetTitle}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleCopy(i, link.anchorText)}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                      style={{ color: copiedLink === i ? "#16a34a" : "#888", border: `1px solid ${copiedLink === i ? "#16a34a" : "#ddd"}` }}
                    >
                      {copiedLink === i ? <CheckIcon size={12} /> : <Copy size={12} />}
                      {copiedLink === i ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>



      {/* Section 5: Competitor benchmark */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm" style={{ color: "#111" }}>Competitor Benchmark</h3>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-opacity"
            style={{
              background: scanning ? "#f5f5f5" : "#f01563",
              color: scanning ? "#888" : "#fff",
              cursor: scanning ? "not-allowed" : "pointer",
            }}
          >
            {scanning ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {scanning ? "Scanning..." : scannedCompetitors ? "Rescan" : "Scan Competitors (Tavily)"}
          </button>
        </div>

        {/* Custom topics input */}
        <div className="rounded-xl mb-4" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "14px 16px" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "#888" }}>Add topics to search:</p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTopic()}
              placeholder="e.g. sales coaching, stress management..."
              className="flex-1 text-sm rounded-lg px-3 py-1.5 outline-none"
              style={{ border: "1px solid #ddd", color: "#555" }}
            />
            <button
              onClick={addTopic}
              disabled={!newTopic.trim()}
              className="flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5"
              style={{
                background: newTopic.trim() ? "#111" : "#f5f5f5",
                color: newTopic.trim() ? "#fff" : "#aaa",
              }}
            >
              <Plus size={12} />
              Add
            </button>
          </div>
          {customTopics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customTopics.map((topic) => (
                <span key={topic} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: "#f5f5f5", color: "#555" }}>
                  {topic}
                  <button onClick={() => removeTopic(topic)} className="hover:opacity-70">
                    <Trash2 size={10} style={{ color: "#888" }} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {scanError && (
          <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#fef2f2", color: "#dc2626" }}>
            {scanError}
          </div>
        )}
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #eeeeee" }}>
                <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>Topic</th>
                <th className="text-center px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>Coachello</th>
                {competitorNames.map((name) => (
                  <th key={name} className="text-center px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>{name}</th>
                ))}
                <th className="text-center px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>Gap</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c, i) => {
                const isGap = !c.coachello && Object.values(c.competitors).some(Boolean);
                return (
                  <tr key={i} style={{ background: isGap ? "#fef9c3" : i % 2 === 1 ? "#fafafa" : "#fff", borderTop: "1px solid #f5f5f5" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "#111" }}>{c.topic}</td>
                    <td className="text-center px-4 py-2.5">
                      {c.coachello ? <CheckIcon size={16} style={{ color: "#16a34a", display: "inline" }} /> : <XIcon size={16} style={{ color: "#dc2626", display: "inline" }} />}
                    </td>
                    {competitorNames.map((name) => (
                      <td key={name} className="text-center px-4 py-2.5">
                        {c.competitors[name] ? <CheckIcon size={16} style={{ color: "#16a34a", display: "inline" }} /> : <XIcon size={16} style={{ color: "#dc2626", display: "inline" }} />}
                      </td>
                    ))}
                    <td className="text-center px-4 py-2.5">
                      {isGap && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#fee2e2", color: "#dc2626" }}>Gap</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3" style={{ background: "#fffbeb", borderTop: "1px solid #fef3c7" }}>
            <p className="text-xs font-semibold" style={{ color: "#d97706" }}>
              {gapCount} topics not covered by Coachello
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
