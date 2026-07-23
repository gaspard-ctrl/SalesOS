"use client";

/**
 * Écran d'accueil du chat (état vide), design 4a, version CLAIRE (demande utilisateur) (handoff
 * __documentation + mock 4a-home-dark.html) : stage clair chaud #faf8f5, fond
 * neural, headline serif, composer central, rangée d'outils connectés.
 * Branché sur le vrai state de app/page.tsx (send, better thinking = "Deep
 * dive", upload de pièces jointes réel).
 */

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import { Instrument_Serif, Schibsted_Grotesk } from "next/font/google";
import { Paperclip, ArrowUp, X, FileText, Loader2 } from "lucide-react";
import { ToolLogo, type LogoKey } from "./tool-logo";
import type { ChatAttachment } from "./chat-input-bar";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400" });
const grotesk = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const ACCENT = "#f01563";

// Outils connectés : vrais logos + tooltip + question type insérée au clic.
const TOOLS: { key: LogoKey; label: string; starter: string }[] = [
  { key: "hubspot", label: "HubSpot", starter: "Fais-moi un point complet sur [client] : deals, CA facturé, meetings et derniers échanges." },
  { key: "slack", label: "Slack", starter: "Qu'est-ce qui s'est dit sur [client] dans Slack récemment ?" },
  { key: "claap", label: "Claap", starter: "Résume le dernier call avec [client] et liste les engagements pris." },
  { key: "notion", label: "Knowledge Coachello (Notion)", starter: "Quel est notre pricing AI Roleplay et que contient le programme ?" },
  { key: "gmail", label: "Gmail", starter: "Retrouve le dernier email de [contact] et résume où on en est." },
  { key: "drive", label: "Google Drive", starter: "Retrouve la dernière proposition envoyée à [client] sur le Drive." },
  { key: "linkedin", label: "LinkedIn", starter: "Trouve les DRH chez [entreprise] et rédige un message d'approche personnalisé." },
  { key: "web", label: "Web", starter: "Quelles sont les dernières actualités sur [entreprise] ?" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function ChatHome({
  input, onChange, onSend, deepDive, onToggleDeepDive,
  attachments, uploadingCount, onPickFiles, onRemoveAttachment,
}: {
  input: string;
  onChange: (v: string) => void;
  onSend: () => void;
  deepDive: boolean;
  onToggleDeepDive: () => void;
  attachments: ChatAttachment[];
  uploadingCount: number;
  onPickFiles: (files: FileList) => void;
  onRemoveAttachment: (id: string) => void;
}) {
  const { user } = useUser();
  const firstName = user?.firstName ?? user?.username ?? "";
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "•";

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const canSend = (input.trim().length > 0 || attachments.length > 0) && uploadingCount === 0;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div
      className={grotesk.className}
      style={{
        position: "relative",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#faf8f5",
        color: "#201a15",
      }}
    >
      {/* Fond neural (décoratif, copié du mock 4a) */}
      <svg
        viewBox="0 0 480 320"
        aria-hidden
        style={{ position: "absolute", left: "50%", top: "43%", width: "min(80vw, 780px)", transform: "translate(-50%,-50%)", opacity: 0.55, pointerEvents: "none" }}
      >
        <path d="M120 90L160 70M160 70L210 60M210 60L260 62M260 62L310 72M310 72L355 95M120 90L100 130M120 90L150 120M160 70L150 120M210 60L200 110M260 62L250 108M310 72L300 115M355 95L345 135M355 95L385 120M100 130L150 120M150 120L200 110M200 110L250 108M250 108L300 115M300 115L345 135M345 135L385 120M100 130L95 175M150 120L140 170M200 110L195 165M250 108L245 168M300 115L300 170M345 135L350 178M385 120L390 170M95 175L140 170M140 170L195 165M195 165L245 168M245 168L300 170M300 170L350 178M350 178L390 170M95 175L110 215M140 170L160 220M195 165L215 225M245 168L270 222M300 170L320 215M350 178L360 205M390 170L360 205M110 215L160 220M160 220L215 225M215 225L270 222M270 222L320 215M320 215L360 205M110 215L150 258M160 220L150 258M215 225L210 262M270 222L265 260M320 215L315 250M360 205L315 250M150 258L210 262M210 262L265 260M265 260L315 250M150 120L195 165M200 110L245 168M250 108L300 170M300 115L350 178M195 165L160 220M245 168L215 225M300 170L270 222M350 178L320 215" fill="none" stroke="rgba(240,21,99,.13)" strokeWidth="1" />
        <g fill="rgba(240,21,99,.28)"><circle cx="120" cy="90" r="2.4" /><circle cx="210" cy="60" r="2.4" /><circle cx="310" cy="72" r="2.4" /><circle cx="150" cy="120" r="2.4" /><circle cx="250" cy="108" r="2.4" /><circle cx="345" cy="135" r="2.4" /><circle cx="95" cy="175" r="2.4" /><circle cx="195" cy="165" r="2.4" /><circle cx="300" cy="170" r="2.4" /><circle cx="390" cy="170" r="2.4" /><circle cx="110" cy="215" r="2.4" /><circle cx="215" cy="225" r="2.4" /><circle cx="320" cy="215" r="2.4" /><circle cx="150" cy="258" r="2.4" /><circle cx="265" cy="260" r="2.4" /><circle cx="315" cy="250" r="2.4" /></g>
        <g fill={ACCENT}><circle cx="200" cy="110" r="4" /><circle cx="245" cy="168" r="4" /><circle cx="270" cy="222" r="4" /></g>
      </svg>

      {/* Avatar (initiales) en haut à droite */}
      <div
        style={{
          position: "absolute", top: 22, right: 26, width: 30, height: 30, borderRadius: "50%",
          background: "linear-gradient(135deg,#ff8fb8,#f01563)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
        }}
      >
        {initials}
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: 640, textAlign: "center", padding: "0 30px" }}>
        <h1 className={serif.className} style={{ fontSize: 42, fontWeight: 400, margin: "0 0 26px", letterSpacing: ".01em" }}>
          <span style={{ color: ACCENT }}>✳</span> What&apos;s on your mind{firstName ? `, ${firstName}` : ""}?
        </h1>

        {/* Composer */}
        <div style={{ background: "#ffffff", border: "1px solid rgba(26,22,19,.08)", boxShadow: "0 1px 3px rgba(26,22,19,.05)", borderRadius: 16, padding: "18px 20px", textAlign: "left" }}>
          {(attachments.length > 0 || uploadingCount > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {attachments.map((a) => (
                <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 8px", borderRadius: 8, background: "rgba(26,22,19,.04)", border: "1px solid rgba(26,22,19,.12)", color: "#5a524b", maxWidth: 240 }}>
                  <FileText size={13} style={{ flexShrink: 0, color: ACCENT }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.filename}</span>
                  <span style={{ color: "#8f857c", flexShrink: 0 }}>{formatSize(a.size_bytes)}</span>
                  <button type="button" onClick={() => onRemoveAttachment(a.id)} aria-label={`Retirer ${a.filename}`} style={{ display: "inline-flex", border: "none", background: "none", cursor: "pointer", color: "#8f857c", padding: 0 }}>
                    <X size={13} />
                  </button>
                </span>
              ))}
              {uploadingCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 8px", borderRadius: 8, background: "rgba(26,22,19,.04)", border: "1px solid rgba(26,22,19,.12)", color: "#9a9088" }}>
                  <Loader2 size={13} className="animate-spin" /> Upload…
                </span>
              )}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Ask anything - I have all your Coachello context…"
            style={{
              width: "100%", resize: "none", border: "none", outline: "none", background: "transparent",
              fontSize: 15.5, lineHeight: 1.5, color: "#201a15", caretColor: ACCENT,
              fontFamily: "inherit", minHeight: 24, maxHeight: 180, overflowY: "auto", padding: 0,
            }}
            className="chat-home-input"
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.docx,.csv,.txt,.md"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.length) onPickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Joindre un document"
                title="Joindre un document (cahier des charges, RFP…) : PDF, image, xlsx, docx, csv, txt, md"
                style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid rgba(26,22,19,.14)", background: "transparent", color: "#7a7068", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Paperclip size={14} />
              </button>
              <button
                type="button"
                onClick={onToggleDeepDive}
                aria-pressed={deepDive}
                title="Deep dive : le modèle est plus rigoureux, croise toutes les sources et répond en détail."
                style={{
                  display: "flex", alignItems: "center", gap: 7, borderRadius: 9, padding: "6px 11px",
                  fontSize: 12.5, fontWeight: 500, cursor: "pointer", background: "transparent",
                  border: `1px solid ${deepDive ? "rgba(240,21,99,.45)" : "rgba(26,22,19,.14)"}`,
                  color: deepDive ? ACCENT : "#7a7068", transition: "all .2s",
                }}
              >
                <span style={{ width: 24, height: 14, borderRadius: 20, background: deepDive ? ACCENT : "rgba(26,22,19,.14)", position: "relative", display: "inline-block", transition: "background .2s" }}>
                  <span style={{ position: "absolute", top: 2, left: deepDive ? 12 : 2, width: 10, height: 10, borderRadius: "50%", background: deepDive ? "#fff" : "#9a9088", transition: "all .2s" }} />
                </span>
                Deep dive
              </button>
            </div>
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Envoyer"
              style={{ width: 30, height: 30, borderRadius: 9, background: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: canSend ? "pointer" : "not-allowed", opacity: canSend ? 1 : 0.4, transition: "opacity .15s" }}
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </div>

        {/* Rangée des outils connectés (vrais logos) */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 30 }}>
          {TOOLS.map(({ key, label, starter }) => (
            <button
              key={key}
              type="button"
              title={label}
              onClick={() => onChange(starter)}
              style={{
                width: 34, height: 34, borderRadius: "50%", background: "#ffffff",
                border: "1px solid rgba(26,22,19,.10)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <ToolLogo logo={key} size={17} />
            </button>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .chat-home-input::placeholder { color: #9a9088; }
      `}</style>
    </div>
  );
}
