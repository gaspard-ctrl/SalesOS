"use client";

import { useState } from "react";
import useSWR from "swr";
import { Send, UserCheck, AlertTriangle, Loader2 } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import {
  getMissingRequiredFields,
  getMissingRecommendedFields,
  type ClientFields,
  type ClientRow,
} from "@/lib/clients/types";

type UserOption = { id: string; email: string; name: string | null };

async function usersFetcher(url: string): Promise<{ users: UserOption[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ users: UserOption[] }>;
}

export function HandoverPanel({
  client,
  fields,
  onUpdated,
}: {
  client: ClientRow;
  fields: Partial<ClientFields>;
  onUpdated: () => void;
}) {
  const { data: usersData } = useSWR("/api/users/list", usersFetcher, { revalidateOnFocus: false });
  const users = usersData?.users ?? [];

  const [amEmail, setAmEmail] = useState<string>(client.am_email ?? "");
  const [csEmail, setCsEmail] = useState<string>(client.cs_email ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Champs clés/recommandés vides : non bloquants. On les liste dans un popup de
  // confirmation avant l'envoi, mais l'AE peut toujours notifier sans les remplir.
  const missingFields = [...getMissingRequiredFields(fields), ...getMissingRecommendedFields(fields)];

  // Une fois l'AM/CS notifiés, la card a fait son office : on la masque (le statut
  // "Transmis AM/CS" reste visible dans la liste des clients).
  if (client.am_cs_notified_at) return null;

  const nameFor = (email: string): string | null => users.find((u) => u.email === email)?.name ?? null;

  async function send() {
    setConfirmOpen(false);
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/notify-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amEmail,
          amName: nameFor(amEmail),
          csEmail,
          csName: nameFor(csEmail),
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  }

  function onNotifyClick() {
    setError(null);
    if (!amEmail || !csEmail) {
      setError("Please select both an AM and a CS.");
      return;
    }
    if (missingFields.length > 0) {
      setConfirmOpen(true);
      return;
    }
    void send();
  }

  const selectStyle: React.CSSProperties = {
    fontSize: 13,
    padding: "7px 10px",
    borderRadius: 8,
    border: `1px solid ${COLORS.line}`,
    background: "white",
    color: COLORS.ink0,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${COLORS.line}`,
          background: COLORS.bgSoft,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <UserCheck size={15} style={{ color: COLORS.brand }} />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink0 }}>Handover to AM &amp; CS</h3>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Call-to-action : assigner l'AM/CS et les notifier. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: COLORS.warnBg,
            color: COLORS.warn,
            border: `1px solid ${COLORS.warn}`,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>Assign an AM and a CS, then notify them — the closed-won context is ready to hand over.</span>
        </div>

        {/* Dropdowns AM / CS */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink2 }}>Account Manager (AM)</label>
            <select value={amEmail} onChange={(e) => setAmEmail(e.target.value)} disabled={sending} style={selectStyle}>
              <option value="">Select an AM…</option>
              {users.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.name ? `${u.name} · ${u.email}` : u.email}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink2 }}>Customer Success (CS)</label>
            <select value={csEmail} onChange={(e) => setCsEmail(e.target.value)} disabled={sending} style={selectStyle}>
              <option value="">Select a CS…</option>
              {users.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.name ? `${u.name} · ${u.email}` : u.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: COLORS.err }}>{error}</div>}

        <div>
          <button
            type="button"
            onClick={onNotifyClick}
            disabled={sending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: sending ? COLORS.bgSoft : COLORS.brand,
              color: sending ? COLORS.ink3 : "#fff",
              cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {sending ? "Notifying…" : "Notify AM & CS"}
          </button>
        </div>
      </div>

      {/* Popup de confirmation : des recommandés sont vides, mais l'AE peut envoyer quand même. */}
      {confirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COLORS.bgCard,
              borderRadius: 12,
              border: `1px solid ${COLORS.line}`,
              maxWidth: 440,
              width: "100%",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.ink0 }}>Some info is still missing</h4>
            <p style={{ margin: 0, fontSize: 13, color: COLORS.ink1, lineHeight: 1.5 }}>
              These fields are still empty:{" "}
              <strong style={{ fontWeight: 600 }}>{missingFields.map((m) => m.label).join(", ")}</strong>. You can
              notify the AM &amp; CS anyway.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: `1px solid ${COLORS.line}`,
                  background: "white",
                  color: COLORS.ink2,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void send()}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: COLORS.brand,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Send anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
