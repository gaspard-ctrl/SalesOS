"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

export default function PromptPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [firstName, setFirstName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prompt")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(({ prompt, firstName: fn }) => {
        setContent(prompt);
        setFirstName(fn);
      })
      .catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#f0f0f0" }}>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: "#888" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#111")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}
        >
          <ArrowLeft size={16} />
          Retour
        </button>
        <div className="text-center">
          <h1 className="text-sm font-semibold" style={{ color: "#111" }}>
            Guide de {firstName || "…"}
          </h1>
          <p className="text-xs" style={{ color: "#aaa" }}>Personnalise le comportement de CoachelloGPT</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: saved ? "#22c55e" : "#f01563", color: "#fff", opacity: saving ? 0.7 : 1 }}
          >
            <Save size={12} />
            {saved ? "Sauvegardé !" : saving ? "…" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {error && (
            <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#fff0f3", color: "#f01563" }}>
              Erreur : {error}
            </p>
          )}
          <p className="text-xs mb-3" style={{ color: "#aaa" }}>
            Ce guide est envoyé à Claude en tant que prompt système. Modifie-le pour personnaliser les réponses, le ton, les priorités.
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-xl border p-4 text-sm font-mono resize-none outline-none transition-all"
            style={{
              borderColor: "#e5e5e5",
              color: "#111",
              background: "#fafafa",
              minHeight: "70vh",
              lineHeight: 1.7,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#f01563")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e5e5")}
          />
        </div>
      </div>
    </div>
  );
}
