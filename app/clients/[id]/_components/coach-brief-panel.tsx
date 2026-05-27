"use client";

import { useState } from "react";
import { Copy, Check, Users } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import type { CoachBrief } from "@/lib/clients/types";

// Brief client à destination des coachs Coachello.
// Le format de rendu suit le template historique partagé sur le canal Slack
// au staffing (Adyen, ACME, etc.). On le rend ici en deux vues :
//  - Vue lisible (cards visuelles) pour consultation directe sur la fiche
//  - Bouton "Copier pour Slack" qui produit la version markdown/texte
//    formatée prête à coller dans le canal #coaches.

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // déjà en texte libre
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Format Slack du brief. On reste fidèle au template original : émojis,
// structure en bullet points, ton sobre. La fonction est totalement défensive
// (elle skip les fields null/undefined/empty arrays).
function renderBriefForSlack(brief: CoachBrief, companyName: string): string {
  const lines: string[] = [];
  lines.push(`*Client brief for coaches*`);
  lines.push(``);
  lines.push(`Hello coaches! :wave: You've just been staffed on *${companyName}*, welcome on board! :rocket:`);
  lines.push(``);
  lines.push(`Please review the client brief below, also available in your Coachello dashboard.`);
  lines.push(``);

  if (brief.intro) {
    lines.push(`*Intro:* ${brief.intro}`);
    lines.push(``);
  }
  if (brief.industry) lines.push(`*Industry:* ${brief.industry}`);
  if (brief.website) lines.push(`*Website:* ${brief.website}`);
  if (brief.context) {
    lines.push(``);
    lines.push(`*Context:*`);
    lines.push(brief.context);
    lines.push(``);
  }
  if (brief.programs && brief.programs.length > 0) {
    lines.push(`*Profiles:*`);
    for (const p of brief.programs) {
      const sessions = p.nb_sessions ? ` (${p.nb_sessions} sessions)` : "";
      const pop = p.population ? ` — ${p.population}` : "";
      lines.push(`- *${p.name}*${sessions}: ${p.description}${pop}`);
    }
    lines.push(``);
  }
  if (brief.goal) {
    lines.push(`*Goal:* ${brief.goal}`);
  }
  if (brief.location) lines.push(`*Location:* ${brief.location}`);
  if (brief.coaching_languages && brief.coaching_languages.length > 0) {
    lines.push(`*Coaching languages:*`);
    for (const cl of brief.coaching_languages) {
      lines.push(`> *${cl.region}:* ${cl.languages.join(", ")}`);
    }
  }
  if (brief.coachee_journey) {
    lines.push(``);
    lines.push(`*Coachee's journey:* ${brief.coachee_journey}`);
  }
  if (brief.ai_coaching !== null && brief.ai_coaching !== undefined) {
    lines.push(`*AI coaching:* ${brief.ai_coaching ? "Yes" : "No"}`);
  }
  if (brief.coachello_app) lines.push(`*Coachello App:* ${brief.coachello_app}`);
  if (brief.briefing_meeting_date) {
    const d = fmtDate(brief.briefing_meeting_date);
    if (d) lines.push(`*Client Briefing meeting for coaches:* ${d}`);
  }
  if (brief.nb_sessions_per_coachee) {
    lines.push(`*# of sessions per coachee:* ${brief.nb_sessions_per_coachee}`);
  }
  if (brief.tripartite) lines.push(`*Tripartite:* ${brief.tripartite}`);
  if (brief.onboarding_start_date) {
    const d = fmtDate(brief.onboarding_start_date);
    if (d) lines.push(`*Onboarding / program start date:* ${d}`);
  }
  if (brief.program_end_date) {
    const d = fmtDate(brief.program_end_date);
    if (d) lines.push(`*Program end date:* ${d}`);
  }
  if (brief.program_duration) lines.push(`*Program duration:* ${brief.program_duration}`);

  lines.push(``);
  lines.push(`*Next steps:*`);
  lines.push(`:white_check_mark: Add a check mark in this channel to confirm you've read everything`);
  lines.push(`:date: Join our client briefing meeting if you can (or watch the recording)`);
  lines.push(`:no_entry_sign: If you're not available, let us know and we'll remove you from the project`);
  lines.push(``);
  lines.push(`Thanks and have a great day! :sunny:`);

  return lines.join("\n");
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 14, padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: COLORS.ink3, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, color: COLORS.ink0 }}>{value}</div>
    </div>
  );
}

