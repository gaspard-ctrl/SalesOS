"use client";

import { Newspaper, ExternalLink } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import type { News } from "@/lib/clients/types";

function fmtDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function NewsPanel({ news }: { news: News | null }) {
  if (!news || news.items.length === 0) {
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
          <Newspaper size={14} style={{ color: COLORS.ink3 }} />
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink2 }}>News entreprise</h3>
          {news && (
            <span style={{ fontSize: 11, color: COLORS.ink3 }}>
              cherché le {new Date(news.refreshed_at).toLocaleDateString("fr-FR")}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: COLORS.ink3, lineHeight: 1.5 }}>
          {news
            ? "Pas de news pertinente trouvée sur les 90 derniers jours."
            : "Sera récupéré au prochain enrichissement (via Tavily, recherche sur les 90 derniers jours)."}
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
        <Newspaper size={14} style={{ color: COLORS.ink1 }} />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink0 }}>
          News entreprise ({news.items.length})
        </h3>
        <span style={{ fontSize: 11, color: COLORS.ink3, marginLeft: "auto" }}>
          refresh le {new Date(news.refreshed_at).toLocaleDateString("fr-FR")}
        </span>
      </div>
      <div>
        {news.items.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: "12px 16px",
              borderBottom: `1px solid ${COLORS.line}`,
              textDecoration: "none",
              color: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = COLORS.brandTintSoft;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink0 }}>
                {item.title}
              </span>
              <ExternalLink size={11} style={{ color: COLORS.ink3, flexShrink: 0 }} />
              <span style={{ marginLeft: "auto", fontSize: 11, color: COLORS.ink3 }}>
                {hostFromUrl(item.url)}
                {item.published_at && ` · ${fmtDate(item.published_at)}`}
              </span>
            </div>
            {item.summary && (
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.ink2,
                  marginTop: 4,
                  lineHeight: 1.5,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {item.summary}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
