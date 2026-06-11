"use client";

import * as React from "react";
import useSWR from "swr";
import { Mail, ChevronRight, Loader2 } from "lucide-react";
import { COLORS, SHADOWS } from "@/lib/design/tokens";
import type { CompanyEmailsResponse, CompanyEmail } from "@/app/api/watchlist/companies/[id]/emails/route";
import type { CompanyContactsResponse } from "@/app/api/watchlist/companies/[id]/contacts/route";

const SOURCE_LABEL: Record<string, string> = {
  watchlist_drafter: "Watchlist",
  mass_prospection: "Mass Prospection",
  prospecting: "Prospecting",
  gmail_send: "Email",
};

export function EmailHistoryCard({ companyId }: { companyId: string }) {
  const { data, isLoading } = useSWR<CompanyEmailsResponse>(
    `/api/watchlist/companies/${companyId}/emails`,
    { revalidateOnFocus: false, dedupingInterval: 15_000 },
  );
  // Contacts (deduped avec ContactsCard) pour resoudre les noms des destinataires.
  const { data: contactsData } = useSWR<CompanyContactsResponse>(
    `/api/watchlist/companies/${companyId}/contacts`,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  const nameByEmail = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contactsData?.contacts ?? []) {
      if (c.email) {
        const n = `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim();
        m.set(c.email.toLowerCase(), n || c.email);
      }
    }
    return m;
  }, [contactsData]);

  const emails = data?.emails ?? [];
  // Carte repliée par défaut ; le header sert de toggle.
  const [open, setOpen] = React.useState(false);

  return (
    <section
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        boxShadow: SHADOWS.card,
        overflow: "hidden",
      }}
    >
      <header
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}
      >
        <span style={{ display: "inline-flex", color: COLORS.ink3 }}>
          <Mail size={16} />
        </span>
        <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", color: COLORS.ink0 }}>
          Email history
        </h2>
        {emails.length > 0 && <span style={{ fontSize: 11, color: COLORS.ink3 }}>{emails.length}</span>}
        {isLoading && <Loader2 size={12} className="animate-spin" style={{ color: COLORS.brand }} />}
        <ChevronRight
          size={14}
          style={{
            marginLeft: "auto",
            color: COLORS.ink4,
            flexShrink: 0,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform .12s",
          }}
        />
      </header>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {isLoading && emails.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: COLORS.ink3 }}>Loading…</p>
          ) : emails.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: COLORS.ink3 }}>
              No emails sent yet from the platform for this company. Emails you send from the drafter will appear here.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {emails.map((e) => (
                <EmailRow key={e.id} email={e} nameByEmail={nameByEmail} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function EmailRow({ email, nameByEmail }: { email: CompanyEmail; nameByEmail: Map<string, string> }) {
  const [open, setOpen] = React.useState(false);
  // Destinataires "prospects" : on exclut le cc et l'adresse de l'expediteur, on resout le nom.
  const senderLower = (email.sender_email ?? "").toLowerCase();
  const recipients = email.recipients
    .filter((r) => (r.kind ?? "") !== "cc" && r.email.toLowerCase() !== senderLower)
    .map((r) => nameByEmail.get(r.email.toLowerCase()) ?? r.email);
  const uniqueRecipients = Array.from(new Set(recipients));
  const sourceLabel = SOURCE_LABEL[email.source] ?? email.source;

  return (
    <li style={{ border: `1px solid ${COLORS.line}`, borderRadius: 8, background: COLORS.bgCard, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          textAlign: "left",
          padding: "9px 11px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <ChevronRight
          size={14}
          style={{ color: COLORS.ink4, flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform .12s" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: COLORS.ink0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {email.subject || "(no subject)"}
          </div>
          <div
            style={{
              fontSize: 11,
              color: COLORS.ink3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {uniqueRecipients.length > 0 ? `To ${uniqueRecipients.join(", ")}` : "No recipients"}
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: COLORS.ink3, background: COLORS.bgSoft, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>
          {sourceLabel}
        </span>
        <span style={{ fontSize: 10, color: COLORS.ink4, flexShrink: 0, whiteSpace: "nowrap" }}>{formatRelative(email.sent_at)}</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px 33px" }}>
          <div
            style={{
              fontSize: 12,
              color: COLORS.ink1,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              background: COLORS.bgSoft,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 8,
              padding: "10px 12px",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {email.body || "(no body saved)"}
          </div>
        </div>
      )}
    </li>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
