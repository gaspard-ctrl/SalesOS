"use client";

import { useState, useCallback, useEffect, Component, type ReactNode } from "react";
import { Sparkles, TrendingUp, AlertCircle, Search, Check, Download, Link2, Loader2 } from "lucide-react";
import { useMarketingContent } from "@/lib/hooks/use-marketing";
import type { ArticleRecommendation, ArticleDraft, ContentAnalysis } from "@/lib/marketing-types";

const PRIORITY_STYLES = {
  high: { bg: "#fee2e2", color: "#dc2626" },
  medium: { bg: "#fef9c3", color: "#ca8a04" },
  low: { bg: "#eff6ff", color: "#3b82f6" },
};

const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };

class ContentErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ContentTab crash]", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl p-6" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>Content Factory error</p>
          <p className="text-xs mt-2 font-mono" style={{ color: "#888", whiteSpace: "pre-wrap" }}>{this.state.error.message}</p>
          {this.state.error.stack && (
            <details className="mt-3">
              <summary className="text-xs cursor-pointer" style={{ color: "#888" }}>Stack trace</summary>
              <pre className="text-[10px] mt-2 overflow-auto" style={{ color: "#666", maxHeight: 300 }}>{this.state.error.stack}</pre>
            </details>
          )}
          <button onClick={() => this.setState({ error: null })} className="mt-4 text-xs px-3 py-1.5 rounded-lg" style={{ background: "#f01563", color: "#fff" }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ContentTabWrapper() {
  return (
    <ContentErrorBoundary>
      <ContentTab />
    </ContentErrorBoundary>
  );
}

function ContentTab() {
  const { analysis: initialAnalysis, recommendations: initialRecs, drafts: initialDrafts, isLoading } = useMarketingContent();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [localRecs, setLocalRecs] = useState<ArticleRecommendation[]>([]);
  const [generatedDrafts, setGeneratedDrafts] = useState<Map<string, ArticleDraft>>(new Map());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generateErrors, setGenerateErrors] = useState<Map<string, string>>(new Map());
  const [previewLang, setPreviewLang] = useState<"fr" | "en">("fr");

  // Load persisted analysis/recommendations on mount
  useEffect(() => {
    if (initialAnalysis && !analysis) setAnalysis(initialAnalysis);
    if (initialRecs.length > 0 && localRecs.length === 0) setLocalRecs(initialRecs);
    if (initialDrafts.length > 0) {
      const m = new Map<string, ArticleDraft>();
      for (const d of initialDrafts) m.set(d.recommendationId, d);
      setGeneratedDrafts((prev) => prev.size === 0 ? m : prev);
    }
  }, [initialAnalysis, initialRecs, initialDrafts, analysis, localRecs.length]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/marketing/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze" }),
      });
      const data = await res.json();
      if (data.error) {
        setAnalyzeError(data.error);
      } else {
        setAnalysis(data.analysis);
        if (data.recommendations) setLocalRecs(data.recommendations);
      }
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Network error");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const [themeInput, setThemeInput] = useState("");
  const [suggestingTheme, setSuggestingTheme] = useState(false);
  const [themeSummary, setThemeSummary] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);

  const handleSuggestTheme = useCallback(async () => {
    const theme = themeInput.trim();
    if (!theme) return;
    setSuggestingTheme(true);
    setThemeError(null);
    setThemeSummary(null);
    try {
      const res = await fetch("/api/marketing/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest_theme", theme }),
      });
      const data = await res.json();
      if (data.error) {
        setThemeError(data.error);
      } else {
        if (data.recommendations) setLocalRecs(data.recommendations);
        if (data.summary) setThemeSummary(data.summary);
        setThemeInput("");
      }
    } catch (e) {
      setThemeError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSuggestingTheme(false);
    }
  }, [themeInput]);

  const handleApprove = useCallback((id: string) => {
    setLocalRecs((prev) => prev.map((r) => r.id === id ? { ...r, status: "approved" as const } : r));
    fetch("/api/marketing/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", recommendationId: id }),
    });
  }, []);

  const handleReject = useCallback((id: string) => {
    setLocalRecs((prev) => prev.filter((r) => r.id !== id));
    fetch("/api/marketing/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", recommendationId: id }),
    });
  }, []);

  const handleGenerate = useCallback(async (id: string) => {
    setGeneratingIds((prev) => new Set(prev).add(id));
    setGenerateErrors((prev) => { const m = new Map(prev); m.delete(id); return m; });
    setLocalRecs((prev) => prev.map((r) => r.id === id ? { ...r, status: "writing" as const } : r));
    try {
      const res = await fetch("/api/marketing/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", recommendationId: id }),
      });
      const data = await res.json();
      if (data.error) {
        setGenerateErrors((prev) => new Map(prev).set(id, data.error));
        setLocalRecs((prev) => prev.map((r) => r.id === id ? { ...r, status: "approved" as const } : r));
      } else if (data.draft) {
        setGeneratedDrafts((prev) => new Map(prev).set(id, data.draft));
      }
    } catch (e) {
      setGenerateErrors((prev) => new Map(prev).set(id, e instanceof Error ? e.message : "Network error"));
      setLocalRecs((prev) => prev.map((r) => r.id === id ? { ...r, status: "approved" as const } : r));
    } finally {
      setGeneratingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, []);

  const handleDownload = useCallback((draft: ArticleDraft, lang: "fr" | "en") => {
    const meta = draft.wordpressFormat[lang];
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${meta.slug}</title>
<meta name="description" content="${meta.excerpt.replace(/"/g, "&quot;")}">
<meta name="category" content="${meta.category}">
<meta name="keywords" content="${meta.tags.join(", ")}">
</head>
<body>
${draft.content[lang]}
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meta.slug || draft.recommendationId}-${lang}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const approvedCount = localRecs.filter((r) => r.status === "approved" || r.status === "writing" || r.status === "published").length;

  if (isLoading) return <div className="text-sm" style={{ color: "#888" }}>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-0 py-4">
        {[
          { n: 1, label: "Analyze" },
          { n: 2, label: "Recommendations" },
          { n: 3, label: "Write & Publish" },
        ].map((s, i) => {
          const isCompleted = step > s.n;
          const isActive = step === s.n;
          const isLocked = step < s.n;
          return (
            <div key={s.n} className="flex items-center">
              {i > 0 && (
                <div className="w-16 h-0.5 mx-1" style={{ background: isCompleted ? "#16a34a" : "#e5e5e5" }} />
              )}
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: isCompleted ? "#16a34a" : isActive ? "#f01563" : "#e5e5e5",
                    color: isLocked ? "#aaa" : "#fff",
                    animation: isActive ? "pulse 2s infinite" : undefined,
                  }}
                >
                  {isCompleted ? <Check size={14} /> : s.n}
                </div>
                <span
                  className="text-xs font-medium whitespace-nowrap"
                  style={{ color: isActive ? "#f01563" : isCompleted ? "#16a34a" : "#aaa" }}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1 — Analyze */}
      {step === 1 && !analysis && (
        <div className="flex flex-col items-center justify-center py-16">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 text-lg font-semibold rounded-xl px-8 py-4 transition-all disabled:opacity-70"
            style={{ background: "#f01563", color: "#fff", cursor: analyzing ? "wait" : "pointer" }}
          >
            {analyzing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            {analyzing ? "Analyzing... (30–60s)" : "Run Analysis"}
          </button>
          <p className="text-sm mt-3 max-w-md text-center" style={{ color: "#888" }}>
            {analyzing
              ? "Fetching data from Google Analytics, Search Console, and WordPress, then asking Claude for insights."
              : "Claude analyzes real traffic (GA4), search queries (Search Console), and existing articles (WordPress) to identify the best content opportunities."}
          </p>
          {analyzeError && (
            <div className="rounded-xl mt-6 max-w-xl" style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "12px 16px" }}>
              <p className="text-sm font-medium" style={{ color: "#dc2626" }}>Analysis failed</p>
              <p className="text-xs mt-1" style={{ color: "#888" }}>{analyzeError}</p>
            </div>
          )}
        </div>
      )}

      {step === 1 && analysis && (
        <div className="space-y-4">
          {/* Summary banner */}
          {analysis.summary && (
            <div className="rounded-xl flex items-start gap-3" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe", padding: "14px 18px" }}>
              <Sparkles size={16} className="shrink-0 mt-0.5" style={{ color: "#3b82f6" }} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#3b82f6" }}>Claude's take</p>
                <p className="text-sm" style={{ color: "#1e3a8a", lineHeight: 1.6 }}>{analysis.summary}</p>
              </div>
            </div>
          )}

          {/* Data sources badges */}
          {analysis.dataSources && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                background: analysis.dataSources.ga4.ok ? "#f0fdf4" : "#fef2f2",
                color: analysis.dataSources.ga4.ok ? "#16a34a" : "#dc2626",
              }}>
                GA4: {analysis.dataSources.ga4.ok ? `${analysis.dataSources.ga4.pagesCount} pages` : "unavailable"}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                background: analysis.dataSources.searchConsole.ok ? "#f0fdf4" : "#fef2f2",
                color: analysis.dataSources.searchConsole.ok ? "#16a34a" : "#dc2626",
              }}>
                Search Console: {analysis.dataSources.searchConsole.ok ? `${analysis.dataSources.searchConsole.keywordsCount} keywords` : "unavailable"}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                background: analysis.dataSources.wordpress.ok ? "#f0fdf4" : "#fef2f2",
                color: analysis.dataSources.wordpress.ok ? "#16a34a" : "#dc2626",
              }}>
                WordPress: {analysis.dataSources.wordpress.ok ? `${analysis.dataSources.wordpress.articlesCount} articles` : "unavailable"}
              </span>
            </div>
          )}

          <div className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "24px" }}>
            <h3 className="font-semibold mb-4" style={{ color: "#111" }}>Blog Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top performers */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#888" }}>
                  Top performers (30d)
                  <span className="ml-1 text-[9px] font-normal" style={{ color: "#16a34a" }}>GA4</span>
                </h4>
                {analysis.topPerformers.length > 0 ? (
                  <div className="space-y-2">
                    {analysis.topPerformers.map((p, i) => (
                      <div key={`${p.path}-${i}`} className="text-sm">
                        <p className="font-medium leading-tight" style={{ color: "#111", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: "#888" }}>
                          <span className="font-mono font-semibold" style={{ color: "#111" }}>{p.sessions.toLocaleString()} sessions</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "#aaa" }}>No GA4 data available</p>
                )}
              </div>
              {/* Rising trends — real Search Console data */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#888" }}>
                  Top opportunity keywords
                  <span className="ml-1 text-[9px] font-normal" style={{ color: "#16a34a" }}>Search Console</span>
                </h4>
                {analysis.risingTrends.length > 0 ? (
                  <div className="space-y-2.5">
                    {analysis.risingTrends.map((t, i) => (
                      <div key={`${t.keyword}-${i}`} className="text-sm">
                        <div className="flex items-start gap-2">
                          <TrendingUp size={12} className="shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium leading-tight" style={{ color: "#111" }}>{t.keyword}</p>
                            <div className="flex flex-wrap items-center gap-x-2 mt-0.5 text-[10px]" style={{ color: "#888" }}>
                              <span className="font-mono">{t.impressions.toLocaleString()} imp.</span>
                              <span>·</span>
                              <span className="font-mono">pos. {t.position.toFixed(1)}</span>
                              <span>·</span>
                              <span className="font-mono">{t.ctr}% CTR</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "#aaa" }}>No Search Console data available</p>
                )}
              </div>
              {/* Content gaps — Claude analysis */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#888" }}>
                  Content gaps
                  <span className="ml-1 text-[9px] font-normal" style={{ color: "#3b82f6" }}>Claude</span>
                </h4>
                <div className="space-y-3">
                  {analysis.contentGaps.map((g, i) => (
                    <div key={`${g.topic}-${i}`} className="text-sm">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#d97706" }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium leading-tight" style={{ color: "#111" }}>{g.topic}</p>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: "#888" }}>{g.rationale}</p>
                          {g.targetKeyword && (
                            <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#f5f5f5", color: "#555" }}>
                              🎯 {g.targetKeyword}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5"
              style={{ border: "1px solid #ddd", color: "#888", background: "#fff" }}
            >
              {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Re-analyze
            </button>
            <button
              onClick={() => setStep(2)}
              className="text-sm font-medium rounded-lg px-5 py-2"
              style={{ background: "#f01563", color: "#fff" }}
            >
              Next: Recommendations →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Recommendations */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Theme input */}
          <div className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "16px 20px" }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} style={{ color: "#f01563" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#888" }}>Suggest articles on your own theme</p>
            </div>
            <p className="text-xs mb-3" style={{ color: "#888" }}>
              Not happy with these recommendations? Enter a theme and Claude will generate new ideas tailored to it, using real Coachello data (WordPress articles + Search Console keywords).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={themeInput}
                onChange={(e) => setThemeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !suggestingTheme && handleSuggestTheme()}
                placeholder="e.g. manager burnout, AI-driven coaching, team resilience..."
                disabled={suggestingTheme}
                className="flex-1 text-sm rounded-lg px-3 py-2 outline-none disabled:opacity-70"
                style={{ border: "1px solid #ddd", color: "#555" }}
              />
              <button
                onClick={handleSuggestTheme}
                disabled={!themeInput.trim() || suggestingTheme}
                className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50"
                style={{ background: "#f01563", color: "#fff", cursor: suggestingTheme ? "wait" : "pointer" }}
              >
                {suggestingTheme ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {suggestingTheme ? "Thinking..." : "Suggest"}
              </button>
            </div>
            {themeError && (
              <p className="text-xs mt-2" style={{ color: "#dc2626" }}>{themeError}</p>
            )}
            {themeSummary && (
              <div className="mt-3 rounded-lg flex items-start gap-2" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe", padding: "10px 14px" }}>
                <Sparkles size={12} className="shrink-0 mt-0.5" style={{ color: "#3b82f6" }} />
                <p className="text-xs" style={{ color: "#1e3a8a", lineHeight: 1.5 }}>{themeSummary}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {localRecs.map((rec) => {
              const pStyle = PRIORITY_STYLES[rec.priority];
              const isApproved = rec.status === "approved" || rec.status === "writing" || rec.status === "published";
              return (
                <div
                  key={rec.id}
                  className="rounded-xl relative"
                  style={{
                    background: "#fff",
                    border: isApproved ? "1.5px solid #16a34a" : "1px solid #eeeeee",
                    padding: "20px",
                  }}
                >
                  <span
                    className="absolute top-4 right-4 text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: pStyle.bg, color: pStyle.color }}
                  >
                    {rec.priority === "high" ? "High" : rec.priority === "medium" ? "Medium" : "Low"}
                  </span>
                  {isApproved && (
                    <span className="absolute top-4 left-4 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                      Approved
                    </span>
                  )}
                  <h4 className="font-semibold text-sm mt-6 mb-2" style={{ color: "#111" }}>{rec.topic}</h4>
                  <div className="flex items-center gap-1 mb-2">
                    <Search size={12} style={{ color: "#888" }} />
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f5f5f5", color: "#555" }}>{rec.targetKeyword}</span>
                  </div>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: "#666" }}>{rec.justification}</p>
                  <p className="text-xs mb-4" style={{ color: "#888" }}>
                    ~{rec.estimatedTraffic} sessions/mois · Difficulté: {DIFFICULTY_LABELS[rec.difficulty]}
                  </p>
                  {!isApproved ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(rec.id)}
                        className="flex-1 text-xs font-medium py-2 rounded-lg"
                        style={{ background: "#16a34a", color: "#fff" }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(rec.id)}
                        className="flex-1 text-xs font-medium py-2 rounded-lg"
                        style={{ background: "#fff", color: "#888", border: "1px solid #ddd" }}
                      >
                        Skip
                      </button>
                    </div>
                  ) : (
                    <button disabled className="w-full text-xs font-medium py-2 rounded-lg opacity-50" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                      Approved
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm font-medium rounded-lg px-4 py-2" style={{ color: "#888", border: "1px solid #ddd" }}>
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={approvedCount === 0}
              className="text-sm font-medium rounded-lg px-5 py-2 transition-opacity"
              style={{
                background: approvedCount > 0 ? "#f01563" : "#e5e5e5",
                color: approvedCount > 0 ? "#fff" : "#aaa",
                cursor: approvedCount > 0 ? "pointer" : "not-allowed",
              }}
            >
              Next: Write ({approvedCount} topic{approvedCount > 1 ? "s" : ""})
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Write & Publish */}
      {step === 3 && (
        <div className="space-y-6">
          {localRecs
            .filter((r) => r.status === "approved" || r.status === "writing" || r.status === "published")
            .map((rec) => {
              const draft = generatedDrafts.get(rec.id);
              const isGenerating = generatingIds.has(rec.id);
              const generateError = generateErrors.get(rec.id);
              const hasDraft = !!draft;

              return (
                <div key={rec.id} className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "24px" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold" style={{ color: "#111" }}>{rec.topic}</h4>
                    {!hasDraft && (
                      <button
                        onClick={() => handleGenerate(rec.id)}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-70"
                        style={{ background: "#f01563", color: "#fff", cursor: isGenerating ? "wait" : "pointer" }}
                      >
                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {isGenerating ? "Writing... (60–90s)" : "Write Article"}
                      </button>
                    )}
                  </div>

                  {generateError && (
                    <div className="rounded-lg mb-4" style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px" }}>
                      <p className="text-xs font-medium" style={{ color: "#dc2626" }}>Generation failed</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#888" }}>{generateError}</p>
                    </div>
                  )}

                  {hasDraft && draft && draft.content && draft.wordpressFormat && (
                    <div>
                      {/* Language toggle */}
                      <div className="flex items-center justify-end gap-1 mb-4">
                        {(["fr", "en"] as const).map((lang) => (
                          <button
                            key={lang}
                            onClick={() => setPreviewLang(lang)}
                            className="text-xs font-medium rounded-full px-3 py-1"
                            style={{
                              background: previewLang === lang ? "#f01563" : "#f5f5f5",
                              color: previewLang === lang ? "#fff" : "#888",
                            }}
                          >
                            {lang === "fr" ? "French" : "English"}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-4">
                        {/* Article preview */}
                        <div className="flex-1 rounded-xl" style={{ background: "#fafafa", border: "1px solid #eeeeee", padding: "24px" }}>
                          <div
                            className="prose prose-sm max-w-none"
                            style={{ color: "#333" }}
                            dangerouslySetInnerHTML={{ __html: draft.content[previewLang] || "" }}
                          />
                        </div>

                        {/* WordPress metadata sidebar */}
                        <div className="w-60 shrink-0 space-y-4">
                          <div className="rounded-lg" style={{ background: "#f9f9f9", border: "1px solid #eeeeee", padding: "16px" }}>
                            <h5 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#888" }}>WordPress Metadata</h5>
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#aaa" }}>Category</p>
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f0f0", color: "#555" }}>
                                  {draft.wordpressFormat?.[previewLang]?.category || "—"}
                                </span>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#aaa" }}>Tags</p>
                                <div className="flex flex-wrap gap-1">
                                  {(draft.wordpressFormat?.[previewLang]?.tags || []).map((t) => (
                                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#f0f0f0", color: "#666" }}>{t}</span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#aaa" }}>Excerpt</p>
                                <p className="text-xs" style={{ color: "#555" }}>{draft.wordpressFormat?.[previewLang]?.excerpt || ""}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#aaa" }}>Slug</p>
                                <code className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#f0f0f0", color: "#555" }}>
                                  /{draft.wordpressFormat?.[previewLang]?.slug || ""}
                                </code>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#aaa" }}>Style Match</p>
                                <div className="flex items-center gap-2">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ border: `3px solid ${draft.styleMatchScore >= 80 ? "#16a34a" : "#d97706"}`, color: draft.styleMatchScore >= 80 ? "#16a34a" : "#d97706" }}>
                                    {draft.styleMatchScore}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Internal Links */}
                          {draft.internalLinks && draft.internalLinks[previewLang]?.length > 0 && (
                            <div className="rounded-lg mt-4" style={{ background: "#f9f9f9", border: "1px solid #eeeeee", padding: "16px" }}>
                              <div className="flex items-center gap-1.5 mb-3">
                                <Link2 size={14} style={{ color: "#f01563" }} />
                                <h5 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#888" }}>Internal Links ({draft.internalLinks[previewLang].length})</h5>
                              </div>
                              <div className="space-y-2.5">
                                {draft.internalLinks[previewLang].map((link, li) => (
                                  <div key={li} className="text-xs">
                                    <p className="font-medium" style={{ color: "#111" }}>{link.targetArticleTitle}</p>
                                    <p className="mt-0.5" style={{ color: "#888" }}>Anchor: <span className="italic" style={{ color: "#555" }}>"{link.anchorText}"</span></p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Download buttons */}
                      <div className="flex items-center gap-3 mt-4">
                        <button
                          onClick={() => handleDownload(draft, "fr")}
                          className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2"
                          style={{ background: "#f01563", color: "#fff" }}
                        >
                          <Download size={14} />
                          Download FR (.html)
                        </button>
                        <button
                          onClick={() => handleDownload(draft, "en")}
                          className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2"
                          style={{ background: "#3b82f6", color: "#fff" }}
                        >
                          <Download size={14} />
                          Download EN (.html)
                        </button>
                      </div>
                      <p className="text-xs mt-2" style={{ color: "#888" }}>HTML file ready to paste into WordPress or any CMS.</p>
                    </div>
                  )}
                </div>
              );
            })}
          <div className="flex justify-start">
            <button onClick={() => setStep(2)} className="text-sm font-medium rounded-lg px-4 py-2" style={{ color: "#888", border: "1px solid #ddd" }}>
              Back to recommendations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
