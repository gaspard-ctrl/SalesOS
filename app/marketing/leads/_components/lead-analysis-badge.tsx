"use client";

import { AlertTriangle, ExternalLink, Loader2, Trophy, User, XCircle } from "lucide-react";
import type { LeadAnalysis } from "@/lib/marketing-types";

const GREEN = "#10b981";
const BLUE = "#3b82f6";
const ORANGE = "#f59e0b";
const AMBER = "#d97706";
const RED = "#ef4444";
const GREY = "#9ca3af";

const HUBSPOT_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID;

function dealUrl(dealId: string): string | null {
  if (!HUBSPOT_PORTAL_ID) return null;
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/deal/${dealId}`;
}

function contactUrl(contactId: string): string | null {
  if (!HUBSPOT_PORTAL_ID) return null;
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/contact/${contactId}`;
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "";
  return amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + "€";
}

function pillStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 999,
    color: "#fff",
    background: color,
  };
}

export default function LeadAnalysisBadge({
  analysis,
  analysisStatus,
}: {
  analysis: LeadAnalysis | null;
  analysisStatus: string | null;
}) {
  if (!analysis && !analysisStatus) {
    return <span style={pillStyle(GREY)}>Non analysé</span>;
  }

  if (analysisStatus === "pending" || analysis?.status === "pending") {
    return (
      <span style={pillStyle(GREY)}>
        <Loader2 size={12} className="animate-spin" /> Analyse…
      </span>
    );
  }

  if (analysis?.status === "error") {
    return (
      <span style={pillStyle(RED)} title={analysis.error_message ?? "Erreur"}>
        <XCircle size={12} /> Erreur d'analyse
      </span>
    );
  }

  if (analysis && !analysis.hubspot_deal_id) {
    const strategy = analysis.match_strategy;

    if (analysis.hubspot_contact_id && (strategy === "email" || strategy === "person")) {
      const label = strategy === "email" ? "Contact HubSpot (email) · pas de deal" : "Contact HubSpot · pas de deal";
      const url = contactUrl(analysis.hubspot_contact_id);
      const content = (
        <>
          <User size={12} />
          {label}
          {url && <ExternalLink size={11} />}
        </>
      );
      if (url) {
        return (
          <a href={url} target="_blank" rel="noreferrer" style={{ ...pillStyle(AMBER), textDecoration: "none" }}>
            {content}
          </a>
        );
      }
      return <span style={pillStyle(AMBER)}>{content}</span>;
    }

    if (strategy === "company") {
      return (
        <span style={pillStyle(AMBER)}>
          <AlertTriangle size={12} /> Société HubSpot · pas de deal
        </span>
      );
    }

    return (
      <span style={pillStyle(ORANGE)}>
        <AlertTriangle size={12} /> Aucun match HubSpot
      </span>
    );
  }

  if (analysis?.status === "done" && analysis.hubspot_deal_id) {
    const isWon = analysis.deal_is_closed_won === true;
    const color = isWon ? GREEN : BLUE;
    const stage = analysis.deal_stage_label ?? analysis.deal_stage ?? "?";
    const amount = formatAmount(analysis.deal_amount);
    const owner = analysis.deal_owner_name ?? "";
    const label = isWon
      ? `Won — ${amount}${owner ? ` — ${owner}` : ""}`
      : `Deal · ${stage}${amount ? ` · ${amount}` : ""}${owner ? ` · ${owner}` : ""}`;
    const url = dealUrl(analysis.hubspot_deal_id);
    const content = (
      <>
        {isWon ? <Trophy size={12} /> : null}
        {label}
        {url && <ExternalLink size={11} />}
      </>
    );
    if (url) {
      return (
        <a href={url} target="_blank" rel="noreferrer" style={{ ...pillStyle(color), textDecoration: "none" }}>
          {content}
        </a>
      );
    }
    return <span style={pillStyle(color)}>{content}</span>;
  }

  return <span style={pillStyle(GREY)}>État inconnu</span>;
}
