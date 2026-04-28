"use client";

import { useEffect, useState } from "react";
import { X, Mail, Send, Copy, RefreshCw, Check } from "lucide-react";

interface Props {
  open: boolean;
  analysisId: string;
  defaultRecipients: { name: string | null; email: string }[];
  initialDraft: { subject: string; body: string } | null;
  onClose: () => void;
}

export function EmailDraftModal({ open, analysisId, defaultRecipients, initialDraft, onClose }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTo(defaultRecipients.map((r) => r.email).join(", "));
    if (initialDraft) {
      setSubject(initialDraft.subject);
      setBody(initialDraft.body);
    } else {
      // Auto-generate on open
      void generate();
    }
    setResult(null);
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function generate() {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/sales-coach/${analysisId}/draft-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setGenerating(false);
    }
  }

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("to", to);
      fd.set("subject", subject);
      fd.set("body", body);
      const res = await fetch("/api/gmail/send", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setResult({ ok: true, msg: "Envoyé via Gmail" });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setSending(false);
    }
  }

  async function copyAll() {
    await navigator.clipboard.writeText(`Sujet : ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] rounded-xl flex flex-col overflow-hidden"
        style={{ background: "#fff" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "#eeeeee" }}>
          <div className="flex items-center gap-2">
            <Mail size={16} style={{ color: "#f01563" }} />
            <h2 className="text-base font-semibold" style={{ color: "#111" }}>Brouillon mail de suivi</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Fermer">
            <X size={18} style={{ color: "#666" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "#888" }}>À</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email1@x.com, email2@y.com"
              className="w-full text-sm px-3 py-2 rounded-md border outline-none"
              style={{ borderColor: "#e5e5e5", background: "#fafafa", color: "#111" }}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "#888" }}>Sujet</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={generating}
              className="w-full text-sm px-3 py-2 rounded-md border outline-none"
              style={{ borderColor: "#e5e5e5", background: "#fafafa", color: "#111" }}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "#888" }}>Corps</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={generating}
              rows={14}
              className="w-full text-sm px-3 py-2 rounded-md border outline-none resize-y"
              style={{ borderColor: "#e5e5e5", background: "#fafafa", color: "#111", lineHeight: 1.6 }}
              placeholder={generating ? "Génération en cours…" : ""}
            />
          </div>

          {result && (
            <div
              className="text-xs px-3 py-2 rounded-md"
              style={{
                color: result.ok ? "#059669" : "#dc2626",
                background: result.ok ? "#ecfdf5" : "#fee2e2",
              }}
            >
              {result.msg}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex items-center gap-2" style={{ borderColor: "#eeeeee" }}>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
            style={{ background: "#fff", color: "#666", border: "1px solid #e5e5e5" }}
          >
            <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
            {generating ? "Régénération…" : "Régénérer"}
          </button>
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md"
            style={{ background: "#fff", color: "#666", border: "1px solid #e5e5e5" }}
          >
            {copied ? <Check size={12} style={{ color: "#059669" }} /> : <Copy size={12} />}
            {copied ? "Copié" : "Copier"}
          </button>
          <div className="flex-1" />
          <button
            onClick={send}
            disabled={sending || generating || !subject.trim() || !body.trim() || !to.trim()}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-md disabled:opacity-50"
            style={{ background: "#f01563", color: "#fff" }}
          >
            <Send size={12} />
            {sending ? "Envoi…" : "Envoyer via Gmail"}
          </button>
        </div>
      </div>
    </div>
  );
}
