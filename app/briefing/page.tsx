"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Calendar, Mail, Globe, Send, ExternalLink } from "lucide-react";
import type { CalendarEvent } from "@/lib/google-calendar";

// ── Types ─────────────────────────────────────────────────────────────────────
interface GatheredData {
  contacts: Record<string, string>[];
  deals: { name: string; stage: string; amount: string | null; closedate: string | null }[];
  engagements: { type: string; date: string; subject: string | null; body: string | null; duration: number | null }[];
  gmailMessages: { subject: string; from: string; date: string; snippet: string }[];
  slackMessages: { channel: string; text: string; timestamp: string }[];
  webResults: { title: string; url: string; content: string; published_date: string | null }[];
  cached?: boolean;
  briefing?: BriefingResult;
}

interface BriefingResult {
  identity: { name: string; role: string; company: string; hubspotStage: string; lastContact: string };
  relationship: { summary: string; deals: { name: string; stage: string; amount: string }[]; lastEngagements: string[] };
  recentNews: { items: { type: string; text: string; url?: string; date: string }[] };
  discussionAngles: string[];
  confidence: "high" | "medium" | "low";
}

type LoadState = "idle" | "loading" | "done" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────
function eventDateLabel(start: string): { label: string; color: string } {
  const d = new Date(start);
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();
  if (d.toDateString() === todayStr) return { label: "Aujourd'hui", color: "#f01563" };
  if (d.toDateString() === tomorrowStr) return { label: "Demain", color: "#f97316" };
  return {
    label: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
    color: "#888",
  };
}

