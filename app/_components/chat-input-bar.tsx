"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";

export const ChatInputBar = React.forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    loading: boolean;
    placeholder?: string;
  }
>(function ChatInputBar({ value, onChange, onSend, loading, placeholder }, ref) {
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = value.trim().length > 0 && !loading;

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
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <textarea
        id="chat-input"
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder ?? "Pose une question, demande un brief, rédige un email…"}
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
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <button
          onClick={onSend}
          disabled={!canSend}
          aria-label="Envoyer le message"
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
