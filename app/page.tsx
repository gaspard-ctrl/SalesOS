"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Plus, X, Check, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type Conversation } from "./_components/conversation-history-modal";
import { ChatHome } from "./_components/chat-home";
import { NotionTreeModal } from "./_components/notion-tree-modal";
import { ToolLogo, logoKeyForTool, logoKeyForSourceKind } from "./_components/tool-logo";
import { ChatInputBar, type ChatAttachment } from "./_components/chat-input-bar";
import { COLORS } from "@/lib/design/tokens";

type Message = { role: "user" | "assistant"; content: string; attachments?: string[]; sources?: ChatSource[] };
type ApiMessage = { role: "user" | "assistant"; content: unknown };
type ChatSource = { kind: string; title: string; url?: string };
type ToolStep = { name: string | null; label: string };

// chat_jobs.tool_steps : {name,label}[] depuis la refonte, string[] sur les
// anciennes rows. On normalise pour afficher le logo de l'outil par étape.
function normalizeToolSteps(raw: unknown): ToolStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) =>
    typeof s === "string"
      ? { name: null, label: s }
      : { name: (s as ToolStep).name ?? null, label: (s as ToolStep).label ?? "" }
  );
}

const SOURCE_KIND_LABELS: Record<string, string> = {
  notion: "Notion",
  claap: "Claap",
  drive: "Drive",
  gmail: "Gmail",
  billing: "Revenue",
  guide: "Guide",
};

// Badge "C" rose de l'assistant (style prototype)
function AssistantBadge() {
  return (
    <div
      className="mr-3 mt-1 shrink-0 self-start"
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: "#f01563",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      C
    </div>
  );
}

// Chips des sources consultées (logo + type + titre, cliquables)
function SourceChips({ sources }: { sources: ChatSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {sources.map((s, i) => {
        const label = SOURCE_KIND_LABELS[s.kind] ?? s.kind;
        const chip = (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 8,
              background: COLORS.bgSoft,
              border: `1px solid ${COLORS.line}`,
              color: COLORS.ink1,
              maxWidth: 280,
            }}
          >
            <ToolLogo logo={logoKeyForSourceKind(s.kind)} size={13} />
            <span style={{ fontWeight: 700, color: COLORS.brand }}>{label}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
          </span>
        );
        return s.url ? (
          <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            {chip}
          </a>
        ) : (
          <span key={i}>{chip}</span>
        );
      })}
    </div>
  );
}

// Memoized message bubble to avoid re-rendering all messages on each keystroke
const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] px-4 py-3 text-sm leading-relaxed"
          style={{ background: "#f01563", color: "#fff", borderRadius: 18, borderBottomRightRadius: 6 }}
        >
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
              {message.attachments.map((name, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.35)",
                  }}
                >
                  📎 {name}
                </span>
              ))}
            </div>
          )}
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant : pill de statut + réponse en carte + sources de CETTE réponse
  return (
    <div className="flex justify-start">
      <AssistantBadge />
      <div style={{ flex: 1, minWidth: 0, maxWidth: "88%", display: "flex", flexDirection: "column", gap: 8 }}>
        {message.sources !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: COLORS.okBg,
                color: COLORS.ok,
              }}
            >
              <Check size={11} strokeWidth={3} />
              Done
            </span>
            {message.sources.length > 0 && (
              <span style={{ fontSize: 11.5, color: COLORS.ink4 }}>
                {message.sources.length} source{message.sources.length > 1 ? "s" : ""} reviewed
              </span>
            )}
          </div>
        )}
        <div
          className="px-5 py-4 text-sm leading-relaxed"
          style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 16 }}
        >
          <div className="chat-answer prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5">
            <ReactMarkdown remarkPlugins={remarkPlugins}>{message.content}</ReactMarkdown>
          </div>
        </div>
        {message.sources && message.sources.length > 0 && <SourceChips sources={message.sources} />}
      </div>
    </div>
  );
});

// Stable reference for remark plugins array
const remarkPlugins = [remarkGfm];

