/**
 * Shim de compatibilité : l'ancien monolithe (boucle + 28 outils + prompt
 * assemblé par concaténation) a été éclaté en modules lors du passage à
 * l'architecture "manifest" (cf. __documentation/coachello-gpt-rag-plan.md) :
 *
 *  - run-agent.ts        orchestration (ex-runChat)
 *  - loop.ts             boucle agentique + filet d'auto-injection Notion
 *  - events.ts           ChatEvent / ChatResult / ChatAuthError
 *  - prompt/             socle + catalogue (repo Coachello.RAG) + contexte dynamique
 *  - tools/              outils par famille + registry (LECTURE SEULE sur Notion)
 *  - rag/guide-loader.ts fetch GitHub du cerveau, cache + snapshot DB
 *
 * Les surfaces (run-job.ts, slack-chat-background.mts) importent toujours ici.
 */

export { runChat } from "./run-agent";
export { ChatAuthError, type ChatEvent, type ChatResult, type ChatSource } from "./events";
export { TOOLS } from "./tools/registry";
