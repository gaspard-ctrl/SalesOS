import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { logUsage } from "@/lib/log-usage";
import { sendSalesCoachSlack } from "@/lib/sales-coach/slack";
import { fetchDealContext, renderDealContextForPrompt, resolveDealFromParticipants } from "@/lib/hubspot";
import { getClaapRecording, fetchTranscriptSegments, pickTranscriptJsonUrl } from "@/lib/claap";
import { computeTalkRatio } from "@/lib/sales-coach/talk-ratio";
import {
  SALES_COACH_SYSTEM_PROMPT,
  salesCoachTool,
  computeGlobalScore,
  type SalesCoachAnalysis,
} from "@/lib/guides/sales-coach";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_ANALYZE_MODEL = "claude-haiku-4-5-20251001";
const MAX_TRANSCRIPT_CHARS_FOR_CLAUDE = 150_000;

type PriorAnalysisRow = {
  id: string;
  meeting_title: string | null;
  meeting_started_at: string | null;
  score_global: number | null;
  meeting_kind: string | null;
  analysis: { summary?: string; bosche?: { trigger_identified?: string | null } } | null;
};

function renderPriorAnalyses(rows: PriorAnalysisRow[]): string {
  if (rows.length === 0) return "Aucun meeting Claap précédent analysé sur ce deal.";
  const lines = [`## Historique Sales Coach sur ce deal (${rows.length})`];
  for (const r of rows) {
    const date = r.meeting_started_at ? new Date(r.meeting_started_at).toLocaleDateString("fr-FR") : "?";
    const score = r.score_global != null ? `${r.score_global}/10` : "?";
    const kind = r.meeting_kind ?? "?";
    const trigger = r.analysis?.bosche?.trigger_identified;
    const summary = r.analysis?.summary?.slice(0, 200) ?? "";
    lines.push(`- [${date}] ${r.meeting_title ?? "?"} (${kind}, ${score}${trigger ? `, trigger: ${trigger}` : ""})`);
    if (summary) lines.push(`  Résumé : ${summary}`);
  }
  return lines.join("\n");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret || req.headers.get("x-internal-secret") !== internalSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row } = await db
    .from("sales_coach_analyses")
    .select("id, status, user_id, meeting_title, meeting_started_at, hubspot_deal_id, claap_recording_id, recorder_email")
    .eq("id", id)
    .single();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status === "done") return NextResponse.json({ ok: true, already: "done" });
  if (row.status === "analyzing") return NextResponse.json({ ok: true, already: "analyzing" });

  await db
    .from("sales_coach_analyses")
    .update({ status: "analyzing", updated_at: new Date().toISOString() })
    .eq("id", id);

  try {
    const { transcriptUrl } = (await req.json().catch(() => ({}))) as { transcriptUrl?: string };
    if (!transcriptUrl) throw new Error("transcriptUrl missing");

    // ── Fetch transcript (Claap signed URL, 24h validity) ──────────────
    const txtRes = await fetch(transcriptUrl);
    if (!txtRes.ok) throw new Error(`Transcript fetch failed: ${txtRes.status}`);
    const rawText = await txtRes.text();
    if (!rawText.trim()) throw new Error("Empty transcript");

    // Claude sees at most MAX_TRANSCRIPT_CHARS_FOR_CLAUDE. DB keeps the full raw.
    const transcriptForClaude = rawText.length > MAX_TRANSCRIPT_CHARS_FOR_CLAUDE
      ? rawText.slice(0, MAX_TRANSCRIPT_CHARS_FOR_CLAUDE)
      : rawText;

    // ── Resolve model from admin preferences ──────────────────────────
    let analyzeModel = DEFAULT_ANALYZE_MODEL;
    const { data: globalModelEntry } = await db
      .from("guide_defaults")
      .select("content")
      .eq("key", "model_preferences")
      .single();
    try {
      if (globalModelEntry?.content) {
        analyzeModel =
          (JSON.parse(globalModelEntry.content) as Record<string, string>).sales_coach ?? analyzeModel;
      }
    } catch { /* keep default */ }

    // ── Auto-resolve deal from participants if not linked yet + grab JSON
    //    transcript for talk-ratio ─────────────────────────────────────
    let dealId = row.hubspot_deal_id as string | null;
    let talkRatio: ReturnType<typeof computeTalkRatio> | null = null;

    if (row.claap_recording_id && process.env.CLAAP_API_TOKEN) {
      try {
        const rec = await getClaapRecording(row.claap_recording_id);
        const participants = rec?.meeting?.participants ?? [];

        if (!dealId && row.recorder_email) {
          const participantEmails = participants
            .map((p) => p.email)
            .filter((e): e is string => !!e);
          const resolved = await resolveDealFromParticipants(participantEmails, row.recorder_email);
          if (resolved) {
            dealId = resolved;
            await db.from("sales_coach_analyses").update({ hubspot_deal_id: resolved }).eq("id", id);
            console.log(`[sales-coach/analyze/${id}] auto-resolved deal ${resolved} from participants`);
          }
        }

        // Fetch JSON transcript (segments) for talk ratio
        const jsonUrl = rec ? pickTranscriptJsonUrl(rec) : null;
        if (jsonUrl) {
          const structured = await fetchTranscriptSegments(jsonUrl);
          if (structured) {
            // Backfill speaker emails from participants if missing
            const enrichedSpeakers = structured.speakers.map((sp) => {
              if (sp.email) return sp;
              const match = participants.find((p) => p.name && sp.name && p.name === sp.name);
              return match ? { ...sp, email: match.email, isRecorder: match.email === rec?.recorder?.email } : sp;
            });
            talkRatio = computeTalkRatio({
              segments: structured.segments,
              speakers: enrichedSpeakers,
              recorderEmail: row.recorder_email,
            });
          }
        }
      } catch (e) {
        console.warn(`[sales-coach/analyze/${id}] Claap enrichment failed:`, e instanceof Error ? e.message : e);
      }
    }

    // ── Deal context + prior analyses (parallel) ──────────────────────
    const [dealSnapshot, priorAnalysesRes, dealScoreRes] = await Promise.allSettled([
      dealId ? fetchDealContext(dealId) : Promise.resolve(null),
      dealId
        ? db
            .from("sales_coach_analyses")
            .select("id, meeting_title, meeting_started_at, score_global, meeting_kind, analysis")
            .eq("hubspot_deal_id", dealId)
            .neq("id", id)
            .eq("status", "done")
            .order("meeting_started_at", { ascending: false, nullsFirst: false })
            .limit(10)
        : Promise.resolve({ data: [] as PriorAnalysisRow[] }),
      dealId
        ? db.from("deal_scores").select("score, reasoning, next_action").eq("deal_id", dealId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const snapshot = dealSnapshot.status === "fulfilled" ? dealSnapshot.value : null;
    const priorAnalyses = (priorAnalysesRes.status === "fulfilled" ? (priorAnalysesRes.value.data ?? []) : []) as PriorAnalysisRow[];
    const dealScore = dealScoreRes.status === "fulfilled"
      ? (dealScoreRes.value as { data: { score: unknown; reasoning?: string; next_action?: string } | null }).data
      : null;

    let scoreBlock = "";
    if (dealScore?.score) {
      const s = dealScore.score as { total?: number };
      scoreBlock = `\n## Score IA du deal : ${s.total ?? "?"}/100${dealScore.reasoning ? `\nReasoning : ${dealScore.reasoning}` : ""}${dealScore.next_action ? `\nNext action suggérée : ${dealScore.next_action}` : ""}`;
    }

    const userPrompt = [
      `## Meeting à analyser`,
      `- Titre : ${row.meeting_title ?? "?"}`,
      `- Date : ${row.meeting_started_at ?? "?"}`,
      ``,
      renderDealContextForPrompt(snapshot),
      scoreBlock,
      ``,
      renderPriorAnalyses(priorAnalyses),
      ``,
      `## Transcription`,
      transcriptForClaude,
    ].filter(Boolean).join("\n");

    // ── Claude analysis (tool_use for guaranteed valid JSON) ──────────
    const client = new Anthropic({ timeout: 180_000 });
    const message = await client.messages.create({
      model: analyzeModel,
      max_tokens: 8000,
      system: SALES_COACH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      tools: [salesCoachTool],
      tool_choice: { type: "tool" as const, name: "sales_coach_analysis" },
    });

    logUsage(row.user_id, analyzeModel, message.usage.input_tokens, message.usage.output_tokens, "sales_coach_analyze");

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || !("input" in toolBlock)) throw new Error("No tool_use block in response");

    const analysis = toolBlock.input as SalesCoachAnalysis;
    const scoreGlobal = computeGlobalScore(analysis);

    // ── Persist (full raw transcript, not sliced) ─────────────────────
    await db
      .from("sales_coach_analyses")
      .update({
        analysis,
        score_global: scoreGlobal,
        transcript_text: rawText,
        deal_snapshot: snapshot,
        meeting_kind: analysis.meeting_kind,
        talk_ratio: talkRatio,
        status: "done",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    const slackEnabled = process.env.SALES_COACH_SLACK_ENABLED === "true";
    if (slackEnabled && row.user_id) {
      const slackRes = await sendSalesCoachSlack(db, id).catch((e) => ({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }));
      if (!slackRes.ok) {
        console.warn(`[sales-coach/analyze/${id}] Slack send skipped:`, slackRes.error);
      }
    } else if (!slackEnabled) {
      console.log(`[sales-coach/analyze/${id}] Slack disabled globally (SALES_COACH_SLACK_ENABLED)`);
    }

    return NextResponse.json({ ok: true, scoreGlobal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[sales-coach/analyze/${id}] error:`, msg);
    await db
      .from("sales_coach_analyses")
      .update({ status: "error", error_message: msg, updated_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
