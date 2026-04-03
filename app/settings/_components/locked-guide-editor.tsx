"use client";

import { useState } from "react";

export function LockedGuideEditor({
  adminGuide,
  initialUserInstructions,
  endpoint,
  title,
  description,
}: {
  adminGuide: string;
  initialUserInstructions: string;
  endpoint: string;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [instructions, setInstructions] = useState(initialUserInstructions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInstructions: instructions.trim() }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border" style={{ borderColor: "#eeeeee", background: "#fff" }}>
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "#111" }}>{title}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#15803d" }}>
              Admin
            </span>
            {instructions.trim() && (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#dbeafe", color: "#1e40af" }}>
                + Tes instructions
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#888" }}>{description}</p>
        </div>
        <svg
          className="shrink-0 ml-4 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "#aaa" }}
          width="16" height="16" viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: "#f5f5f5" }}>
          {/* Admin guide (read-only) */}
          <div className="pt-3">
            <button
              onClick={() => setShowAdmin((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium"
              style={{ color: "#666" }}
            >
              <svg
                className="transition-transform"
                style={{ transform: showAdmin ? "rotate(90deg)" : "rotate(0deg)" }}
                width="12" height="12" viewBox="0 0 12 12" fill="none"
              >
                <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Guide admin (lecture seule)
            </button>
            {showAdmin && (
              <textarea
                readOnly
                value={adminGuide}
                rows={12}
                className="w-full text-xs px-3 py-2.5 border rounded-lg outline-none resize-y font-mono mt-2 cursor-default"
                style={{ borderColor: "#e5e5e5", color: "#888", background: "#f9f9f9", lineHeight: "1.7" }}
              />
            )}
          </div>

          {/* User instructions */}
          <div>
            <label className="text-xs font-medium" style={{ color: "#111" }}>
              Tes instructions personnelles
            </label>
            <p className="text-[11px] mb-2" style={{ color: "#aaa" }}>
              Ces instructions seront ajoutées au guide admin. Ajoute tes préférences, contexte, ou règles spécifiques.
            </p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ex: Toujours répondre en anglais, mentionner notre offre coaching leadership..."
              rows={6}
              className="w-full text-xs px-3 py-2.5 border rounded-lg outline-none resize-y font-mono"
              style={{ borderColor: "#e5e5e5", color: "#111", lineHeight: "1.7" }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="text-xs px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: saved ? "#dcfce7" : "#f01563", color: saved ? "#166534" : "#fff" }}
            >
              {saving ? "Sauvegarde..." : saved ? "Sauvegardé !" : "Sauvegarder"}
            </button>
            {instructions.trim() && (
              <button
                onClick={() => { setInstructions(""); }}
                className="text-[11px]"
                style={{ color: "#aaa" }}
              >
                Effacer mes instructions
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