export default function IntelligencePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [toolSteps, setToolSteps] = useState<ToolStep[]>([]);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [costWarning, setCostWarning] = useState<number | null>(null);
  const [betterThinking, setBetterThinking] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // Panneau latéral des chats : fermable, réouvrable via un bouton discret.
  const [showConvPanel, setShowConvPanel] = useState(true);
  const [showNotionTree, setShowNotionTree] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Vrai tant que l'utilisateur est collé (ou proche) du bas : on n'auto-scroll
  // pendant l'écriture que dans ce cas, sinon on le laisse lire tranquillement.
  const pinnedToBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Jeton du polling en cours : permet d'annuler une boucle de poll quand on
  // change de conversation ou démonte la page (évite les fuites / mélanges).
  const pollRef = useRef<{ cancelled: boolean } | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) pollRef.current.cancelled = true;
    pollRef.current = null;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedToBottomRef.current = distanceFromBottom < 120;
  }, []);

  useEffect(() => {
    if (pinnedToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, streamingText]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const loadConversations = useCallback(async () => {
    try {
      const r = await fetch("/api/conversations");
      if (r.ok) {
        const { conversations: data } = await r.json();
        setConversations(data ?? []);
      }
    } catch (e) {
      console.error("Erreur chargement conversations:", e);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const startNewConversation = () => {
    stopPolling();
    setLoading(false);
    setMessages([]);
    setApiHistory([]);
    setStreamingText("");
    setToolSteps([]);
    setSources([]);
    setCostWarning(null);
    setConversationId(null);
    setInput("");
    setAttachments([]);
  };

  // Upload des pièces jointes (cahier des charges, RFP...) : lecture en base64
  // côté client puis POST /api/chat/attachments qui extrait/stocke le contenu.
  const handlePickFiles = useCallback((files: FileList) => {
    // Cap GLOBAL de 3 fichiers par message (limite payload Netlify) : on
    // bloque au-delà au lieu de laisser le serveur en ignorer en silence.
    const room = 3 - attachments.length - uploadingCount;
    const picked = Array.from(files);
    if (picked.length > room) {
      alert("Maximum 3 documents par message.");
      if (room <= 0) return;
    }
    for (const file of picked.slice(0, room)) {
      setUploadingCount((n) => n + 1);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
          const r = await fetch("/api/chat/attachments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, mime: file.type, base64 }),
          });
          const data = await r.json().catch(() => ({}));
          if (r.ok && data.attachment) {
            setAttachments((prev) => [...prev, data.attachment as ChatAttachment]);
          } else {
            alert(data.error ?? `Upload de "${file.name}" impossible.`);
          }
        } catch {
          alert(`Upload de "${file.name}" impossible.`);
        } finally {
          setUploadingCount((n) => n - 1);
        }
      };
      reader.onerror = () => setUploadingCount((n) => n - 1);
      reader.readAsDataURL(file);
    }
  }, [attachments.length, uploadingCount]);

  const loadConversation = async (id: string) => {
    try {
      stopPolling();
      setLoading(false);
      const r = await fetch(`/api/conversations/${id}`);
      if (!r.ok) return;
      const { messages: msgs, apiHistory: history } = await r.json();
      setMessages(msgs ?? []);
      setApiHistory(history ?? []);
      setConversationId(id);
    } catch (e) {
      console.error("Erreur chargement conversation:", e);
    }
  };

  const deleteConversation = async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (conversationId === id) startNewConversation();
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error("Erreur suppression conversation:", e);
    }
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading || uploadingCount > 0) return;
    const sentAttachments = attachments;
    const attachmentIds = sentAttachments.map((a) => a.id);
    const attachmentNames = sentAttachments.map((a) => a.filename);
    setInput("");
    setAttachments([]);
    const userText = text || "Analyse le(s) document(s) joint(s).";
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userText, ...(attachmentNames.length ? { attachments: attachmentNames } : {}) },
    ];
    // Envoi d'un message : on recolle au bas pour voir sa propre bulle.
    pinnedToBottomRef.current = true;
    setMessages(newMessages);
    setLoading(true);
    setStreamingText("");
    setToolSteps([]);
    setSources([]);
    setCostWarning(null);

    let convId = conversationId;
    if (!convId) {
      try {
        const r = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userText.slice(0, 50) }),
        });
        if (r.ok) {
          const { conversation } = await r.json();
          convId = conversation.id;
          setConversationId(convId);
          setConversations((prev) => [conversation, ...prev]);
        }
      } catch {}
    }

    // Annule un éventuel poll en cours et ouvre un nouveau jeton pour ce send.
    stopPolling();
    const token = { cancelled: false };
    pollRef.current = token;

    try {
      const apiMessages: ApiMessage[] = apiHistory.length > 0
        ? [...apiHistory, { role: "user", content: userText }]
        : newMessages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, betterThinking, attachmentIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { jobId } = await res.json();
      if (!jobId) throw new Error("No job id");

      // L'agentic loop tourne dans une Background Function ; on lit la
      // progression écrite dans chat_jobs par polling toutes les ~1s. Le worker
      // bat un heartbeat (updated_at) toutes les ~8s : si updated_at gèle plus
      // de STALE_MS, le process a été tué -> on débloque l'UI au lieu de tourner
      // indéfiniment.
      const STALE_MS = 45000;
      let lastStamp = "";
      let lastChangeMs = Date.now();
      while (!token.cancelled) {
        await new Promise((r) => setTimeout(r, 1000));
        if (token.cancelled) return;

        const pr = await fetch(`/api/chat/${jobId}`);
        if (!pr.ok) throw new Error(`HTTP ${pr.status}`);
        const { job } = await pr.json();
        if (token.cancelled) return;

        const stamp = typeof job.updated_at === "string" ? job.updated_at : "";
        if (stamp !== lastStamp) {
          lastStamp = stamp;
          lastChangeMs = Date.now();
        } else if (job.status === "running" && Date.now() - lastChangeMs > STALE_MS) {
          throw new Error("The response stopped (connection lost). Please try again.");
        }

        if (typeof job.streaming_text === "string") setStreamingText(job.streaming_text);
        if (Array.isArray(job.tool_steps)) setToolSteps(normalizeToolSteps(job.tool_steps));
        if (Array.isArray(job.sources)) setSources(job.sources);
        if (job.cost != null) setCostWarning(Number(job.cost));

        if (job.status === "done") {
          const fullText = job.final_text || job.streaming_text || "";
          const latestHistory: ApiMessage[] | null = Array.isArray(job.history) ? job.history : null;
          const doneSources: ChatSource[] = Array.isArray(job.sources) ? job.sources : [];
          pollRef.current = null;
          setMessages((prev) => [...prev, { role: "assistant", content: fullText, sources: doneSources }]);
          setSources([]);
          if (latestHistory) setApiHistory(latestHistory);
          setStreamingText("");
          setToolSteps([]);
          setLoading(false);

          if (convId) {
            const isFirst = messages.length === 0;
            fetch(`/api/conversations/${convId}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userContent: userText,
                assistantContent: fullText,
                apiHistory: latestHistory,
                isFirst,
              }),
            }).then((r) => r.json()).then((data) => {
              if (data.title) {
                setConversations((prev) =>
                  prev.map((c) => c.id === convId ? { ...c, title: data.title } : c)
                );
              }
            }).catch(() => {});
          }
          return;
        }

        if (job.status === "error") {
          pollRef.current = null;
          setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${job.error || "Unknown error"}` }]);
          setStreamingText("");
          setToolSteps([]);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      if (token.cancelled) return;
      pollRef.current = null;
      const detail = err instanceof Error ? err.message : "Unknown error";
      console.error("[Chat] client error:", detail);
      setMessages((prev) => [...prev, { role: "assistant", content: `Connection error: ${detail}` }]);
      setStreamingText("");
      setToolSteps([]);
      setLoading(false);
    }
  };

  const isHome = messages.length === 0;
  const { user } = useUser();
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "•";
  const conversationTitle =
    conversations.find((c) => c.id === conversationId)?.title
    ?? messages.find((m) => m.role === "user")?.content.slice(0, 60)
    ?? "New chat";

  return (
    <div className="flex flex-col h-full" style={{ background: COLORS.bgPage }}>
      {/* Panneau chats (barre de gauche) + contenu conversation */}
      <div className="flex flex-1 min-h-0">
        {showConvPanel && (
          <ConversationsPanel
            conversations={conversations}
            currentId={conversationId}
            onSelect={loadConversation}
            onDelete={deleteConversation}
            onNew={startNewConversation}
            onClose={() => setShowConvPanel(false)}
            onNotionTree={() => setShowNotionTree(true)}
          />
        )}
        <div className="flex flex-col flex-1 min-w-0" style={{ position: "relative" }}>
          {/* Rouvrir le panneau chats depuis l'accueil (stage sombre) */}
          {isHome && !showConvPanel && (
            <button
              onClick={() => setShowConvPanel(true)}
              aria-label="Afficher les chats"
              title="Afficher les chats"
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                zIndex: 20,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 9,
                border: "1px solid rgba(26,22,19,0.14)",
                background: "#ffffff",
                color: "#7a7068",
                cursor: "pointer",
              }}
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
      {/* Top bar : titre de la conversation + avatar (style prototype, en clair) */}
      {!isHome && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 20px",
            borderBottom: `1px solid ${COLORS.line}`,
            background: COLORS.bgCard,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {!showConvPanel && (
              <button
                onClick={() => setShowConvPanel(true)}
                aria-label="Afficher les chats"
                title="Afficher les chats"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: COLORS.ink5,
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bgSoft; e.currentTarget.style.color = COLORS.ink2; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.ink5; }}
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: COLORS.ink0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {conversationTitle}
            </span>
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#ff8fb8,#f01563)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10.5,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        </div>
      )}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto" style={{ padding: isHome ? 0 : "16px 24px" }}>
        {(
          isHome ? (
            <ChatHome
              input={input}
              onChange={setInput}
              onSend={send}
              deepDive={betterThinking}
              onToggleDeepDive={() => setBetterThinking((v) => !v)}
              attachments={attachments}
              uploadingCount={uploadingCount}
              onPickFiles={handlePickFiles}
              onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
            />
          ) : (
            <div className="max-w-3xl mx-auto space-y-5" style={{ paddingTop: 8 }}>
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} />
              ))}
              {streamingText && (
                <div className="flex justify-start">
                  <AssistantBadge />
                  <div
                    className="px-5 py-4 text-sm leading-relaxed"
                    style={{ flex: 1, minWidth: 0, maxWidth: "88%", background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 16 }}
                  >
                    <div className="chat-answer prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5">
                      <ReactMarkdown remarkPlugins={remarkPlugins}>{streamingText}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
              {loading && (
                <div className="flex justify-start items-start">
                  <AssistantBadge />
                  <div
                    className="px-4 py-3 space-y-1.5"
                    style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 16 }}
                  >
                    {toolSteps.map((step, i) => {
                      const isCurrent = i === toolSteps.length - 1 && !streamingText;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          {step.name ? (
                            <ToolLogo logo={logoKeyForTool(step.name)} size={15} />
                          ) : (
                            <span style={{ width: 15, display: "inline-block" }} />
                          )}
                          <span className="text-xs" style={{ color: "#888" }}>{step.label}</span>
                          {isCurrent ? (
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#f01563" }} />
                          ) : (
                            <span className="text-xs" style={{ color: "#16a34a" }}>✓</span>
                          )}
                        </div>
                      );
                    })}
                    {costWarning !== null && (
                      <div className="flex items-center gap-2 mt-1 px-2 py-1 rounded-lg" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                        <span className="text-xs">⚠️</span>
                        <span className="text-xs font-medium" style={{ color: "#c2410c" }}>
                          Expensive request: ~{(costWarning * 100).toFixed(1)}¢ so far
                        </span>
                      </div>
                    )}
                    {!streamingText && (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#f01563", animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                        {toolSteps.length > 0 && (
                          <span className="text-xs" style={{ color: "#bbb" }}>in progress…</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {loading && sources.length > 0 && (
                <div style={{ marginLeft: 38 }}>
                  <SourceChips sources={sources} />
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )
        )}
      </div>

      {/* Input bar — masquée sur l'accueil (le composer est dans le stage) */}
      {!isHome && (
        <div style={{ padding: "8px 24px 20px" }}>
          <ChatInputBar
            ref={textareaRef}
            value={input}
            onChange={setInput}
            onSend={send}
            loading={loading}
            placeholder="Refine, clarify, or ask another question…"
            betterThinking={betterThinking}
            onToggleBetterThinking={() => setBetterThinking((v) => !v)}
            attachments={attachments}
            uploadingCount={uploadingCount}
            onPickFiles={handlePickFiles}
            onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
          />
          <p
            style={{
              textAlign: "center",
              fontSize: 10,
              marginTop: 10,
              color: COLORS.ink5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            HubSpot · Slack · Gmail · Drive · LinkedIn · Claap · Notion · Web
          </p>
        </div>
      )}
        </div>
      </div>

      {showNotionTree && <NotionTreeModal onClose={() => setShowNotionTree(false)} />}

      {/* Style des réponses markdown (cartes) : titres à barre rose, tableaux propres */}
      <style jsx global>{`
        .chat-answer h1 { font-size: 1.15rem; font-weight: 800; margin: 0.4rem 0 0.6rem; color: #111; }
        .chat-answer h2, .chat-answer h3 {
          font-size: 0.95rem;
          font-weight: 700;
          color: #111;
          border-left: 3px solid #f01563;
          padding-left: 10px;
          margin: 1.1rem 0 0.5rem;
        }
        .chat-answer table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid ${COLORS.line};
          border-radius: 10px;
          overflow: hidden;
          font-size: 0.8rem;
          margin: 0.5rem 0;
        }
        .chat-answer thead th {
          background: ${COLORS.bgSoft};
          color: ${COLORS.ink3};
          font-weight: 600;
          text-align: left;
          padding: 7px 12px;
          border-bottom: 1px solid ${COLORS.line};
        }
        .chat-answer tbody td {
          padding: 7px 12px;
          border-bottom: 1px solid ${COLORS.line};
        }
        .chat-answer tbody tr:last-child td { border-bottom: none; }
        .chat-answer a { color: #f01563; }
        .chat-answer strong { color: #111; }
      `}</style>
    </div>
  );
}

function ConversationsPanel({
  conversations,
  currentId,
  onSelect,
  onDelete,
  onNew,
  onClose,
  onNotionTree,
}: {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  onNotionTree: () => void;
}) {
  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        borderRight: `1px solid ${COLORS.line}`,
        background: COLORS.bgCard,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* En-tête : masquer le panneau + nouveau chat */}
      <div style={{ padding: "10px 10px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            aria-label="Masquer les chats"
            title="Masquer le panneau"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: COLORS.ink5,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bgSoft; e.currentTarget.style.color = COLORS.ink2; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.ink5; }}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <button
          onClick={onNew}
          aria-label="New chat"
          title="Nouvelle conversation"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "9px 12px",
            borderRadius: 10,
            border: "none",
            background: COLORS.brand,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus size={15} />
          New chat
        </button>
        <button
          onClick={onNotionTree}
          aria-label="What's on the Notion"
          title="Explorer la base de connaissance Coachello (Notion)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "9px 12px",
            borderRadius: 10,
            border: `1px solid ${COLORS.lineStrong}`,
            background: COLORS.bgCard,
            color: COLORS.ink2,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = COLORS.brand;
            e.currentTarget.style.color = COLORS.brand;
            e.currentTarget.style.background = COLORS.brandTintSoft;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = COLORS.lineStrong;
            e.currentTarget.style.color = COLORS.ink2;
            e.currentTarget.style.background = COLORS.bgCard;
          }}
        >
          <ToolLogo logo="notion" size={15} />
          What&apos;s on the Notion
        </button>
      </div>
      <div style={{ padding: "6px 14px 4px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.ink5 }}>
          Chats
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
        {conversations.length === 0 && (
          <p style={{ fontSize: 12, color: COLORS.ink5, padding: "8px 6px", margin: 0 }}>No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="group hover:bg-black/5"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 8px",
              borderRadius: 8,
              cursor: "pointer",
              marginBottom: 2,
              background: c.id === currentId ? COLORS.brandTintSoft : undefined,
              color: c.id === currentId ? COLORS.brand : COLORS.ink1,
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.title || "Untitled"}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              aria-label="Delete conversation"
              className="opacity-0 group-hover:opacity-100"
              style={{ border: "none", background: "none", cursor: "pointer", color: COLORS.ink5, padding: 2, display: "inline-flex" }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
