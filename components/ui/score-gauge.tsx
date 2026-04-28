import * as React from "react";
import { COLORS, scoreToColor } from "@/lib/design/tokens";

type Size = 48 | 64 | 72 | 96 | 120;

export function ScoreGauge({
  value,
  scale = 100,
  size = 72,
  label,
  sublabel,
  ariaLabel,
}: {
  value: number | null | undefined;
  scale?: 10 | 100;
  size?: Size;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  ariaLabel?: string;
}) {
  const stroke = size <= 64 ? 5 : size <= 96 ? 7 : 9;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const norm =
    value === null || value === undefined || Number.isNaN(value)
      ? 0
      : Math.max(0, Math.min(1, value / scale));
  const dash = circ * norm;
  const { fg } = scoreToColor(value ?? 0, scale);
  const display =
    value === null || value === undefined || Number.isNaN(value)
      ? "—"
      : scale === 10
        ? value.toFixed(1)
        : Math.round(value).toString();

  const fontSize = size <= 64 ? 14 : size <= 96 ? 18 : 24;
  const labelFs = size <= 64 ? 9 : size <= 96 ? 11 : 12;

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `Score ${display}/${scale}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 12 }}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={COLORS.line}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={fg}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize,
            fontWeight: 700,
            color: COLORS.ink0,
            letterSpacing: "-0.02em",
          }}
        >
          {display}
        </div>
      </div>
      {(label || sublabel) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {label && (
            <span style={{ fontSize: labelFs + 2, fontWeight: 600, color: COLORS.ink0 }}>
              {label}
            </span>
          )}
          {sublabel && (
            <span style={{ fontSize: labelFs, color: COLORS.ink2 }}>{sublabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
