"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { scoreBadge } from "@/lib/deal-scoring";
import { COLORS } from "@/lib/design/tokens";
import { ListItem } from "@/components/ui/list-item";
import type { Deal, Stage } from "../_helpers";
import { fmt, fmtDate, stageColor, timeAgo } from "../_helpers";

export function DealListGrouped({
  stages,
  dealsByStage,
  selectedId,
  onSelect,
}: {
  stages: Stage[];
  dealsByStage: Record<string, Deal[]>;
  selectedId: string | null;
  onSelect: (d: Deal) => void;
}) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setExpanded((c) => ({ ...c, [id]: !c[id] }));

  return (
    <div
      className="thin-scrollbar"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "8px 12px 16px",
        overflowY: "auto",
        height: "100%",
      }}
    >
      {stages.map((stage, idx) => {
        const items = dealsByStage[stage.id] ?? [];
        const color = stageColor(idx);
        const total = items.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
        const isCollapsed = !expanded[stage.id];
        return (
          <section key={stage.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button
              type="button"
              onClick={() => toggle(stage.id)}
              aria-expanded={!isCollapsed}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 8,
                background: `${color}10`,
                border: "none",
                borderLeft: `3px solid ${color}`,
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isCollapsed ? (
                  <ChevronRight size={12} style={{ color }} />
                ) : (
                  <ChevronDown size={12} style={{ color }} />
                )}
                <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {stage.label}
                </span>
                <span style={{ fontSize: 10, color: COLORS.ink3 }}>
                  {items.length} deal{items.length > 1 ? "s" : ""}
                </span>
              </div>
              <span style={{ fontSize: 11, color: COLORS.ink2, fontWeight: 600 }}>
                {(total / 1000).toFixed(0)}k€
              </span>
            </button>
            {!isCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {items.length === 0 && (
                <div style={{ fontSize: 11, color: COLORS.ink4, fontStyle: "italic", padding: "6px 10px" }}>
                  Aucun deal
                </div>
              )}
              {items.map((d) => {
                const ref = d.lastContacted || d.lastModified;
                const badge = d.score ? scoreBadge(d.score.total) : null;
                return (
                  <ListItem
                    key={d.id}
                    active={d.id === selectedId}
                    onClick={() => onSelect(d)}
                    right={
                      d.score && badge ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 999,
                            background: badge.bg,
                            color: badge.color,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {d.score.total}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: COLORS.ink4, fontStyle: "italic" }}>—</span>
                      )
                    }
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: COLORS.ink0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {d.dealname || "Sans nom"}
                      </span>
                      <span style={{ fontSize: 10, color: COLORS.ink3 }}>
                        {fmt(d.amount)}
                        {d.closedate ? ` · ${fmtDate(d.closedate)}` : ""}
                        {ref ? ` · ${timeAgo(ref)}` : ""}
                      </span>
                    </div>
                  </ListItem>
                );
              })}
            </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
