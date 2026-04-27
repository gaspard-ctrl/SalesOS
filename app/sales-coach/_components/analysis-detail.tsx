"use client";

import { useState } from "react";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Target,
  TrendingUp,
  MessageSquare,
  FileText,
  RefreshCw,
  ExternalLink,
  Building2,
  Calendar,
  Users,
  History,
  Quote,
  Lightbulb,
  ClipboardCheck,
  Trash2,
  Info,
} from "lucide-react";
import { useSalesCoachDetail, useSalesCoachDealHistory } from "@/lib/hooks/use-sales-coach";
import type { SalesCoachAnalysis, AxisScore, MeddicScore } from "@/lib/guides/sales-coach";
import { MEETING_KIND_LABELS, isDiscoveryKind } from "@/lib/guides/sales-coach";

interface Props {
  analysisId: string;
  onSlackSent?: () => void;
  onDeleted?: () => void;
}

type TabId = "axes" | "meddic" | "bosche" | "history" | "transcript";

function scoreColor(score: number): string {
  if (score >= 7.5) return "#059669";
  if (score >= 5) return "#b45309";
  return "#dc2626";
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(10, score)) * 10;
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#f0f0f0" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color, minWidth: 36 }}>
        {score.toFixed(1)}/10
      </span>
    </div>
  );
}

const AXES_LABELS: { key: keyof SalesCoachAnalysis["axes"]; label: string }[] = [
  { key: "opening", label: "Opening & first impressions" },
  { key: "discovery", label: "Discovery quality" },
  { key: "active_listening", label: "Active listening" },
  { key: "value_articulation", label: "Value articulation" },
  { key: "objection_handling", label: "Objection handling" },
  { key: "next_steps", label: "Next steps & closing" },
];

const MEDDIC_LABELS: { key: keyof SalesCoachAnalysis["meddic"]; label: string; short: string }[] = [
  { key: "metrics", label: "Metrics — impact chiffrable", short: "M" },
  { key: "economic_buyer", label: "Economic Buyer — budget holder", short: "EB" },
  { key: "decision_criteria", label: "Decision Criteria — critères de choix", short: "DC" },
  { key: "decision_process", label: "Decision Process — étapes d'achat", short: "DP" },
  { key: "identify_pain", label: "Identify Pain — vraie douleur", short: "IP" },
  { key: "champion", label: "Champion — relais interne", short: "C" },
];

const EMPTY_AXIS: AxisScore = { score: 0, notes: "", evidence: "", explanation: "", recommendation: "" };

const BOSCHE_LABELS: { key: keyof SalesCoachAnalysis["bosche"]; label: string; short: string }[] = [
  { key: "business", label: "Business pressure", short: "B" },
  { key: "organization", label: "Organizational friction", short: "O" },
  { key: "skills", label: "Skills gap", short: "S" },
  { key: "consequences", label: "Consequences", short: "C" },
  { key: "human_economic", label: "Human & Economic impact", short: "H.E" },
];

