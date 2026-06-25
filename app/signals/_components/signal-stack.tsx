"use client";

import * as React from "react";
import { ExternalLink, Check, X, Building2, Sparkles, Eye, Linkedin, Newspaper } from "lucide-react";
import { COLORS, RADIUS, SHADOWS, companyAvatarGradient } from "@/lib/design/tokens";
import type { SignalRow } from "@/lib/signals/types";
import type { SignalAction } from "@/lib/hooks/use-signals";

const SWIPE_THRESHOLD = 120;

const CATEGORY_META: Record<string, { label: string; fg: string; bg: string }> = {
  funding: { label: "Funding", fg: COLORS.ok, bg: COLORS.okBg },
  acquisition: { label: "M&A", fg: COLORS.info, bg: COLORS.infoBg },
  expansion: { label: "Expansion", fg: COLORS.ok, bg: COLORS.okBg },
  nomination: { label: "Leadership", fg: COLORS.info, bg: COLORS.infoBg },
  job_change: { label: "New decision-maker", fg: COLORS.info, bg: COLORS.infoBg },
  leadership: { label: "Leadership", fg: COLORS.info, bg: COLORS.infoBg },
  hiring: { label: "Hiring", fg: COLORS.brand, bg: COLORS.brandTint },
  restructuring: { label: "Restructuring", fg: COLORS.warn, bg: COLORS.warnBg },
  linkedin_post: { label: "LinkedIn", fg: COLORS.brand, bg: COLORS.brandTint },
  content: { label: "Content", fg: COLORS.ink2, bg: COLORS.bgSoft },
};

function metaFor(s: SignalRow) {
  return CATEGORY_META[s.category ?? ""] ?? CATEGORY_META[s.signal_type] ?? { label: s.signal_type, fg: COLORS.ink2, bg: COLORS.bgSoft };
}

// Libellé + icône lisibles pour la source brute stockée en base.
const SOURCE_META: Record<string, { label: string; Icon: typeof Building2 }> = {
  brightdata_linkedin: { label: "LinkedIn", Icon: Linkedin },
  brightdata_serp: { label: "News", Icon: Newspaper },
  apollo: { label: "Apollo", Icon: Building2 },
};

function sourceMetaFor(s: SignalRow) {
  return SOURCE_META[s.source] ?? { label: s.source.replace(/_/g, " "), Icon: Building2 };
}

