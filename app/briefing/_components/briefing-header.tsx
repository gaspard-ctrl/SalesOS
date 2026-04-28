"use client";

import * as React from "react";
import { Linkedin, Mail, Sparkles, ExternalLink } from "lucide-react";
import type { CalendarEvent } from "@/lib/google-calendar";
import { COLORS } from "@/lib/design/tokens";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { IconButton } from "@/components/ui/icon-button";
import type { BriefingResult, GatheredData } from "../_helpers";

function meetingKindLabel(briefing: BriefingResult): string | null {
  if (briefing.isSalesMeeting === false) return null;
  if (briefing.meetingType === "discovery") return "Discovery";
  if (briefing.meetingType === "follow_up") return "Suivi";
  return null;
}

export function BriefingHeader({
  selectedEvent,
  briefing,
  rawData,
  onAskAI,
  onDownloadDraft,
  onLinkedIn,
}: {
  selectedEvent: CalendarEvent;
  briefing: BriefingResult;
  rawData: GatheredData | null;
  onAskAI: () => void;
  onDownloadDraft: () => void;
  onLinkedIn: () => void;
}) {
  const company = briefing.identity?.company || "";
  const kindLabel = meetingKindLabel(briefing);
  const dateStr = selectedEvent.start
    ? new Date(selectedEvent.start).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";
  const timeStr = selectedEvent.start && selectedEvent.start.includes("T")
    ? new Date(selectedEvent.start).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const deal = rawData?.deals?.[0];
  const amount = deal?.amount
    ? `${Number(deal.amount).toLocaleString("fr-FR")} €`
    : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "16px 0",
      }}
    >
      <CompanyAvatar name={company} size={56} rounded="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          {kindLabel && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 6,
                background: COLORS.bgSoft,
                color: COLORS.ink2,
                border: `1px solid ${COLORS.line}`,
              }}
            >
              {kindLabel}
            </span>
          )}
          <ConfidenceBadge confidence={briefing.confidence} />
          {briefing.identity?.hubspotStage && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 999,
                background: COLORS.okBg,
                color: COLORS.ok,
              }}
            >
              {briefing.identity.hubspotStage}
            </span>
          )}
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: 0,
            color: COLORS.ink0,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          {briefing.identity?.name || selectedEvent.title}
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
            fontSize: 12,
            color: COLORS.ink2,
            flexWrap: "wrap",
          }}
        >
          {briefing.identity?.role && <span>{briefing.identity.role}</span>}
          {briefing.identity?.role && company && <span>·</span>}
          {company && <span>{company}</span>}
          {dateStr && <span>·</span>}
          {dateStr && (
            <span>
              {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
              {timeStr ? ` — ${timeStr}` : ""}
            </span>
          )}
          {deal && (
            <>
              <span>·</span>
              <span style={{ color: COLORS.ink1, fontWeight: 500 }}>{deal.name}</span>
              {amount && (
                <>
                  <span>·</span>
                  <span style={{ color: COLORS.ink0, fontWeight: 600 }}>{amount}</span>
                </>
              )}
            </>
          )}
          {selectedEvent.meetingLink && (
            <>
              <span>·</span>
              <a
                href={selectedEvent.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  color: "#1d4ed8",
                  textDecoration: "none",
                }}
              >
                Rejoindre <ExternalLink size={10} />
              </a>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <IconButton
          icon={Linkedin}
          aria-label="Voir LinkedIn"
          onClick={onLinkedIn}
        />
        <IconButton
          icon={Mail}
          aria-label="Télécharger le debrief"
          onClick={onDownloadDraft}
        />
        <IconButton
          icon={Sparkles}
          variant="brand"
          label="Demander à l'IA"
          aria-label="Demander à l'IA"
          onClick={onAskAI}
        />
      </div>
    </div>
  );
}
