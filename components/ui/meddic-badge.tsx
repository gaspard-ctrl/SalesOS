import * as React from "react";
import { COLORS } from "@/lib/design/tokens";

const MEDDIC_LABELS: Record<string, string> = {
  metrics: "M",
  economic_buyer: "EB",
  decision_criteria: "DC",
  decision_process: "DP",
  identify_pain: "IP",
  champion: "C",
};

const MEDDIC_COLORS: Record<string, string> = {
  metrics: "#0891b2",
  economic_buyer: "#7c3aed",
  decision_criteria: "#ca8a04",
  decision_process: "#16a34a",
  identify_pain: "#dc2626",
  champion: "#ec4899",
};

const BOSCHE_LABELS: Record<string, string> = {
  business: "B",
  organization: "O",
  skills: "S",
  consequences: "C",
  human_economic: "HE",
};

export type MeddicKey = keyof typeof MEDDIC_LABELS;
export type BoscheKey = keyof typeof BOSCHE_LABELS;

export function MeddicBadge({
  dimension,
  size = 32,
  framework = "meddic",
}: {
  dimension: string;
  size?: number;
  framework?: "meddic" | "bosche";
}) {
  const labels = framework === "bosche" ? BOSCHE_LABELS : MEDDIC_LABELS;
  const letter = labels[dimension.toLowerCase()] ?? dimension.charAt(0).toUpperCase();
  const bg = MEDDIC_COLORS[dimension.toLowerCase()] ?? COLORS.ink2;
  const fontSize = size <= 24 ? 10 : size <= 32 ? 12 : 14;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: "#fff",
        fontSize,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
    >
      {letter}
    </span>
  );
}
