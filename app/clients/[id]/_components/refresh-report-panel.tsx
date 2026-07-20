"use client";

import { useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import { SECTION_DEFINITIONS, type ClientFields, type ClientFieldValue, type RefreshReport, type SectionKey } from "@/lib/clients/types";

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// Rendu texte générique (pas de dépendance au kind du field, contrairement à
// field-display.tsx) : suffisant pour un aperçu dans le dropdown de détail.
function stringifyFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          return String(o.name ?? o.title ?? o.role ?? JSON.stringify(o));
        }
        return String(item);
      })
      .join(", ");
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if ("enabled" in o) return o.enabled ? (o.details ? `Yes — ${String(o.details)}` : "Yes") : "No";
    if ("name" in o) return String(o.name ?? "—");
    return JSON.stringify(o);
  }
  if (typeof value === "string" && !value.trim()) return "—";
  return String(value);
}

export function RefreshReportPanel({
  report,
  fields,
}: {
  report: RefreshReport | null;
  fields: Partial<ClientFields>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!report) return null;

  const before = report.health_before;
  const after = report.health_after;
  const delta = before != null && after != null ? after - before : null;
  const TrendIcon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const trendColor = delta == null || delta === 0 ? COLORS.ink3 : delta > 0 ? COLORS.ok : COLORS.err;

  // Groupe les fields changés par section, dans l'ordre de SECTION_DEFINITIONS,
  // avec leur valeur courante (fields_json est déjà post-refresh à ce stade).
  const changedBySection = SECTION_DEFINITIONS.map((section) => {
    const keys = new Set(report.changed_fields.filter((f) => f.section === section.key).map((f) => f.key));
    if (keys.size === 0) return null;
    const sectionData = (fields[section.key as SectionKey] ?? {}) as Record<string, ClientFieldValue>;
    const rows = section.fields
      .filter((f) => keys.has(f.key))
      .map((f) => ({ label: f.label, value: stringifyFieldValue(sectionData[f.key]?.value ?? null) }));
    return { label: section.label, rows };
  }).filter((s): s is { label: string; rows: { label: string; value: string }[] } => s !== null);

  return (
    <div
      style={{
        background: report.error ? COLORS.errBg : COLORS.bgSoft,
        border: `1px solid ${report.error ? COLORS.err : COLORS.line}`,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        color: COLORS.ink2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <RefreshCw size={13} style={{ color: COLORS.ink3, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: COLORS.ink1 }}>Refreshed on {fmtDateTime(report.refreshed_at)}</span>

        {report.error ? (
          <span style={{ color: COLORS.err }}>· failed: {report.error}</span>
        ) : (
          <>
            <span style={{ color: COLORS.ink3 }}>·</span>
            <span>
              {report.new_activity_count} new {report.new_activity_count > 1 ? "activities" : "activity"}
            </span>

            {before != null && after != null && (
              <>
                <span style={{ color: COLORS.ink3 }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: trendColor }}>
                  <TrendIcon size={13} />
                  health {before} → {after}
                </span>
              </>
            )}

            <span style={{ color: COLORS.ink3 }}>·</span>
            {report.changed_fields.length === 0 ? (
              <span>no field changed</span>
            ) : (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.brand,
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                {report.changed_fields.length} {report.changed_fields.length > 1 ? "fields" : "field"} updated
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </>
        )}
      </div>

      {expanded && changedBySection.length > 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${COLORS.line}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {changedBySection.map((section) => (
            <div key={section.label}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
                {section.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {section.rows.map((row) => (
                  <div key={row.label} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                    <span style={{ color: COLORS.ink2, fontWeight: 600, flexShrink: 0, minWidth: 160 }}>{row.label}</span>
                    <span style={{ color: COLORS.ink0 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
