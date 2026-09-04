import type Anthropic from "@anthropic-ai/sdk";

/**
 * Source consultée pendant une réponse (page Notion lue, transcript Claap,
 * fichier Drive...). Émise par les outils via ctx.onSource, accumulée dans
 * chat_jobs.sources, affichée par le front en indicateurs "ce que je consulté".
 *
 * TOUT outil de lecture en émet une, y compris quand il ne trouve RIEN : le
 * compteur "N sources reviewed" est ce que l'utilisateur lit pour juger si la
 * réponse a vraiment cherché. Tant que HubSpot, Slack, LinkedIn et le web n'en
 * émettaient pas, une réponse qui avait interrogé 6 outils s'affichait
 * "1 source reviewed" et donnait l'impression d'une non-recherche.
 */
export type ChatSource = {
  kind:
    | "notion" | "claap" | "drive" | "gmail" | "billing" | "guide" | "client"
    | "hubspot" | "slack" | "linkedin" | "web";
  title: string;
  url?: string;
};

/** Contexte d'exécution passé à chaque outil par la boucle agentique. */
export type ToolContext = {
  userId: string;
  userOwnerId: string | null;
  /** Email de l'utilisateur connecté : sert aux filtres "mes clients" (owner/AM/CS). */
  userEmail: string | null;
  onProgress: (msg: string) => void;
  onSource: (source: ChatSource) => void;
};

export type ToolHandler = (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>;

/** Un module d'outils = définitions Anthropic + handlers, fusionnés par le registry. */
export type ToolModule = {
  defs: Anthropic.Tool[];
  handlers: Record<string, ToolHandler>;
};
