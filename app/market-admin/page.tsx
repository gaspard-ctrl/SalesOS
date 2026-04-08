"use client";

import { useState, useEffect } from "react";
import { useUserMe } from "@/lib/hooks/use-user-me";
import {
  Building2, Users, Search, RefreshCw, Shield, Eye, Plus, Trash2,
  ExternalLink, AlertCircle, CheckCircle,
} from "lucide-react";

export default function MarketAdminPage() {
  const { isAdmin, isLoading: userLoading } = useUserMe();
  const [loading, setLoading] = useState(true);

  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [netrowsStatus, setNetrowsStatus] = useState<{ hasApiKey: boolean; hasSubscription: boolean; radarCompanies: number; radarProfiles: number } | null>(null);
  const [radarCompanies, setRadarCompanies] = useState<{ id: string; username: string; is_active: boolean }[]>([]);
  const [signalStats, setSignalStats] = useState<{ total: number; thisWeek: number; highPriority: number }>({ total: 0, thisWeek: 0, highPriority: 0 });

  const [monitoredProfiles, setMonitoredProfiles] = useState<{ username: string; full_name: string; headline: string; company: string; profile_url: string; radar_active: boolean; source: string; last_change_at: string | null; created_at: string }[]>([]);
  const [monitoredStats, setMonitoredStats] = useState<{ total: number; companies: number; radar_active: number }>({ total: 0, companies: 0, radar_active: 0 });

  const [activeTab, setActiveTab] = useState<"overview" | "companies" | "roles" | "profiles" | "linkedin" | "alerts">("overview");
  const [newCompany, setNewCompany] = useState("");
  const [newRole, setNewRole] = useState("");
  const [testingNetrows, setTestingNetrows] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [initRunning, setInitRunning] = useState(false);
  const [initResult, setInitResult] = useState<string | null>(null);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [profileFilter, setProfileFilter] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/market-targets?key=target_companies").then((r) => r.json()),
      fetch("/api/settings/market-targets?key=target_roles").then((r) => r.json()),
      fetch("/api/market/signals").then((r) => r.json()),
    ]).then(([companies, roles, signals]) => {
      setTargetCompanies(companies.items ?? []);
      setTargetRoles(roles.items ?? []);
      if (signals.stats) setSignalStats(signals.stats);

      fetch("/api/linkedin/status").then((r) => r.json()).then(setNetrowsStatus).catch(() => null);
      fetch("/api/linkedin/setup-radar").then((r) => r.json()).then((data) => {
        setRadarCompanies(data.data ?? []);
      }).catch(() => null);
      fetch("/api/linkedin/init-monitoring").then((r) => r.json()).then((data) => {
        setMonitoredProfiles(data.profiles ?? []);
        setMonitoredStats({ total: data.total ?? 0, companies: data.companies ?? 0, radar_active: data.radar_active ?? 0 });
      }).catch(() => null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function saveCompanies(updated: string[]) {
    setTargetCompanies(updated);
    await fetch("/api/settings/market-targets?key=target_companies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updated }),
    });
  }

  async function saveRoles(updated: string[]) {
    setTargetRoles(updated);
    await fetch("/api/settings/market-targets?key=target_roles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updated }),
    });
  }

  async function testNetrowsConnection() {
    setTestingNetrows(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/linkedin/profile?username=williamhgates");
      const data = await res.json();
      setTestResult(data.firstName
        ? `OK — ${data.firstName} ${data.lastName} (${data.headline?.slice(0, 50)})`
        : `Erreur: ${data.error ?? "Réponse inattendue"}`);
    } catch (e) {
      setTestResult(`Erreur: ${String(e)}`);
    }
    setTestingNetrows(false);
  }

  if (loading || userLoading) return <div className="p-8 text-center text-sm" style={{ color: "#aaa" }}>Chargement…</div>;
  if (!isAdmin) return <div className="p-8 text-center text-sm" style={{ color: "#dc2626" }}>Accès admin requis</div>;

  const tabs = [
    { id: "overview" as const, label: "Vue d'ensemble", icon: Eye },
    { id: "companies" as const, label: `Entreprises (${targetCompanies.length})`, icon: Building2 },
    { id: "roles" as const, label: `Postes (${targetRoles.length})`, icon: Users },
    { id: "profiles" as const, label: `Profils (${monitoredStats.total})`, icon: Users },
    { id: "linkedin" as const, label: "LinkedIn / Netrows", icon: Search },
    { id: "alerts" as const, label: "Alertes Slack", icon: AlertCircle },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "#f8f8f8" }}>
      <div className="px-6 py-4 border-b" style={{ background: "#fff", borderColor: "#eee" }}>
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} style={{ color: "#f01563" }} />
          <h1 className="text-base font-semibold" style={{ color: "#111" }}>Market Intel — Administration</h1>
        </div>
        <p className="text-xs" style={{ color: "#888" }}>Configuration des cibles, monitoring LinkedIn et alertes</p>
      </div>

      <div className="px-6 py-2 border-b flex gap-1" style={{ background: "#fff", borderColor: "#eee" }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: activeTab === tab.id ? "#111" : "transparent", color: activeTab === tab.id ? "#fff" : "#888" }}>
              <Icon size={12} /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">

        {/* ── Overview ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Entreprises ciblées", value: targetCompanies.length, color: "#111" },
                { label: "Postes surveillés", value: targetRoles.length, color: "#7c3aed" },
                { label: "Signaux cette semaine", value: signalStats.thisWeek, color: "#16a34a" },
                { label: "Signaux prioritaires", value: signalStats.highPriority, color: "#f01563" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border px-3.5 py-2.5" style={{ borderColor: "#f0f0f0", background: "#fff" }}>
                  <p className="text-[10px] font-medium" style={{ color: "#aaa" }}>{kpi.label}</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color: kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatusCard title="Tavily (recherche web)" status="active" details={[
                `${signalStats.total} signaux détectés au total`,
                "Scan global : levées, restructurations, expansions",
                "Scan ciblé : nominations dans les entreprises cibles",
              ]} />
              <StatusCard title="Netrows (LinkedIn)" status={netrowsStatus?.hasApiKey ? "active" : "inactive"} details={
                netrowsStatus?.hasApiKey
                  ? [`API connectée`, `Abonnement : ${netrowsStatus.hasSubscription ? "Actif (Radar dispo)" : "Gratuit (Radar indispo)"}`, `Radar : ${radarCompanies.length} entreprises`]
                  : ["NETROWS_API_KEY non configurée", "Ajouter la clé dans .env.local"]
              } />
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
              <p className="text-xs font-semibold mb-3" style={{ color: "#111" }}>Sources de données</p>
              <div className="space-y-2">
                {[
                  { name: "Tavily — Scan global (levées, restructurations)", status: "active" as const, freq: "Manuel / Cron" },
                  { name: "Tavily — Scan ciblé (nominations entreprises cibles)", status: "active" as const, freq: "Manuel / Cron" },
                  { name: "Netrows — Posts LinkedIn", status: (netrowsStatus?.hasApiKey ? "active" : "inactive") as "active" | "inactive", freq: "Manuel" },
                  { name: "Netrows — People search", status: (netrowsStatus?.hasApiKey ? "active" : "inactive") as "active" | "inactive", freq: "Manuel" },
                  { name: "Netrows — Radar monitoring", status: (netrowsStatus?.hasSubscription ? "active" : "locked") as "active" | "locked", freq: "Continu (abo 49€/mois)" },
                  { name: "Netrows — Enrichissement profil", status: (netrowsStatus?.hasApiKey ? "active" : "inactive") as "active" | "inactive", freq: "À la demande" },
                  { name: "HubSpot — Contacts et deals", status: "active" as const, freq: "Temps réel" },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      {s.status === "active" && <CheckCircle size={12} style={{ color: "#16a34a" }} />}
                      {s.status === "inactive" && <AlertCircle size={12} style={{ color: "#dc2626" }} />}
                      {s.status === "locked" && <Shield size={12} style={{ color: "#d97706" }} />}
                      <span className="text-[11px]" style={{ color: "#555" }}>{s.name}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: "#aaa" }}>{s.freq}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Companies ─────────────────────────────────────────────── */}
        {activeTab === "companies" && (
          <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#111" }}>Entreprises ciblées</p>
                <p className="text-[11px]" style={{ color: "#888" }}>Le scan changements de poste + LinkedIn ne tourne que sur ces entreprises</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f5f5f5", color: "#888" }}>{targetCompanies.length}</span>
            </div>
            <div className="flex gap-2 mb-3">
              <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newCompany.trim()) { saveCompanies([...targetCompanies, newCompany.trim()]); setNewCompany(""); } }}
                placeholder="Ajouter une entreprise…" className="flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none" style={{ borderColor: "#e5e5e5" }} />
              <button onClick={() => { if (newCompany.trim()) { saveCompanies([...targetCompanies, newCompany.trim()]); setNewCompany(""); } }}
                disabled={!newCompany.trim()} className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-30" style={{ background: "#f01563", color: "#fff" }}>
                <Plus size={12} />
              </button>
            </div>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {targetCompanies.map((company, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
                  <div className="flex items-center gap-2">
                    <Building2 size={12} style={{ color: "#aaa" }} />
                    <span className="text-xs" style={{ color: "#333" }}>{company}</span>
                  </div>
                  <button onClick={() => saveCompanies(targetCompanies.filter((_, j) => j !== i))}
                    className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={12} style={{ color: "#dc2626" }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Roles ─────────────────────────────────────────────────── */}
        {activeTab === "roles" && (
          <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#111" }}>Postes surveillés</p>
                <p className="text-[11px]" style={{ color: "#888" }}>Changement de poste dans une entreprise ciblée → signal prioritaire</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f5f5f5", color: "#888" }}>{targetRoles.length}</span>
            </div>
            <div className="flex gap-2 mb-3">
              <input value={newRole} onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newRole.trim()) { saveRoles([...targetRoles, newRole.trim()]); setNewRole(""); } }}
                placeholder="Ajouter un poste (ex: Head of L&D)…" className="flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none" style={{ borderColor: "#e5e5e5" }} />
              <button onClick={() => { if (newRole.trim()) { saveRoles([...targetRoles, newRole.trim()]); setNewRole(""); } }}
                disabled={!newRole.trim()} className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-30" style={{ background: "#f01563", color: "#fff" }}>
                <Plus size={12} />
              </button>
            </div>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {targetRoles.map((role, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
                  <div className="flex items-center gap-2">
                    <Users size={12} style={{ color: "#aaa" }} />
                    <span className="text-xs" style={{ color: "#333" }}>{role}</span>
                  </div>
                  <button onClick={() => saveRoles(targetRoles.filter((_, j) => j !== i))}
                    className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={12} style={{ color: "#dc2626" }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Profils monitorés ──────────────────────────────────────── */}
        {activeTab === "profiles" && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
              <p className="text-sm font-semibold mb-3" style={{ color: "#111" }}>Actions</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    setInitRunning(true); setInitResult(null);
                    try {
                      const res = await fetch("/api/linkedin/init-monitoring", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ limit: 5, radarEnabled: netrowsStatus?.hasSubscription ?? false }),
                      });
                      const data = await res.json();
                      setInitResult(`${data.profiles_found} profils trouvés, ${data.profiles_new} nouveaux, ${data.radar_added ?? 0} ajoutés au Radar · ${data.credits_used} crédits`);
                      // Reload profiles
                      const reload = await fetch("/api/linkedin/init-monitoring").then((r) => r.json());
                      setMonitoredProfiles(reload.profiles ?? []);
                      setMonitoredStats({ total: reload.total ?? 0, companies: reload.companies ?? 0, radar_active: reload.radar_active ?? 0 });
                    } catch (e) { setInitResult(`Erreur: ${String(e)}`); }
                    setInitRunning(false);
                  }}
                  disabled={initRunning}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: "#f01563", color: "#fff" }}
                >
                  {initRunning ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
                  Init monitoring (5 entreprises · ~15 crédits)
                </button>
                <button
                  onClick={async () => {
                    setScanRunning(true); setScanResult(null);
                    try {
                      const res = await fetch("/api/linkedin/weekly-scan", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ companiesLimit: 10, keywordsLimit: 5 }),
                      });
                      const data = await res.json();
                      setScanResult(`Posts: ${data.company_posts?.new_posts ?? 0} nouveaux (entreprises) + ${data.keyword_posts?.new_posts ?? 0} (keywords) · ${data.analysis?.signals_created ?? 0} signaux · ${data.credits_used} crédits`);
                    } catch (e) { setScanResult(`Erreur: ${String(e)}`); }
                    setScanRunning(false);
                  }}
                  disabled={scanRunning}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: "#111", color: "#fff" }}
                >
                  {scanRunning ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Scan LinkedIn (10 entreprises + 5 keywords)
                </button>
              </div>
              {initResult && <p className="mt-2 text-[11px] px-3 py-2 rounded-lg" style={{ background: initResult.startsWith("Erreur") ? "#fef2f2" : "#f0fdf4", color: initResult.startsWith("Erreur") ? "#dc2626" : "#166534" }}>{initResult}</p>}
              {scanResult && <p className="mt-2 text-[11px] px-3 py-2 rounded-lg" style={{ background: scanResult.startsWith("Erreur") ? "#fef2f2" : "#f0fdf4", color: scanResult.startsWith("Erreur") ? "#dc2626" : "#166534" }}>{scanResult}</p>}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Profils monitorés", value: monitoredStats.total, color: "#111" },
                { label: "Entreprises couvertes", value: monitoredStats.companies, color: "#7c3aed" },
                { label: "Radar actif", value: monitoredStats.radar_active, color: "#16a34a" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border px-3.5 py-2.5" style={{ borderColor: "#f0f0f0", background: "#fff" }}>
                  <p className="text-[10px] font-medium" style={{ color: "#aaa" }}>{kpi.label}</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color: kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Profiles list */}
            <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold" style={{ color: "#111" }}>Profils LinkedIn monitorés</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f5f5f5", color: "#888" }}>{monitoredProfiles.length}</span>
              </div>

              <input value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}
                placeholder="Filtrer par nom, poste ou entreprise…"
                className="w-full text-xs px-3 py-1.5 border rounded-lg outline-none mb-3" style={{ borderColor: "#e5e5e5" }} />

              {monitoredProfiles.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: "#aaa" }}>Aucun profil monitoré. Lance l&apos;init pour commencer.</p>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {monitoredProfiles
                    .filter((p) => {
                      if (!profileFilter) return true;
                      const q = profileFilter.toLowerCase();
                      return `${p.full_name} ${p.headline} ${p.company}`.toLowerCase().includes(q);
                    })
                    .map((p) => (
                      <div key={p.username} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium truncate" style={{ color: "#111" }}>{p.full_name || p.username}</p>
                            {p.radar_active && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#16a34a" }}>Radar</span>}
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#f5f5f5", color: "#888" }}>{p.source}</span>
                          </div>
                          <p className="text-[10px] truncate" style={{ color: "#888" }}>{p.headline}</p>
                          <p className="text-[10px]" style={{ color: "#bbb" }}>{p.company}{p.last_change_at ? ` · Dernier changement: ${new Date(p.last_change_at).toLocaleDateString("fr-FR")}` : ""}</p>
                        </div>
                        <a href={p.profile_url || `https://linkedin.com/in/${p.username}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={12} style={{ color: "#aaa" }} />
                        </a>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LinkedIn / Netrows ────────────────────────────────────── */}
        {activeTab === "linkedin" && (
          <div className="space-y-4">
            <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
              <p className="text-sm font-semibold mb-3" style={{ color: "#111" }}>Connexion Netrows</p>
              <div className="space-y-2 mb-3">
                {[
                  { label: "API Key", ok: netrowsStatus?.hasApiKey },
                  { label: "Abonnement (Radar)", ok: netrowsStatus?.hasSubscription },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#555" }}>{row.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: row.ok ? "#f0fdf4" : row.label.includes("Radar") ? "#fef3c7" : "#fef2f2",
                      color: row.ok ? "#16a34a" : row.label.includes("Radar") ? "#92400e" : "#dc2626",
                    }}>{row.ok ? "Actif" : row.label.includes("Radar") ? "Plan gratuit" : "Non configuré"}</span>
                  </div>
                ))}
              </div>
              <button onClick={testNetrowsConnection} disabled={testingNetrows}
                className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5" style={{ background: "#111", color: "#fff" }}>
                {testingNetrows ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
                Tester la connexion (1 crédit)
              </button>
              {testResult && (
                <p className="mt-2 text-[11px] px-3 py-2 rounded-lg" style={{
                  background: testResult.startsWith("OK") ? "#f0fdf4" : "#fef2f2",
                  color: testResult.startsWith("OK") ? "#166534" : "#dc2626",
                }}>{testResult}</p>
              )}
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold" style={{ color: "#111" }}>Radar — Entreprises monitorées</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f5f5f5", color: "#888" }}>{radarCompanies.length}</span>
              </div>
              {radarCompanies.length === 0 ? (
                <p className="text-xs" style={{ color: "#aaa" }}>
                  {netrowsStatus?.hasSubscription ? "Aucune entreprise en monitoring." : "Nécessite l'abonnement Netrows (49€/mois)."}
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {radarCompanies.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: "#fafafa" }}>
                      <span className="text-xs" style={{ color: "#333" }}>{c.username}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                        background: c.is_active ? "#f0fdf4" : "#f5f5f5", color: c.is_active ? "#16a34a" : "#aaa",
                      }}>{c.is_active ? "Actif" : "Pausé"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
              <p className="text-sm font-semibold mb-3" style={{ color: "#111" }}>Outils</p>
              <div className="flex gap-2">
                <a href="/linkedin-test" className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5" style={{ background: "#f5f5f5", color: "#555" }}>
                  <ExternalLink size={11} /> Page de test
                </a>
                <a href="https://netrows.com/docs" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5" style={{ background: "#f5f5f5", color: "#555" }}>
                  <ExternalLink size={11} /> Doc Netrows
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Alerts ────────────────────────────────────────────────── */}
        {activeTab === "alerts" && (
          <div className="space-y-4">
            <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
              <p className="text-sm font-semibold mb-2" style={{ color: "#111" }}>Configuration des alertes</p>
              <p className="text-[11px] mb-3" style={{ color: "#888" }}>Les alertes Slack sont configurables dans la page Admin.</p>
              <a href="/admin" className="text-xs px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5" style={{ background: "#111", color: "#fff" }}>
                <ExternalLink size={11} /> Admin → Alertes Market Intel
              </a>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
              <p className="text-sm font-semibold mb-3" style={{ color: "#111" }}>Comment ça marche</p>
              <div className="space-y-1.5 text-[11px]" style={{ color: "#555" }}>
                <p>1. Le scan (Tavily + Netrows) détecte des signaux et les score 0-100</p>
                <p>2. Les signaux au-dessus du seuil (défaut 70) déclenchent une alerte</p>
                <p>3. Envoi dans le canal Slack configuré + DM si activé par l&apos;utilisateur</p>
                <p>4. Format : score + entreprise + signal + action suggérée + source</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ title, status, details }: { title: string; status: "active" | "inactive" | "locked"; details: string[] }) {
  const c = { active: { bg: "#f0fdf4", color: "#16a34a", label: "Actif" }, inactive: { bg: "#fef2f2", color: "#dc2626", label: "Inactif" }, locked: { bg: "#fef3c7", color: "#92400e", label: "Verrouillé" } }[status];
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold" style={{ color: "#111" }}>{title}</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>{c.label}</span>
      </div>
      {details.map((d, i) => <p key={i} className="text-[11px]" style={{ color: "#888" }}>• {d}</p>)}
    </div>
  );
}
