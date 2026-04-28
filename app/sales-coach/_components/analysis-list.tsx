"use client";

import { Search, AlertCircle, CheckCircle2, Loader2, CircleDashed, CircleSlash } from "lucide-react";
import type { MeetingParticipant, SalesCoachListItem, SalesCoachStatus } from "@/lib/hooks/use-sales-coach";
import { MEETING_KIND_LABELS } from "@/lib/guides/sales-coach";
import { companyFromEmail } from "@/lib/claap";
import { COLORS, scoreToColor } from "@/lib/design/tokens";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { ListItem } from "@/components/ui/list-item";

function pickPrimaryParticipant(
  participants: MeetingParticipant[] | null | undefined,
  fallback: { name: string; email: string } | null | undefined,
): { name: string; company: string | null; extra: number } | null {
  if (participants && participants.length > 0) {
    const primary = participants[0];
    const name = primary.name?.trim() || primary.email.split("@")[0];
    if (name) {
      return {
        name,
        company: companyFromEmail(primary.email),
        extra: Math.max(0, participants.length - 1),
      };
    }
  }
  if (fallback && (fallback.name || fallback.email)) {
    const name = fallback.name || fallback.email.split("@")[0];
    return {
      name,
      company: companyFromEmail(fallback.email),
      extra: 0,
    };
  }
  return null;
}

interface Props {
  analyses: SalesCoachListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isAdmin: boolean;
  ownerFilter: "mine" | "all";
  onOwnerFilterChange: (v: "mine" | "all") => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}

function StatusIcon({ status }: { status: SalesCoachStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 size={12} style={{ color: COLORS.ok }} />;
    case "analyzing":
      return <Loader2 size={12} style={{ color: "#2563eb" }} className="animate-spin" />;
    case "pending":
      return <CircleDashed size={12} style={{ color: COLORS.ink3 }} />;
    case "error":
      return <AlertCircle size={12} style={{ color: COLORS.err }} />;
    case "skipped":
      return <CircleSlash size={12} style={{ color: COLORS.ink3 }} />;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AnalysisList({
  analyses,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  isAdmin,
  ownerFilter,
  onOwnerFilterChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: Props) {
  const hasDateFilter = Boolean(dateFrom || dateTo);
  function clearDates() {
    onDateFromChange("");
    onDateToChange("");
  }
  const filtered = searchQuery
    ? analyses.filter((a) => {
        const q = searchQuery.toLowerCase();
        return (
          (a.meeting_title ?? "").toLowerCase().includes(q) ||
          (a.hubspot_deal_id ?? "").toLowerCase().includes(q) ||
          (a.recorder_email ?? "").toLowerCase().includes(q)
        );
      })
    : analyses;

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: COLORS.bgCard, borderRight: `1px solid ${COLORS.line}` }}
    >
      {/* Search + filter */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.line}` }}>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: COLORS.ink3,
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Chercher un meeting…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: 32,
              paddingRight: 12,
              paddingTop: 7,
              paddingBottom: 7,
              fontSize: 13,
              borderRadius: 8,
              border: `1px solid ${COLORS.line}`,
              background: COLORS.bgSoft,
              outline: "none",
              color: COLORS.ink0,
            }}
          />
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {(["mine", "all"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onOwnerFilterChange(v)}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: ownerFilter === v ? COLORS.brand : "transparent",
                  color: ownerFilter === v ? "#fff" : COLORS.ink2,
                  border: `1px solid ${ownerFilter === v ? COLORS.brand : COLORS.lineStrong}`,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {v === "mine" ? "Mes meetings" : "Tous"}
              </button>
            ))}
          </div>
        )}

        {/* Date range filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            style={{
              fontSize: 11,
              padding: "5px 8px",
              borderRadius: 6,
              border: `1px solid ${COLORS.line}`,
              background: COLORS.bgSoft,
              color: COLORS.ink1,
              outline: "none",
              flex: 1,
              minWidth: 0,
            }}
            title="Date min"
          />
          <span style={{ fontSize: 11, color: COLORS.ink3 }}>→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            style={{
              fontSize: 11,
              padding: "5px 8px",
              borderRadius: 6,
              border: `1px solid ${COLORS.line}`,
              background: COLORS.bgSoft,
              color: COLORS.ink1,
              outline: "none",
              flex: 1,
              minWidth: 0,
            }}
            title="Date max"
          />
          {hasDateFilter && (
            <button
              onClick={clearDates}
              style={{
                fontSize: 11,
                padding: "4px 6px",
                color: COLORS.ink3,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              title="Effacer les dates"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: COLORS.ink3 }}>
            Aucune analyse pour le moment. Les debriefs apparaîtront ici après chaque meeting Claap.
          </div>
        )}
        {filtered.map((a) => {
          const active = a.id === selectedId;
          const score = typeof a.score_global === "number" ? a.score_global : null;
          const sc = scoreToColor(score, 10);
          const primary = pickPrimaryParticipant(a.participants, a.primary_contact);
          const dateStr = formatDate(a.meeting_started_at ?? a.created_at);
          const kindLabel = a.meeting_kind ? MEETING_KIND_LABELS[a.meeting_kind] : null;

          return (
            <ListItem
              key={a.id}
              active={active}
              onClick={() => onSelect(a.id)}
              left={
                primary ? (
                  <CompanyAvatar name={primary.company || primary.name} size={32} rounded="md" />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: COLORS.bgSoft,
                    }}
                  />
                )
              }
              right={
                a.status === "done" && score !== null ? (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: sc.fg,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {score.toFixed(1)}
                  </span>
                ) : (
                  <StatusIcon status={a.status} />
                )
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: COLORS.ink0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {primary ? primary.name : a.meeting_title ?? "Meeting sans titre"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: COLORS.ink3,
                    flexWrap: "wrap",
                  }}
                >
                  {kindLabel && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "1px 6px",
                        borderRadius: 999,
                        background: COLORS.infoBg,
                        color: COLORS.info,
                      }}
                    >
                      {kindLabel}
                    </span>
                  )}
                  {primary?.company && <span>{primary.company}</span>}
                  {dateStr && (
                    <>
                      {primary?.company && <span>·</span>}
                      <span>{dateStr}</span>
                    </>
                  )}
                </div>
                {a.status === "error" && a.error_message && (
                  <div
                    style={{
                      fontSize: 11,
                      color: COLORS.err,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.error_message}
                  </div>
                )}
              </div>
            </ListItem>
          );
        })}
      </div>
    </div>
  );
}
