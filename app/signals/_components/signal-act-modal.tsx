"use client";

import * as React from "react";
import Link from "next/link";
import { X, Loader2, Sparkles, Mail, Send, ArrowRight, CheckCircle2, AlertTriangle, User, Star, ArrowLeft, Building2, Bookmark } from "lucide-react";
import { COLORS, RADIUS, SHADOWS } from "@/lib/design/tokens";
import type { SignalRow, SignalCandidate } from "@/lib/signals/types";

type Phase = "preparing" | "pick" | "drafting" | "review";
const CUSTOM_KEY = "__custom__";

/**
 * Pop-up d'action sur un signal. Étapes :
 *  1. preparing : liste les destinataires possibles (contacts CRM + candidats ICP
 *     Apollo) sans rien dépenser.
 *  2. pick : l'utilisateur CHOISIT qui contacter (plus de destinataire random).
 *  3. drafting : reveal email (Apollo, à la demande) + rédaction signal-aware.
 *  4. review : brouillon éditable + envoi Gmail.
 */
export function SignalActModal({
  signal,
  onClose,
  onActioned,
}: {
  signal: SignalRow;
  /** actioned = true si le signal a été traité (draft/save), false si annulé. */
  onClose: (actioned?: boolean) => void;
  onActioned: () => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("preparing");
  // Trace si le signal a effectivement été traité, pour informer le parent à la
  // fermeture (le feed décide alors de retirer ou de remettre la carte).
  const actionedRef = React.useRef(false);
  const close = React.useCallback(() => onClose(actionedRef.current), [onClose]);
  const markActioned = React.useCallback(() => {
    actionedRef.current = true;
    onActioned();
  }, [onActioned]);
  const [candidates, setCandidates] = React.useState<SignalCandidate[]>([]);
  const [apolloConfigured, setApolloConfigured] = React.useState(true);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [customEmail, setCustomEmail] = React.useState("");
  const [customName, setCustomName] = React.useState("");
  const [prepError, setPrepError] = React.useState<string | null>(null);

  const [scopeCompanyId, setScopeCompanyId] = React.useState<string | null>(signal.scope_company_id);
  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [draftError, setDraftError] = React.useState<string | null>(null);

  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [savingLater, setSavingLater] = React.useState(false);

  // "S'en occuper plus tard" : envoie le signal dans la watchlist sans rédiger.
  async function saveLater() {
    setSavingLater(true);
    try {
      await fetch(`/api/signals/${signal.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save" }),
      });
    } catch {
      /* best-effort */
    }
    markActioned();
    close();
  }

  // Fermeture au clavier (Escape).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Étape 1 : récupère les candidats.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/signals/${signal.id}/candidates`, { method: "POST" });
        const json = (await r.json().catch(() => ({}))) as {
          candidates?: SignalCandidate[];
          apolloConfigured?: boolean;
          scopeCompanyId?: string | null;
          error?: string;
        };
        if (!alive) return;
        setCandidates(json.candidates ?? []);
        setApolloConfigured(json.apolloConfigured ?? false);
        if (json.scopeCompanyId) setScopeCompanyId(json.scopeCompanyId);
        setSelected(json.candidates?.[0]?.key ?? (json.candidates?.length ? null : CUSTOM_KEY));
        if (json.error) setPrepError(json.error);
        setPhase("pick");
      } catch (e) {
        if (alive) {
          setPrepError(e instanceof Error ? e.message : "Failed");
          setPhase("pick");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [signal.id]);

  async function generate() {
    setPhase("drafting");
    setDraftError(null);
    const cand = candidates.find((c) => c.key === selected);
    const choice =
      selected === CUSTOM_KEY || !cand
        ? { email: customEmail.trim() || null, name: customName.trim() || null }
        : {
            // Pour le focus nominé : pas d'email connu -> reveal Apollo par nom,
            // avec l'email deviné en secours. Sinon CRM (email) / Apollo (apolloId).
            email: cand.guessed ? null : cand.email,
            name: cand.name,
            apolloId: cand.apolloId,
            firstName: cand.firstName,
            lastName: cand.lastName,
            fallbackEmail: cand.guessEmail,
          };
    try {
      const r = await fetch(`/api/signals/${signal.id}/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const json = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        recipient?: { name: string | null; email: string } | null;
        draft?: { subject: string; body: string } | null;
        scopeCompanyId?: string | null;
        error?: string;
      };
      if (json.scopeCompanyId) setScopeCompanyId(json.scopeCompanyId);
      setTo(json.recipient?.email ?? (choice.email ?? ""));
      setSubject(json.draft?.subject ?? "");
      setBody(json.draft?.body ?? "");
      if (json.draft) {
        // Le signal n'est marqué actioned côté serveur QUE si le brouillon a été
        // généré. En cas d'échec on le laisse 'new' : retry possible depuis le feed.
        markActioned();
      } else {
        setDraftError(json.error ?? "Could not generate the draft. The signal stays in your feed so you can retry.");
      }
      setPhase("review");
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Failed");
      setPhase("review");
    }
  }

  async function send() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const fd = new FormData();
      fd.set("to", to.trim());
      fd.set("cc", "");
      fd.set("bcc", "");
      fd.set("subject", subject);
      fd.set("body", body);
      fd.set("source", "signal_act");
      if (scopeCompanyId) fd.set("scope_company_id", scopeCompanyId);
      const r = await fetch("/api/gmail/send", { method: "POST", body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error ?? "Failed to send");
      setSent(true);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  }

  const canGenerate = selected === CUSTOM_KEY ? !!customEmail.trim() : !!selected;

  return (
    <div onClick={close} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={card} role="dialog" aria-modal="true" aria-label={`Act on signal: ${signal.title}`}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: COLORS.ink3, marginBottom: 2, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Building2 size={12} /> {signal.company_name}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink0, lineHeight: 1.35 }}>{signal.title}</div>
          </div>
          <button
            onClick={saveLater}
            disabled={savingLater}
            title="Save to your watchlist and handle it later"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              border: `1px solid ${COLORS.line}`,
              background: COLORS.bgCard,
              color: COLORS.ink1,
              borderRadius: RADIUS.md,
              padding: "5px 10px",
              fontSize: 12,
              cursor: savingLater ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            {savingLater ? <Loader2 size={13} className="animate-spin" /> : <Bookmark size={13} />} Later
          </button>
          <button onClick={close} aria-label="Close" style={{ border: "none", background: "none", cursor: "pointer", color: COLORS.ink3, padding: 2, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {phase === "preparing" && (
            <Centered>
              <Loader2 size={24} className="animate-spin" style={{ color: COLORS.brand }} />
              <span style={hint}>Finding the right people at {signal.company_name}…</span>
            </Centered>
          )}

          {phase === "pick" && (
            <>
              <div style={{ fontSize: 13, color: COLORS.ink1, fontWeight: 600 }}>Who should we reach out to?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                {candidates.map((c) => (
                  <RecipientOption
                    key={c.key}
                    selected={selected === c.key}
                    onSelect={() => setSelected(c.key)}
                    name={c.name}
                    title={c.title}
                    badge={
                      c.focus
                        ? c.guessEmail
                          ? "Nominee · guessed email"
                          : "Nominee · find email"
                        : c.source === "apollo"
                          ? "Apollo · reveal"
                          : c.email
                            ? "In CRM"
                            : "CRM · reveal"
                    }
                    badgeColor={c.focus || c.source === "apollo" || !c.email ? COLORS.brand : COLORS.ok}
                    icp={c.icp}
                    focus={c.focus}
                    subnote={c.guessEmail && (c.focus || !c.email) ? c.guessEmail : undefined}
                  />
                ))}
                {/* Email personnalisé */}
                <RecipientOption
                  selected={selected === CUSTOM_KEY}
                  onSelect={() => setSelected(CUSTOM_KEY)}
                  name="Someone else"
                  title="Enter an email manually"
                  custom
                >
                  {selected === CUSTOM_KEY && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Name (optional)" style={{ ...inputStyle, flex: 1 }} />
                      <input value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} placeholder="email@company.com" style={{ ...inputStyle, flex: 1.4 }} />
                    </div>
                  )}
                </RecipientOption>
              </div>

              {candidates.length === 0 && (
                <div style={{ fontSize: 12, color: COLORS.ink2, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} style={{ color: COLORS.warn }} />
                  {apolloConfigured ? "No contact found automatically. Enter an email above." : "No CRM contact, and Apollo is not configured. Enter an email above."}
                </div>
              )}
              {prepError && <div style={{ fontSize: 12, color: COLORS.warn }}>{prepError}</div>}
            </>
          )}

          {phase === "drafting" && (
            <Centered>
              <Loader2 size={24} className="animate-spin" style={{ color: COLORS.brand }} />
              <span style={hint}>
                <Sparkles size={13} style={{ color: COLORS.brand }} /> Revealing email & drafting a tailored message…
              </span>
            </Centered>
          )}

          {phase === "review" && (
            <>
              <Field label="To">
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@company.com" style={inputStyle} />
              </Field>
              <Field label="Subject">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Message">
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }} />
              </Field>
              {draftError && <div style={{ fontSize: 12, color: COLORS.warn }}>Draft note: {draftError}</div>}
              {sendError && <div style={{ fontSize: 12, color: COLORS.err }}>{sendError}</div>}
            </>
          )}
        </div>

        {/* Footer */}
        {phase === "pick" && (
          <Footer>
            <button onClick={close} style={btnGhost}>Cancel</button>
            <button onClick={generate} disabled={!canGenerate} style={{ ...btnPrimary, opacity: canGenerate ? 1 : 0.5 }}>
              <Sparkles size={15} /> Generate email
            </button>
          </Footer>
        )}
        {phase === "review" && (
          <Footer>
            <button onClick={() => setPhase("pick")} style={{ ...btnGhost, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <ArrowLeft size={14} /> Recipient
            </button>
            {scopeCompanyId && (
              <Link href={`/watchlist/${scopeCompanyId}`} style={{ fontSize: 12, color: COLORS.ink2, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                Open account <ArrowRight size={12} />
              </Link>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {sent ? (
                <span style={{ ...btnPrimary, background: COLORS.ok, cursor: "default" }}>
                  <CheckCircle2 size={15} /> Sent
                </span>
              ) : (
                <button onClick={send} disabled={sending || !to.trim() || !subject.trim() || !body.trim()} style={{ ...btnPrimary, opacity: sending || !to.trim() || !subject.trim() || !body.trim() ? 0.5 : 1 }}>
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Send via Gmail
                </button>
              )}
            </div>
          </Footer>
        )}
      </div>
    </div>
  );
}

function RecipientOption({
  selected,
  onSelect,
  name,
  title,
  badge,
  badgeColor,
  icp,
  focus,
  subnote,
  custom,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  name: string;
  title: string | null;
  badge?: string;
  badgeColor?: string;
  icp?: boolean;
  focus?: boolean;
  subnote?: string;
  custom?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        border: `1px solid ${selected ? COLORS.brand : focus ? COLORS.brandTint : COLORS.line}`,
        background: selected ? COLORS.brandTintSoft : COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: "10px 12px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: focus ? COLORS.brandTint : COLORS.bgSoft, color: focus ? COLORS.brand : COLORS.ink2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {focus ? <Star size={14} /> : <User size={14} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink0, display: "flex", alignItems: "center", gap: 6 }}>
            {name}
            {icp && !focus && <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.ok, background: COLORS.okBg, padding: "1px 6px", borderRadius: 999 }}>ICP</span>}
          </div>
          {title && <div style={{ fontSize: 12, color: COLORS.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>}
          {subnote && <div style={{ fontSize: 11, color: COLORS.brand, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subnote}</div>}
        </div>
        {badge && !custom && (
          <span style={{ fontSize: 10, fontWeight: 700, color: badgeColor, background: `${badgeColor}14`, padding: "3px 7px", borderRadius: 999, flexShrink: 0 }}>{badge}</span>
        )}
        <input type="radio" checked={selected} onChange={onSelect} style={{ accentColor: COLORS.brand }} />
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink2, display: "inline-flex", alignItems: "center", gap: 5 }}>
        <Mail size={12} /> {label}
      </span>
      {children}
    </label>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "28px 0" }}>{children}</div>;
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "12px 20px", borderTop: `1px solid ${COLORS.line}`, display: "flex", alignItems: "center", gap: 10 }}>{children}</div>;
}

const hint: React.CSSProperties = { fontSize: 13, color: COLORS.ink1, display: "inline-flex", alignItems: "center", gap: 8 };

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "rgba(17,17,17,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  maxHeight: "90vh",
  overflowY: "auto",
  background: COLORS.bgCard,
  borderRadius: RADIUS.xl,
  boxShadow: SHADOWS.pop,
  display: "flex",
  flexDirection: "column",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${COLORS.line}`,
  borderRadius: RADIUS.md,
  padding: "9px 11px",
  fontSize: 13,
  color: COLORS.ink0,
  background: COLORS.bgCard,
  outline: "none",
};

const btnGhost: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.line}`,
  background: COLORS.bgCard,
  color: COLORS.ink1,
  fontSize: 13,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: RADIUS.md,
  border: "none",
  background: COLORS.brand,
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};
