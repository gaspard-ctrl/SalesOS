import { NextRequest, NextResponse, after } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { runChatJob } from "@/lib/chat/run-job";

export const dynamic = "force-dynamic";

const BG_FN = "chat-background";

/**
 * Démarre une job de chat (CoachelloGPT) et délègue l'agentic loop à une
 * Background Function Netlify (jusqu'à 15 min), au lieu de streamer en SSE depuis
 * cette route sync (tuée à ~26s par Netlify, d'où les "Connection error" et les
 * réponses coupées). Le navigateur récupère `jobId` puis poll GET /api/chat/[jobId].
 *
 * Le worker `runChatJob` appelle le MÊME `runChat()` que la version Slack
 * (netlify/functions/slack-chat-background.mts) et écrit la progression dans
 * la table chat_jobs.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { messages, betterThinking } = await req.json();

  const { data: job, error } = await db
    .from("chat_jobs")
    .insert({
      user_id: user.id,
      status: "running",
      input_messages: Array.isArray(messages) ? messages : [],
      better_thinking: betterThinking === true,
    })
    .select("id")
    .single();

  if (error || !job) {
    return NextResponse.json({ error: error?.message ?? "Failed to create job" }, { status: 500 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL ?? process.env.SITE_URL ?? req.nextUrl.origin;
  console.log(
    `[chat] dispatch jobId=${job.id} NETLIFY=${process.env.NETLIFY ?? "<unset>"} ` +
    `hasCronSecret=${!!cronSecret} siteUrl=${siteUrl}`
  );

  if (process.env.NETLIFY === "true") {
    // En prod, sans CRON_SECRET la Background Function refuserait l'appel : on
    // échoue bruyamment plutôt que de tomber sur `after()` qui meurt à ~26s.
    if (!cronSecret) {
      await db.from("chat_jobs").update({ status: "error", error: "CRON_SECRET manquant" }).eq("id", job.id);
      return NextResponse.json({ error: "Server misconfigured (CRON_SECRET)" }, { status: 503 });
    }
    // On attend la réponse (la Background Function répond 202 immédiatement puis
    // tourne en arrière-plan) pour DÉTECTER une fonction non déployée (404) ou un
    // refus (401), et marquer la job en erreur plutôt que de laisser l'UI tourner.
    try {
      const resp = await fetch(`${siteUrl}/.netlify/functions/${BG_FN}`, {
        method: "POST",
        headers: { authorization: `Bearer ${cronSecret}`, "content-type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      console.log(`[chat] background invoke status=${resp.status} jobId=${job.id}`);
      if (!resp.ok && resp.status !== 202) {
        const detail = `Background function HTTP ${resp.status}`;
        await db.from("chat_jobs").update({ status: "error", error: detail }).eq("id", job.id);
        return NextResponse.json({ error: detail, jobId: job.id }, { status: 502 });
      }
    } catch (e) {
      console.error("[chat] background invoke failed:", e);
      await db.from("chat_jobs").update({ status: "error", error: "Background invoke failed" }).eq("id", job.id);
      return NextResponse.json({ error: "Background invoke failed", jobId: job.id }, { status: 502 });
    }
    return NextResponse.json({ ok: true, jobId: job.id }, { status: 202 });
  }

  // Dev (hors Netlify) : exécution in-process après la réponse.
  console.log(`[chat] running in-process via after() jobId=${job.id} (NETLIFY not "true")`);
  after(async () => {
    const res = await runChatJob({ jobId: job.id });
    if (!res.ok) console.error("[chat] dev run failed:", res.error);
  });

  return NextResponse.json({ ok: true, jobId: job.id }, { status: 202 });
}
