"use client";

import { CheckCircle2, AlertTriangle, Rocket, Mail, ListChecks, MessageSquare, Trash2 } from "lucide-react";
import type { KeyMoment, KeyMomentKind, SalesCoachAnalysis } from "@/lib/guides/sales-coach";
import type { TalkRatio } from "@/lib/sales-coach/talk-ratio";
import { KeyMoments } from "./key-moments";

// Claude occasionally returns string arrays as objects { "1": "...", "2": "..." }
// or as array-likes that lack .map. Normalize so .map() never crashes.
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (v && typeof v === "object") {
    return Object.values(v as Record<string, unknown>).filter((x): x is string => typeof x === "string");
  }
  if (typeof v === "string") return [v];
  return [];
}

const KEY_MOMENT_KINDS = new Set<KeyMomentKind>(["engagement", "objection", "pivot", "doubt", "next_step", "concession"]);

function toKeyMoments(v: unknown): KeyMoment[] {
  const items = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v as Record<string, unknown>) : [];
  const out: KeyMoment[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const m = it as Partial<KeyMoment>;
    if (typeof m.kind !== "string" || !KEY_MOMENT_KINDS.has(m.kind as KeyMomentKind)) continue;
    out.push({
      timestamp_seconds: typeof m.timestamp_seconds === "number" ? m.timestamp_seconds : 0,
      kind: m.kind as KeyMomentKind,
      label: typeof m.label === "string" ? m.label : "",
      quote: typeof m.quote === "string" ? m.quote : "",
    });
  }
  return out;
}

interface Props {
  analysis: SalesCoachAnalysis;
  talkRatio: TalkRatio | null;
  hubspotTaskIds: string[] | null;
  onOpenEmailDraft: () => void;
  onCreateTasks: () => void;
  onDeleteTasks: () => void;
  creatingTasks: boolean;
  deletingTasks: boolean;
  taskResult: { ok: boolean; msg: string } | null;
  onGoToAxes: () => void;
}

const AXES_LABELS = [
  { key: "opening", label: "Opening" },
  { key: "discovery", label: "Discovery" },
  { key: "active_listening", label: "Active listening" },
  { key: "value_articulation", label: "Value articulation" },
  { key: "objection_handling", label: "Objection handling" },
  { key: "next_steps", label: "Next steps" },
] as const;

function scoreColor(score: number): string {
  if (score >= 7.5) return "#10b981";
  if (score >= 5) return "#d97706";
  if (score > 0) return "#dc2626";
  return "#cbd5e1";
}

function ThinBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(10, score)) * 10;
  return (
    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "#f0f0f0" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: scoreColor(score) }} />
    </div>
  );
}