function AxisCard({ label, axis }: { label: string; axis: AxisScore | MeddicScore }) {
  const isNA = axis.score === 0 && /n\/?a/i.test(axis.notes);
  return (
    <div className="rounded-lg p-4" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-sm font-medium" style={{ color: "#111" }}>{label}</div>
        {isNA ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ color: "#888", background: "#f4f4f4" }}>N/A</span>
        ) : (
          <ScoreBar score={axis.score} />
        )}
      </div>
      <p className="text-sm" style={{ color: "#333" }}>{axis.notes}</p>

      {axis.evidence && (
        <div className="mt-3">
          <div className="flex items-center gap-1 mb-1 text-[11px] uppercase tracking-wider font-medium" style={{ color: "#888" }}>
            <Quote size={10} />
            Citation du meeting
          </div>
          <div className="text-xs italic px-3 py-2 rounded border-l-2" style={{ color: "#555", background: "#fafafa", borderColor: "#f01563" }}>
            « {axis.evidence} »
          </div>
        </div>
      )}

      {axis.explanation && (
        <div className="mt-3">
          <div className="flex items-center gap-1 mb-1 text-[11px] uppercase tracking-wider font-medium" style={{ color: "#888" }}>
            <Lightbulb size={10} />
            Pourquoi cette note
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#444" }}>{axis.explanation}</p>
        </div>
      )}

      {axis.recommendation && (
        <div className="mt-3 rounded-md px-3 py-2" style={{ background: "#fef2f4", border: "1px solid #fbd5de" }}>
          <div className="flex items-center gap-1 mb-1 text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#f01563" }}>
            <ClipboardCheck size={11} />
            Reco pour le prochain call
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#7a0e35" }}>{axis.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function DealTopo({
  snapshot,
  dealId,
  analysisId,
  onDealUpdated,
}: {
  snapshot: import("@/lib/hubspot").DealSnapshot | null;
  dealId: string | null;
  analysisId: string;
  onDealUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dealInput, setDealInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [autoResolving, setAutoResolving] = useState(false);
  const [autoResolveMsg, setAutoResolveMsg] = useState<string | null>(null);

  async function autoResolve() {
    setAutoResolving(true);
    setAutoResolveMsg(null);
    try {
      const res = await fetch(`/api/sales-coach/${analysisId}/resolve-deal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      if (data.dealId) {
        setAutoResolveMsg(`Deal retrouvé : ${data.name ?? data.dealId}`);
        onDealUpdated();
      } else {
        setAutoResolveMsg(data.reason === "no_match" ? "Aucun deal correspondant trouvé." : "Impossible de retrouver un deal.");
      }
    } catch (e) {
      setAutoResolveMsg(e instanceof Error ? e.message : "Erreur");
    } finally {
      setAutoResolving(false);
    }
  }

  async function saveDeal() {
    const trimmed = dealInput.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sales-coach/${analysisId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubspotDealId: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur");
      }
      setEditing(false);
      setDealInput("");
      onDealUpdated();
      // Offer to re-run the analysis with the fresh deal context
      if (confirm("Deal associé. Ré-analyser maintenant avec le contexte du deal HubSpot ?")) {
        await reanalyze(true);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function reanalyze(skipConfirm = false) {
    if (!skipConfirm && !confirm("Ré-analyser ce meeting avec le contexte deal à jour ? L'analyse actuelle sera remplacée.")) return;
    setReanalyzing(true);
    try {
      const res = await fetch(`/api/sales-coach/${analysisId}/reanalyze`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur");
      }
      onDealUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setReanalyzing(false);
    }
  }

  // No deal linked at all
  if (!dealId) {
    return (
      <div className="rounded-lg p-4" style={{ background: "#fff", border: "1px dashed #e5e5e5" }}>
        <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "#888" }}>
          <Building2 size={14} />
          <span>Aucun deal HubSpot associé à ce meeting.</span>
          {!editing && (
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={autoResolve}
                disabled={autoResolving}
                className="font-medium disabled:opacity-50 flex items-center gap-1"
                style={{ color: "#6d28d9" }}
                title="Retrouver le deal via les emails des participants"
              >
                <RefreshCw size={11} className={autoResolving ? "animate-spin" : ""} />
                {autoResolving ? "Recherche…" : "Retrouver automatiquement"}
              </button>
              <button onClick={() => setEditing(true)} className="font-medium" style={{ color: "#f01563" }}>
                Associer un deal
              </button>
            </div>
          )}
        </div>
        {autoResolveMsg && (
          <div className="mt-2 text-xs" style={{ color: autoResolveMsg.startsWith("Deal retrouvé") ? "#059669" : "#888" }}>
            {autoResolveMsg}
          </div>
        )}
        {editing && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="ID deal HubSpot (ex: 12345678)"
              value={dealInput}
              onChange={(e) => setDealInput(e.target.value)}
              className="text-xs px-2 py-1 rounded border outline-none flex-1"
              style={{ borderColor: "#e5e5e5", background: "#fafafa" }}
              autoFocus
            />
            <button
              onClick={saveDeal}
              disabled={saving || !dealInput.trim()}
              className="text-xs font-medium px-2.5 py-1 rounded disabled:opacity-50"
              style={{ background: "#f01563", color: "#fff" }}
            >
              {saving ? "…" : "Enregistrer"}
            </button>
            <button
              onClick={() => { setEditing(false); setDealInput(""); }}
              className="text-xs px-2 py-1"
              style={{ color: "#888" }}
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    );
  }

  // Deal linked but no snapshot yet (ancienne analyse ou HubSpot injoignable)
  if (!snapshot) {
    return (
      <div className="rounded-lg p-3 flex items-center gap-2 text-xs" style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e" }}>
        <Building2 size={14} />
        <span>Deal HubSpot <strong>{dealId}</strong> — snapshot non disponible (analyse antérieure à la capture deal).</span>
        <button
          onClick={() => reanalyze()}
          disabled={reanalyzing}
          className="ml-auto font-medium px-2 py-1 rounded disabled:opacity-50"
          style={{ background: "#fff", color: "#92400e", border: "1px solid #fde68a" }}
        >
          <RefreshCw size={11} className={`inline mr-1 ${reanalyzing ? "animate-spin" : ""}`} />
          {reanalyzing ? "Ré-analyse…" : "Ré-analyser"}
        </button>
      </div>
    );
  }

  const close = snapshot.close_date ? new Date(snapshot.close_date).toLocaleDateString("fr-FR") : null;
  const amount = snapshot.amount != null ? `${snapshot.amount.toLocaleString("fr-FR")}€` : null;

  return (
    <div
      className="rounded-lg px-3 py-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs"
      style={{ background: "#fff", border: "1px solid #eeeeee", color: "#555" }}
      title={snapshot.description ?? undefined}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Building2 size={13} style={{ color: "#f01563" }} className="flex-shrink-0" />
        <span className="text-sm font-semibold truncate" style={{ color: "#111" }}>
          {snapshot.name || `Deal ${snapshot.id}`}
        </span>
      </div>
      {snapshot.stage_label && (
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f01563" }} />
          {snapshot.stage_label}
        </span>
      )}
      {amount && <span>💰 {amount}</span>}
      {close && (
        <span className="inline-flex items-center gap-1">
          <Calendar size={10} />
          {close}
        </span>
      )}
      {snapshot.owner_name && <span>👤 {snapshot.owner_name}</span>}
      {snapshot.contacts.length > 0 && (
        <span className="inline-flex items-center gap-1 truncate max-w-[260px]">
          <Users size={11} className="flex-shrink-0" />
          <span className="truncate">
            {snapshot.contacts.slice(0, 2).map((c, i) => {
              const name = `${c.firstname} ${c.lastname}`.trim() || c.email || "?";
              return (
                <span key={c.id}>
                  {i > 0 && " · "}
                  <span style={{ color: "#111" }}>{name}</span>
                </span>
              );
            })}
            {snapshot.contacts.length > 2 && <span> +{snapshot.contacts.length - 2}</span>}
          </span>
        </span>
      )}
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={() => reanalyze()}
          disabled={reanalyzing}
          className="flex items-center gap-1 text-[11px] font-medium disabled:opacity-50"
          style={{ color: "#888" }}
          title="Ré-analyser le meeting avec les données deal à jour"
        >
          <RefreshCw size={10} className={reanalyzing ? "animate-spin" : ""} />
          {reanalyzing ? "Ré-analyse…" : "Ré-analyser"}
        </button>
        <a
          href={`/deals?id=${snapshot.id}`}
          className="flex items-center gap-1 text-[11px] font-medium"
          style={{ color: "#f01563" }}
        >
          Voir le deal <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

function MeetingKindBadge({ kind, size = "sm" }: { kind: string | null; size?: "sm" | "md" }) {
  if (!kind) return null;
  const label = MEETING_KIND_LABELS[kind as keyof typeof MEETING_KIND_LABELS] ?? kind;
  const sizeClass = size === "md" ? "text-xs font-semibold px-2.5 py-1" : "text-[11px] font-semibold px-2 py-0.5";
  return (
    <span
      className={`${sizeClass} rounded-full`}
      style={{ background: "#ede9fe", color: "#6d28d9" }}
    >
      {label}
    </span>
  );
}

export default function AnalysisDetail({ analysisId, onSlackSent, onDeleted }: Props) {
  const { detail, isLoading, error, reload } = useSalesCoachDetail(analysisId);
  const { history } = useSalesCoachDealHistory(detail?.hubspot_deal_id ?? null, analysisId);
  const [tab, setTab] = useState<TabId>("axes");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function resendSlack() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/sales-coach/${analysisId}/resend-slack`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setSendResult({ ok: true, msg: "Envoyé sur Slack" });
      await reload();
      onSlackSent?.();
    } catch (e) {
      setSendResult({ ok: false, msg: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setSending(false);
    }
  }

  async function deleteAnalysis() {
    const ok = typeof window !== "undefined" && window.confirm("Supprimer cette analyse ? Cette action est irréversible.");
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sales-coach/${analysisId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      onDeleted?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
      setDeleting(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-sm" style={{ color: "#888" }}>Chargement…</div>;
  }

  if (error || !detail) {
    return <div className="flex items-center justify-center h-full text-sm" style={{ color: "#dc2626" }}>{error || "Analyse introuvable"}</div>;
  }

  if (detail.status !== "done" || !detail.analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        {detail.status === "analyzing" && (
          <>
            <RefreshCw size={28} className="animate-spin mb-3" style={{ color: "#f01563" }} />
            <div className="text-sm font-medium" style={{ color: "#111" }}>Analyse en cours…</div>
            <div className="text-xs mt-1" style={{ color: "#888" }}>Le debrief sera disponible dans quelques instants.</div>
          </>
        )}
        {detail.status === "pending" && (
          <>
            <div className="text-sm font-medium" style={{ color: "#111" }}>En file d&apos;attente</div>
            <div className="text-xs mt-1" style={{ color: "#888" }}>L&apos;analyse va démarrer.</div>
          </>
        )}
        {detail.status === "error" && (
          <>
            <AlertCircle size={28} className="mb-3" style={{ color: "#dc2626" }} />
            <div className="text-sm font-medium" style={{ color: "#111" }}>Erreur</div>
            <div className="text-xs mt-1" style={{ color: "#888" }}>{detail.error_message ?? "Erreur inconnue"}</div>
          </>
        )}
        {detail.status === "skipped" && (
          <>
            <div className="text-sm font-medium" style={{ color: "#111" }}>Meeting non analysé</div>
            <div className="text-xs mt-1" style={{ color: "#888" }}>Raison : {detail.error_message ?? "—"}</div>
          </>
        )}
        <button
          onClick={deleteAnalysis}
          disabled={deleting}
          className="mt-4 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
          style={{ background: "#fff", color: "#dc2626", border: "1px solid #fecaca" }}
        >
          <Trash2 size={12} />
          {deleting ? "Suppression…" : "Supprimer cette analyse"}
        </button>
      </div>
    );
  }

  const a = detail.analysis;
  const meetingDate = detail.meeting_started_at
    ? new Date(detail.meeting_started_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : "";
  const isDisco = isDiscoveryKind(detail.meeting_kind);

  // Normalize string-list fields: Claude occasionally returns an object
  // { "1": "...", "2": "..." } instead of a string array — accept both.
  const toStringArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
    if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).filter((x): x is string => typeof x === "string");
    if (typeof v === "string") return [v];
    return [];
  };
  const coachingPriorities = toStringArray(a.coaching_priorities);
  const risks = toStringArray(a.risks);

  return (
    <div className="flex flex-col h-full" style={{ background: "#f8f8f8" }}>
      {/* Header */}
      <div className="px-6 pt-3 pb-3" style={{ background: "#fff", borderBottom: "1px solid #eeeeee" }}>
        {/* Line 1: title + score (adjacent to title) · kind badge + info pushed right */}
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-bold truncate min-w-0 max-w-full" style={{ color: "#111" }}>
            {detail.meeting_title ?? "Meeting"}
          </h2>
          <div
            className="flex-shrink-0 font-bold px-3 py-1 rounded-md leading-none"
            style={{
              background: "#fef2f4",
              color: scoreColor(Number(detail.score_global ?? 0)),
              border: "1px solid " + scoreColor(Number(detail.score_global ?? 0)),
              fontSize: 18,
            }}
          >
            {Number(detail.score_global ?? 0).toFixed(1)}
            <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>/10</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <MeetingKindBadge kind={detail.meeting_kind} size="md" />
            {a.meeting_kind_reasoning && (
              <span title={`Classification : ${a.meeting_kind_reasoning}`} style={{ color: "#888", cursor: "help" }}>
                <Info size={13} />
              </span>
            )}
          </div>
        </div>

        {/* Line 2: date · recorder · avec · actions */}
        <div className="mt-1 flex items-center gap-2 flex-wrap text-xs" style={{ color: "#888" }}>
          <span>{meetingDate}</span>
          {detail.recorder_email && <span>· {detail.recorder_email}</span>}
          {(() => {
            const participantNames = (detail.participants ?? [])
              .map((p) => p.name?.trim() || p.email.split("@")[0])
              .filter((s): s is string => !!s);
            const fallbackNames = participantNames.length === 0
              ? (detail.deal_snapshot?.contacts ?? [])
                  .map((c) => `${c.firstname} ${c.lastname}`.trim() || c.email)
                  .filter((s): s is string => !!s)
              : [];
            const names = participantNames.length > 0 ? participantNames : fallbackNames;
            if (names.length === 0) return null;
            return (
              <span className="inline-flex items-center gap-1" style={{ color: "#555" }}>
                · <Users size={11} />
                <span>avec {names.slice(0, 3).join(", ")}{names.length > 3 ? ` +${names.length - 3}` : ""}</span>
              </span>
            );
          })()}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={resendSlack}
              disabled={sending}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
              style={{ background: "#f01563", color: "#fff" }}
            >
              <Send size={11} />
              {sending ? "Envoi…" : detail.slack_sent_at ? "Renvoyer Slack" : "Slack"}
            </button>
            {sendResult && (
              <span className="flex items-center gap-1" style={{ color: sendResult.ok ? "#059669" : "#dc2626" }}>
                {sendResult.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                {sendResult.msg}
              </span>
            )}
            {detail.slack_sent_at && !sendResult && (
              <span className="text-[11px]">Envoyé le {new Date(detail.slack_sent_at).toLocaleDateString("fr-FR")}</span>
            )}
            <button
              onClick={deleteAnalysis}
              disabled={deleting}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md disabled:opacity-50"
              style={{ color: "#dc2626", border: "1px solid #fecaca", background: "#fff" }}
              title="Supprimer l'analyse"
            >
              <Trash2 size={11} />
              {deleting ? "…" : "Supprimer"}
            </button>
          </div>
        </div>

        {a.summary && <div className="mt-2 text-sm" style={{ color: "#333" }}>{a.summary}</div>}
      </div>

      {/* Topo deal */}
      <div className="px-6 pt-2" style={{ background: "#f8f8f8" }}>
        <DealTopo
          snapshot={detail.deal_snapshot}
          dealId={detail.hubspot_deal_id}
          analysisId={analysisId}
          onDealUpdated={reload}
        />
      </div>

      {/* Tabs */}
      <div className="px-6 mt-2" style={{ background: "#fff", borderBottom: "1px solid #eeeeee" }}>
        <div className="flex gap-1">
          {[
            { id: "axes" as const, label: "6 axes coaching", icon: Target },
            { id: "meddic" as const, label: "MEDDIC", icon: TrendingUp },
            ...(isDisco ? [{ id: "bosche" as const, label: "BOSCHE", icon: TrendingUp }] : []),
            { id: "history" as const, label: `Historique${history.length > 0 ? ` (${history.length})` : ""}`, icon: History },
            { id: "transcript" as const, label: "Transcript", icon: FileText },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 text-sm px-4 py-2.5 font-medium transition-colors whitespace-nowrap"
                style={{
                  color: active ? "#f01563" : "#888",
                  borderBottom: active ? "2px solid #f01563" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === "axes" && (
          <div className="space-y-3">
            {AXES_LABELS.map(({ key, label }) => (
              <AxisCard key={key} label={label} axis={a.axes?.[key] ?? EMPTY_AXIS} />
            ))}

            {coachingPriorities.length > 0 && (
              <div className="rounded-lg p-4" style={{ background: "#fef2f4", border: "1px solid #f01563" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp size={14} style={{ color: "#f01563" }} />
                  <div className="text-sm font-semibold" style={{ color: "#f01563" }}>Top priorités pour le prochain call</div>
                </div>
                <ol className="space-y-1.5 pl-1">
                  {coachingPriorities.map((p, i) => (
                    <li key={i} className="text-sm flex gap-2" style={{ color: "#333" }}>
                      <span className="font-semibold" style={{ color: "#f01563" }}>{i + 1}.</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {risks.length > 0 && (
              <div className="rounded-lg p-4" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertCircle size={14} style={{ color: "#dc2626" }} />
                  <div className="text-sm font-semibold" style={{ color: "#111" }}>Risques identifiés</div>
                </div>
                <ul className="space-y-1 text-sm" style={{ color: "#333" }}>
                  {risks.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "meddic" && (
          <div className="space-y-3">
            <div className="rounded-lg p-3 text-xs" style={{ background: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3" }}>
              <strong>MEDDIC</strong> — framework de qualification appliqué à tous types de meetings. Les dimensions marquées N/A ne sont pas observables dans ce type de call, mais la reco reste pertinente.
            </div>
            {!a.meddic && (
              <div className="rounded-lg p-4 text-sm" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                Analyse MEDDIC non disponible pour ce meeting (analyse générée avant l&apos;ajout du framework, ou incomplete). Ré-analyse le meeting via &quot;Analyser un meeting passé&quot; pour obtenir les scores MEDDIC.
              </div>
            )}
            {a.meddic && MEDDIC_LABELS.map(({ key, label, short }) => (
              <div key={key} className="relative">
                <div className="absolute -left-1 top-4 z-10">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold"
                    style={{ background: "#ede9fe", color: "#6d28d9" }}
                  >
                    {short}
                  </span>
                </div>
                <div className="pl-8">
                  <AxisCard label={label} axis={a.meddic[key] ?? EMPTY_AXIS} />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "bosche" && isDisco && a.bosche && (
          <div className="space-y-3">
            {a.bosche.trigger_identified ? (
              <div className="rounded-lg p-4" style={{ background: "#fff", border: "1px solid #f01563" }}>
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "#f01563" }}>
                  Trigger Coachello détecté
                </div>
                <div className="text-base font-semibold mt-1" style={{ color: "#111" }}>
                  {a.bosche.trigger_identified}
                </div>
                <div className="text-xs mt-2 flex items-center gap-1.5" style={{ color: "#666" }}>
                  <span>Critères de sortie :</span>
                  {a.bosche.exit_criteria_met ? (
                    <span className="font-medium" style={{ color: "#059669" }}>✓ remplis</span>
                  ) : (
                    <span className="font-medium" style={{ color: "#dc2626" }}>✗ non remplis</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg p-4 text-sm" style={{ background: "#fafafa", color: "#888", border: "1px dashed #e5e5e5" }}>
                Pas de trigger BOSCHE clairement identifié.
              </div>
            )}

            {BOSCHE_LABELS.map(({ key, label, short }) => {
              const dim = a.bosche[key] as { score: number; notes: string };
              return (
                <div key={key} className="rounded-lg p-4" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                        style={{ background: "#fef2f4", color: "#f01563" }}
                      >
                        {short}
                      </span>
                      <span className="text-sm font-medium" style={{ color: "#111" }}>{label}</span>
                    </div>
                    <ScoreBar score={dim.score} />
                  </div>
                  <p className="text-sm" style={{ color: "#333" }}>{dim.notes}</p>
                </div>
              );
            })}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            {/* Claap meetings past */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <History size={14} style={{ color: "#111" }} />
                <h3 className="text-sm font-semibold" style={{ color: "#111" }}>Meetings Claap précédents sur ce deal</h3>
              </div>
              {history.length === 0 ? (
                <div className="rounded-lg p-3 text-xs" style={{ background: "#fafafa", color: "#888", border: "1px dashed #e5e5e5" }}>
                  Aucun autre meeting analysé sur ce deal.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => {
                    const d = h.meeting_started_at ? new Date(h.meeting_started_at).toLocaleDateString("fr-FR") : "?";
                    const kind = h.meeting_kind ? MEETING_KIND_LABELS[h.meeting_kind] : null;
                    return (
                      <a
                        key={h.id}
                        href={`?id=${h.id}`}
                        className="block rounded-lg p-3 transition-colors"
                        style={{ background: "#fff", border: "1px solid #eeeeee" }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs" style={{ color: "#888" }}>{d}</span>
                            {kind && <MeetingKindBadge kind={h.meeting_kind} />}
                            <span className="text-sm truncate" style={{ color: "#111" }}>{h.meeting_title ?? "Meeting"}</span>
                          </div>
                          {h.score_global != null && (
                            <span className="text-xs font-semibold tabular-nums" style={{ color: scoreColor(Number(h.score_global)) }}>
                              {Number(h.score_global).toFixed(1)}/10
                            </span>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* HubSpot engagements */}
            {detail.deal_snapshot && detail.deal_snapshot.engagements.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Building2 size={14} style={{ color: "#111" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "#111" }}>Engagements HubSpot ({detail.deal_snapshot.engagements.length})</h3>
                </div>
                <div className="space-y-2">
                  {detail.deal_snapshot.engagements.map((e, i) => {
                    const d = e.date ? new Date(e.date).toLocaleDateString("fr-FR") : "?";
                    const typeColors: Record<string, { bg: string; fg: string }> = {
                      meeting: { bg: "#dbeafe", fg: "#1e40af" },
                      call: { bg: "#dcfce7", fg: "#166534" },
                      note: { bg: "#fef3c7", fg: "#92400e" },
                      engagement: { bg: "#f3f4f6", fg: "#374151" },
                    };
                    const color = typeColors[e.type] ?? typeColors.engagement;
                    return (
                      <div key={i} className="rounded-lg p-3" style={{ background: "#fff", border: "1px solid #eeeeee" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: color.bg, color: color.fg }}>
                            {e.type}
                          </span>
                          <span className="text-xs" style={{ color: "#888" }}>{d}</span>
                          {e.title && <span className="text-xs font-medium" style={{ color: "#111" }}>{e.title}</span>}
                        </div>
                        {e.body && <p className="text-xs leading-relaxed" style={{ color: "#555" }}>{e.body}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "transcript" && (
          <div
            className="rounded-lg p-4 text-sm whitespace-pre-wrap"
            style={{
              background: "#fff",
              border: "1px solid #eeeeee",
              color: "#333",
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {detail.transcript_text ? (
              <>
                {detail.transcript_text}
                <div className="mt-4 text-[11px]" style={{ color: "#888" }}>
                  {detail.transcript_text.length.toLocaleString("fr-FR")} caractères
                </div>
              </>
            ) : (
              <span style={{ color: "#888" }}>
                <MessageSquare size={14} className="inline mr-1" />
                Transcription non disponible.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
