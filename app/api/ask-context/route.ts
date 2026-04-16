import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { logUsage } from "@/lib/log-usage";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Non authentifié." })}\n\n`,
      { status: 401, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const { context, question } = await req.json();
  if (!question?.trim()) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Question manquante." })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // ── Get Claude API key ────────────────────────────────────────────────────
  let claudeApiKey: string;

  if (process.env.SUPABASE_URL) {
    const { data: keyRow } = await db
      .from("user_keys")
      .select("encrypted_key, iv, auth_tag, is_active")
      .eq("user_id", user.id)
      .eq("service", "claude")
      .single();

    if (!keyRow?.is_active) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", message: "Ton accès Claude n'est pas encore configuré. Contacte Arthur." })}\n\n`,
        { status: 402, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    claudeApiKey = decrypt({
      encryptedKey: keyRow.encrypted_key,
      iv: keyRow.iv,
      authTag: keyRow.auth_tag,
    });
  } else {
    claudeApiKey = process.env.ANTHROPIC_API_KEY ?? "";
  }

  // ── Model preference ──────────────────────────────────────────────────────
  let model = "claude-haiku-4-5-20251001";
  if (process.env.SUPABASE_URL) {
    const { data: modelEntry } = await db
      .from("guide_defaults")
      .select("content")
      .eq("key", "model_preferences")
      .single();
    try {
      if (modelEntry?.content) {
        model = (JSON.parse(modelEntry.content) as Record<string, string>).chat ?? model;
      }
    } catch { /* keep default */ }
  }

  const client = new Anthropic({ apiKey: claudeApiKey });

  const systemPrompt = `Tu es un assistant commercial expert intégré à SalesOS. L'utilisateur te pose une question à propos d'un deal ou d'un meeting dont tu as toutes les données ci-dessous.

DONNÉES CONTEXTUELLES :
${typeof context === "string" ? context : JSON.stringify(context, null, 2)}

RÈGLES :
- Réponds en français, de manière concise et actionnable.
- Base-toi UNIQUEMENT sur les données fournies. Si l'information n'est pas disponible, dis-le.
- Utilise des bullet points et du markdown léger pour la lisibilité.
- Sois direct — pas de formules de politesse inutiles.`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const apiStream = client.messages.stream({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: question }],
        });

        apiStream.on("text", (delta) => send({ type: "text", text: delta }));

        const message = await apiStream.finalMessage();
        send({ type: "done" });

        logUsage(user.id, model, message.usage.input_tokens, message.usage.output_tokens, "ask-context");
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Erreur inconnue" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
