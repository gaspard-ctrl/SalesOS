"use client";

import * as React from "react";
import Link from "next/link";
import { Target, UserSearch, Radar } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import { useWatchSalesReps, useWatchAccounts } from "@/lib/hooks/use-watchlist";
import { SalesStrip } from "./_components/sales-strip";
import { AccountsTable } from "./_components/accounts-table";

export default function WatchListPage() {
  const { reps, isLoading: repsLoading } = useWatchSalesReps();
  const [selectedRep, setSelectedRep] = React.useState<string | null>(null);
  const { accounts, isLoading: accountsLoading } = useWatchAccounts(selectedRep);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: COLORS.bgPage }}>
      <SalesStrip
        reps={reps}
        selectedRep={selectedRep}
        onSelect={setSelectedRep}
        isLoading={repsLoading}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink0, margin: 0, lineHeight: 1.2 }}>
              Watch List {selectedRep ? `· ${selectedRep}` : ""}
            </h1>
            <p style={{ fontSize: 11, color: COLORS.ink3, margin: 0 }}>
              Comptes ICP, prospects radar et signaux par sales rep.
            </p>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/enrichment"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 8,
                border: `1px solid ${COLORS.brand}`,
                background: COLORS.brand,
                color: "white",
                textDecoration: "none",
              }}
            >
              <UserSearch size={13} /> Trouver des prospects
            </Link>
            <Link
              href="/enrichment?tab=radar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.bgCard,
                color: COLORS.ink1,
                textDecoration: "none",
              }}
            >
              <Radar size={13} /> Mon Radar
            </Link>
            <Link
              href="/watchlist/companies"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 8,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.bgCard,
                color: COLORS.ink1,
                textDecoration: "none",
              }}
            >
              <Target size={13} /> Mes companies
            </Link>
          </div>
        </div>

        <AccountsTable accounts={accounts} isLoading={accountsLoading} />
      </div>
    </div>
  );
}
