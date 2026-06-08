"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Cloud } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import { AttributionView } from "../_components/attribution-view";

export default function WatchlistManagePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: COLORS.bgPage }}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "10px 16px",
          borderBottom: `1px solid ${COLORS.line}`,
          background: COLORS.bgCard,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/watchlist/companies"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: `1px solid ${COLORS.line}`,
            background: COLORS.bgCard,
            color: COLORS.ink1,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={13} /> Back to board
        </Link>

        <h1 style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: COLORS.ink0, margin: 0, lineHeight: 1.2 }}>
          <Cloud size={16} style={{ color: COLORS.ink3 }} /> HubSpot Sourcing
        </h1>
      </div>

      {/* Recherche + attribution HubSpot */}
      <AttributionView />
    </div>
  );
}
