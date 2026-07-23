"use client";

/**
 * "What's on the Notion" : explorateur en arbre de la base de connaissance
 * Coachello (🧭 DATABASE). Branches dépliables, chargées à la volée via
 * GET /api/notion/tree (lecture seule), liens cliquables vers Notion.
 */

import * as React from "react";
import { X, ChevronRight, Loader2, ExternalLink, Table2 } from "lucide-react";
import { ToolLogo } from "./tool-logo";
import { COLORS } from "@/lib/design/tokens";

type TreeChild = { id: string; title: string; url: string; kind: "page" | "database" };

function TreeNode({ node, depth }: { node: TreeChild; depth: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const [children, setChildren] = React.useState<TreeChild[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (!next || children !== null || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/notion/tree?id=${node.id}&kind=${node.kind}`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setChildren(data.children ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setChildren(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div
        className="group hover:bg-black/5"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          paddingLeft: 8 + depth * 18,
          borderRadius: 8,
          cursor: "pointer",
        }}
        onClick={toggle}
      >
        <ChevronRight
          size={13}
          style={{
            color: COLORS.ink5,
            flexShrink: 0,
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
        {node.kind === "database" && <Table2 size={13} style={{ color: COLORS.brand, flexShrink: 0 }} />}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            color: COLORS.ink0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.title}
        </span>
        {loading && <Loader2 size={13} className="animate-spin" style={{ color: COLORS.ink5, flexShrink: 0 }} />}
        <a
          href={node.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Ouvrir "${node.title}" dans Notion`}
          className="opacity-0 group-hover:opacity-100"
          style={{ color: COLORS.ink4, display: "inline-flex", flexShrink: 0, transition: "opacity 0.15s" }}
        >
          <ExternalLink size={13} />
        </a>
      </div>
      {expanded && error && (
        <p style={{ fontSize: 12, color: "#c2410c", margin: "2px 0 4px", paddingLeft: 8 + (depth + 1) * 18 }}>
          {error}
        </p>
      )}
      {expanded && children !== null && children.length === 0 && (
        <p style={{ fontSize: 12, color: COLORS.ink5, margin: "2px 0 4px", paddingLeft: 8 + (depth + 1) * 18 }}>
          (aucune sous-page)
        </p>
      )}
      {expanded && children !== null && children.map((c) => (
        <TreeNode key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export function NotionTreeModal({ onClose }: { onClose: () => void }) {
  const [roots, setRoots] = React.useState<TreeChild[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/notion/tree")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        if (!cancelled) setRoots(data.children ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(26,22,19,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "78vh",
          background: COLORS.bgCard,
          borderRadius: 16,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 20px 60px rgba(26,22,19,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: `1px solid ${COLORS.line}`,
          }}
        >
          <ToolLogo logo="notion" size={18} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink0 }}>What&apos;s on the Notion</div>
            <div style={{ fontSize: 11.5, color: COLORS.ink4 }}>
              La base de connaissance Coachello (🧭 DATABASE) · lecture seule · déplie les branches
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: COLORS.ink4,
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px 14px" }}>
          {roots === null && !error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", color: COLORS.ink4, fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" />
              Lecture de la base Notion…
            </div>
          )}
          {error && (
            <p style={{ fontSize: 13, color: "#c2410c", padding: "10px 12px", margin: 0 }}>{error}</p>
          )}
          {roots !== null && roots.length === 0 && (
            <p style={{ fontSize: 13, color: COLORS.ink5, padding: "10px 12px", margin: 0 }}>
              Aucune page trouvée sous 🧭 DATABASE. Vérifie que l&apos;intégration Notion est bien partagée sur la page.
            </p>
          )}
          {roots?.map((r) => <TreeNode key={r.id} node={r} depth={0} />)}
        </div>
      </div>
    </div>
  );
}
