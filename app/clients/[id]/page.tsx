"use client";

import { use, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, AlertTriangle, Loader2, Sparkles, Clock, Trash2, RefreshCw, Search, CheckCircle2, MailPlus, ListChecks, Video, UserCheck, Info } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import { getMissingHubspotFields, mergeOnboardingItems, type ClientRow } from "@/lib/clients/types";
import { useUserMe } from "@/lib/hooks/use-user-me";
import { HealthBadge } from "../_components/health-badge";
import { FieldsSection } from "./_components/fields-section";
import { TimelinePanel, type ClientMeeting } from "./_components/timeline-panel";
import { CoachBriefPanel } from "./_components/coach-brief-panel";
import { DealRecapPanel } from "./_components/deal-recap-panel";
import { HealthPanel } from "./_components/health-panel";
import { NewsPanel } from "./_components/news-panel";
import { RefreshReportPanel } from "./_components/refresh-report-panel";
import { BillingPanel } from "./_components/billing-panel";
import { MeetingConfirmationModal } from "./_components/meeting-confirmation-modal";
import { NewMeetingConfirmationModal } from "./_components/new-meeting-confirmation-modal";
import { AnalyzedMeetingsModal } from "./_components/analyzed-meetings-modal";
import { HandoverPanel } from "./_components/handover-panel";
import { HubspotChecklistPanel } from "./_components/hubspot-checklist-panel";
import { OnboardingChecklistPanel } from "./_components/onboarding-checklist-panel";
import { MissingInfoEmailModal } from "./_components/missing-info-email-modal";

