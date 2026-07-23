import type Anthropic from "@anthropic-ai/sdk";
import type { ChatSource } from "./tools/types";

/**
 * Événements émis par la boucle agentique vers les surfaces (worker web qui
 * écrit dans chat_jobs, ou fonction Slack qui met à jour son message).
 * "source" est nouveau : une source consultée (page Notion, meeting Claap,
 * fichier Drive...), affichée par le front en indicateurs temps réel.
 */
export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string }
  | { type: "tool_progress"; message: string }
  | { type: "source"; source: ChatSource }
  | { type: "cost_warning"; cost: number }
  | { type: "history"; messages: Anthropic.MessageParam[] }
  | { type: "done" }
  | { type: "error"; message: string };

export type ChatResult = {
  finalText: string;
  messages: Anthropic.MessageParam[];
  inputTokens: number;
  outputTokens: number;
  /** Tokens écrits dans le cache Anthropic (facturés x1.25 du tarif input). */
  cacheWriteTokens: number;
  /** Tokens relus depuis le cache Anthropic (facturés x0.1 du tarif input). */
  cacheReadTokens: number;
};

export class ChatAuthError extends Error {
  status: number;
  constructor(message: string, status = 402) {
    super(message);
    this.status = status;
  }
}

export type { ChatSource };
