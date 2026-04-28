import * as React from "react";
import { scoreToColor } from "@/lib/design/tokens";

export function ScoreBadge({
  value,
  scale = 100,
  size = "md",
}: {
  value: number | null | undefined;
  scale?: 10 | 100;
  size?: "sm" | "md" | "lg";
}) {
  const { fg, bg } = scoreToColor(value ?? null, scale);
  const display =
    value === null || value === undefined || Number.isNaN(value)
      ? "—"
      : scale === 10
        ? value.toFixed(1)
        : Math.round(value).toString();
  const py = size === "sm" ? 1 : size === "lg" ? 4 : 2;
  const px = size === "sm" ? 6 : size === "lg" ? 12 : 8;
  const fs = size === "sm" ? 10 : size === "lg" ? 14 : 12;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${py}px ${px}px`,
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: fs,
        fontWeight: 600,
        lineHeight: 1.2,
      }}
    >
      {display}
      <span style={{ opacity: 0.7, marginLeft: 2 }}>/{scale}</span>
    </span>
  );
}

export function ScoreDot({
  value,
  scale = 100,
  size = 8,
}: {
  value: number | null | undefined;
  scale?: 10 | 100;
  size?: number;
}) {
  const { fg } = scoreToColor(value ?? null, scale);
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: fg,
      }}
    />
  );
}
