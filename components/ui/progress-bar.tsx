import * as React from "react";
import { COLORS, scoreToColor } from "@/lib/design/tokens";

export function ProgressBar({
  value,
  max = 100,
  height = 6,
  variant = "auto",
  scale,
  trackColor,
  className = "",
}: {
  value: number | null | undefined;
  max?: number;
  height?: 4 | 6 | 8;
  variant?: "auto" | "brand" | "ok" | "warn" | "err" | "neutral";
  scale?: 10 | 100;
  trackColor?: string;
  className?: string;
}) {
  const safe =
    value === null || value === undefined || Number.isNaN(value) ? 0 : Math.max(0, Math.min(max, value));
  const pct = max > 0 ? (safe / max) * 100 : 0;

  let fill: string = COLORS.brand;
  if (variant === "brand") fill = COLORS.brand;
  else if (variant === "ok") fill = COLORS.ok;
  else if (variant === "warn") fill = COLORS.warn;
  else if (variant === "err") fill = COLORS.err;
  else if (variant === "neutral") fill = COLORS.ink3;
  else if (variant === "auto") {
    const inferredScale = scale ?? (max <= 10 ? 10 : 100);
    const scaledValue = inferredScale === 10 ? safe * (10 / max) : safe * (100 / max);
    fill = scoreToColor(scaledValue, inferredScale).fg;
  }

  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={max}
      style={{
        width: "100%",
        height,
        background: trackColor ?? COLORS.line,
        borderRadius: height,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: fill,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}
