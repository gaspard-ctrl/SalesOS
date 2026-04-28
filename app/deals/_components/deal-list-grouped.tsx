"use client";

import * as React from "react";
import { scoreBadge } from "@/lib/deal-scoring";
import { COLORS } from "@/lib/design/tokens";
import { CompanyAvatar } from "@/components/ui/company-avatar";
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
  return (
    <div
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
        if (items.length === 0) return null;
        const color = stageColor(idx);
        const total = items.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
        return (
          <section key={stage.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 8,
                background: `${color}10`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            </header>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {items.map((d) => {
                const ref = d.lastContacted || d.lastModified;
                const badge = d.score ? scoreBadge(d.score.total) : null;
                return (
                  <ListItem
                    key={d.id}
                    active={d.id === selectedId}
                    onClick={() => onSelect(d)}
                    left={
                      <CompanyAvatar
                        name={d.dealname.split("—")[0]?.trim() || d.dealname}
                        size={28}
                        rounded="md"
                      />
                    }
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
          </section>
        );
      })}
    </div>
  );
}
