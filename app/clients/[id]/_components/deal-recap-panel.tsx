"use client";

import { Sparkles, AlertTriangle, ShieldCheck, Zap, MessageSquare } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import type { DealRecap, ClientFieldSource } from "@/lib/clients/types";

function renderSourceLabel(source: ClientFieldSource | null | undefined): string {
  if (!source) return "";
  if (source.kind === "claap") return source.recordingId ? `claap · ${source.recordingId}` : "claap";
  if (source.kind === "hubspot") return source.id ? `hubspot · ${source.entity} · ${source.id}` : `hubspot · ${source.entity}`;
  if (source.kind === "inferred") return "inféré";
  return "";
}

function fmtWhen(when: string | null | undefined): string {
  if (!when) return "";
  // Si c'est une ISO date, on la formate
  const d = new Date(when);
  if (!Number.isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}/.test(when)) {
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }
  return when;
}

function BulletList({
  items,
  icon: Icon,
  color,
  emptyLabel,
}: {
  items: string[] | undefined;
  icon: typeof Sparkles;
  color: string;
  emptyLabel: string;
}) {
  if (!items || items.length === 0) {
    return <div style={{ fontSize: 12, color: COLORS.ink4, fontStyle: "italic" }}>{emptyLabel}</div>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: COLORS.ink0, lineHeight: 1.5 }}>
          <Icon size={13} style={{ color, marginTop: 3, flexShrink: 0 }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function DealRecapPanel({ recap }: { recap: DealRecap | null }) {
  if (!recap) {
    return (
      <div
        style={{
          background: COLORS.bgCard,
          border: `1px dashed ${COLORS.lineStrong}`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Sparkles size={14} style={{ color: COLORS.ink3 }} />
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink2 }}>Recap deal IA</h3>
          <span
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 4,
              background: COLORS.bgSoft,
              color: COLORS.ink3,
              fontWeight: 600,
            }}
          >
            pas encore généré
          </span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.ink3, lineHeight: 1.5 }}>
          Sera généré au prochain enrichissement IA — comment ce deal a été signé en
          3-5 moments clés, objections, leviers, promesses sales et risques d&apos;onboarding.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${COLORS.line}`,
          background: COLORS.bgSoft,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Sparkles size={14} style={{ color: COLORS.brand }} />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink0 }}>Recap deal IA</h3>
        {recap.generated_at && (
          <span style={{ fontSize: 11, color: COLORS.ink3 }}>
            généré le {new Date(recap.generated_at).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Timeline */}
        {recap.timeline && recap.timeline.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
              Timeline du deal
            </div>
            <div style={{ position: "relative", paddingLeft: 16 }}>
              <div
                style={{
                  position: "absolute",
                  left: 5,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  background: COLORS.line,
                }}
              />
              {recap.timeline.map((t, i) => (
                <div key={i} style={{ position: "relative", paddingBottom: 12 }}>
                  <span
                    style={{
                      position: "absolute",
                      left: -16,
                      top: 4,
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: COLORS.brand,
                      border: `2px solid ${COLORS.bgCard}`,
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink0 }}>{t.title}</span>
                    {t.when && <span style={{ fontSize: 11, color: COLORS.ink3 }}>{fmtWhen(t.when)}</span>}
                    {t.source && (
                      <span style={{ fontSize: 10, color: COLORS.ink4, fontFamily: "monospace" }}>
                        {renderSourceLabel(t.source)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.ink1, lineHeight: 1.5, marginTop: 2 }}>
                    {t.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How closed */}
        {recap.how_closed && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              Comment il a basculé
            </div>
            <div style={{ fontSize: 13, color: COLORS.ink0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {recap.how_closed}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              Leviers déclencheurs
            </div>
            <BulletList items={recap.triggers} icon={Zap} color={COLORS.brand} emptyLabel="Aucun levier identifié" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              Objections rencontrées
            </div>
            <BulletList items={recap.objections} icon={MessageSquare} color={COLORS.info} emptyLabel="Aucune objection notable" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              Promesses sales (à respecter)
            </div>
            <BulletList items={recap.sales_promises} icon={ShieldCheck} color={COLORS.ok} emptyLabel="Aucune promesse identifiée" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              Risques d&apos;onboarding
            </div>
            <BulletList items={recap.onboarding_risks} icon={AlertTriangle} color={COLORS.warn} emptyLabel="Aucun risque détecté" />
          </div>
        </div>
      </div>
    </div>
  );
}
