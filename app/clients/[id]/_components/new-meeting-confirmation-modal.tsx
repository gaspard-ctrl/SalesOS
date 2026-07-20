"use client";

import { useMemo, useState } from "react";
import { Loader2, Video, ExternalLink, Check, X } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import type { MeetingCandidate } from "@/lib/clients/types";

function fmtDate(iso: string | null): string {
  if (!iso) return "?";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Popup déclenché par un refresh MANUEL qui a détecté un ou plusieurs meetings
// Claap jamais vus par ce client (matchés par domaine/titre, hors deal indexé,
// confirmé, découvert ou décliné précédemment). Contrairement au popup
// d'import (MeetingConfirmationModal), pas de recherche/browse : la discovery
// a déjà trouvé le(s) meeting(s), on demande juste une confirmation. Tant que
// rien n'est décidé (fermeture sans action), le reste du refresh (health,
// news, champs) reste en pause — cf. runClientRefresh.
export function NewMeetingConfirmationModal({
  clientId,
  candidates,
  onResolved,
  onClose,
}: {
  clientId: string;
  candidates: MeetingCandidate[];
  onResolved: () => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(candidates.map((c) => c.recording_id)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = useMemo(() => candidates.filter((c) => checked.has(c.recording_id)).length, [candidates, checked]);

  function toggle(recordingId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(recordingId)) next.delete(recordingId);
      else next.add(recordingId);
      return next;
    });
  }

  async function submit(confirmedIds: string[]) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/confirm-refresh-meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed_ids: confirmedIds }),
      });
      if (!res.ok && res.status !== 202) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSubmitting(false);
    }
  }

  const single = candidates.length === 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={submitting ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.bgCard,
          borderRadius: 14,
          border: `1px solid ${COLORS.line}`,
          width: "100%",
          maxWidth: 520,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${COLORS.line}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <Video size={16} style={{ color: COLORS.brand, marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.ink0 }}>
              {single ? "New Claap meeting found" : `${candidates.length} new Claap meetings found`}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.ink2 }}>
              We found {single ? "a meeting" : "meetings"} for this account we haven&apos;t seen before. Confirm the
              ones that belong here — the rest of the refresh (health, news, fields) resumes once you decide.
            </p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {candidates.map((c) => {
            const isChecked = checked.has(c.recording_id);
            return (
              <label
                key={c.recording_id}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "10px",
                  borderRadius: 8,
                  alignItems: "flex-start",
                  cursor: "pointer",
                  background: isChecked ? COLORS.brandTint : COLORS.bgSoft,
                  border: `1px solid ${isChecked ? COLORS.brand : COLORS.line}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(c.recording_id)}
                  disabled={submitting}
                  style={{ marginTop: 2 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink0 }}>
                    {c.meeting_title ?? "Untitled meeting"}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.ink3, marginTop: 2 }}>{fmtDate(c.meeting_started_at)}</div>
                </div>
                {c.claap_url && (
                  <a
                    href={c.claap_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: COLORS.ink4, marginTop: 2 }}
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </label>
            );
          })}
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${COLORS.line}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {error && <span style={{ fontSize: 11, color: COLORS.err, flex: 1 }}>{error}</span>}
          {!error && (
            <span style={{ fontSize: 11, color: COLORS.ink3, flex: 1 }}>
              {selectedCount} of {candidates.length} selected
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              fontSize: 12,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${COLORS.line}`,
              background: COLORS.bgCard,
              color: COLORS.ink2,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => submit([])}
            disabled={submitting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: COLORS.bgCard,
              color: "#dc2626",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            <X size={13} />
            Ignore all
          </button>
          <button
            type="button"
            onClick={() => submit(Array.from(checked))}
            disabled={submitting || selectedCount === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${COLORS.brand}`,
              background: submitting || selectedCount === 0 ? COLORS.bgSoft : COLORS.brand,
              color: submitting || selectedCount === 0 ? COLORS.ink3 : "#fff",
              cursor: submitting || selectedCount === 0 ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {submitting ? "Confirming…" : "Confirm & refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
