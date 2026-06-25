"use client";

import * as React from "react";
import { Radar, ExternalLink, PenLine, Sparkles, X, Trash2, Loader2 } from "lucide-react";
import { COLORS, RADIUS } from "@/lib/design/tokens";
import { useCompanySignals } from "@/lib/hooks/use-signals";
import type { SignalRow } from "@/lib/signals/types";
import { SignalActModal } from "@/app/signals/_components/signal-act-modal";
import type { DraftRecipient } from "./mail-drafter";

const TYPE_META: Record<string, { label: string; fg: string; bg: string }> = {
  funding: { label: "Funding", fg: COLORS.ok, bg: COLORS.okBg },
  acquisition: { label: "M&A", fg: COLORS.info, bg: COLORS.infoBg },
  expansion: { label: "Expansion", fg: COLORS.ok, bg: COLORS.okBg },
  nomination: { label: "Leadership", fg: COLORS.info, bg: COLORS.infoBg },
  job_change: { label: "New decision-maker", fg: COLORS.info, bg: COLORS.infoBg },
  hiring: { label: "Hiring", fg: COLORS.brand, bg: COLORS.brandTint },
  restructuring: { label: "Restructuring", fg: COLORS.warn, bg: COLORS.warnBg },
  linkedin_post: { label: "LinkedIn", fg: COLORS.brand, bg: COLORS.brandTint },
  content: { label: "Content", fg: COLORS.ink2, bg: COLORS.bgSoft },
};

function meta(s: SignalRow) {
  return TYPE_META[s.category ?? ""] ?? TYPE_META[s.signal_type] ?? { label: s.signal_type, fg: COLORS.ink2, bg: COLORS.bgSoft };
}

export function SignalsCard({
  companyId,
  onProspect,
}: {
  companyId: string;
  onProspect: (recipients: DraftRecipient[], seed?: { subject: string | null; body: string | null }) => void;
}) {
  const { signals, error, isLoading, mutate } = useCompanySignals(companyId);
  const [actSignal, setActSignal] = React.useState<SignalRow | null>(null);
  const [dismissingId, setDismissingId] = React.useState<string | null>(null);
  const [dismissError, setDismissError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function dismiss(id: string) {
    setDismissingId(id);
    setDismissError(null);
    try {
      const res = await fetch(`/api/signals/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error ?? `HTTP ${res.status}`);
      await mutate();
    } catch (e) {
      setDismissError(e instanceof Error ? e.message : "Could not dismiss the signal.");
      await mutate(); // resynchronise l'état réel (la carte reste visible)
    } finally {
      setDismissingId(null);
    }
  }

  // Suppression définitive : retire le signal pour de bon (status 'deleted'),
  // il ne réapparaîtra pas au prochain scan. Confirmation car irréversible.
  async function del(id: string) {
    if (!window.confirm("Delete this signal permanently? It won't come back on the next scan.")) return;
    setDeletingId(id);
    setDismissError(null);
    try {
      const res = await fetch(`/api/signals/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error ?? `HTTP ${res.status}`);
      await mutate();
    } catch (e) {
      setDismissError(e instanceof Error ? e.message : "Could not delete the signal.");
      await mutate(); // resynchronise l'état réel (la carte reste visible)
    } finally {
      setDeletingId(null);
    }
  }

  // Erreur de chargement : on l'affiche au lieu de masquer silencieusement la carte.
  if (!isLoading && error && signals.length === 0 && !actSignal) {
    return (
      <section style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.lg, padding: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <Radar size={15} style={{ color: COLORS.ink3 }} />
        <span style={{ fontSize: 13, color: COLORS.err }}>Could not load signals: {error}</span>
      </section>
    );
  }

  if (!isLoading && signals.length === 0 && !actSignal) return null;

  return (
    <>
      <section
        style={{
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.line}`,
          borderRadius: RADIUS.lg,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Radar size={15} style={{ color: COLORS.brand }} />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.ink0 }}>Signals</h3>
          <span style={{ fontSize: 12, color: COLORS.ink3 }}>({signals.length})</span>
        </div>

        {dismissError && <div style={{ fontSize: 12, color: COLORS.err }}>{dismissError}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {signals.map((s) => {
            const m = meta(s);
            const recipient = s.draft_recipient;
            const canDraft = !!recipient?.email;
            const isDismissing = dismissingId === s.id;
            const isDeleting = deletingId === s.id;
            const isBusy = isDismissing || isDeleting;
            return (
              <div
                key={s.id}
                style={{
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: RADIUS.md,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  background: s.status === "actioned" ? COLORS.brandTintSoft : COLORS.bgCard,
                  opacity: isBusy ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: m.fg, background: m.bg, padding: "2px 8px", borderRadius: 999 }}>{m.label}</span>
                  {s.status === "actioned" && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.ok }}>{s.draft_recipient ? "Actioned" : "Saved"}</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: COLORS.ink2 }}>{s.score}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink0, lineHeight: 1.4 }}>{s.title}</div>
                {s.summary && <div style={{ fontSize: 12, color: COLORS.ink2, lineHeight: 1.45 }}>{s.summary}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: COLORS.ink3, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                    >
                      Source <ExternalLink size={11} />
                    </a>
                  )}
                  <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => dismiss(s.id)}
                      disabled={isBusy}
                      title="Dismiss this signal"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: COLORS.ink3,
                        background: "none",
                        border: "none",
                        cursor: isBusy ? "default" : "pointer",
                      }}
                    >
                      {isDismissing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => del(s.id)}
                      disabled={isBusy}
                      title="Delete this signal permanently"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: COLORS.err,
                        background: "none",
                        border: "none",
                        cursor: isBusy ? "default" : "pointer",
                      }}
                    >
                      {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                    </button>
                    {canDraft && (
                      <button
                        type="button"
                        onClick={() =>
                          onProspect(
                            [{ name: recipient!.name ?? null, email: recipient!.email }],
                            { subject: s.draft_subject, body: s.draft_body },
                          )
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          color: COLORS.ink1,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <PenLine size={12} /> Use draft
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActSignal(s)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        color: COLORS.brand,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Sparkles size={12} /> Act
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {actSignal && (
        <SignalActModal
          key={actSignal.id}
          signal={actSignal}
          onClose={() => setActSignal(null)}
          onActioned={() => mutate()}
        />
      )}
    </>
  );
}
