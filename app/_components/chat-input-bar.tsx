"use client";

import * as React from "react";
import { ArrowUp, Sparkles, Paperclip, X, FileText, Loader2 } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";

export type ChatAttachment = {
  id: string;
  filename: string;
  kind: "pdf" | "image" | "text";
  size_bytes: number;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export const ChatInputBar = React.forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    loading: boolean;
    placeholder?: string;
    betterThinking?: boolean;
    onToggleBetterThinking?: () => void;
    attachments?: ChatAttachment[];
    uploadingCount?: number;
    onPickFiles?: (files: FileList) => void;
    onRemoveAttachment?: (id: string) => void;
  }
>(function ChatInputBar(
  {
    value, onChange, onSend, loading, placeholder,
    betterThinking = false, onToggleBetterThinking,
    attachments = [], uploadingCount = 0, onPickFiles, onRemoveAttachment,
  },
  ref
) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !loading && uploadingCount === 0;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.lineStrong}`,
        borderRadius: 14,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {(attachments.length > 0 || uploadingCount > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {attachments.map((a) => (
            <span
              key={a.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 8,
                background: COLORS.bgSoft,
                border: `1px solid ${COLORS.line}`,
                color: COLORS.ink1,
                maxWidth: 260,
              }}
            >
              <FileText size={13} style={{ flexShrink: 0, color: COLORS.brand }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.filename}
              </span>
              <span style={{ color: COLORS.ink5, flexShrink: 0 }}>{formatSize(a.size_bytes)}</span>
              {onRemoveAttachment && (
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(a.id)}
                  aria-label={`Retirer ${a.filename}`}
                  style={{ display: "inline-flex", border: "none", background: "none", cursor: "pointer", color: COLORS.ink3, padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </span>
          ))}
          {uploadingCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 8,
                background: COLORS.bgSoft,
                border: `1px solid ${COLORS.line}`,
                color: COLORS.ink3,
              }}
            >
              <Loader2 size={13} className="animate-spin" />
              Upload…
            </span>
          )}
        </div>
      )}

      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <textarea
        id="chat-input"
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder ?? "Ask a question, request a brief, draft an email…"}
        rows={1}
        className="resize-none text-sm outline-none bg-transparent leading-relaxed"
        style={{
          color: COLORS.ink0,
          maxHeight: 200,
          overflowY: "auto",
          width: "100%",
          padding: "4px 4px",
          minHeight: 28,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {onPickFiles && (
            <>
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
                title="Joindre un document (cahier des charges, RFP, brief…) : PDF, image, xlsx, docx, csv, txt, md"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.lineStrong}`,
                  background: COLORS.bgCard,
                  color: COLORS.ink2,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Paperclip size={14} />
              </button>
            </>
          )}
          {onToggleBetterThinking && (
            <button
              type="button"
              onClick={onToggleBetterThinking}
              aria-pressed={betterThinking}
              title="Deeper thinking: the model is more rigorous, digs through all available data and answers in detail."
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 30,
                padding: "0 10px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1,
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
                border: `1px solid ${betterThinking ? COLORS.brand : COLORS.lineStrong}`,
                background: betterThinking ? COLORS.brandTint : COLORS.bgCard,
                color: betterThinking ? COLORS.brand : COLORS.ink2,
              }}
            >
              <Sparkles size={14} />
              Better thinking
            </button>
          )}
        </div>
        <button
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLORS.brand,
            color: "#fff",
            border: "none",
            cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend ? 1 : 0.4,
            transition: "opacity 0.15s",
            flexShrink: 0,
          }}
        >
          <ArrowUp size={15} />
        </button>
      </div>
    </div>
  );
});
