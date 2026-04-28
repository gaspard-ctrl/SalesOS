"use client";

import * as React from "react";
import { Target } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";

export function BriefingObjective({ objective }: { objective: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 16px",
        background: COLORS.brandTint,
        border: `1px solid ${COLORS.brandTint}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(255,255,255,0.6)",
          color: COLORS.brand,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Target size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: COLORS.brand,
            margin: 0,
            marginBottom: 4,
          }}
        >
          Objectif du meeting
        </p>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#7a0e3a",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {objective}
        </p>
      </div>
    </div>
  );
}
