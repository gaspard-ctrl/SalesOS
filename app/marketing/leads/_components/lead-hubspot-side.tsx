"use client";

import { ExternalLink, UserCheck } from "lucide-react";
import type { LeadAnalysis } from "@/lib/marketing-types";

const HUBSPOT_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID;

const ACCENT = "#f01563";
const BLUE = "#3b82f6";
const GREEN = "#10b981";
const PURPLE = "#8b5cf6";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const GRAY = "#9ca3af";

// HubSpot's Lead-object record URL. The CRM type segment for a Lead is
// "0-136" (the underlying object type id).
function leadUrl(leadId: string): string | null {
  if (!HUBSPOT_PORTAL_ID) return null;
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-136/${leadId}`;
}

// Pick a color from the stage label. We don't know stage IDs ahead of time
// (pipelines can be customised), so match on common label keywords.
function stageColor(label: string | null): string {
  if (!label) return GRAY;
  const norm = label.toLowerCase();
  if (/new/.test(norm)) return GRAY;
  if (/attempt/.test(norm)) return PURPLE;
  if (/connect/.test(norm)) return BLUE;
  if (/qualif|open\s*deal/.test(norm)) return ACCENT;
  if (/won|customer/.test(norm)) return GREEN;
  if (/unqualif/.test(norm)) return RED;
  if (/bad/.test(norm)) return AMBER;
  return GRAY;
}

export default function LeadHubspotLeadSide({ analysis }: { analysis: LeadAnalysis }) {
  if (!analysis.hubspot_lead_id) return null;

  const url = leadUrl(analysis.hubspot_lead_id);
  const stageLabel = analysis.hubspot_lead_stage_label ?? "—";
  const owner = analysis.hubspot_lead_owner_name ?? analysis.contact_owner_name;
  const email = analysis.contact_email ?? analysis.extracted_email;
  const name = analysis.hubspot_lead_name ?? analysis.contact_name ?? analysis.extracted_name;
  const color = stageColor(analysis.hubspot_lead_stage_label);

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
            background: color,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <UserCheck size={11} />
          {stageLabel}
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

      {name && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111", lineHeight: 1.3 }}>
          {name}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {email && <KvRow k="Email" v={email} />}
        <KvRow k="Stage" v={stageLabel} />
        {owner && <KvRow k="Owner" v={owner} />}
      </div>

      <div
        style={{
          borderTop: "1px solid #eee",
          paddingTop: 8,
          fontSize: 11,
          color: GREEN,
          fontStyle: "italic",
        }}
      >
        Lead HubSpot trouvé — pas encore de deal
      </div>
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
