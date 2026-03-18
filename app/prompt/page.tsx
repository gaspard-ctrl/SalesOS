"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, RotateCcw } from "lucide-react";

const DEFAULT_PROMPT_KEY = "coachello_prompt_guide";

export default function PromptPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [defaultContent, setDefaultContent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/prompt")
      .then((r) => r.text())
      .then((text) => {
        setDefaultContent(text);
        const saved = localStorage.getItem(DEFAULT_PROMPT_KEY);
        setContent(saved ?? text);
      });
  }, []);

  const save = () => {
    localStorage.setItem(DEFAULT_PROMPT_KEY, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    setContent(defaultContent);
    localStorage.removeItem(DEFAULT_PROMPT_KEY);
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
          <h1 className="text-sm font-semibold" style={{ color: "#111" }}>Guide de réponse</h1>
          <p className="text-xs" style={{ color: "#aaa" }}>Personnalise le comportement de Coachello Intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: "#e5e5e5", color: "#888" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#ccc")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e5e5")}
          >
            <RotateCcw size={12} />
            Réinitialiser
          </button>
          <button
            onClick={save}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: saved ? "#22c55e" : "#f01563", color: "#fff" }}
          >
            <Save size={12} />
            {saved ? "Sauvegardé !" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
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
