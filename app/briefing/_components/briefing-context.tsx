"use client";

import * as React from "react";
import { COLORS } from "@/lib/design/tokens";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MarkdownBlock } from "./markdown";
import type { BriefingResult, DealQualification } from "../_helpers";

const QUAL_FIELDS: { key: keyof DealQualification; label: string }[] = [
  { key: "budget", label: "Budget" },
  { key: "estimatedBudget", label: "Budget estimé" },
  { key: "authority", label: "Autorité (décisionnaire)" },
  { key: "need", label: "Besoin" },
  { key: "champion", label: "Champion interne" },
  { key: "needDetailed", label: "Besoin détaillé" },
  { key: "timeline", label: "Timeline" },
  { key: "strategicFit", label: "Fit stratégique" },
];

export function BriefingContext({ briefing }: { briefing: BriefingResult }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {briefing.contextSummary && (
        <Card padding={16}>
          <SectionHeader title="Contexte" />
          <MarkdownBlock text={briefing.contextSummary} />
        </Card>
      )}

      {briefing.isSalesMeeting !== false && briefing.dealQualification && (() => {
        const known = QUAL_FIELDS.filter((f) => !!briefing.dealQualification![f.key]);
        const missing = QUAL_FIELDS.filter((f) => !briefing.dealQualification![f.key]);
        return (
          <Card padding={16}>
            <SectionHeader
              title={`Qualification deal — ${known.length}/${QUAL_FIELDS.length}`}
            />
            <div style={{ marginBottom: 12 }}>
              <ProgressBar
                value={(known.length / QUAL_FIELDS.length) * 100}
                max={100}
                height={4}
                variant={known.length === QUAL_FIELDS.length ? "ok" : "brand"}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {known.map((f) => (
                <div key={f.key} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: COLORS.ok,
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink2, margin: 0 }}>{f.label}</p>
                    <p style={{ fontSize: 12, color: COLORS.ink0, margin: 0, lineHeight: 1.5 }}>
                      {briefing.dealQualification![f.key]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {missing.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink3, marginBottom: 6, marginTop: 0 }}>
                  À collecter
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {missing.map((f) => (
                    <span
                      key={f.key}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: `1px solid #fecaca`,
                        background: COLORS.bgCard,
                        color: COLORS.err,
                      }}
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {briefing.nextStep && (
        <Card padding={16} style={{ background: COLORS.okBg, borderColor: COLORS.okBg }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: COLORS.ok,
              margin: 0,
              marginBottom: 4,
            }}
          >
            Prochaine étape
          </p>
          <p style={{ fontSize: 13, color: "#15803d", margin: 0, lineHeight: 1.5 }}>{briefing.nextStep}</p>
        </Card>
      )}
    </div>
  );
}
