import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logUsage } from "@/lib/log-usage";
import { DEFAULT_PROSPECTION_GUIDE } from "@/lib/guides/prospection";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { company_name, signal_type, title, summary, why_relevant, suggested_action } = await req.json() as {
    company_name: string;
    signal_type: string;
    title: string;
    summary: string | null;
    why_relevant: string | null;
    suggested_action: string | null;
  };

  const [{ data }, { data: globalModelEntry }, { data: globalGuideEntry }] = await Promise.all([
    db.from("users").select("prospection_guide").eq("id", user.id).maybeSingle(),
    db.from("guide_defaults").select("content").eq("key", "model_preferences").single(),
    db.from("guide_defaults").select("content").eq("key", "prospection").single(),
  ]);

  const guide = data?.prospection_guide ?? globalGuideEntry?.content ?? DEFAULT_PROSPECTION_GUIDE;
  let model = "claude-haiku-4-5-20251001";
  try { if (globalModelEntry?.content) model = (JSON.parse(globalModelEntry.content) as Record<string, string>).prospection ?? model; } catch { /* keep default */ }

  const senderName = user.name?.trim() || "L'équipe Coachello";

  const systemPrompt = [
    "Tu es un expert en prospection B2B pour Coachello, une entreprise de coaching professionnel.",
    "Tu rédiges des emails de prospection ultra-personnalisés basés sur un signal marché détecté.",
    "L'email doit exploiter le signal comme accroche naturelle pour engager la conversation.",
    `L'email doit être signé par : ${senderName}.`,
    "Réponds UNIQUEMENT en JSON valide avec exactement ces deux clés : { \"subject\": \"...\", \"body\": \"...\" }",
    "Le body doit être en texte brut (pas de HTML, pas de markdown).",
    guide ? `\n---\nGUIDE DE PROSPECTION :\n${guide}` : "",
  ].filter(Boolean).join("\n");

  const signalContext = [
    `Entreprise : ${company_name}`,
    `Type de signal : ${signal_type}`,
    `Titre : ${title}`,
    summary ? `Résumé : ${summary}` : null,
    why_relevant ? `Pourquoi c'est pertinent : ${why_relevant}` : null,
    suggested_action ? `Action suggérée : ${suggested_action}` : null,
  ].filter(Boolean).join("\n");

  const userPrompt = `Voici un signal marché détecté sur une entreprise cible :\n\n${signalContext}\n\nRédige un email de prospection qui utilise ce signal comme accroche pour engager un décideur RH / L&D de cette entreprise. L'objectif est d'ouvrir une conversation sur le coaching professionnel Coachello.`;

  const client = new Anthropic();
  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  logUsage(user.id, model, message.usage.input_tokens, message.usage.output_tokens, "market_generate_email");
  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  let subject = "";
  let body = "";
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      subject = parsed.subject ?? "";
      body = parsed.body ?? "";
    }
  } catch {
    body = raw;
  }

  return NextResponse.json({ subject, body });
}
