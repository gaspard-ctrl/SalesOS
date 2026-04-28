"use client";

import { ThumbsUp, AlertTriangle, GitBranch, HelpCircle, Flag, Handshake } from "lucide-react";
import type { KeyMoment, KeyMomentKind } from "@/lib/guides/sales-coach";
import { KEY_MOMENT_LABELS } from "@/lib/guides/sales-coach";

const KIND_STYLES: Record<KeyMomentKind, { icon: typeof ThumbsUp; color: string; bg: string }> = {
  engagement: { icon: ThumbsUp, color: "#059669", bg: "#ecfdf5" },
  objection: { icon: AlertTriangle, color: "#dc2626", bg: "#fee2e2" },
  pivot: { icon: GitBranch, color: "#6d28d9", bg: "#ede9fe" },
  doubt: { icon: HelpCircle, color: "#b45309", bg: "#fef3c7" },
  next_step: { icon: Flag, color: "#1e40af", bg: "#dbeafe" },
  concession: { icon: Handshake, color: "#374151", bg: "#f3f4f6" },
};

function formatTimestamp(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function KeyMoments({ moments }: { moments: KeyMoment[] }) {
  if (!moments || moments.length === 0) return null;

  const sorted = [...moments].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

  return (
    <div className="space-y-2">
      {sorted.map((m, i) => {
        const style = KIND_STYLES[m.kind] ?? KIND_STYLES.engagement;
        const Icon = style.icon;
        return (
          <div key={i} className="flex items-start gap-3 py-2.5 px-3 rounded-lg" style={{ background: "#fff" }}>
            <span
              className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full"
              style={{ background: style.bg, color: style.color }}
            >
              <Icon size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xs font-semibold tabular-nums" style={{ color: "#888" }}>
                  {formatTimestamp(m.timestamp_seconds)}
                </span>
                <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: style.color }}>
                  {KEY_MOMENT_LABELS[m.kind]}
                </span>
              </div>
              <p className="text-sm" style={{ color: "#222", lineHeight: 1.5 }}>{m.label}</p>
              {m.quote && (
                <p className="text-xs mt-1 italic" style={{ color: "#777" }}>« {m.quote} »</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
