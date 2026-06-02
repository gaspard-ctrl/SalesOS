"use client";

import * as React from "react";
import { Radio, ExternalLink, Sparkles } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import { BriefSection } from "./brief-section";
import type { BriefRow, NewsContent, NewsSignalSnapshot } from "@/lib/watchlist/briefs";

// Catégorie de signal → libellé + couleur du badge.
const SIGNAL_META: Record<string, { label: string; fg: string; bg: string }> = {
  funding: { label: "Levée", fg: COLORS.ok, bg: COLORS.okBg },
  acquisition: { label: "M&A", fg: COLORS.info, bg: COLORS.infoBg },
  leadership: { label: "Direction", fg: COLORS.info, bg: COLORS.infoBg },
  product: { label: "Produit", fg: COLORS.brand, bg: COLORS.brandTint },
  partnership: { label: "Partenariat", fg: COLORS.brand, bg: COLORS.brandTint },
  expansion: { label: "Expansion", fg: COLORS.ok, bg: COLORS.okBg },
  risk: { label: "Risque", fg: COLORS.warn, bg: COLORS.warnBg },
  other: { label: "Autre", fg: COLORS.ink2, bg: COLORS.bgSoft },
};

function signalMeta(type: string) {
  return SIGNAL_META[type] ?? SIGNAL_META.other;
}

export function NewsCard({
  brief,
  onRefresh,
  isRefreshing = false,
  clientError = null,
}: {
  brief: BriefRow<NewsContent> | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  clientError?: string | null;
}) {
  const baseStatus = brief?.status ?? "idle";
  const status = isRefreshing && baseStatus !== "running" ? "running" : baseStatus;
  const content = brief?.content ?? null;

  return (
    <BriefSection
      title="News"
      icon={<Radio size={14} />}
      status={clientError && status !== "running" ? "error" : status}
      completedAt={brief?.completed_at ?? null}
      error={clientError ?? brief?.error ?? null}
      onRefresh={onRefresh}
      disabled={isRefreshing}
    >
      {status === "ok" && content ? (
        <div>
          {content.intel_summary && (
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: COLORS.brandTintSoft,
                border: `1px solid ${COLORS.brandTint}`,
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              <Sparkles size={14} style={{ color: COLORS.brand, flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 12, color: COLORS.ink1, lineHeight: 1.5 }}>{content.intel_summary}</p>
            </div>
          )}

          {content.signals.length > 0 && (
            <>
              <h4 style={sectionTitle()}>Signaux marché ({content.signals.length})</h4>
              <ul style={list()}>
                {content.signals.slice(0, 10).map((s, i) => (
                  <SignalItem key={s.id || i} signal={s} />
                ))}
              </ul>
            </>
          )}

          <h4 style={sectionTitle()}>Posts LinkedIn ({content.posts.length})</h4>
          {content.posts.length === 0 ? (
            <p style={empty()}>Aucun post récent.</p>
          ) : (
            <ul style={list()}>
              {content.posts.slice(0, 8).map((p, i) => (
                <li key={i} style={listItem()}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: COLORS.ink3 }}>
                      {new Date(p.postedAt).toLocaleDateString("fr-FR")}
                    </span>
                    <span style={{ fontSize: 10, color: COLORS.ink3 }}>
                      ♡ {p.likes} · 💬 {p.comments}
                    </span>
                    <a
                      href={p.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginLeft: "auto", color: "#0a66c2", display: "inline-flex" }}
                    >
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: COLORS.ink1, lineHeight: 1.5 }}>
                    {p.text.slice(0, 280)}
                    {p.text.length > 280 ? "…" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: COLORS.ink3 }}>
          Pas encore de veille pour cette company. Clique sur <strong>Générer</strong> en haut à droite : on récupère les
          posts LinkedIn et on lance une veille marché Bright Data (presse, signaux d&apos;achat) synthétisée par l&apos;IA.
        </p>
      )}
    </BriefSection>
  );
}

function SignalItem({ signal }: { signal: NewsSignalSnapshot }) {
  const meta = signalMeta(signal.type);
  return (
    <li style={listItem()}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: meta.fg,
            background: meta.bg,
            padding: "1px 6px",
            borderRadius: 4,
          }}
        >
          {meta.label}
        </span>
        {signal.created_at && <span style={{ fontSize: 10, color: COLORS.ink3 }}>{signal.created_at}</span>}
        {signal.url && (
          <a
            href={signal.url}
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: "auto", color: "#0a66c2", display: "inline-flex" }}
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: COLORS.ink0, lineHeight: 1.4 }}>{signal.title}</p>
      {signal.excerpt && (
        <p style={{ margin: "3px 0 0", fontSize: 11, color: COLORS.ink2, lineHeight: 1.5 }}>{signal.excerpt}</p>
      )}
    </li>
  );
}

function sectionTitle(): React.CSSProperties {
  return {
    margin: "12px 0 6px",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: COLORS.ink3,
  };
}
function empty(): React.CSSProperties {
  return { margin: 0, fontSize: 11, color: COLORS.ink3 };
}
function list(): React.CSSProperties {
  return { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 };
}
function listItem(): React.CSSProperties {
  return {
    padding: "8px 10px",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 8,
    background: COLORS.bgCard,
  };
}
