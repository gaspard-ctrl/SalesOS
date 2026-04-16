"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, X, RefreshCw } from "lucide-react";

interface AskClaudeProps {
  /** JSON context to send to the API (deal data, briefing data, etc.) */
  context: unknown;
  /** Placeholder text for the input */
  placeholder?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Compact button to place in a flex row — renders just the trigger */
export function AskClaudeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: 10,
        border: "none",
        background: "#fff7ed",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#ffedd5"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff7ed"; }}
    >
      <img src="/3d-claude-ai-logo.jpg" alt="Claude" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Claude</div>
        <div style={{ fontSize: 10, color: "#9ca3af" }}>Poser une question</div>
      </div>
    </button>
  );
}

/** Chat panel — renders full-width below the row */
export function AskClaudePanel({ context, placeholder = "Poser une question sur ce deal…", onClose }: AskClaudeProps & { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; abortRef.current?.abort(); };
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  const ask = useCallback(async () => {
    const q = input.trim();
    if (!q || streaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setStreaming(true);
    scrollToBottom();

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/ask-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, question: q }),
        signal: abort.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done || !mountedRef.current) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (!mountedRef.current) break;
            if (evt.type === "text") {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: last.content + evt.text };
                }
                return copy;
              });
              scrollToBottom();
            } else if (evt.type === "error") {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: `Erreur : ${evt.message}` };
                }
                return copy;
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError" && mountedRef.current) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant" && !last.content) {
            copy[copy.length - 1] = { ...last, content: "Erreur de connexion." };
          }
          return copy;
        });
      }
    } finally {
      if (mountedRef.current) {
        setStreaming(false);
      }
      abortRef.current = null;
    }
  }, [input, streaming, context, scrollToBottom]);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setStreaming(false);
  }, []);

  return (
    <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", overflow: "hidden", marginBottom: 14 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid #f3f4f6",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <img src="/3d-claude-ai-logo.jpg" alt="Claude" style={{ width: 16, height: 16, borderRadius: 3 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Claude</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {messages.length > 0 && (
            <button
              onClick={reset}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#9ca3af", padding: 2, display: "flex",
              }}
              title="Nouvelle conversation"
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button
            onClick={() => { onClose(); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#9ca3af", padding: 2, display: "flex",
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          maxHeight: 300,
          overflowY: "auto",
          padding: messages.length > 0 ? "10px 12px" : 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              ...(msg.role === "user"
                ? { background: "#e88c30", color: "white" }
                : { background: "#f3f4f6", color: "#374151" }),
            }}
          >
            {msg.content || (streaming && i === messages.length - 1 ? (
              <span style={{ color: "#9ca3af" }}>Réflexion…</span>
            ) : null)}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 10px",
        borderTop: messages.length > 0 ? "1px solid #f3f4f6" : "none",
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
          placeholder={placeholder}
          disabled={streaming}
          style={{
            flex: 1,
            fontSize: 12,
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            outline: "none",
            background: "#fafafa",
          }}
        />
        <button
          onClick={ask}
          disabled={streaming || !input.trim()}
          style={{
            width: 30, height: 30, borderRadius: 8,
            border: "none",
            background: streaming || !input.trim() ? "#f3f4f6" : "#e88c30",
            color: streaming || !input.trim() ? "#9ca3af" : "white",
            cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {streaming ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}

/** Legacy all-in-one component (for briefing page) */
export function AskClaude({ context, placeholder }: AskClaudeProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <AskClaudeButton onClick={() => setOpen(true)} />;
  }

  return <AskClaudePanel context={context} placeholder={placeholder} onClose={() => setOpen(false)} />;
}
