import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "@/lib/log-usage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { name, jobTitle, company, industry, lifecyclestage } = await req.json();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 128,
    system:
      "Génère un message LinkedIn de prospection B2B pour Coachello (coaching professionnel). 200 caractères max. Direct, personnalisé, sans emoji. Angle pertinent selon secteur/poste. Réponds uniquement avec le message, sans guillemets ni formatage.",
    messages: [
      {
        role: "user",
        content: `Nom: ${name}\nPoste: ${jobTitle}\nEntreprise: ${company}\nSecteur: ${industry}${lifecyclestage ? `\nStatut: ${lifecyclestage}` : ""}`,
      },
    ],
  });

  const message = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
  logUsage(user.id, "claude-haiku-4-5", response.usage.input_tokens, response.usage.output_tokens, "prospection_linkedin");

  return NextResponse.json({ message });
}
