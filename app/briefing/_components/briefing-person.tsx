"use client";

import * as React from "react";
import { Linkedin } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { LinkedInEnrich } from "@/components/linkedin-enrich";
import type { BriefingResult } from "../_helpers";

// L'enrichissement LinkedIn de l'interlocuteur se fait À LA DEMANDE (bouton),
// pas automatiquement (économie de crédits Bright Data). La société est passée
// pour cibler le bon profil (sinon picker en cas d'homonymes).
export function BriefingPerson({ briefing }: { briefing: BriefingResult }) {
  const name = briefing.identity?.name?.trim();
  if (!name) return null;

  const parts = name.split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  const company = briefing.identity?.company ?? "";

  return (
    <Card padding={16}>
      <SectionHeader
        title="Interlocuteur"
        right={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#1d4ed8" }}>
            <Linkedin size={11} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>LinkedIn</span>
          </span>
        }
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink0, margin: 0 }}>{name}</p>
          {briefing.identity?.role && (
            <p style={{ fontSize: 12, color: "#1d4ed8", margin: 0 }}>
              {briefing.identity.role}
              {company ? ` @ ${company}` : ""}
            </p>
          )}
        </div>
        <LinkedInEnrich firstName={firstName} lastName={lastName} company={company} />
      </div>
    </Card>
  );
}
