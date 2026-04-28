import * as React from "react";
import { COLORS } from "@/lib/design/tokens";

export function StatPill({
  label,
  value,
  trend,
  trendDirection,
  className = "",
  style,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  trend?: React.ReactNode;
  trendDirection?: "up" | "down" | "flat";
  className?: string;
  style?: React.CSSProperties;
}) {
  const trendColor =
    trendDirection === "up"
      ? COLORS.ok
      : trendDirection === "down"
        ? COLORS.err
        : COLORS.ink3;
  return (
    <div className={`ds-stat-pill ${className}`.trim()} style={style}>
      <span className="ds-kpi-label">{label}</span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
        <span className="ds-kpi-num">{value}</span>
        {trend ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: trendColor }}>{trend}</span>
        ) : null}
      </span>
    </div>
  );
}
