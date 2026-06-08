"use client";

import * as React from "react";
import useSWR from "swr";
import { Users, Mail, ExternalLink, Loader2, MailPlus } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import { ProspectGmailModal } from "../../_components/prospect-gmail-modal";
import type { DraftRecipient } from "./mail-drafter";
import type { CompanyContactsResponse } from "@/app/api/watchlist/companies/[id]/contacts/route";

export function ContactsCard({
  companyId,
  onProspect,
}: {
  companyId: string;
  onProspect?: (recipients: DraftRecipient[]) => void;
}) {
  const { data, isLoading } = useSWR<CompanyContactsResponse>(
    `/api/watchlist/companies/${companyId}/contacts`,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  const [gmailTarget, setGmailTarget] = React.useState<{ name: string; email: string } | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const contacts = data?.contacts ?? [];
  const withEmail = contacts.filter((c) => c.email);

  function nameOf(c: (typeof contacts)[number]) {
    return `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim() || c.email || "Contact";
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelected() {
    if (!onProspect) return;
    const picked = withEmail
      .filter((c) => selected.has(c.id))
      .map((c) => ({ name: nameOf(c), email: c.email as string }));
    if (picked.length > 0) onProspect(picked);
    setSelected(new Set());
  }

  return (
    <section
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: `1px solid ${COLORS.line}`,
          background: COLORS.bgSoft,
        }}
      >
        <span style={{ display: "inline-flex", color: COLORS.ink2 }}>
          <Users size={14} />
        </span>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink0 }}>
          HubSpot Contacts
        </h2>
        {contacts.length > 0 && (
          <span style={{ fontSize: 11, color: COLORS.ink3 }}>{contacts.length}</span>
        )}
        {onProspect && selected.size > 0 && (
          <button
            type="button"
            onClick={addSelected}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 11px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 7,
              border: "none",
              background: COLORS.brand,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <MailPlus size={12} /> Ajouter {selected.size} au mail
          </button>
        )}
        {isLoading && (
          <Loader2
            size={12}
            className="animate-spin"
            style={{ color: COLORS.brand, marginLeft: selected.size > 0 ? 0 : "auto" }}
          />
        )}
      </header>

      <div style={{ padding: "8px 8px" }}>
        {isLoading && contacts.length === 0 ? (
          <p style={{ margin: 0, padding: "8px 8px", fontSize: 12, color: COLORS.ink3 }}>Loading contacts…</p>
        ) : contacts.length === 0 ? (
          <p style={{ margin: 0, padding: "8px 8px", fontSize: 12, color: COLORS.ink3 }}>
            {data?.hubspot_company_id
              ? "No contacts associated with this company in HubSpot."
              : "Company not linked to HubSpot (import from HubSpot to link contacts)."}
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
            {contacts.map((c) => {
              const name = nameOf(c);
              return (
                <li
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 8px",
                    borderRadius: 8,
                  }}
                >
                  {onProspect && c.email && (
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      title="Select for email"
                      style={{ accentColor: COLORS.brand, width: 15, height: 15, cursor: "pointer", flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.jobtitle ? c.jobtitle : "—"}
                      {c.email ? ` · ${c.email}` : ""}
                    </div>
                  </div>
                  {c.email && onProspect && (
                    <button
                      type="button"
                      onClick={() => onProspect([{ name, email: c.email as string }])}
                      title="Add to email (BCC)"
                      style={iconBtn()}
                    >
                      <MailPlus size={13} />
                    </button>
                  )}
                  {c.email && (
                    <button
                      type="button"
                      onClick={() => setGmailTarget({ name, email: c.email as string })}
                      title="View Gmail exchanges"
                      style={iconBtn()}
                    >
                      <Mail size={13} />
                    </button>
                  )}
                  <a
                    href={`https://app.hubspot.com/contacts/_/contact/${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in HubSpot"
                    style={{ ...iconBtn(), textDecoration: "none" }}
                  >
                    <ExternalLink size={13} />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {gmailTarget && (
        <ProspectGmailModal
          fullName={gmailTarget.name}
          email={gmailTarget.email}
          onClose={() => setGmailTarget(null)}
        />
      )}
    </section>
  );
}

function iconBtn(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 6,
    border: `1px solid ${COLORS.line}`,
    color: COLORS.ink2,
    background: COLORS.bgCard,
    cursor: "pointer",
    flexShrink: 0,
  };
}
