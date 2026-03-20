"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

export default function ProspectionGuidePage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prospection-guide")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(({ content: c }) => setContent(c))
      .catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/prospection-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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
          onClick={() => router.push("/admin")}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: "#888" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#111")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}
        >
          <ArrowLeft size={16} />
          Admin
        </button>
        <div className="text-center">
          <h1 className="text-sm font-semibold" style={{ color: "#111" }}>Guide Prospection</h1>
          <p className="text-xs" style={{ color: "#aaa" }}>
            Exemples d&apos;emails et instructions que Claude utilise pour rédiger les emails de prospection
          </p>
        </div>
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

      {/* Editor */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {error && (
            <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#fff0f3", color: "#f01563" }}>
              Erreur : {error}
            </p>
          )}
          <p className="text-xs mb-3" style={{ color: "#aaa" }}>
            Ce guide est injecté dans le prompt de génération. Ajoute des exemples d&apos;emails, le ton à adopter, les signaux à exploiter et les cibles prioritaires.
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
