"use client";

import * as React from "react";
import { Linkedin, ExternalLink, Loader2, Search, AlertCircle } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";

// Profil sérialisé renvoyé par /api/linkedin/enrich (GET poll).
export interface EnrichedProfile {
  username: string;
  name: string;
  headline: string;
  summary: string;
  location?: string;
  positions: { company: string; title: string; start: string | null; end: string }[];
  skills: string[];
  education: string[];
  profileUrl: string;
}

interface Candidate {
  name: string;
  headline: string;
  username: string;
  profileURL: string;
}

type Phase = "idle" | "searching" | "choosing" | "scraping" | "done" | "error";

const POLL_INTERVAL = 4000;
const MAX_POLLS = 30; // ~2 min

/**
 * Enrichissement LinkedIn à la demande, réutilisable (briefing, deals).
 * Bouton "Enrichir" → recherche SERP → si plusieurs candidats, picker →
 * scrape du SEUL profil choisi → affichage. Aucun crédit dépensé tant que
 * l'utilisateur n'a pas cliqué (et choisi).
 */
export function LinkedInEnrich({
  firstName,
  lastName,
  company,
  linkedinUrl,
  label,
}: {
  firstName?: string;
  lastName?: string;
  company?: string;
  /** Si connu (ex: linkedin_url HubSpot), on saute la recherche. */
  linkedinUrl?: string | null;
  /** Libellé affiché à côté du bouton (ex: nom de l'interlocuteur). */
  label?: string;
}) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [profile, setProfile] = React.useState<EnrichedProfile | null>(null);
  const [error, setError] = React.useState("");

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || label || "this profile";

  async function pollProfile(snapshotId: string) {
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      const res = await fetch(`/api/linkedin/enrich?snapshot_id=${encodeURIComponent(snapshotId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scrape error");
      if (json.ready) {
        if (!json.profile) throw new Error("Profile not found");
        setProfile(json.profile as EnrichedProfile);
        setPhase("done");
        return;
      }
    }
    throw new Error("Timed out (the scrape is taking too long)");
  }

  async function scrape(url: string) {
    setPhase("scraping");
    setError("");
    try {
      const res = await fetch("/api/linkedin/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "trigger", linkedinUrl: url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scrape error");
      await pollProfile(json.snapshotId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("error");
    }
  }

  async function start() {
    setError("");
    // URL connue → scrape direct, pas de recherche.
    if (linkedinUrl && /linkedin\.com\/in\//i.test(linkedinUrl)) {
      void scrape(linkedinUrl);
      return;
    }
    setPhase("searching");
    try {
      const res = await fetch("/api/linkedin/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "search", firstName, lastName, company }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search error");
      const found = (json.candidates ?? []) as Candidate[];
      if (found.length === 0) {
        setError("No LinkedIn profile found. Add the company or check the name.");
        setPhase("error");
      } else if (found.length === 1) {
        void scrape(found[0].profileURL); // un seul candidat → scrape direct
      } else {
        setCandidates(found);
        setPhase("choosing"); // plusieurs → l'utilisateur choisit
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("error");
    }
  }

  // ── Bouton initial ────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button onClick={start} style={btnStyle()}>
          <Linkedin size={13} /> Enrich LinkedIn{label ? ` - ${label}` : ""}
        </button>
        {!company && (
          <span style={{ fontSize: 10, color: COLORS.ink3, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <AlertCircle size={10} /> Without a company, there may be several namesakes (you can choose).
          </span>
        )}
      </div>
    );
  }

  // ── Recherche / scrape en cours ──────────────────────────────────────
  if (phase === "searching" || phase === "scraping") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.ink3 }}>
        <Loader2 size={13} className="animate-spin" />
        {phase === "searching" ? `Searching for ${fullName}…` : "Scraping profile…"}
      </div>
    );
  }

  // ── Picker (plusieurs candidats) ─────────────────────────────────────
  if (phase === "choosing") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 11, color: COLORS.ink3, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Search size={11} /> Several profiles for &quot;{fullName}&quot; - pick the right one:
        </span>
        {candidates.map((c) => (
          <button key={c.username} onClick={() => scrape(c.profileURL)} style={candidateStyle()}>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink0 }}>{c.name}</span>
            {c.headline && <span style={{ fontSize: 11, color: COLORS.ink2 }}>{c.headline}</span>}
            <span style={{ fontSize: 10, color: "#0a66c2" }}>{c.profileURL.replace(/^https?:\/\//, "")}</span>
          </button>
        ))}
      </div>
    );
  }

  // ── Erreur ───────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "#b91c1c" }}>{error}</span>
        <button onClick={start} style={btnStyle()}>Try again</button>
      </div>
    );
  }

  // ── Profil enrichi ───────────────────────────────────────────────────
  if (phase === "done" && profile) return <ProfileBlock profile={profile} />;
  return null;
}

function ProfileBlock({ profile: p }: { profile: EnrichedProfile }) {
  return (
    <div>
      <div style={{ marginBottom: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink0, margin: 0 }}>{p.name}</p>
          <p style={{ fontSize: 12, color: "#1d4ed8", margin: 0 }}>{p.headline}</p>
          {p.location && <p style={{ fontSize: 11, color: COLORS.ink3, margin: 0 }}>{p.location}</p>}
        </div>
        <a href={p.profileUrl} target="_blank" rel="noreferrer"
           style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0a66c2", fontSize: 11, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
          <Linkedin size={12} /> View <ExternalLink size={10} />
        </a>
      </div>
      {p.positions.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={uppercaseLabel()}>Experience</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {p.positions.map((pos, i) => (
              <div key={i} style={{ fontSize: 12, color: COLORS.ink1, lineHeight: 1.4 }}>
                <strong style={{ color: COLORS.ink0 }}>{pos.title}</strong> @ {pos.company}{" "}
                <span style={{ color: COLORS.ink3 }}>({pos.start ?? "?"} → {pos.end})</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {p.skills.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={uppercaseLabel()}>Skills</p>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {p.skills.map((s) => (
              <span key={s} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: COLORS.bgSoft, color: COLORS.ink2 }}>{s}</span>
            ))}
          </div>
        </div>
      )}
      {p.education.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={uppercaseLabel()}>Education</p>
          <p style={{ fontSize: 12, color: COLORS.ink1, margin: 0 }}>{p.education.join(" · ")}</p>
        </div>
      )}
      {p.summary && (
        <div>
          <p style={uppercaseLabel()}>Bio</p>
          <p style={{ fontSize: 12, color: COLORS.ink1, margin: 0, lineHeight: 1.5 }}>{p.summary}</p>
        </div>
      )}
    </div>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
    padding: "5px 12px", borderRadius: 8, border: "1px solid #0a66c2",
    background: "#fff", color: "#0a66c2", fontSize: 12, fontWeight: 600, cursor: "pointer",
  };
}
function candidateStyle(): React.CSSProperties {
  return {
    display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start", textAlign: "left",
    padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", cursor: "pointer",
  };
}
function uppercaseLabel(): React.CSSProperties {
  return { fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: COLORS.ink3, margin: 0, marginBottom: 4 };
}
