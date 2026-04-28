import * as React from "react";
import { COLORS } from "@/lib/design/tokens";
import { ScoreBadge } from "./score-badge";
import { ProgressBar } from "./progress-bar";

export function BantCard({
  label,
  value,
  score,
  scoreScale = 100,
  fillRatio,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  score?: number | null;
  scoreScale?: 10 | 100;
  /** Optional 0..1 ratio for the bottom progress bar (defaults to inferred from score). */
  fillRatio?: number | null;
  emphasis?: boolean;
}) {
  const ratio =
    fillRatio ?? (typeof score === "number" ? Math.max(0, Math.min(1, score / scoreScale)) : null);
  return (
    <div
      className="ds-card"
      style={{
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 120,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 700,
            color: COLORS.ink3,
          }}
        >
          {label}
        </span>
        {typeof score === "number" ? <ScoreBadge value={score} scale={scoreScale} size="sm" /> : null}
      </div>
      <div
        style={{
          fontSize: emphasis ? 15 : 13,
          fontWeight: emphasis ? 600 : 500,
          color: COLORS.ink0,
          lineHeight: 1.35,
          flex: 1,
        }}
      >
        {value || <span style={{ color: COLORS.ink4, fontStyle: "italic" }}>—</span>}
      </div>
      {ratio !== null && (
        <ProgressBar value={ratio * 100} max={100} height={4} variant="auto" scale={100} />
      )}
    </div>
  );
}
