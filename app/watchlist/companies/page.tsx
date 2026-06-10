"use client";

import * as React from "react";
import Link from "next/link";
import { Cloud, Sparkles, Building2, List as ListIcon } from "lucide-react";
import { COLORS, SHADOWS } from "@/lib/design/tokens";
import { BoardView } from "./_components/board-view";
import { EnrichWizard } from "./_components/enrich-wizard";
import { NewHubspotCompanyDialog } from "./_components/new-hubspot-company-dialog";
import type { RosterRep } from "@/app/api/intel/admin/sales-reps/route";

export default function WatchlistHubPage() {
  const [showEnrich, setShowEnrich] = React.useState(false);
  const [showNewCompany, setShowNewCompany] = React.useState(false);
  const [reps, setReps] = React.useState<RosterRep[]>([]);

  React.useEffect(() => {
    fetch("/api/intel/admin/sales-reps?withCounts=1")
      .then((r) => r.json())
      .then((j) => setReps(j.reps ?? []))
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: COLORS.bgPage }}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          height: 56,
          padding: "0 18px",
          borderBottom: `1px solid ${COLORS.line}`,
          background: COLORS.bgCard,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink0, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>Watch List</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 9, alignItems: "center" }}>
          <Link href="/watchlist/companies/manage" style={ghostBtnSm()}>
            <Cloud size={14} /> HubSpot Sourcing
          </Link>
          <button type="button" onClick={() => setShowNewCompany(true)} style={ghostBtnSm()}>
            <Building2 size={14} /> New company
          </button>
          <button type="button" onClick={() => setShowEnrich(true)} style={primaryBtnSm()}>
            <Sparkles size={14} /> Enrich
          </button>
          <Link href="/watchlist/lists" style={ghostBtnSm()}>
            <ListIcon size={14} /> Lists
          </Link>
        </div>
      </div>

      {/* Board (companies déjà dans la watchlist) */}
      <BoardView />

      {showEnrich && (
        <EnrichWizard
          reps={reps.map((r) => ({ id: r.id, name: r.name }))}
          onClose={() => setShowEnrich(false)}
          onDone={() => {}}
        />
      )}

      {showNewCompany && <NewHubspotCompanyDialog onClose={() => setShowNewCompany(false)} />}
    </div>
  );
}

function ghostBtnSm(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 30,
    padding: "0 11px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    border: `1px solid ${COLORS.lineStrong}`,
    background: COLORS.bgCard,
    color: COLORS.ink0,
    textDecoration: "none",
    cursor: "pointer",
  };
}

function primaryBtnSm(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 30,
    padding: "0 11px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    background: COLORS.brand,
    color: "#fff",
    boxShadow: SHADOWS.pink,
    cursor: "pointer",
  };
}
