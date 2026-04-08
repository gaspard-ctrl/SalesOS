"use client";

import { useState, useEffect, useCallback } from "react";
import { useUserMe } from "@/lib/hooks/use-user-me";
import {
  Search, RefreshCw, ExternalLink, Mail, Eye, Check, ChevronRight,
  TrendingUp, Users, Target, Zap, Building2, ArrowUpRight, Settings,
  X, Copy, Loader2, Shield,
} from "lucide-react";
import { EditableList } from "@/app/admin/_components/editable-list";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Signal {
  id: string;
  company_name: string;
  signal_type: string;
  title: string;
  summary: string | null;
  signal_date: string | null;
  strength: number;
  source_url: string | null;
  source_domain: string | null;
  score: number | null;
  score_breakdown: { icp: number; actionability: number; freshness: number; source_reliability: number; signal_strength: number } | null;
  why_relevant: string | null;
  suggested_action: string | null;
  action_type: string | null;
  is_read: boolean;
  is_actioned: boolean;
  created_at: string;
}

interface Stats {
  total: number;
  thisWeek: number;
  highPriority: number;
  actioned: number;
  actionRate: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string; icon: typeof TrendingUp }> = {
  funding: { label: "Levée", bg: "#f0fdf4", color: "#16a34a", icon: TrendingUp },
  hiring: { label: "Recrutement", bg: "#eff6ff", color: "#2563eb", icon: Users },
  nomination: { label: "Nomination", bg: "#fef3c7", color: "#d97706", icon: Target },
  expansion: { label: "Expansion", bg: "#f5f3ff", color: "#7c3aed", icon: ArrowUpRight },
  restructuring: { label: "Restructuration", bg: "#fef2f2", color: "#dc2626", icon: Zap },
  job_change: { label: "Changement poste", bg: "#eef2ff", color: "#4f46e5", icon: Users },
  linkedin_post: { label: "Post LinkedIn", bg: "#dbeafe", color: "#1d4ed8", icon: ExternalLink },
  content: { label: "Contenu", bg: "#f3f4f6", color: "#6b7280", icon: Building2 },
};

function scoreColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

