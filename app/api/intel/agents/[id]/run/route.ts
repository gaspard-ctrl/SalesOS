import { NextRequest, NextResponse, after } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AGENT_BY_ID } from "@/lib/intel-agents";
import type { AgentId } from "@/lib/intel-types";
import { runLinkedinScan } from "@/lib/intel/run-linkedin-scan";
import { logAgentRun } from "@/lib/intel/log-agent-run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Fire-and-forget : on enregistre last_run_status = "running" + 202,
// l'exécution réelle se poursuit via `after()` après réponse au client.
// Évite l'« Inactivity Timeout » du proxy Vercel sur les scans longs.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await ctx.params;
  const def = AGENT_BY_ID[id as AgentId];
  if (!def) return NextResponse.json({ error: "Agent inconnu" }, { status: 404 });
  if (!def.runEndpoint) {
    return NextResponse.json({ error: "Cet agent fonctionne en push, pas de run manuel." }, { status: 400 });
  }

  const startedAt = new Date().toISOString();
  await db
    .from("intel_agent_runs")
    .upsert(
      { user_id: user.id, agent_id: id, last_run_at: startedAt, last_run_status: "running", last_run_error: null },
      { onConflict: "user_id,agent_id" }
    );

  const userId = user.id;
  const baseUrl = req.nextUrl.origin;
  const cookie = req.headers.get("cookie") ?? "";
  const runEndpoint = def.runEndpoint;

  // ── company-news : délègue à une Netlify Background Function ──────────
  // Le scan prend 1-3 min (50 entreprises + 15 keywords + Claude). Sur Netlify
  // les fonctions synchrones (et leur `after()`) sont coupées à ~26s — d'où le
  // statut "running" figé. Les Background Functions tolèrent jusqu'à 15 min.
  const siteUrl = process.env.URL ?? process.env.SITE_URL ?? baseUrl;
  const cronSecret = process.env.CRON_SECRET;
  if (id === "company-news" && process.env.NETLIFY === "true" && cronSecret) {
    fetch(`${siteUrl}/.netlify/functions/intel-company-news-background`, {
      method: "POST",
      headers: { authorization: `Bearer ${cronSecret}`, "content-type": "application/json" },
      body: JSON.stringify({ userId, startedAt, triggeredBy: "manual" }),
    }).catch((e) => {
      console.error("[intel/agents/run] background invoke failed:", e);
    });
    return NextResponse.json({ ok: true, queued: true, background: true }, { status: 202 });
  }

  // Dev local (pas de Background Functions dispo) + autres agents : on garde
  // le pattern `after()` historique. Note : les autres agents partagent le
  // même risque de coupure 26s sur Netlify et devraient passer en background
  // s'ils dépassent ce budget.
  after(async () => {
    let signalsCount = 0;
    let ok = true;
    let errorText: string | null = null;
    let payload: unknown = null;

    try {
      if (id === "company-news") {
        const result = await runLinkedinScan({ callerUserId: userId });
        signalsCount = result.analysis.signals_created;
        payload = result;
      } else {
        const res = await fetch(`${baseUrl}${runEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify({}),
        });
        const text = await res.text();
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text.slice(0, 200) };
        }
        ok = res.ok;
        if (!ok) errorText = String(text).slice(0, 500);
        if (
          payload &&
          typeof payload === "object" &&
          "signalsCount" in payload &&
          typeof (payload as { signalsCount: unknown }).signalsCount === "number"
        ) {
          signalsCount = (payload as { signalsCount: number }).signalsCount;
        }
      }
    } catch (e) {
      ok = false;
      errorText = e instanceof Error ? e.message : String(e);
    }

    await db
      .from("intel_agent_runs")
      .upsert(
        {
          user_id: userId,
          agent_id: id,
          last_run_at: startedAt,
          last_run_status: ok ? "ok" : "error",
          last_run_signals_count: signalsCount,
          last_run_error: errorText,
        },
        { onConflict: "user_id,agent_id" }
      );

    await logAgentRun({
      agentId: id,
      triggeredBy: "manual",
      userId,
      startedAt,
      status: ok ? "ok" : "error",
      signalsCount,
      error: errorText,
      payload,
    });
  });

  return NextResponse.json({ ok: true, queued: true }, { status: 202 });
}
