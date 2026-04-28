"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import type { CalendarEvent } from "@/lib/google-calendar";
import { COLORS } from "@/lib/design/tokens";
import { externalAttendees, eventDateLabel, eventTime } from "../_helpers";

export function MeetingSidebar({
  events,
  selectedId,
  onSelect,
  onBackToCalendar,
}: {
  events: CalendarEvent[];
  selectedId: string | null;
  onSelect: (e: CalendarEvent) => void;
  onBackToCalendar: () => void;
}) {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: COLORS.bgCard,
        borderRight: `1px solid ${COLORS.line}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: `1px solid ${COLORS.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink0, margin: 0, letterSpacing: "-0.01em" }}>
            Meetings à venir
          </h2>
          <p style={{ fontSize: 11, color: COLORS.ink4, margin: 0, marginTop: 2 }}>7 prochains jours</p>
        </div>
        <button
          type="button"
          onClick={onBackToCalendar}
          aria-label="Retour au calendrier"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            padding: "5px 9px",
            borderRadius: 8,
            border: `1px solid ${COLORS.line}`,
            background: COLORS.bgCard,
            color: COLORS.ink2,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = COLORS.brand;
            e.currentTarget.style.color = COLORS.brand;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = COLORS.line;
            e.currentTarget.style.color = COLORS.ink2;
          }}
        >
          <ArrowLeft size={12} />
          Calendrier
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {events.length === 0 && (
          <p style={{ fontSize: 11, color: COLORS.ink4, textAlign: "center", padding: 16, margin: 0 }}>
            Aucun meeting à venir
          </p>
        )}
        {events.map((event) => {
          const ext = externalAttendees(event);
          const isInternal = ext.length === 0;
          const { label, color } = eventDateLabel(event.start);
          const time = eventTime(event.start);
          const active = selectedId === event.id;

          return (
            <button
              key={event.id}
              type="button"
              onClick={() => !isInternal && onSelect(event)}
              disabled={isInternal}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 11px",
                borderRadius: 10,
                border: `1px solid ${active ? COLORS.brand : COLORS.lineStrong}`,
                background: active ? COLORS.brandTintSoft : COLORS.bgCard,
                opacity: isInternal ? 0.5 : 1,
                cursor: isInternal ? "default" : "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isInternal && !active) e.currentTarget.style.borderColor = COLORS.brand;
              }}
              onMouseLeave={(e) => {
                if (!isInternal && !active) e.currentTarget.style.borderColor = COLORS.lineStrong;
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink0, margin: 0, lineHeight: 1.25 }}>
                  {event.title}
                </p>
                <span style={{ fontSize: 10, fontWeight: 500, color, flexShrink: 0, marginTop: 1 }}>{label}</span>
              </div>
              {time && <p style={{ fontSize: 10, color: COLORS.ink3, margin: 0, marginBottom: 4 }}>{time}</p>}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {isInternal ? (
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999, background: "#f1f5f9", color: "#475569" }}>
                    Interne
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: COLORS.ink4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                    {ext[0]?.displayName || ext[0]?.email}
                    {ext.length > 1 ? ` +${ext.length - 1}` : ""}
                  </span>
                )}
                {event.meetingLink && (
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8" }}>
                    Visio
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
