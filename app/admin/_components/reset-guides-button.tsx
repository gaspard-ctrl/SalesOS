"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

export function ResetGuidesButton() {
  const [phase, setPhase] = useState<"idle" | "confirm" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function confirm() {
    setPhase("loading");
    try {
      const r = await fetch("/api/admin/reset-guides", { method: "POST" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      setPhase("done");
      setTimeout(() => setPhase("idle"), 3000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur");
      setPhase("error");
      setTimeout(() => setPhase("idle"), 4000);
    }
  }

  if (phase === "confirm") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ borderColor: "#fecaca", background: "#fff5f5" }}>
        <p className="text-xs flex-1" style={{ color: "#991b1b" }}>
          Tous les guides personnalisés des utilisateurs seront supprimés. Irréversible.
        </p>
        <button
          onClick={() => setPhase("idle")}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "#e5e5e5", color: "#666" }}
        >
          Annuler
        </button>
        <button
          onClick={confirm}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
          style={{ background: "#dc2626", color: "#fff" }}
        >
          Confirmer la réinitialisation
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs" style={{ color: phase === "done" ? "#16a34a" : phase === "error" ? "#dc2626" : "#aaa" }}>
        {phase === "done" && "✓ Guides réinitialisés pour tous les utilisateurs"}
        {phase === "error" && `Erreur : ${errorMsg}`}
        {phase === "loading" && "Réinitialisation…"}
      </p>
      <button
        onClick={() => setPhase("confirm")}
        disabled={phase === "loading"}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
        style={{ borderColor: "#fecaca", color: "#dc2626", background: "#fff" }}
      >
        <RotateCcw size={11} />
        Réinitialiser les guides de tous les users
      </button>
    </div>
  );
}
