"use client";

import { Loader2 } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import type { JobProgress } from "@/lib/orgchart/types";

// Affiche l'avancée d'un job : label de phase + barre (done/total) ou spinner.
export function JobProgressView({ progress, fallback }: { progress?: JobProgress | null; fallback?: string }) {
  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "22px 0" }}>
      <Loader2 size={28} className="animate-spin" style={{ color: COLORS.brand }} />
      <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink0, textAlign: "center" }}>
        {progress?.label || fallback || "Working…"}
      </div>
      {pct != null && (
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ height: 8, borderRadius: 999, background: COLORS.line, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: COLORS.brand, transition: "width .25s" }} />
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4, textAlign: "center" }}>
            {done} / {total}
          </div>
        </div>
      )}
    </div>
  );
}