export function RecapTab({
  analysis,
  talkRatio,
  hubspotTaskIds,
  onOpenEmailDraft,
  onCreateTasks,
  onDeleteTasks,
  creatingTasks,
  deletingTasks,
  taskResult,
  onGoToAxes,
}: Props) {
  const strengths = toStringArray(analysis.strengths);
  const weaknesses = toStringArray(analysis.weaknesses);
  const priorities = toStringArray(analysis.coaching_priorities);
  const keyMoments = toKeyMoments(analysis.key_moments);
  const tasksCreated = Array.isArray(hubspotTaskIds) && hubspotTaskIds.length > 0;

  return (
    <div className="space-y-8">
      {/* Strengths */}
      {strengths.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full"
              style={{ background: "#ecfdf5", color: "#059669" }}
            >
              <CheckCircle2 size={14} />
            </span>
            <h3 className="text-base font-semibold" style={{ color: "#111" }}>Points forts</h3>
          </div>
          <div className="rounded-lg p-4 space-y-2" style={{ background: "#fff", border: "1px solid #f0f0f0" }}>
            {strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#059669" }} />
                <p className="text-sm" style={{ color: "#222", lineHeight: 1.55 }}>{s}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full"
              style={{ background: "#fef3c7", color: "#b45309" }}
            >
              <AlertTriangle size={14} />
            </span>
            <h3 className="text-base font-semibold" style={{ color: "#111" }}>À travailler</h3>
          </div>
          <div className="rounded-lg p-4 space-y-2" style={{ background: "#fff", border: "1px solid #f0f0f0" }}>
            {weaknesses.map((w, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#b45309" }} />
                <p className="text-sm" style={{ color: "#222", lineHeight: 1.55 }}>{w}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top 3 actions + CTAs */}
      {priorities.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full"
              style={{ background: "#fef2f4", color: "#f01563" }}
            >
              <Rocket size={14} />
            </span>
            <h3 className="text-base font-semibold" style={{ color: "#111" }}>Top {priorities.length} actions pour le prochain call</h3>
          </div>
          <div className="rounded-lg p-5 space-y-3" style={{ background: "#fff", border: "1px solid #fbd5de" }}>
            <ol className="space-y-3">
              {priorities.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                    style={{ background: "#f01563", color: "#fff" }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm pt-0.5" style={{ color: "#1a1a1a", lineHeight: 1.55 }}>{p}</p>
                </li>
              ))}
            </ol>
            <div className="pt-3 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "#fbd5de" }}>
              <button
                onClick={onOpenEmailDraft}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md"
                style={{ background: "#f01563", color: "#fff" }}
              >
                <Mail size={12} />
                Brouillon mail follow-up
              </button>
              {tasksCreated ? (
                <>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md"
                    style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}
                  >
                    <CheckCircle2 size={12} />
                    {hubspotTaskIds!.length} tâche{hubspotTaskIds!.length > 1 ? "s" : ""} HubSpot créée{hubspotTaskIds!.length > 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={onDeleteTasks}
                    disabled={deletingTasks}
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md disabled:opacity-50"
                    style={{ background: "#fff", color: "#dc2626", border: "1px solid #fecaca" }}
                    title="Archiver les tâches dans HubSpot"
                  >
                    <Trash2 size={11} />
                    {deletingTasks ? "Suppression…" : "Supprimer"}
                  </button>
                </>
              ) : (
                <button
                  onClick={onCreateTasks}
                  disabled={creatingTasks}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
                  style={{ background: "#fff", color: "#f01563", border: "1px solid #f01563" }}
                >
                  <ListChecks size={12} />
                  {creatingTasks ? "Création…" : "Tâches HubSpot"}
                </button>
              )}
              {taskResult && (
                <span className="text-xs" style={{ color: taskResult.ok ? "#059669" : "#dc2626" }}>
                  {taskResult.msg}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Scores par axe + talk ratio */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold" style={{ color: "#111" }}>Scores par axe</h3>
          <button onClick={onGoToAxes} className="text-xs font-medium" style={{ color: "#f01563" }}>
            Voir le détail →
          </button>
        </div>
        <div className="rounded-lg p-4 space-y-3" style={{ background: "#fff", border: "1px solid #f0f0f0" }}>
          {AXES_LABELS.map(({ key, label }) => {
            const axis = analysis.axes?.[key];
            const score = axis?.score ?? 0;
            return (
              <div key={key} className="flex items-center gap-4">
                <div className="w-44 text-sm" style={{ color: "#444" }}>{label}</div>
                <ThinBar score={score} />
                <div className="w-12 text-right text-sm font-semibold tabular-nums" style={{ color: scoreColor(score) }}>
                  {score.toFixed(1)}
                </div>
              </div>
            );
          })}

          {talkRatio && (
            <div className="pt-3 mt-2 border-t" style={{ borderColor: "#f0f0f0" }}>
              <div className="flex items-center gap-3 text-xs" style={{ color: "#444" }}>
                <MessageSquare size={13} style={{ color: "#888" }} />
                <span className="font-medium">Talk ratio</span>
                <span className="text-[11px]" style={{ color: "#888" }}>
                  Coachello {talkRatio.internal_pct}% · Prospect {talkRatio.external_pct}%
                </span>
              </div>
              <div className="flex h-1.5 mt-2 rounded-full overflow-hidden" style={{ background: "#f0f0f0" }}>
                <div style={{ width: `${talkRatio.internal_pct}%`, background: "#6d28d9" }} />
                <div style={{ width: `${talkRatio.external_pct}%`, background: "#10b981" }} />
              </div>
              {talkRatio.by_speaker.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "#666" }}>
                  {talkRatio.by_speaker.map((s) => (
                    <span key={s.speakerId}>
                      <span style={{ color: s.isInternal ? "#6d28d9" : "#10b981" }}>●</span>{" "}
                      {s.name ?? s.email ?? "Speaker"} {s.pct}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Key moments */}
      {keyMoments.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-base font-semibold" style={{ color: "#111" }}>Moments clés ({keyMoments.length})</h3>
          </div>
          <div className="rounded-lg p-2" style={{ background: "#fafafa", border: "1px solid #f0f0f0" }}>
            <KeyMoments moments={keyMoments} />
          </div>
        </section>
      )}
    </div>
  );
}