const HUBSPOT_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID;

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type Resp = { client: ClientRow; meetings: ClientMeeting[] };

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtAmount(n: number | null): string {
  if (n == null) return "-";
  return `€${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
}

// Destinataire de l'email "infos manquantes" : signataire en priorite, sinon
// contact RH principal / operationnel. Meme logique que la route draft (cf.
// draft-missing-info-email/route.ts pickContact). Nom prefere, sinon email.
// Affiché en haut de la fiche une fois le compte transmis : qui sont l'AM et le
// CS qui ont récupéré le client.
function HandoverChip({ role, name, email }: { role: string; name: string | null; email: string }) {
  return (
    <span
      title={email}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        padding: "3px 9px",
        borderRadius: 999,
        border: `1px solid ${COLORS.line}`,
        background: COLORS.bgSoft,
        color: COLORS.ink1,
      }}
    >
      <UserCheck size={11} style={{ color: COLORS.brand }} />
      <strong style={{ fontWeight: 700, color: COLORS.ink2 }}>{role}</strong>
      {name || email}
    </span>
  );
}

function StatusBanner({ client, onConfirmMeetings }: { client: ClientRow; onConfirmMeetings: () => void }) {
  if (client.enrichment_status === "awaiting_meetings") {
    return (
      <div
        style={{
          background: COLORS.brandTint,
          color: COLORS.brand,
          border: `1px solid ${COLORS.brand}`,
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Search size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>
          We found the Claap meetings for this account. Confirm the list (and add any we missed), then the AI
          analysis will start.
        </span>
        <button
          type="button"
          onClick={onConfirmMeetings}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            background: COLORS.brand,
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Confirm meetings
        </button>
      </div>
    );
  }
  if (client.enrichment_status === "running") {
    return (
      <div
        style={{
          background: COLORS.infoBg,
          color: COLORS.info,
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Loader2 size={14} className="animate-spin" />
        AI enrichment in progress, fields will appear in 1-2 minutes.
      </div>
    );
  }
  if (client.enrichment_status === "pending") {
    return (
      <div
        style={{
          background: COLORS.bgSoft,
          color: COLORS.ink2,
          border: `1px solid ${COLORS.line}`,
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Clock size={14} />
        Waiting for enrichment. Click <strong style={{ fontWeight: 600 }}>&quot;Run enrichment&quot;</strong> in the top right to generate the AI profile.
      </div>
    );
  }
  if (client.enrichment_status === "error") {
    return (
      <div
        style={{
          background: COLORS.errBg,
          color: COLORS.err,
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 12,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          Enrichment error.
          {client.enrichment_error && (
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.85 }}>{client.enrichment_error}</div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAdmin } = useUserMe();
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [analyzedMeetingsOpen, setAnalyzedMeetingsOpen] = useState(false);
  // Le popup "nouveau meeting" se referme sur "Later" sans rien persister côté
  // serveur : on le masque localement tant que le set de candidats ne change
  // pas (cf. effet plus bas qui réarme dismissed à false sur un nouveau set).
  const [newMeetingModalDismissed, setNewMeetingModalDismissed] = useState(false);
  // Distingue une fermeture "confirmée" (on reste sur la fiche, l'enrichissement
  // démarre) d'une fermeture "abandon" (on renvoie vers la liste, cf. gate).
  const confirmedMeetings = useRef(false);
  // Capturés au moment de lancer un refresh (bouton ou confirmation d'un
  // nouveau meeting) : servent à détecter la fin du job dans l'effet plus bas.
  const refreshBaselineRef = useRef<string | null>(null);
  const refreshDeadlineRef = useRef(0);

  // Refresh agressif tant que l'enrichissement n'est pas terminé pour que le
  // CS voie les fields apparaître dès la fin du pipeline IA. Une fois "done"
  // ou "error", on relâche la cadence. Pareil pendant un refresh incrémental
  // (bouton "Actualiser" ou popup de confirmation d'un nouveau meeting) : on
  // repasse à 3s tant que `refreshing` est vrai, pour que la fiche (report,
  // health, popup de confirmation…) se mette à jour toute seule, sans reload.
  const { data, error, isLoading, mutate } = useSWR<Resp>(`/api/clients/${id}`, fetcher, {
    refreshInterval: (latest) => {
      const s = latest?.client?.enrichment_status;
      if (s === "pending" || s === "running") return 5_000;
      if (refreshing) return 3_000;
      return 0;
    },
    revalidateOnFocus: false,
  });

  // Détecte la fin d'un refresh en cours à chaque revalidation SWR (nouveau
  // report écrit, OU nouveau meeting détecté nécessitant confirmation, OU
  // timeout de sécurité). Piloté par l'état de `data`, donc robuste à une
  // erreur réseau ponctuelle (contrairement à une boucle de poll manuelle qui
  // resterait bloquée sur "Refreshing…" indéfiniment si un `mutate()` throw).
  useEffect(() => {
    if (!refreshing || !data) return;
    const stamp = data.client.last_refresh_report?.refreshed_at ?? null;
    const hasPendingCandidates = (data.client.pending_refresh_meeting_candidates ?? []).length > 0;
    const timedOut = Date.now() > refreshDeadlineRef.current;
    if ((stamp && stamp !== refreshBaselineRef.current) || hasPendingCandidates || timedOut) {
      setRefreshing(false);
    }
  }, [data, refreshing]);

  // Tant que les meetings Claap n'ont pas été confirmés (awaiting_meetings), la
  // fiche n'est pas consultable : le popup de confirmation est un passage obligé.
  // On le force ouvert quel que soit le chemin d'accès (clic depuis la liste, lien
  // Slack…) ; sa fermeture sans confirmation renvoie vers la liste (cf. plus bas).
  const mustConfirmMeetings = data?.client.enrichment_status === "awaiting_meetings";
  useEffect(() => {
    if (mustConfirmMeetings) setConfirmOpen(true);
  }, [mustConfirmMeetings]);

  // Nouveau(x) meeting(s) Claap détecté(s) par un refresh manuel (cf.
  // runClientRefresh) : le popup se réarme dès que le set de candidats change
  // (nouvelle détection après un "Later"), et se referme tout seul une fois
  // pending_refresh_meeting_candidates vidé côté serveur (confirmé/décliné).
  const pendingRefreshCandidates = data?.client.pending_refresh_meeting_candidates ?? [];
  const pendingRefreshKey = pendingRefreshCandidates.map((c) => c.recording_id).join(",");
  useEffect(() => {
    setNewMeetingModalDismissed(false);
  }, [pendingRefreshKey]);

  async function triggerEnrich() {
    setTriggering(true);
    setTriggerError(null);
    try {
      const res = await fetch(`/api/clients/${id}/enrich`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Refresh immédiat pour passer pending -> running, puis le polling SWR
      // prendra le relais jusqu'à done.
      await mutate();
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : "Error");
    } finally {
      setTriggering(false);
    }
  }

  // Arme le polling SWR rapide (cf. refreshInterval plus haut) et l'effet qui
  // le coupera à la fin. À appeler juste avant de déclencher un refresh
  // (bouton "Actualiser" ou confirmation d'un nouveau meeting).
  function armRefreshWatch() {
    refreshBaselineRef.current = data?.client.last_refresh_report?.refreshed_at ?? null;
    refreshDeadlineRef.current = Date.now() + 4 * 60_000;
    setRefreshing(true);
  }

  async function triggerRefresh() {
    // Le refresh tourne dans une background function Netlify (fields + news +
    // health + insights, plusieurs appels IA) : 20-60s en général. La fiche se
    // met à jour toute seule à la fin du job (report neuf, ou popup de
    // confirmation d'un nouveau meeting), sans reload — cf. l'effet plus haut.
    armRefreshWatch();
    setTriggerError(null);
    try {
      const res = await fetch(`/api/clients/${id}/refresh`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : "Error");
      setRefreshing(false);
      return;
    }
    void mutate();
  }

  async function restoreOnboarding() {
    try {
      const res = await fetch(`/api/clients/${id}/onboarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: false }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await mutate();
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : "Error");
    }
  }

  async function deleteClient(companyName: string) {
    if (!window.confirm(`Permanently delete the profile for "${companyName}"? This action cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    setTriggerError(null);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.push("/clients");
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : "Error");
      setDeleting(false);
    }
  }

  if (isLoading) {
    return <div style={{ padding: 24, color: COLORS.ink3 }}>Loading…</div>;
  }
  if (error || !data) {
    return (
      <div style={{ padding: 24, color: COLORS.err }}>
        {error instanceof Error ? error.message : "Loading error"}
      </div>
    );
  }

  const { client, meetings } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: COLORS.bgPage }}>
      <header
        style={{
          flexShrink: 0,
          background: COLORS.bgCard,
          borderBottom: `1px solid ${COLORS.line}`,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/clients"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${COLORS.line}`,
            color: COLORS.ink2,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={13} />
          Clients
        </Link>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.ink0,
                letterSpacing: "-0.01em",
              }}
            >
              {client.company_name}
            </h1>
            <HealthBadge health={client.health} />
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink2 }}>
            {client.owner_name || client.owner_email || "No owner"} · Signed on {fmtDate(client.closedwon_at)} ·{" "}
            {fmtAmount(client.deal_amount)}
          </div>
          {client.am_cs_notified_at && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {client.am_email && (
                <HandoverChip role="AM" name={client.am_name} email={client.am_email} />
              )}
              {client.cs_email && (
                <HandoverChip role="CS" name={client.cs_name} email={client.cs_email} />
              )}
            </div>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {client.enrichment_status === "awaiting_meetings" && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${COLORS.brand}`,
                background: COLORS.brand,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              <CheckCircle2 size={12} />
              Confirm meetings
            </button>
          )}
          {isAdmin && client.enrichment_status !== "running" && client.enrichment_status !== "awaiting_meetings" && (
            <button
              type="button"
              onClick={triggerEnrich}
              disabled={triggering}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${COLORS.brand}`,
                background: triggering ? COLORS.bgSoft : COLORS.brandTint,
                color: triggering ? COLORS.ink3 : COLORS.brand,
                cursor: triggering ? "not-allowed" : "pointer",
              }}
              title={
                client.enrichment_status === "done"
                  ? "Re-runs the AI extraction from the current data (HubSpot + Claap)."
                  : undefined
              }
            >
              {triggering ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {triggering
                ? "Starting…"
                : client.enrichment_status === "done"
                  ? "Re-run enrichment"
                  : "Run enrichment"}
            </button>
          )}
          {client.enrichment_status === "done" && (
            <button
              type="button"
              onClick={() => setEmailModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.bgCard,
                color: COLORS.ink1,
                cursor: "pointer",
              }}
              title="Draft an email asking the contact for the missing info (review before sending)."
            >
              <MailPlus size={12} />
              Draft a mail to request missing info
            </button>
          )}
          {client.enrichment_status === "done" && (
            <button
              type="button"
              onClick={() => router.push(`/video-studio?clientId=${client.id}`)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.bgCard,
                color: COLORS.ink1,
                cursor: "pointer",
              }}
              title="Generate a personalized avatar video for this account (script from AI, then HeyGen)."
            >
              <Video size={12} />
              Create video
            </button>
          )}
          {client.enrichment_status === "done" && client.onboarding_checklist?.dismissed && (
            <button
              type="button"
              onClick={restoreOnboarding}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.bgCard,
                color: COLORS.ink1,
                cursor: "pointer",
              }}
              title="Bring back the onboarding checklist for this account."
            >
              <ListChecks size={12} />
              Show onboarding
            </button>
          )}
          {client.enrichment_status === "done" && (
            <button
              type="button"
              onClick={triggerRefresh}
              disabled={refreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: refreshing ? COLORS.bgSoft : COLORS.bgCard,
                color: refreshing ? COLORS.ink3 : COLORS.ink1,
                cursor: refreshing ? "not-allowed" : "pointer",
              }}
              title="Takes new activity into account: updates health, news and the fields that changed (without re-analyzing everything)."
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
          {client.enrichment_status === "done" && (
            <button
              type="button"
              onClick={() => setAnalyzedMeetingsOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.bgCard,
                color: COLORS.ink1,
                cursor: "pointer",
              }}
              title="See every Claap meeting that has fed this client's data."
            >
              <Info size={12} />
            </button>
          )}
          {HUBSPOT_PORTAL_ID && (
            <a
              href={`https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/deal/${client.hubspot_deal_id}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                color: COLORS.ink2,
                textDecoration: "none",
              }}
            >
              HubSpot deal
              <ExternalLink size={12} />
            </a>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => deleteClient(client.company_name)}
              disabled={deleting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${COLORS.errBg}`,
                background: deleting ? COLORS.bgSoft : COLORS.errBg,
                color: deleting ? COLORS.ink3 : COLORS.err,
                cursor: deleting ? "not-allowed" : "pointer",
              }}
              title="Permanently delete this client"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </header>

      {triggerError && (
        <div
          style={{
            background: COLORS.errBg,
            color: COLORS.err,
            padding: "8px 16px",
            fontSize: 12,
            borderBottom: `1px solid ${COLORS.line}`,
          }}
        >
          Trigger error: {triggerError}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        <ClientBody
          client={client}
          meetings={meetings}
          onUpdated={() => void mutate()}
          onConfirmMeetings={() => setConfirmOpen(true)}
        />
      </div>

      {emailModalOpen && <MissingInfoEmailModal clientId={client.id} onClose={() => setEmailModalOpen(false)} />}

      {analyzedMeetingsOpen && (
        <AnalyzedMeetingsModal
          clientId={client.id}
          dealId={client.hubspot_deal_id}
          onClose={() => setAnalyzedMeetingsOpen(false)}
        />
      )}

      {pendingRefreshCandidates.length > 0 && !newMeetingModalDismissed && (
        <NewMeetingConfirmationModal
          clientId={client.id}
          candidates={pendingRefreshCandidates}
          onClose={() => setNewMeetingModalDismissed(true)}
          onResolved={() => {
            setNewMeetingModalDismissed(true);
            armRefreshWatch();
            void mutate();
          }}
        />
      )}

      {confirmOpen && (
        <MeetingConfirmationModal
          clientId={client.id}
          blocking={mustConfirmMeetings}
          onClose={() => {
            setConfirmOpen(false);
            // Fermeture sans confirmation alors que c'est obligatoire : la fiche
            // n'est pas consultable tant que les meetings ne sont pas validés, on
            // renvoie donc vers la liste plutôt que d'exposer une fiche vide.
            if (mustConfirmMeetings && !confirmedMeetings.current) {
              router.push("/clients");
            }
            confirmedMeetings.current = false;
          }}
          onConfirmed={() => {
            confirmedMeetings.current = true;
            void mutate();
          }}
          onDeleted={() => {
            // Le client supprimé depuis le popup : on évite le renvoi "Back to
            // clients" de onClose et on navigue directement vers la liste.
            confirmedMeetings.current = true;
            setConfirmOpen(false);
            router.push("/clients");
          }}
        />
      )}
    </div>
  );
}

// Corps de la fiche. Layout conditionnel : tant qu'une checklist d'action reste
// à compléter (champs HubSpot manquants OU items onboarding non cochés), on
// affiche 2 colonnes (actions à gauche, contenu à droite). Une fois les deux
// checklists terminées, la colonne gauche disparaît et le contenu se recentre
// en une seule colonne (layout d'origine).
function ClientBody({
  client,
  meetings,
  onUpdated,
  onConfirmMeetings,
}: {
  client: ClientRow;
  meetings: ClientMeeting[];
  onUpdated: () => void;
  onConfirmMeetings: () => void;
}) {
  // Les checklists d'action n'ont de sens qu'une fois la fiche enrichie.
  const enriched = client.enrichment_status === "done";
  const hasMissingHubspot = getMissingHubspotFields(client.hubspot_deal_fields).length > 0;
  const onboardingDismissed = client.onboarding_checklist?.dismissed === true;
  const onboardingItems = mergeOnboardingItems(client.onboarding_checklist ?? null);
  const hasPendingOnboarding = !onboardingDismissed && onboardingItems.some((i) => !i.done);
  const leftVisible = enriched && (hasMissingHubspot || hasPendingOnboarding);

  const rightColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <StatusBanner client={client} onConfirmMeetings={onConfirmMeetings} />
      <HandoverPanel client={client} fields={client.fields_json ?? {}} onUpdated={onUpdated} />
      <HealthPanel health={client.health} insights={client.insights} clientId={client.id} onUpdated={onUpdated} />
      <RefreshReportPanel report={client.last_refresh_report} fields={client.fields_json ?? {}} />
      <DealRecapPanel recap={client.deal_recap} clientId={client.id} onUpdated={onUpdated} />
      <CoachBriefPanel
        brief={client.coach_brief ?? null}
        generatedAt={client.coach_brief_generated_at ?? null}
        companyName={client.company_name}
        clientId={client.id}
        onUpdated={onUpdated}
      />
      <BillingPanel
        billing={client.billing}
        refreshedAt={client.billing_refreshed_at}
        clientId={client.id}
        onUpdated={onUpdated}
      />
      <FieldsSection fields={client.fields_json ?? {}} clientId={client.id} onUpdated={onUpdated} />
      <NewsPanel news={client.news} />
      <TimelinePanel meetings={meetings} discoveredRecordings={client.discovered_claap_recordings ?? []} />
    </div>
  );

  // Les deux checklists terminées : colonne unique centrée (layout d'origine).
  if (!leftVisible) {
    return <div style={{ maxWidth: 1100, margin: "0 auto" }}>{rightColumn}</div>;
  }

  // 2 colonnes pleine largeur : actions à gauche (colonne large mais bornée),
  // contenu à droite qui prend tout le reste.
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(360px, 460px) minmax(0, 1fr)",
        gap: 20,
        width: "100%",
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <OnboardingChecklistPanel client={client} onUpdated={onUpdated} />
        <HubspotChecklistPanel client={client} onUpdated={onUpdated} />
      </div>
      {rightColumn}
    </div>
  );
}
