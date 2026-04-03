import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/auth";
import { logUsage } from "@/lib/log-usage";

export const dynamic = "force-dynamic";

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  published_date?: string;
};

async function searchTavily(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", max_results: 8, days: 180 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

const contactsTool: Anthropic.Tool = {
  name: "extract_contacts",
  description: "Retourne les contacts identifiés",
  input_schema: {
    type: "object" as const,
    properties: {
      contacts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Prénom Nom (ou titre de poste si inconnu)" },
            title: { type: "string", description: "Poste dans l'entreprise" },
            linkedin_url: { type: "string", description: "URL LinkedIn ou null" },
            source_url: { type: "string", description: "URL de la source ou null" },
          },
          required: ["name", "title"],
        },
      },
    },
    required: ["contacts"],
  },
};

async function extractFromSources(
  company: string,
  sourcesText: string,
  userId: string
): Promise<{ name: string; title: string; linkedin_url: string | null; source_url: string | null; source: "web" }[]> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `Tu extrais des personnes nommées avec leur rôle chez ${company}. Focus : décideurs RH, L&D, direction. Ne génère que des personnes explicitement nommées dans les sources. Utilise l'outil extract_contacts.`,
    messages: [{ role: "user", content: `Entreprise : ${company}\n\nSources :\n${sourcesText}` }],
    tools: [contactsTool],
    tool_choice: { type: "tool" as const, name: "extract_contacts" },
  });

  logUsage(userId, "claude-haiku-4-5-20251001", message.usage.input_tokens, message.usage.output_tokens, "market_contacts");

  const toolBlock = message.content.find((b) => b.type === "tool_use");
  if (!toolBlock || !("input" in toolBlock)) return [];
  const result = toolBlock.input as { contacts: { name: string; title: string; linkedin_url?: string | null; source_url?: string | null }[] };
  return (result.contacts ?? []).map((c) => ({ ...c, linkedin_url: c.linkedin_url ?? null, source_url: c.source_url ?? null, source: "web" as const }));
}

async function inferFromKnowledge(
  company: string,
  userId: string
): Promise<{ name: string; title: string; linkedin_url: string | null; source_url: string | null; source: "ai" }[]> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `Tu identifies les décideurs probables dans une entreprise pour la prospection B2B en coaching. Si tu ne connais pas de noms précis, propose les titres de postes à cibler. Utilise l'outil extract_contacts.`,
    messages: [{ role: "user", content: `Entreprise : ${company}\n\nTavily n'a rien trouvé. Liste les décideurs RH, L&D, direction connus ou probables.` }],
    tools: [contactsTool],
    tool_choice: { type: "tool" as const, name: "extract_contacts" },
  });

  logUsage(userId, "claude-haiku-4-5-20251001", message.usage.input_tokens, message.usage.output_tokens, "market_contacts");

  const toolBlock = message.content.find((b) => b.type === "tool_use");
  if (!toolBlock || !("input" in toolBlock)) return [];
  const result = toolBlock.input as { contacts: { name: string; title: string; linkedin_url?: string | null; source_url?: string | null }[] };
  return (result.contacts ?? [])
    .filter((c) => c.name && c.name !== "null")
    .map((c) => ({ ...c, linkedin_url: c.linkedin_url ?? null, source_url: c.source_url ?? null, source: "ai" as const }));
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const company = req.nextUrl.searchParams.get("company")?.trim();
    if (!company) return NextResponse.json({ contacts: [] });

    const searches = [
      `${company} directeur responsable RH ressources humaines`,
      `${company} CEO DG directeur général équipe dirigeante`,
      `${company} CPO Chief People Officer Head of People`,
    ];

    const allResultsNested = await Promise.all(searches.map((q) => searchTavily(q)));
    const allResults = allResultsNested.flat();

    const seen = new Set<string>();
    const uniqueResults = allResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    if (uniqueResults.length > 0) {
      const sourcesText = uniqueResults
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`)
        .join("\n\n---\n\n");
      const contacts = await extractFromSources(company, sourcesText, user.id);
      return NextResponse.json({ contacts, fallback: false });
    }

    const contacts = await inferFromKnowledge(company, user.id);
    return NextResponse.json({ contacts, fallback: true });
  } catch (e) {
    console.error("contacts-web error:", e);
    return NextResponse.json({ contacts: [], fallback: false });
  }
}