function eventTime(start: string): string {
  if (!start.includes("T")) return "";
  return new Date(start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function externalAttendees(event: CalendarEvent) {
  return event.attendees.filter((a) => !a.self && !a.email.includes("coachello"));
}

function companyFromEmail(email: string): string {
  const domain = email.split("@")[1] ?? "";
  const parts = domain.split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : domain;
}

function confidenceBadge(c: "high" | "medium" | "low") {
  if (c === "high") return { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", label: "Données riches" };
  if (c === "medium") return { bg: "#fef3c7", color: "#92400e", border: "#fde68a", label: "Données partielles" };
  return { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", label: "Peu de données" };
}

function formatBriefingForSlack(briefing: BriefingResult, eventTitle: string): string {
  const lines: string[] = [
    `*Briefing — ${eventTitle}*`,
    "",
    `*${briefing.identity.name}* — ${briefing.identity.role} @ ${briefing.identity.company}`,
    `Statut CRM : ${briefing.identity.hubspotStage || "—"} | Dernier contact : ${briefing.identity.lastContact || "—"}`,
    "",
    `*Relation* : ${briefing.relationship.summary}`,
    "",
    `*Actualités* :`,
    ...(briefing.recentNews.items.slice(0, 3).map((i) => `• ${i.text}`)),
    "",
    `*3 angles de discussion* :`,
    ...(briefing.discussionAngles.map((a, i) => `${i + 1}. ${a}`)),
  ];
  return lines.join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BriefingPage() {
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [gatherState, setGatherState] = useState<LoadState>("idle");
  const [briefingState, setBriefingState] = useState<LoadState>("idle");
  const [rawData, setRawData] = useState<GatheredData | null>(null);
  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [sendingSlack, setSendingSlack] = useState(false);
  const [slackSent, setSlackSent] = useState(false);
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [draftSent, setDraftSent] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/events?days=7")
      .then((r) => r.json())
      .then((data) => {
        setCalendarConnected(data.calendarConnected ?? false);
        setEvents(data.events ?? []);
      })
      .catch(() => setCalendarConnected(false))
      .finally(() => setLoadingEvents(false));
  }, []);

  async function selectEvent(event: CalendarEvent, forceRefresh = false) {
    setSelectedEvent(event);
    setBriefing(null);
    setRawData(null);
    setSlackSent(false);
    setDraftSent(false);

    const ext = externalAttendees(event);
    const company = ext[0] ? companyFromEmail(ext[0].email) : "";

    setGatherState("loading");
    setBriefingState("idle");

    try {
      const gatherRes = await fetch("/api/briefing/gather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, eventTitle: event.title, attendees: ext, company }),
      });
      if (!gatherRes.ok) throw new Error("gather failed");
      const gathered: GatheredData = await gatherRes.json();
      setRawData(gathered);
      setGatherState("done");

      // Use cached briefing if available and not forcing refresh
      if (gathered.cached && gathered.briefing && !forceRefresh) {
        setBriefing(gathered.briefing);
        setBriefingState("done");
        return;
      }

      setBriefingState("loading");
      const synthRes = await fetch("/api/briefing/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          eventTitle: event.title,
          eventStart: event.start,
          attendees: ext,
          rawData: gathered,
        }),
      });
      if (!synthRes.ok) throw new Error("synthesize failed");
      const result: BriefingResult = await synthRes.json();
      setBriefing(result);
      setBriefingState("done");
    } catch {
      setGatherState("error");
    }
  }

  async function sendToSlack() {
    if (!briefing || !selectedEvent) return;
    setSendingSlack(true);
    try {
      const res = await fetch("/api/briefing/send-slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: "",
          briefingText: formatBriefingForSlack(briefing, selectedEvent.title),
          eventTitle: selectedEvent.title,
        }),
      });
      if (res.ok) setSlackSent(true);
    } finally {
      setSendingSlack(false);
    }
  }

  async function createDraft() {
    if (!briefing || !selectedEvent) return;
    setDraftingEmail(true);
    try {
      const ext = externalAttendees(selectedEvent);
      const to = ext.map((a) => a.email);
      const subject = `Préparation : ${selectedEvent.title}`;
      const body = formatBriefingForSlack(briefing, selectedEvent.title).replace(/\*/g, "");

      const form = new FormData();
      form.append("to", JSON.stringify(to));
      form.append("subject", subject);
      form.append("body", body);
      const res = await fetch("/api/gmail/draft", { method: "POST", body: form });
      if (res.ok) setDraftSent(true);
    } finally {
      setDraftingEmail(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden" style={{ background: "#f8f8f8" }}>

      {/* ── LEFT: Calendar Events ───────────────────────────────────────────── */}
      <div className="flex flex-col border-r" style={{ width: 364, flexShrink: 0, background: "#fff", borderColor: "#eee" }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: "#eee" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#111" }}>Meetings à venir</h2>
          <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>7 prochains jours</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {calendarConnected === false && (
            <div className="rounded-xl p-4 text-center" style={{ background: "#fde8ef", border: "1px solid #f9b4cb" }}>
              <Calendar size={20} style={{ color: "#f01563", margin: "0 auto 8px" }} />
              <p className="text-xs font-semibold mb-1" style={{ color: "#c01252" }}>Calendar non connecté</p>
              <p className="text-xs mb-3" style={{ color: "#c01252" }}>
                Reconnecte Google pour activer l&apos;accès Calendar.
              </p>
              <a
                href="/api/gmail/connect"
                className="inline-block text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: "#f01563", color: "#fff" }}
              >
                Reconnecter Google →
              </a>
            </div>
          )}

          {loadingEvents && calendarConnected !== false && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#f5f5f5" }} />
              ))}
            </div>
          )}

          {!loadingEvents && calendarConnected && events.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
              <span className="text-3xl">📅</span>
              <p className="text-xs" style={{ color: "#aaa" }}>Aucun meeting dans les 7 prochains jours</p>
            </div>
          )}

          {events.map((event) => {
            const ext = externalAttendees(event);
            const { label, color } = eventDateLabel(event.start);
            const time = eventTime(event.start);
            const active = selectedEvent?.id === event.id;
            const isInternal = ext.length === 0;

            return (
              <button
                key={event.id}
                onClick={() => !isInternal && selectEvent(event)}
                disabled={isInternal}
                className="w-full text-left p-3 rounded-xl border transition-colors"
                style={{
                  borderColor: active ? "#f01563" : "#e5e5e5",
                  background: active ? "#fff9fb" : "#fff",
                  opacity: isInternal ? 0.5 : 1,
                  cursor: isInternal ? "default" : "pointer",
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-xs font-semibold leading-tight" style={{ color: "#111" }}>{event.title}</p>
                  <span className="text-[10px] shrink-0 font-medium" style={{ color }}>{label}</span>
                </div>
                {time && <p className="text-[10px] mb-1" style={{ color: "#888" }}>{time}</p>}
                <div className="flex items-center gap-1.5">
                  {isInternal ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#f1f5f9", color: "#475569" }}>Interne</span>
                  ) : (
                    <span className="text-[10px]" style={{ color: "#aaa" }}>
                      {ext[0]?.displayName || ext[0]?.email}
                      {ext.length > 1 ? ` +${ext.length - 1}` : ""}
                    </span>
                  )}
                  {event.meetingLink && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#1d4ed8" }}>Visio</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CENTER: Briefing Content ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
        {!selectedEvent && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <Calendar size={40} style={{ color: "#e5e5e5" }} />
            <p className="text-sm font-medium" style={{ color: "#888" }}>Sélectionne un meeting</p>
            <p className="text-xs" style={{ color: "#bbb" }}>Clique sur un événement pour générer le briefing</p>
          </div>
        )}

        {selectedEvent && (
          <div className="px-6 py-5 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold" style={{ color: "#111" }}>{selectedEvent.title}</h2>
                <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                  {selectedEvent.start
                    ? new Date(selectedEvent.start).toLocaleDateString("fr-FR", {
                        weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                      })
                    : ""}
                  {selectedEvent.meetingLink && (
                    <a href={selectedEvent.meetingLink} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-0.5" style={{ color: "#1d4ed8" }}>
                      Rejoindre <ExternalLink size={10} />
                    </a>
                  )}
                </p>
              </div>
              {briefingState === "done" && (
                <button
                  onClick={() => selectEvent(selectedEvent, true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "#f5f5f5", color: "#555" }}
                >
                  <RefreshCw size={11} />
                  Régénérer
                </button>
              )}
            </div>

            {/* Loading: gather */}
            {gatherState === "loading" && (
              <div className="space-y-3">
                {["HubSpot CRM…", "Gmail…", "Slack…", "Web…"].map((src) => (
                  <div key={src} className="flex items-center gap-3 p-3 rounded-xl border animate-pulse" style={{ borderColor: "#f0f0f0", background: "#fafafa" }}>
                    <div className="w-4 h-4 rounded-full" style={{ background: "#f5f5f5" }} />
                    <p className="text-xs" style={{ color: "#aaa" }}>Recherche dans {src}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Loading: synthesize */}
            {gatherState === "done" && briefingState === "loading" && (
              <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ borderColor: "#fde8ef", background: "#fff9fb" }}>
                <div className="w-2 h-2 rounded-full animate-ping" style={{ background: "#f01563" }} />
                <p className="text-xs" style={{ color: "#c01252" }}>Claude analyse les données…</p>
              </div>
            )}

            {/* Error */}
            {gatherState === "error" && (
              <div className="p-4 rounded-xl border text-xs" style={{ borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}>
                Erreur lors de la récupération des données. Réessaie dans un moment.
              </div>
            )}

            {/* Data sources summary */}
            {gatherState === "done" && rawData && (
              <div className="flex gap-2 flex-wrap">
                {[
                  { icon: "🏢", label: `${rawData.contacts.length} contact${rawData.contacts.length > 1 ? "s" : ""} HubSpot`, active: rawData.contacts.length > 0 },
                  { icon: "💼", label: `${rawData.deals.length} deal${rawData.deals.length > 1 ? "s" : ""}`, active: rawData.deals.length > 0 },
                  { icon: "✉️", label: `${rawData.gmailMessages.length} email${rawData.gmailMessages.length > 1 ? "s" : ""}`, active: rawData.gmailMessages.length > 0 },
                  { icon: "💬", label: `${rawData.slackMessages.length} Slack`, active: rawData.slackMessages.length > 0 },
                  { icon: "🌐", label: `${rawData.webResults.length} web`, active: rawData.webResults.length > 0 },
                ].map(({ icon, label, active }) => (
                  <span key={label} className="text-[10px] px-2 py-1 rounded-full" style={{
                    background: active ? "#f0fdf4" : "#f5f5f5",
                    color: active ? "#166534" : "#aaa",
                    border: `1px solid ${active ? "#bbf7d0" : "#e5e5e5"}`,
                  }}>
                    {icon} {label}
                  </span>
                ))}
                {rawData.cached && (
                  <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                    Cache
                  </span>
                )}
              </div>
            )}

            {/* Briefing sections */}
            {briefingState === "done" && briefing && (
              <div className="space-y-4">

                {/* Identity */}
                <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-3" style={{ color: "#aaa" }}>Qui tu rencontres</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold uppercase shrink-0" style={{ background: "#fde8ef", color: "#f01563" }}>
                      {briefing.identity.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "#111" }}>{briefing.identity.name}</p>
                      <p className="text-xs" style={{ color: "#888" }}>
                        {briefing.identity.role}{briefing.identity.company ? ` · ${briefing.identity.company}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {briefing.identity.hubspotStage && (
                        <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
                          {briefing.identity.hubspotStage}
                        </span>
                      )}
                      {briefing.confidence && (() => {
                        const badge = confidenceBadge(briefing.confidence);
                        return (
                          <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                            {badge.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  {briefing.identity.lastContact && (
                    <p className="text-xs mt-2" style={{ color: "#888" }}>Dernier contact : {briefing.identity.lastContact}</p>
                  )}
                </div>

                {/* Relationship */}
                <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#aaa" }}>Historique de la relation</p>
                  <p className="text-xs mb-3" style={{ color: "#555", lineHeight: "1.6" }}>{briefing.relationship.summary}</p>

                  {briefing.relationship.deals.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {briefing.relationship.deals.map((d, i) => (
                        <div key={i} className="p-2.5 rounded-lg" style={{ border: "1px solid #e5e5e5", borderLeft: "3px solid #f01563" }}>
                          <p className="text-xs font-medium" style={{ color: "#111" }}>{d.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#dbeafe", color: "#1e40af" }}>{d.stage}</span>
                            {d.amount && <span className="text-xs font-semibold" style={{ color: "#f01563" }}>{d.amount}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {briefing.relationship.lastEngagements?.length > 0 && (
                    <ul className="space-y-1">
                      {briefing.relationship.lastEngagements.slice(0, 3).map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "#666" }}>
                          <span style={{ color: "#f01563" }}>•</span>{e}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Recent news */}
                {briefing.recentNews.items.length > 0 && (
                  <div className="rounded-xl border p-4" style={{ borderColor: "#e5e5e5", background: "#fff" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#aaa" }}>Actualités récentes</p>
                    <div className="space-y-2">
                      {briefing.recentNews.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-sm shrink-0 mt-0.5">
                            {item.type === "web" ? "🌐" : item.type === "slack" ? "💬" : "✉️"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs" style={{ color: "#444" }}>{item.text}</p>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-0.5 mt-0.5" style={{ color: "#1d4ed8" }}>
                                Source <ExternalLink size={9} />
                              </a>
                            )}
                          </div>
                          {item.date && <span className="text-[10px] shrink-0" style={{ color: "#bbb" }}>{item.date}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: Discussion Angles + Actions ─────────────────────────────── */}
      <div className="flex flex-col border-l" style={{ width: 416, flexShrink: 0, background: "#fff", borderColor: "#eee" }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: "#eee" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#111" }}>Angles de discussion</h2>
          <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>Recommandations personnalisées</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!selectedEvent && (
            <p className="text-xs text-center mt-12" style={{ color: "#bbb" }}>Sélectionne un meeting pour voir les recommandations</p>
          )}

          {(briefingState === "loading" || gatherState === "loading") && selectedEvent && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#f5f5f5" }} />
              ))}
            </div>
          )}

          {briefingState === "done" && briefing && (
            <div className="space-y-3">
              {briefing.discussionAngles.map((angle, i) => (
                <div key={i} className="p-3.5 rounded-xl border" style={{ borderColor: "#fde8ef", background: "#fff9fb" }}>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "#f01563", color: "#fff" }}>
                      {i + 1}
                    </span>
                    <p className="text-xs leading-relaxed" style={{ color: "#333" }}>{angle}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {briefingState === "done" && briefing && selectedEvent && (
          <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: "#eee" }}>
            <button
              onClick={sendToSlack}
              disabled={sendingSlack || slackSent}
              className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: slackSent ? "#f0fdf4" : "#f5f5f5", color: slackSent ? "#166534" : "#333" }}
            >
              <Send size={12} />
              {slackSent ? "Envoyé en DM Slack" : sendingSlack ? "Envoi…" : "Envoyer en DM Slack"}
            </button>
            <button
              onClick={createDraft}
              disabled={draftingEmail || draftSent}
              className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: draftSent ? "#f0fdf4" : "#f5f5f5", color: draftSent ? "#166534" : "#333" }}
            >
              <Mail size={12} />
              {draftSent ? "Brouillon créé" : draftingEmail ? "Création…" : "Créer brouillon Gmail"}
            </button>
            <button
              onClick={() => selectEvent(selectedEvent, true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors"
              style={{ background: "#fff", color: "#aaa", border: "1px solid #e5e5e5" }}
            >
              <Globe size={12} />
              Régénérer le briefing
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
