import type { Context } from "@netlify/functions";
import { runLinkedinScan } from "../../lib/intel/run-linkedin-scan";
import { logAgentRun } from "../../lib/intel/log-agent-run";
import { db } from "../../lib/db";

// HTTP-triggered background function. Netlify renvoie 202 immédiatement à
// l'appelant et continue l'exécution en arrière-plan (jusqu'à 15 min) — c'est
// ce qu'il faut pour `runLinkedinScan` qui dépasse la limite synchrone (~26s
// sur le plan Pro) à cause des 50 entreprises + 15 keywords + appel Claude.
//
// Auth : Bearer CRON_SECRET (posé par /api/intel/agents/company-news/run).
// Body : { userId: string | null, startedAt: string, triggeredBy: "manual" | "cron" }
export default async (req: Request, _ctx: Context) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: { userId?: string | null; startedAt?: string; triggeredBy?: "manual" | "cron" } = {};
  try {
    body = await req.json();
  } catch {
    return new Response("invalid body", { status: 400 });
  }

  const userId = body.userId ?? null;
  const startedAt = body.startedAt ?? new Date().toISOString();
  const triggeredBy = body.triggeredBy ?? "manual";

  let ok = true;
  let errorText: string | null = null;
  let signalsCount = 0;
  let payload: unknown = null;

  try {
    const result = await runLinkedinScan({ callerUserId: userId });
    signalsCount = result.analysis.signals_created;
    payload = result;
  } catch (e) {
    ok = false;
    errorText = e instanceof Error ? e.message : String(e);
    console.error("[intel-company-news-background] scan failed:", e);
  }

  if (userId) {
    const { error: upsertErr } = await db.from("intel_agent_runs").upsert(
      {
        user_id: userId,
        agent_id: "company-news",
        last_run_at: startedAt,
        last_run_status: ok ? "ok" : "error",
        last_run_signals_count: signalsCount,
        last_run_error: errorText,
      },
      { onConflict: "user_id,agent_id" },
    );
    if (upsertErr) {
      console.error("[intel-company-news-background] intel_agent_runs upsert failed:", upsertErr);
    }
  }

  await logAgentRun({
    agentId: "company-news",
    triggeredBy,
    userId,
    startedAt,
    status: ok ? "ok" : "error",
    signalsCount,
    error: errorText,
    payload,
  });

  return new Response(null, { status: 200 });
};
