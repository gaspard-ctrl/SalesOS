"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import type { CalendarEvent } from "@/lib/google-calendar";
import { externalAttendees, eventTime } from "../_helpers";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_SHORT = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

export function CalendarWeek({
  events,
  loading,
  calendarConnected,
  onSelectEvent,
}: {
  events: CalendarEvent[];
  loading: boolean;
  calendarConnected: boolean | undefined;
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  if (!loading && calendarConnected === false) {
    return (
      <div
        style={{
          margin: 16,
          borderRadius: 12,
          padding: 16,
          textAlign: "center",
          background: "#fde8ef",
          border: "1px solid #f9b4cb",
        }}
      >
        <Calendar size={20} style={{ color: "#f01563", margin: "0 auto 8px" }} />
        <p style={{ fontSize: 12, fontWeight: 600, color: "#c01252", margin: 0, marginBottom: 4 }}>
          Calendar non connecté
        </p>
        <p style={{ fontSize: 12, color: "#c01252", margin: 0, marginBottom: 12 }}>
          Reconnecte Google pour activer l&apos;accès Calendar.
        </p>
        <a
          href="/api/gmail/connect"
          style={{
            display: "inline-block",
            fontSize: 12,
            padding: "6px 12px",
            borderRadius: 8,
            fontWeight: 500,
            background: "#f01563",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          Reconnecter Google →
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 1,
          padding: 16,
          background: "#f0f0f0",
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, background: "#fff" }}>
            <div className="h-6 rounded animate-pulse" style={{ background: "#f5f5f5" }} />
            <div className="h-16 rounded animate-pulse" style={{ background: "#f5f5f5" }} />
          </div>
        ))}
      </div>
    );
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const eventsByDay = days.map((day) =>
    events.filter((e) => new Date(e.start).toDateString() === day.toDateString())
  );
  const todayStr = new Date().toDateString();

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {days.map((day, di) => {
        const isToday = day.toDateString() === todayStr;
        const dayEvents = eventsByDay[di];
        return (
          <div
            key={di}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              borderRight: "1px solid #f0f0f0",
              overflow: "hidden",
              background: isToday ? "#fffbfc" : "#fff",
            }}
          >
            <div
              style={{
                padding: "8px",
                borderBottom: "1px solid #f0f0f0",
                textAlign: "center",
                background: isToday ? "#fde8ef" : "#fafafa",
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 500, color: isToday ? "#f01563" : "#888", margin: 0 }}>
                {DAY_LABELS[day.getDay()]}
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: isToday ? "#f01563" : "#111", margin: 0 }}>
                {day.getDate()}
              </p>
              <p style={{ fontSize: 9, color: "#bbb", margin: 0 }}>{MONTH_SHORT[day.getMonth()]}</p>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
              {dayEvents.length === 0 && (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
                  <span style={{ fontSize: 10, color: "#e5e5e5" }}>—</span>
                </div>
              )}
              {dayEvents.map((event) => {
                const ext = externalAttendees(event);
                const isInternal = ext.length === 0;
                const time = eventTime(event.start);
                return (
                  <button
                    key={event.id}
                    onClick={() => !isInternal && onSelectEvent(event)}
                    disabled={isInternal}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 8,
                      borderRadius: 8,
                      border: `1px solid ${isInternal ? "#f0f0f0" : "#e5e5e5"}`,
                      background: isInternal ? "#fafafa" : "#fff",
                      opacity: isInternal ? 0.5 : 1,
                      cursor: isInternal ? "default" : "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isInternal) e.currentTarget.style.borderColor = "#f01563";
                    }}
                    onMouseLeave={(e) => {
                      if (!isInternal) e.currentTarget.style.borderColor = "#e5e5e5";
                    }}
                  >
                    {time && <p style={{ fontSize: 9, fontWeight: 600, color: "#f01563", margin: 0, marginBottom: 2 }}>{time}</p>}
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#111", margin: 0, marginBottom: 4, lineHeight: 1.2 }}>
                      {event.title}
                    </p>
                    {!isInternal && (
                      <p style={{ fontSize: 9, color: "#aaa", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ext[0]?.displayName || ext[0]?.email}
                        {ext.length > 1 ? ` +${ext.length - 1}` : ""}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                      {isInternal && (
                        <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 999, background: "#f1f5f9", color: "#475569" }}>
                          Interne
                        </span>
                      )}
                      {event.meetingLink && (
                        <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8" }}>
                          Visio
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