export function CoachBriefPanel({
  brief,
  generatedAt,
  companyName,
}: {
  brief: CoachBrief | null;
  generatedAt: string | null;
  companyName: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!brief) {
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
          <Users size={14} style={{ color: COLORS.ink3 }} />
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink2 }}>Brief coachs</h3>
          <span
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 4,
              background: COLORS.bgSoft,
              color: COLORS.ink3,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            pas encore généré
          </span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.ink3, lineHeight: 1.5 }}>
          Le brief sera créé lors du prochain enrichissement IA (bouton &quot;Lancer
          l&apos;enrichissement&quot; en haut de la fiche). Il reprend le format du message Slack
          standard pour les coachs au staffing.
        </div>
      </div>
    );
  }

  async function copyToClipboard() {
    if (!brief) return;
    const text = renderBriefForSlack(brief, companyName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("clipboard error:", e);
    }
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
          gap: 10,
        }}
      >
        <Users size={14} style={{ color: COLORS.ink1 }} />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink0 }}>
          Brief coachs
        </h3>
        {generatedAt && (
          <span style={{ fontSize: 11, color: COLORS.ink3 }}>
            généré le {new Date(generatedAt).toLocaleDateString("fr-FR")}
          </span>
        )}
        <button
          type="button"
          onClick={copyToClipboard}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 10px",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 6,
            border: `1px solid ${copied ? COLORS.ok : COLORS.line}`,
            background: copied ? COLORS.okBg : COLORS.bgCard,
            color: copied ? COLORS.ok : COLORS.ink2,
            cursor: "pointer",
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copié" : "Copier pour Slack"}
        </button>
      </div>

      <div style={{ padding: "12px 16px" }}>
        {brief.intro && (
          <p style={{ fontSize: 13, color: COLORS.ink0, margin: "4px 0 14px", lineHeight: 1.5 }}>
            {brief.intro}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          {brief.industry && <Row label="Industry" value={brief.industry} />}
          {brief.website && (
            <Row
              label="Website"
              value={
                <a href={brief.website} target="_blank" rel="noreferrer" style={{ color: COLORS.brand }}>
                  {brief.website}
                </a>
              }
            />
          )}
          {brief.context && (
            <Row
              label="Context"
              value={<span style={{ whiteSpace: "pre-wrap" }}>{brief.context}</span>}
            />
          )}

          {brief.programs && brief.programs.length > 0 && (
            <Row
              label="Profiles"
              value={
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {brief.programs.map((p, i) => (
                    <div key={i}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      {p.nb_sessions && (
                        <span style={{ color: COLORS.ink3 }}> ({p.nb_sessions} sessions)</span>
                      )}
                      <span style={{ color: COLORS.ink1 }}>: {p.description}</span>
                      {p.population && (
                        <span style={{ color: COLORS.ink3 }}> — {p.population}</span>
                      )}
                    </div>
                  ))}
                </div>
              }
            />
          )}

          {brief.goal && <Row label="Goal" value={brief.goal} />}
          {brief.location && <Row label="Location" value={brief.location} />}

          {brief.coaching_languages && brief.coaching_languages.length > 0 && (
            <Row
              label="Coaching languages"
              value={
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {brief.coaching_languages.map((cl, i) => (
                    <div key={i}>
                      <span style={{ fontWeight: 600 }}>{cl.region}:</span>{" "}
                      <span>{cl.languages.join(", ")}</span>
                    </div>
                  ))}
                </div>
              }
            />
          )}

          {brief.coachee_journey && <Row label="Coachee's journey" value={brief.coachee_journey} />}
          {brief.ai_coaching !== null && brief.ai_coaching !== undefined && (
            <Row label="AI coaching" value={brief.ai_coaching ? "Yes" : "No"} />
          )}
          {brief.coachello_app && <Row label="Coachello App" value={brief.coachello_app} />}
          {brief.briefing_meeting_date && (
            <Row label="Client Briefing meeting" value={fmtDate(brief.briefing_meeting_date) ?? "—"} />
          )}
          {brief.nb_sessions_per_coachee && (
            <Row label="Sessions per coachee" value={brief.nb_sessions_per_coachee} />
          )}
          {brief.tripartite && <Row label="Tripartite" value={brief.tripartite} />}
          {brief.onboarding_start_date && (
            <Row label="Program start date" value={fmtDate(brief.onboarding_start_date) ?? "—"} />
          )}
          {brief.program_end_date && (
            <Row label="Program end date" value={fmtDate(brief.program_end_date) ?? "—"} />
          )}
          {brief.program_duration && <Row label="Program duration" value={brief.program_duration} />}
        </div>
      </div>
    </div>
  );
}
