"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useSalesCoachList } from "@/lib/hooks/use-sales-coach";
import AnalysisList from "./_components/analysis-list";
import AnalysisDetail from "./_components/analysis-detail";
import { BackfillModal } from "./_components/backfill-modal";

function SalesCoachInner() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");

  const [ownerFilter, setOwnerFilter] = useState<"mine" | "all">("mine");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const { analyses, isAdmin, isLoading, error, reload } = useSalesCoachList(ownerFilter, {
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [searchQuery, setSearchQuery] = useState("");
  const [backfillOpen, setBackfillOpen] = useState(false);

  useEffect(() => {
    if (!selectedId && analyses.length > 0) {
      setSelectedId(analyses[0].id);
    }
  }, [analyses, selectedId]);

  return (
    <div className="flex h-full" style={{ background: "#f8f8f8" }}>
      {/* Left column — list */}
      <div className="w-[300px] flex-shrink-0 flex flex-col">
        <div className="px-4 pt-4 pb-3" style={{ background: "#fff", borderBottom: "1px solid #eeeeee", borderRight: "1px solid #eeeeee" }}>
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold" style={{ color: "#111" }}>Sales Coach</h1>
            <button
              onClick={() => reload()}
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ color: "#f01563" }}
            >
              Rafraîchir
            </button>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#888" }}>
            Debriefs automatiques après chaque meeting Claap lié à un deal.
          </p>
          <button
            onClick={() => setBackfillOpen(true)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md"
            style={{ background: "#fef2f4", color: "#f01563", border: "1px solid #fbd5de" }}
          >
            <Plus size={12} />
            Analyser un meeting passé
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "#888" }}>Chargement…</div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "#dc2626" }}>{error}</div>
          ) : (
            <AnalysisList
              analyses={analyses}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isAdmin={isAdmin}
              ownerFilter={ownerFilter}
              onOwnerFilterChange={setOwnerFilter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
          )}
        </div>
      </div>

      {/* Right column — detail */}
      <div className="flex-1 min-w-0">
        {selectedId ? (
          <AnalysisDetail
            analysisId={selectedId}
            onSlackSent={reload}
            onDeleted={() => {
              setSelectedId(null);
              reload();
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: "#888" }}>
            Sélectionne un meeting pour voir le debrief.
          </div>
        )}
      </div>

      <BackfillModal
        open={backfillOpen}
        onClose={() => setBackfillOpen(false)}
        onAnalysisStarted={(id) => {
          setSelectedId(id);
          reload();
        }}
      />

    </div>
  );
}

export default function SalesCoachPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-sm" style={{ color: "#888" }}>Chargement…</div>}>
      <SalesCoachInner />
    </Suspense>
  );
}
