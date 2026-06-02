import Anthropic from "@anthropic-ai/sdk";
import { withAnthropicRetry } from "@/lib/anthropic-retry";
import { logUsage } from "@/lib/log-usage";
import type { MarketArticle } from "@/lib/brightdata/serp";
import type { NewsSignalSnapshot } from "@/lib/watchlist/briefs";

// Haiku : tâche de tri/synthèse sur beaucoup d'articles, rapide et économique.
const MODEL = "claude-haiku-4-5-20251001";

const CATEGORIES = [
  "funding",
  "acquisition",
  "leadership",
  "product",
  "partnership",
  "expansion",
  "risk",
  "other",
] as const;

const SYSTEM_PROMPT = `Tu es un analyste sales. À partir d'une liste d'articles de presse récents sur une entreprise cible, tu produis une veille actionnable pour un commercial qui prospecte ce compte.

LANGUE : détecte la langue dominante des articles et réponds dans cette langue (FR si majoritaire, EN sinon). Ne traduis jamais les noms propres.

Règles ABSOLUES :
- N'invente RIEN. Appuie-toi UNIQUEMENT sur les articles fournis.
- Écarte le bruit (keep=false) : articles hors-sujet, doublons, contenus génériques sur le secteur sans rapport direct avec l'entreprise.
- Pour chaque article gardé, écris un "insight" : une phrase courte expliquant POURQUOI ça compte pour un commercial (signal d'achat, trigger décideur, risque, momentum).
- "summary" : 2 à 4 phrases synthétisant le momentum du compte (que se passe-t-il, signaux d'achat, points de vigilance). Si rien d'intéressant, dis-le.
- Tu RÉPONDS UNIQUEMENT via l'outil emit_market_intel.`;

const INTEL_TOOL: Anthropic.Tool = {
  name: "emit_market_intel",
  description: "Émet la veille marché structurée (synthèse + articles catégorisés).",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "2 à 4 phrases de synthèse du momentum du compte.",
      },
      items: {
        type: "array",
        description: "Les articles, catégorisés et triés.",
        items: {
          type: "object",
          properties: {
            index: { type: "number", description: "Index de l'article dans la liste fournie." },
            category: { type: "string", enum: CATEGORIES as unknown as string[] },
            keep: { type: "boolean", description: "false si c'est du bruit." },
            insight: { type: "string", description: "Pourquoi ça compte pour un commercial (1 phrase)." },
          },
          required: ["index", "category", "keep", "insight"],
        },
      },
    },
    required: ["summary", "items"],
  },
};

interface IntelItem {
  index: number;
  category: string;
  keep: boolean;
  insight: string;
}

export interface MarketIntelResult {
  summary: string | null;
  signals: NewsSignalSnapshot[];
}

/**
 * Envoie les articles Bright Data à Claude pour catégorisation + synthèse.
 * Best-effort : si pas de clé API ou échec, renvoie les articles bruts en
 * signals (catégorie "other", excerpt = extrait d'article) sans synthèse.
 */
export async function analyzeMarketNews(
  articles: MarketArticle[],
  opts: { companyName: string; userId?: string | null },
): Promise<MarketIntelResult> {
  const fallback = (): MarketIntelResult => ({
    summary: null,
    signals: articles.map((a, i) => ({
      id: `${i}`,
      type: "other",
      title: a.title,
      url: a.url,
      created_at: a.date,
      excerpt: a.excerpt,
    })),
  });

  if (articles.length === 0) return { summary: null, signals: [] };
  if (!process.env.ANTHROPIC_API_KEY) return fallback();

  const list = articles
    .map((a, i) => `[${i}] ${a.title}${a.source ? ` (${a.source}` : ""}${a.date ? `, ${a.date})` : a.source ? ")" : ""}\n${a.excerpt.slice(0, 220)}`)
    .join("\n\n");

  const prompt = `Entreprise cible : "${opts.companyName}".\nVoici ${articles.length} articles de presse récents. Catégorise, écarte le bruit et synthétise.\n\n${list}`;

  let parsed: { summary?: string; items?: IntelItem[] };
  try {
    const client = new Anthropic({ timeout: 120_000 });
    const msg = await withAnthropicRetry(
      () =>
        client.messages.create({
          model: MODEL,
          max_tokens: 2500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
          tools: [INTEL_TOOL],
          tool_choice: { type: "tool" as const, name: "emit_market_intel" },
        }),
      { label: "watchlist/market-intel" },
    );
    logUsage(opts.userId ?? null, MODEL, msg.usage.input_tokens, msg.usage.output_tokens, "watchlist_market_intel");

    const block = msg.content.find((b) => b.type === "tool_use");
    if (!block || !("input" in block)) return fallback();
    parsed = block.input as { summary?: string; items?: IntelItem[] };
  } catch (e) {
    console.warn(`[watchlist/market-intel] analyse échouée pour "${opts.companyName}":`, e instanceof Error ? e.message : e);
    return fallback();
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const signals: NewsSignalSnapshot[] = [];
  for (const it of items) {
    if (!it || typeof it.index !== "number" || it.keep === false) continue;
    const a = articles[it.index];
    if (!a) continue;
    signals.push({
      id: a.url,
      type: typeof it.category === "string" ? it.category : "other",
      title: a.title,
      url: a.url,
      created_at: a.date,
      excerpt: typeof it.insight === "string" && it.insight.trim() ? it.insight : a.excerpt,
    });
  }

  return {
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : null,
    signals,
  };
}
