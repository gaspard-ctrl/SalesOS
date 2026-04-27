"use client";

import { Search, AlertCircle, CheckCircle2, Loader2, CircleDashed, CircleSlash, User, Building2 } from "lucide-react";
import type { MeetingParticipant, SalesCoachListItem, SalesCoachStatus } from "@/lib/hooks/use-sales-coach";
import { MEETING_KIND_LABELS } from "@/lib/guides/sales-coach";
import { companyFromEmail } from "@/lib/claap";

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

function scoreColor(score: number | null): { bg: string; fg: string } {
  if (score === null || score === undefined) return { bg: "#f5f5f5", fg: "#888" };
  if (score >= 7.5) return { bg: "#ecfdf5", fg: "#059669" };
  if (score >= 5) return { bg: "#fef3c7", fg: "#b45309" };
  return { bg: "#fee2e2", fg: "#dc2626" };
}

function StatusIcon({ status }: { status: SalesCoachStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 size={14} style={{ color: "#059669" }} />;
    case "analyzing":
      return <Loader2 size={14} style={{ color: "#2563eb" }} className="animate-spin" />;
    case "pending":
      return <CircleDashed size={14} style={{ color: "#888" }} />;
    case "error":
      return <AlertCircle size={14} style={{ color: "#dc2626" }} />;
    case "skipped":
      return <CircleSlash size={14} style={{ color: "#888" }} />;
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
    <div className="flex flex-col h-full" style={{ background: "#fff", borderRight: "1px solid #eeeeee" }}>
      {/* Search + filter */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "#eeeeee" }}>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#888" }} />
          <input
            type="text"
            placeholder="Chercher un meeting, deal, email…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border outline-none"
            style={{ borderColor: "#e5e5e5", background: "#fafafa" }}
          />
        </div>
        {isAdmin && (
          <div className="flex gap-1 mb-2">
            {(["mine", "all"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onOwnerFilterChange(v)}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{
                  background: ownerFilter === v ? "#f01563" : "transparent",
                  color: ownerFilter === v ? "#fff" : "#666",
                  border: "1px solid " + (ownerFilter === v ? "#f01563" : "#e5e5e5"),
                }}
              >
                {v === "mine" ? "Mes meetings" : "Tous"}
              </button>
            ))}
          </div>
        )}

        {/* Date range filter */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="text-xs px-2 py-1 rounded border outline-none flex-1 min-w-0"
            style={{ borderColor: "#e5e5e5", background: "#fafafa", color: "#333" }}
            title="Date min"
          />
          <span className="text-xs" style={{ color: "#888" }}>→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="text-xs px-2 py-1 rounded border outline-none flex-1 min-w-0"
            style={{ borderColor: "#e5e5e5", background: "#fafafa", color: "#333" }}
            title="Date max"
          />
          {hasDateFilter && (
            <button
              onClick={clearDates}
              className="text-xs px-1.5 py-1 rounded"
              style={{ color: "#888" }}
              title="Effacer les dates"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "#888" }}>
            Aucune analyse pour le moment. Les debriefs apparaîtront ici après chaque meeting Claap.
          </div>
        )}
        {filtered.map((a) => {
          const active = a.id === selectedId;
          const { bg, fg } = scoreColor(a.score_global);
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className="w-full text-left px-4 py-3 border-b transition-colors"
              style={{
                background: active ? "#fef2f4" : "transparent",
                borderColor: "#eeeeee",
                borderLeft: active ? "3px solid #f01563" : "3px solid transparent",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <StatusIcon status={a.status} />
                    <span className="text-sm font-medium truncate" style={{ color: "#111" }}>
                      {a.meeting_title ?? "Meeting sans titre"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs" style={{ color: "#666" }}>
                    {a.meeting_kind && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: "#ede9fe", color: "#6d28d9" }}
                      >
                        {MEETING_KIND_LABELS[a.meeting_kind]}
                      </span>
                    )}
                    <span className="truncate">
                      {formatDate(a.meeting_started_at ?? a.created_at)}
                    </span>
                  </div>
                  {(() => {
                    const primary = pickPrimaryParticipant(a.participants, a.primary_contact);
                    if (!primary) return null;
                    return (
                      <div
                        className="flex items-center gap-1.5 text-xs mt-1 flex-wrap"
                        style={{ color: "#333" }}
                        title={`${primary.name}${primary.company ? ` · ${primary.company}` : ""}${primary.extra > 0 ? ` +${primary.extra}` : ""}`}
                      >
                        <span className="inline-flex items-center gap-1 truncate">
                          <User size={11} className="flex-shrink-0" style={{ color: "#888" }} />
                          <span className="truncate font-medium">{primary.name}</span>
                          {primary.extra > 0 && (
                            <span className="text-[10px]" style={{ color: "#888" }}>+{primary.extra}</span>
                          )}
                        </span>
                        {primary.company && (
                          <span className="inline-flex items-center gap-1 truncate" style={{ color: "#555" }}>
                            <Building2 size={11} className="flex-shrink-0" style={{ color: "#888" }} />
                            <span className="truncate">{primary.company}</span>
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {a.status === "error" && a.error_message && (
                    <div className="text-xs mt-1 truncate" style={{ color: "#dc2626" }}>
                      {a.error_message}
                    </div>
                  )}
                </div>
                {a.status === "done" && a.score_global !== null && (
                  <div
                    className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded"
                    style={{ background: bg, color: fg }}
                  >
                    {a.score_global.toFixed(1)}/10
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
