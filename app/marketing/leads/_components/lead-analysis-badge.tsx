"use client";

import { AlertTriangle, ExternalLink, Loader2, Trophy, XCircle } from "lucide-react";
import type { LeadAnalysis } from "@/lib/marketing-types";

const GREEN = "#10b981";
const BLUE = "#3b82f6";
const ORANGE = "#f59e0b";
const RED = "#ef4444";
const GREY = "#9ca3af";

const HUBSPOT_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID;

function dealUrl(dealId: string): string | null {
  if (!HUBSPOT_PORTAL_ID) return null;
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/deal/${dealId}`;
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

  if (analysis?.status === "no_match" || (!analysis?.hubspot_deal_id && analysis)) {
    return (
      <span style={pillStyle(ORANGE)}>
        <AlertTriangle size={12} /> Aucun deal HubSpot trouvé
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