function scoreBg(score: number): string {
  if (score >= 70) return "#f0fdf4";
  if (score >= 50) return "#fef3c7";
  return "#fef2f2";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days}j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, thisWeek: 0, highPriority: 0, actioned: 0, actionRate: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterMinScore, setFilterMinScore] = useState<number>(0);
  const [companySearch, setCompanySearch] = useState("");
  const [searchingCompany, setSearchingCompany] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const { isAdmin } = useUserMe();
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);

  const loadSignals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterMinScore > 0) params.set("minScore", String(filterMinScore));
      const res = await fetch(`/api/market/signals?${params}`);
      const data = await res.json();
      setSignals(data.signals ?? []);
      setStats(data.stats ?? { total: 0, thisWeek: 0, highPriority: 0, actioned: 0, actionRate: 0 });
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterType, filterMinScore]);

  useEffect(() => { loadSignals(); }, [loadSignals]);


  useEffect(() => {
    if (!showConfig) return;
    Promise.all([
      fetch("/api/settings/market-targets?key=target_companies").then((r) => r.json()),
      fetch("/api/settings/market-targets?key=target_roles").then((r) => r.json()),
    ]).then(([c, r]) => {
      setTargetCompanies(c.items ?? []);
      setTargetRoles(r.items ?? []);
    }).catch(() => {});
  }, [showConfig]);

  async function runScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/market/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      const dbg = data.debug;
      const debugStr = dbg ? ` · Sources: ${dbg.globalResults ?? 0} global + ${dbg.targetedResults ?? 0} ciblé · ${dbg.queriesEmpty ?? 0} requêtes vides` : "";
      setScanResult(data.signals > 0
        ? `${data.signals} signaux détectés (${data.highPriority ?? 0} prioritaires) · Score moyen ${data.avgScore ?? "—"}${debugStr}`
        : `Aucun signal détecté${debugStr}`);
      await loadSignals();
    } catch {
      setScanResult("Erreur lors du scan");
    }
    setScanning(false);
  }

  async function searchCompany() {
    if (!companySearch.trim()) return;
    setSearchingCompany(true);
    try {
      await fetch("/api/market/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: companySearch.trim() }),
      });
      setCompanySearch("");
      await loadSignals();
    } catch { /* ignore */ }
    setSearchingCompany(false);
  }

  async function markSignal(id: string, field: "is_read" | "is_actioned", value: boolean) {
    await fetch("/api/market/signals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value }),
    });
    setSignals((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
    if (selectedSignal?.id === id) setSelectedSignal((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  function selectSignal(signal: Signal) {
    setSelectedSignal(signal);
    setGeneratedEmail(null);
    if (!signal.is_read) markSignal(signal.id, "is_read", true);
  }

  async function generateEmail(signal: Signal) {
    setGeneratingEmail(true);
    setGeneratedEmail(null);
    try {
      const res = await fetch("/api/market/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: signal.company_name,
          signal_type: signal.signal_type,
          title: signal.title,
          summary: signal.summary,
          why_relevant: signal.why_relevant,
          suggested_action: signal.suggested_action,
        }),
      });
      const data = await res.json();
      setGeneratedEmail({ subject: data.subject, body: data.body });
    } catch {
      setGeneratedEmail({ subject: "Erreur", body: "Impossible de générer l'email." });
    }
    setGeneratingEmail(false);
  }

  function copyEmail() {
    if (!generatedEmail) return;
    const text = `Objet : ${generatedEmail.subject}\n\n${generatedEmail.body}`;
    navigator.clipboard.writeText(text);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ background: "#f8f8f8" }}>

      {/* ── Header + KPIs ────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee" }}>
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold" style={{ color: "#111" }}>Market Intel</h1>
            <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>Signaux d&apos;achat scorés et priorisés</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5" style={{ borderColor: "#e5e5e5" }}>
              <Search size={13} style={{ color: "#aaa" }} />
              <input
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchCompany()}
                placeholder="Analyser une entreprise…"
                className="text-xs outline-none bg-transparent w-40"
                style={{ color: "#333" }}
              />
              {searchingCompany && <RefreshCw size={11} className="animate-spin" style={{ color: "#aaa" }} />}
            </div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors"
              style={{ background: showConfig ? "#111" : "#f5f5f5", color: showConfig ? "#fff" : "#555" }}
            >
              <Settings size={12} />
              Cibles
            </button>
            {isAdmin && (
              <a href="/market-admin"
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors"
                style={{ background: "#f5f5f5", color: "#555" }}>
                <Shield size={12} />
                Admin
              </a>
            )}
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              style={{ background: "#f01563", color: "#fff" }}
            >
              <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
              {scanning ? "Scan en cours…" : "Scan global"}
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="px-6 pb-4 grid grid-cols-4 gap-3">
          {[
            { label: "Signaux cette semaine", value: stats.thisWeek, color: "#111" },
            { label: "Prioritaires (70+)", value: stats.highPriority, color: "#16a34a" },
            { label: "Taux d'action", value: `${stats.actionRate}%`, color: "#2563eb" },
            { label: "Total signaux", value: stats.total, color: "#888" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border px-3.5 py-2.5" style={{ borderColor: "#f0f0f0", background: "#fafafa" }}>
              <p className="text-[10px] font-medium" style={{ color: "#aaa" }}>{kpi.label}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {scanResult && (
          <div className="px-6 pb-3">
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: scanResult.includes("Aucun") || scanResult.includes("Erreur") ? "#f5f5f5" : "#f0fdf4", color: scanResult.includes("Aucun") || scanResult.includes("Erreur") ? "#888" : "#166534" }}>
              {scanResult}
            </p>
          </div>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 flex items-center gap-3 border-b" style={{ background: "#fff", borderColor: "#eee" }}>
        <div className="flex items-center gap-1">
          {["all", "funding", "hiring", "nomination", "job_change", "linkedin_post", "expansion", "restructuring", "content"].map((t) => {
            const cfg = TYPE_CONFIG[t];
            const isActive = filterType === t;
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors"
                style={{
                  background: isActive ? (cfg?.bg ?? "#111") : "#fff",
                  color: isActive ? (cfg?.color ?? "#fff") : "#888",
                  border: `1px solid ${isActive ? (cfg?.color ?? "#111") : "#e5e5e5"}`,
                }}
              >
                {t === "all" ? "Tous" : cfg?.label ?? t}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "#aaa" }}>Score min :</span>
          {[0, 50, 70].map((v) => (
            <button
              key={v}
              onClick={() => setFilterMinScore(v)}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: filterMinScore === v ? "#111" : "#f5f5f5",
                color: filterMinScore === v ? "#fff" : "#888",
              }}
            >
              {v === 0 ? "Tous" : `${v}+`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Config panel (entreprises + postes ciblés) ────────────────── */}
      {showConfig && (
        <div className="px-6 py-4 border-b space-y-3" style={{ background: "#fafafa", borderColor: "#eee" }}>
          <div className="grid grid-cols-2 gap-3">
            <EditableList
              initialItems={targetCompanies}
              endpoint="/api/settings/market-targets?key=target_companies"
              title="Entreprises ciblées"
              description="Scan changements de poste + LinkedIn L&D sur ces entreprises uniquement."
              placeholder="Ajouter une entreprise…"
              saveFormat="items"
            />
            <EditableList
              initialItems={targetRoles}
              endpoint="/api/settings/market-targets?key=target_roles"
              title="Postes surveillés"
              description="Changement de poste dans une entreprise ciblée → signal prioritaire."
              placeholder="Ajouter un poste (ex: Head of L&D)…"
              saveFormat="items"
            />
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Feed */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2" style={{ maxWidth: selectedSignal ? "55%" : "100%" }}>
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#f0f0f0" }} />
              ))}
            </div>
          )}

          {!loading && signals.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <Search size={32} style={{ color: "#e5e5e5" }} />
              <p className="text-sm font-medium" style={{ color: "#888" }}>Aucun signal</p>
              <p className="text-xs" style={{ color: "#bbb" }}>Lance un scan global ou analyse une entreprise</p>
            </div>
          )}

          {signals.map((signal) => {
            const score = signal.score ?? 0;
            const cfg = TYPE_CONFIG[signal.signal_type] ?? TYPE_CONFIG.content;
            const TypeIcon = cfg.icon;
            const isSelected = selectedSignal?.id === signal.id;

            return (
              <button
                key={signal.id}
                onClick={() => selectSignal(signal)}
                className="w-full text-left rounded-xl border p-3.5 transition-all flex gap-3"
                style={{
                  borderColor: isSelected ? "#f01563" : "#e5e5e5",
                  background: isSelected ? "#fff9fb" : signal.is_read ? "#fff" : "#fffcf0",
                  boxShadow: isSelected ? "0 0 0 1px #f01563" : "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                {/* Score */}
                <div className="flex flex-col items-center gap-1 shrink-0 w-10">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: scoreBg(score), color: scoreColor(score) }}>
                    {score}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: "#111" }}>{signal.company_name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5" style={{ background: cfg.bg, color: cfg.color }}>
                      <TypeIcon size={9} />
                      {cfg.label}
                    </span>
                    {!signal.is_read && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f01563" }} />}
                    {signal.is_actioned && <Check size={11} style={{ color: "#16a34a" }} />}
                  </div>
                  <p className="text-[11px] leading-relaxed truncate" style={{ color: "#444" }}>{signal.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {signal.source_domain && <span className="text-[10px]" style={{ color: "#bbb" }}>{signal.source_domain}</span>}
                    <span className="text-[10px]" style={{ color: "#ccc" }}>{timeAgo(signal.created_at)}</span>
                  </div>
                </div>

                <ChevronRight size={14} className="shrink-0 mt-3" style={{ color: "#ddd" }} />
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {selectedSignal && (() => {
          const s = selectedSignal;
          const score = s.score ?? 0;
          const cfg = TYPE_CONFIG[s.signal_type] ?? TYPE_CONFIG.content;
          const TypeIcon = cfg.icon;
          const breakdown = s.score_breakdown;

          return (
            <div className="w-[45%] border-l overflow-y-auto" style={{ borderColor: "#eee", background: "#fff" }}>
              <div className="px-5 py-4 space-y-4">

                {/* Header */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5" style={{ background: cfg.bg, color: cfg.color }}>
                      <TypeIcon size={9} />
                      {cfg.label}
                    </span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: scoreBg(score), color: scoreColor(score) }}>
                      {score}
                    </div>
                  </div>
                  <h2 className="text-sm font-semibold" style={{ color: "#111" }}>{s.company_name}</h2>
                  <p className="text-xs mt-1" style={{ color: "#555" }}>{s.title}</p>
                </div>

                {/* Summary */}
                {s.summary && (
                  <div className="rounded-xl p-3" style={{ background: "#fafafa", border: "1px solid #f0f0f0" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#aaa" }}>Résumé</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#444" }}>{s.summary}</p>
                  </div>
                )}

                {/* Why relevant */}
                {s.why_relevant && (
                  <div className="rounded-xl p-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#166534" }}>Pourquoi c&apos;est pertinent</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#15803d" }}>{s.why_relevant}</p>
                  </div>
                )}

                {/* Suggested action */}
                {s.suggested_action && (
                  <div className="rounded-xl p-3" style={{ background: "#fde8ef", border: "1px solid #f9b4cb" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#c01252" }}>Action suggérée</p>
                    <p className="text-xs leading-relaxed mb-2" style={{ color: "#7a0e3a" }}>{s.suggested_action}</p>
                    <div className="flex gap-2">
                      {(s.action_type === "email" || !s.action_type) && (
                        <button
                          onClick={() => generateEmail(s)}
                          disabled={generatingEmail}
                          className="text-[10px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50"
                          style={{ background: "#f01563", color: "#fff" }}
                        >
                          {generatingEmail ? <Loader2 size={10} className="animate-spin" /> : <Mail size={10} />}
                          {generatingEmail ? "Génération…" : "Générer email"}
                        </button>
                      )}
                      {s.source_url && (
                        <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1" style={{ background: "#fff", color: "#555", border: "1px solid #e5e5e5" }}>
                          <ExternalLink size={10} /> Source
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Generated email */}
                {generatedEmail && (
                  <div className="rounded-xl p-3" style={{ background: "#fafafa", border: "1px solid #e5e5e5" }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#aaa" }}>Email généré</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={copyEmail}
                          className="text-[10px] px-2 py-0.5 rounded-lg font-medium flex items-center gap-1"
                          style={{ background: emailCopied ? "#f0fdf4" : "#fff", color: emailCopied ? "#166534" : "#555", border: `1px solid ${emailCopied ? "#bbf7d0" : "#e5e5e5"}` }}
                        >
                          {emailCopied ? <Check size={9} /> : <Copy size={9} />}
                          {emailCopied ? "Copié" : "Copier"}
                        </button>
                        <button onClick={() => setGeneratedEmail(null)} className="p-0.5 rounded" style={{ color: "#aaa" }}>
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold mb-1.5" style={{ color: "#333" }}>Objet : {generatedEmail.subject}</p>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "#444" }}>{generatedEmail.body}</p>
                  </div>
                )}

                {/* Score breakdown */}
                {breakdown && (
                  <div className="rounded-xl border p-3" style={{ borderColor: "#f0f0f0" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#aaa" }}>Score détaillé</p>
                    <div className="space-y-1.5">
                      {[
                        { label: "ICP Coachello", value: breakdown.icp, max: 25 },
                        { label: "Actionnabilité", value: breakdown.actionability, max: 25 },
                        { label: "Fraîcheur", value: breakdown.freshness, max: 20 },
                        { label: "Fiabilité source", value: breakdown.source_reliability, max: 15 },
                        { label: "Force du signal", value: breakdown.signal_strength, max: 15 },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          <span className="text-[10px] w-28 shrink-0" style={{ color: "#888" }}>{item.label}</span>
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: "#f0f0f0" }}>
                            <div className="h-1.5 rounded-full" style={{ width: `${(item.value / item.max) * 100}%`, background: scoreColor(Math.round((item.value / item.max) * 100)) }} />
                          </div>
                          <span className="text-[10px] font-medium w-8 text-right" style={{ color: "#555" }}>{item.value}/{item.max}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source info */}
                <div className="flex items-center gap-3 text-[11px]" style={{ color: "#888" }}>
                  {s.source_domain && <span>{s.source_domain}</span>}
                  {s.signal_date && <span>{s.signal_date}</span>}
                  <span>{timeAgo(s.created_at)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "#f0f0f0" }}>
                  <button
                    onClick={() => markSignal(s.id, "is_actioned", !s.is_actioned)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded-lg font-medium transition-colors"
                    style={{
                      background: s.is_actioned ? "#f0fdf4" : "#fff",
                      color: s.is_actioned ? "#166534" : "#555",
                      border: `1px solid ${s.is_actioned ? "#bbf7d0" : "#e5e5e5"}`,
                    }}
                  >
                    <Check size={12} />
                    {s.is_actioned ? "Traité" : "Marquer traité"}
                  </button>
                  <button
                    onClick={() => markSignal(s.id, "is_read", !s.is_read)}
                    className="flex items-center justify-center gap-1.5 text-[11px] py-2 px-3 rounded-lg font-medium"
                    style={{ background: "#fff", color: "#888", border: "1px solid #e5e5e5" }}
                  >
                    <Eye size={12} />
                    {s.is_read ? "Non lu" : "Lu"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