/** Auteur d'un post LinkedIn discovery (stocké dans payload). */
function authorOf(s: SignalRow): string | null {
  if (s.signal_type !== "linkedin_post") return null;
  const a = (s.payload as { author?: { name?: string } } | null)?.author;
  return a?.name?.trim() || null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function SignalStack({
  signals,
  onAction,
}: {
  signals: SignalRow[];
  /**
   * accept -> le parent ouvre la pop-up d'action ; dismiss -> persiste + revalide.
   * Si la résolution est `false` (échec/annulation), la carte revient dans la pile.
   */
  onAction: (signal: SignalRow, action: SignalAction) => boolean | void | Promise<boolean | void>;
}) {
  const [removed, setRemoved] = React.useState<Set<string>>(new Set());
  const [drag, setDrag] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [leaving, setLeaving] = React.useState<null | "left" | "right">(null);
  const startX = React.useRef<number | null>(null);
  const busy = React.useRef(false);

  // Purge du Set `removed` des ids disparus de la liste (signaux réellement
  // traités côté serveur) : évite la fuite mémoire et le masquage permanent d'un
  // id qui resterait 'new' après un échec non réverti.
  React.useEffect(() => {
    setRemoved((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(signals.map((s) => s.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (ids.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [signals]);

  // Liste visible dérivée : on retire localement les cartes déjà traitées
  // (l'animation de sortie joue avant le retrait). Pas de reset d'index nécessaire.
  const visible = React.useMemo(() => signals.filter((s) => !removed.has(s.id)), [signals, removed]);
  const top = visible[0];

  const commit = React.useCallback(
    async (action: SignalAction) => {
      if (!top || busy.current) return;
      busy.current = true;
      const dir = action === "dismiss" ? "left" : "right";
      setLeaving(dir);
      const sig = top;
      // Laisse jouer l'animation de sortie avant de retirer la carte.
      window.setTimeout(async () => {
        setRemoved((prev) => new Set(prev).add(sig.id));
        setDrag(0);
        setLeaving(null);
        startX.current = null;
        busy.current = false;
        const result = await onAction(sig, action);
        // Échec (dismiss raté) ou annulation (pop-up fermée sans agir) : on remet
        // la carte dans la pile.
        if (result === false) {
          setRemoved((prev) => {
            const n = new Set(prev);
            n.delete(sig.id);
            return n;
          });
        }
      }, 220);
    },
    [top, onAction],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving || busy.current) return;
    startX.current = e.clientX;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setDrag(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    const d = drag;
    startX.current = null;
    setDragging(false);
    if (d > SWIPE_THRESHOLD) commit("accept");
    else if (d < -SWIPE_THRESHOLD) commit("dismiss");
    else setDrag(0);
  };

  if (!top) {
    return (
      <div style={{ textAlign: "center", color: COLORS.ink2, fontSize: 13, padding: "40px 0" }}>
        You are all caught up. No more signals in this feed.
      </div>
    );
  }

  // Rendu : carte du haut (draggable) + 2 cartes derrière.
  const behind = visible.slice(1, 3);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 460, margin: "0 auto", height: 460 }}>
      {/* Cartes en arrière-plan (effet pile). */}
      {behind
        .map((s, i) => {
          const depth = i + 1;
          return (
            <div
              key={s.id}
              style={{
                position: "absolute",
                inset: 0,
                transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`,
                opacity: 1 - depth * 0.25,
                zIndex: 1,
              }}
            >
              <SignalCard signal={s} muted />
            </div>
          );
        })
        .reverse()}

      {/* Carte du haut. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          cursor: leaving ? "default" : "grab",
          touchAction: "pan-y",
          transform: leaving
            ? `translateX(${leaving === "right" ? 600 : -600}px) rotate(${leaving === "right" ? 18 : -18}deg)`
            : `translateX(${drag}px) rotate(${drag * 0.04}deg)`,
          transition: dragging ? "none" : "transform 0.22s ease",
        }}
      >
        <SignalCard signal={top} drag={drag} />
      </div>

      {/* Boutons (desktop / accessibilité). */}
      <div
        style={{
          position: "absolute",
          bottom: -64,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 16,
          zIndex: 3,
        }}
      >
        <ActionButton kind="dismiss" onClick={() => commit("dismiss")} />
        <ActionButton kind="accept" onClick={() => commit("accept")} />
      </div>
    </div>
  );
}

function SignalCard({ signal, drag = 0, muted = false }: { signal: SignalRow; drag?: number; muted?: boolean }) {
  const meta = metaFor(signal);
  const grad = companyAvatarGradient(signal.company_name);
  const acceptHint = drag > 40;
  const dismissHint = drag < -40;

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.line}`,
        borderRadius: RADIUS.xl,
        boxShadow: muted ? SHADOWS.card : SHADOWS.pop,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Overlays de décision. */}
      {acceptHint && <DecisionBadge label="ACT" color={COLORS.ok} side="left" />}
      {dismissHint && <DecisionBadge label="SKIP" color={COLORS.err} side="right" />}

      {/* En-tête société. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: RADIUS.md,
            background: grad.background,
            color: grad.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {(signal.company_name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.ink0, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signal.company_name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: meta.fg, background: meta.bg, padding: "2px 8px", borderRadius: 999 }}>
              {meta.label}
            </span>
            {signal.feed === "discovery" ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.brand, background: COLORS.brandTint, padding: "2px 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Sparkles size={11} /> Discovery
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink2, background: COLORS.bgSoft, padding: "2px 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Eye size={11} /> Watchlist
              </span>
            )}
            {signal.signal_date && <span style={{ fontSize: 11, color: COLORS.ink3 }}>{fmtDate(signal.signal_date)}</span>}
          </div>
        </div>
        <ScorePill score={signal.score} />
      </div>

      {/* Titre du signal. */}
      <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink0, lineHeight: 1.35 }}>{signal.title}</div>

      {/* Auteur du post LinkedIn (discovery) : acter l'ajoute à la watchlist + HubSpot. */}
      {authorOf(signal) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.ink2, marginTop: -6 }}>
          <Linkedin size={12} style={{ color: "#0A66C2" }} />
          Post by {authorOf(signal)}
        </div>
      )}

      {/* Résumé / pourquoi. */}
      <div style={{ fontSize: 13, color: COLORS.ink1, lineHeight: 1.5, overflow: "hidden", flex: 1 }}>
        {signal.summary}
        {signal.why_relevant && (
          <div style={{ marginTop: 10, color: COLORS.ink2, fontStyle: "italic" }}>
            Why it matters: {signal.why_relevant}
          </div>
        )}
      </div>

      {/* Pied : source. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.ink3 }}>
        {(() => {
          const sm = sourceMetaFor(signal);
          return (
            <>
              <sm.Icon size={13} style={signal.source === "brightdata_linkedin" ? { color: "#0A66C2" } : undefined} />
              <span>{sm.label}</span>
            </>
          );
        })()}
        {signal.url && (
          <a
            href={signal.url}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            style={{ marginLeft: "auto", color: COLORS.brand, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
          >
            Source <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const fg = score >= 75 ? COLORS.ok : score >= 55 ? COLORS.warn : COLORS.ink3;
  const bg = score >= 75 ? COLORS.okBg : score >= 55 ? COLORS.warnBg : COLORS.bgSoft;
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: fg, background: bg, padding: "4px 9px", borderRadius: 999, flexShrink: 0 }}>
      {score}
    </span>
  );
}

function DecisionBadge({ label, color, side }: { label: string; color: string; side: "left" | "right" }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 18,
        [side]: 18,
        zIndex: 5,
        border: `3px solid ${color}`,
        color,
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: 1,
        padding: "4px 12px",
        borderRadius: 10,
        transform: `rotate(${side === "left" ? -12 : 12}deg)`,
      } as React.CSSProperties}
    >
      {label}
    </div>
  );
}

function ActionButton({ kind, onClick }: { kind: "accept" | "dismiss"; onClick: () => void }) {
  const isAccept = kind === "accept";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isAccept ? "Act on signal" : "Dismiss signal"}
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        border: `1px solid ${isAccept ? COLORS.ok : COLORS.line}`,
        background: COLORS.bgCard,
        color: isAccept ? COLORS.ok : COLORS.err,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: SHADOWS.md,
      }}
    >
      {isAccept ? <Check size={22} /> : <X size={22} />}
    </button>
  );
}
