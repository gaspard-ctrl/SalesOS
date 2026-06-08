"use client";

import Link from "next/link";
import { COLORS } from "@/lib/design/tokens";
import { HealthBadge } from "./health-badge";
import type { Health, Billing } from "@/lib/clients/types";

export type ClientListItem = {
  id: string;
  hubspot_deal_id: string;
  hubspot_company_id: string | null;
  company_name: string;
  owner_email: string | null;
  owner_name: string | null;
  closedwon_at: string;
  deal_amount: number | null;
  billing: Billing | null;
  health: Health | null;
  enrichment_status: "pending" | "awaiting_meetings" | "running" | "done" | "error";
  enrichment_error: string | null;
  last_enriched_at: string | null;
  am_cs_notified_at: string | null;
};

function fmtAmount(n: number | null): string {
  if (n == null) return "-";
  return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k€`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusPill({
  status,
  amCsNotifiedAt,
}: {
  status: ClientListItem["enrichment_status"];
  amCsNotifiedAt: string | null;
}) {
  const map: Record<ClientListItem["enrichment_status"], { fg: string; bg: string; label: string }> = {
    pending: { fg: COLORS.ink2, bg: COLORS.bgSoft, label: "Pending" },
    awaiting_meetings: { fg: COLORS.brand, bg: COLORS.brandTint, label: "Meetings to confirm" },
    running: { fg: COLORS.info, bg: COLORS.infoBg, label: "Enriching…" },
    // Une fois enrichi, l'étape suivante est la validation par l'AE (remplir les
    // champs requis + assigner/notifier l'AM et le CS). On reflète ce sous-état :
    // "À valider" tant que l'AM/CS ne sont pas notifiés, "Transmis AM/CS" ensuite.
    done: { fg: COLORS.ok, bg: COLORS.okBg, label: "Enriched" },
    error: { fg: COLORS.err, bg: COLORS.errBg, label: "Error" },
  };
  const s =
    status === "done"
      ? amCsNotifiedAt
        ? { fg: COLORS.ok, bg: COLORS.okBg, label: "Handed over to AM/CS" }
        : { fg: COLORS.warn, bg: COLORS.warnBg, label: "To validate" }
      : map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  );
}

export function ClientsTable({ clients }: { clients: ClientListItem[] }) {
  if (clients.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          background: COLORS.bgCard,
          border: `1px dashed ${COLORS.line}`,
          borderRadius: 12,
          color: COLORS.ink2,
          fontSize: 14,
        }}
      >
        No clients to display.
        <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 6 }}>
          Clients are created automatically when a HubSpot deal moves to closed-won.
        </div>
      </div>
    );
  }

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
          display: "grid",
          gridTemplateColumns: "minmax(200px, 2fr) minmax(140px, 1fr) 120px 120px 130px 140px 100px",
          gap: 12,
          padding: "10px 16px",
          background: COLORS.bgSoft,
          borderBottom: `1px solid ${COLORS.line}`,
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.ink3,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        <div>Account</div>
        <div>Owner</div>
        <div>HubSpot amount</div>
        <div>Billed amount</div>
        <div>Signed on</div>
        <div>Health</div>
        <div>Status</div>
      </div>
      {clients.map((c) => (
        <Link
          key={c.id}
          href={`/clients/${c.id}`}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(200px, 2fr) minmax(140px, 1fr) 120px 120px 130px 140px 100px",
            gap: 12,
            padding: "12px 16px",
            borderBottom: `1px solid ${COLORS.line}`,
            color: "inherit",
            textDecoration: "none",
            alignItems: "center",
            background: COLORS.bgCard,
            transition: "background 120ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = COLORS.brandTintSoft;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = COLORS.bgCard;
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.ink0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={c.company_name}
            >
              {c.company_name}
            </div>
            <div style={{ fontSize: 11, color: COLORS.ink3, marginTop: 1 }}>
              deal #{c.hubspot_deal_id}
            </div>
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.owner_name || c.owner_email || "-"}
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink1, fontVariantNumeric: "tabular-nums" }}>
            {fmtAmount(c.deal_amount)}
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink1, fontVariantNumeric: "tabular-nums" }}>
            {fmtAmount(c.billing?.total_contract_value ?? null)}
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink1, fontVariantNumeric: "tabular-nums" }}>
            {fmtDate(c.closedwon_at)}
          </div>
          <div>
            <HealthBadge health={c.health} compact />
          </div>
          <div>
            <StatusPill status={c.enrichment_status} amCsNotifiedAt={c.am_cs_notified_at} />
          </div>
        </Link>
      ))}
    </div>
  );
}
