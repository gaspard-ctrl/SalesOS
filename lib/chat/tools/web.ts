/**
 * Outil recherche web (Tavily) de CoachelloGPT (extrait de l'ancien core.ts).
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { ToolModule } from "./types";

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
};

/**
 * Une clé absente ou un appel en échec renvoyaient un tableau vide,
 * indistinguable d'une recherche qui n'a rien donné : le modèle annonçait
 * "aucun résultat" alors que l'outil n'avait pas tourné. L'erreur remonte
 * désormais telle quelle.
 */
async function searchTavily(
  query: string,
  days = 30
): Promise<{ results: TavilyResult[]; error?: string }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { results: [], error: "TAVILY_API_KEY manquant : la recherche web n'est pas configuree." };
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
        days,
      }),
    });
    if (!res.ok) return { results: [], error: `Tavily a répondu ${res.status}.` };
    const data = await res.json();
    return { results: (data.results ?? []) as TavilyResult[] };
  } catch (e) {
    return { results: [], error: e instanceof Error ? e.message : "erreur inconnue" };
  }
}

const defs: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Recherche sur le web en temps réel : actualité, concurrents, tendances, infos sur une entreprise externe.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Requête de recherche" },
        days: { type: "number", description: "Limiter aux résultats des N derniers jours (défaut : 30)" },
      },
      required: ["query"],
    },
  },
];

const module_: ToolModule = {
  defs,
  handlers: {
    web_search: async (input, ctx) => {
      const query = String(input.query ?? "");
      const { results, error } = await searchTavily(query, (input.days as number) ?? 30);
      ctx.onSource({ kind: "web", title: `"${query}" (${results.length} results)` });
      if (error) return `La recherche web n'a pas pu tourner : ${error} Ne présente pas ca comme une absence de résultat.`;
      if (results.length === 0) return "Aucun résultat trouvé pour cette recherche.";
      return JSON.stringify(results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content.slice(0, 1000),
        date: r.published_date,
      })));
    },
  },
};

export const webTools = module_;
