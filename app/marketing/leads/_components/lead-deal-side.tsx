"use client";

import { ExternalLink, Trophy, XCircle } from "lucide-react";
import type { LeadAnalysis } from "@/lib/marketing-types";
import { scoreBadge, reliabilityLabel, reliabilityColor } from "@/lib/deal-scoring";

const HUBSPOT_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID;

const GREEN = "#10b981";
const BLUE = "#3b82f6";
const RED = "#ef4444";

function dealUrl(dealId: string): string | null {
  if (!HUBSPOT_PORTAL_ID) return null;
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/deal/${dealId}`;
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "—";
  return amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + "€";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function LeadDealSide({ analysis }: { analysis: LeadAnalysis }) {
  if (!analysis.hubspot_deal_id) return null;

  const isWon = analysis.deal_is_closed_won === true;
  const isLost = analysis.deal_is_closed === true && analysis.deal_is_closed_won === false;
  const stage = analysis.deal_stage_label ?? analysis.deal_stage ?? "—";
  const url = dealUrl(analysis.hubspot_deal_id);
  const score = analysis.deal_score ?? null;
  const badge = score ? scoreBadge(score.total) : null;

  const headerColor = isWon ? GREEN : isLost ? RED : BLUE;
  const headerLabel = isWon ? "Won" : isLost ? "Lost" : "En cours";

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "#fafafa",
        border: "1px solid #eee",
        borderRadius: 8,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            color: "#fff",
            background: headerColor,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {isWon && <Trophy size={11} />}
          {isLost && <XCircle size={11} />}
          {headerLabel}
        </span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 11,
              color: "#555",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              textDecoration: "none",
              marginLeft: "auto",
            }}
          >
            HubSpot <ExternalLink size={10} />
          </a>
        )}
      </div>

      {analysis.deal_name && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111", lineHeight: 1.3 }}>
          {analysis.deal_name}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <KvRow k="Étape" v={stage} />
        <KvRow k="Montant" v={formatAmount(analysis.deal_amount)} />
        <KvRow k="Close" v={formatDate(analysis.deal_close_date)} />
        {analysis.deal_owner_name && <KvRow k="Owner" v={analysis.deal_owner_name} />}
      </div>

      {score && badge && (
        <div
          style={{
            borderTop: "1px solid #eee",
            paddingTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: badge.color }}>
              {score.total}
            </span>
            <span style={{ fontSize: 11, color: "#888" }}>/ 100</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 999,
                background: badge.bg,
                color: badge.color,
                marginLeft: "auto",
              }}
            >
              {badge.label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: reliabilityColor(score.reliability) }}>
            Fiabilité : {reliabilityLabel(score.reliability)} ({score.reliability}/5)
          </div>
        </div>
      )}

      {!score && (
        <div
          style={{
            borderTop: "1px solid #eee",
            paddingTop: 8,
            fontSize: 11,
            color: "#888",
            fontStyle: "italic",
          }}
        >
          Pas encore scoré
        </div>
      )}
    </aside>
  );
}

function KvRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", fontSize: 11, gap: 6 }}>
      <span style={{ color: "#888", minWidth: 52 }}>{k}</span>
      <span style={{ color: "#222", fontWeight: 500, wordBreak: "break-word" }}>{v}</span>
    </div>
  );
}
