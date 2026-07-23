/**
 * Assemblage du system prompt de CoachelloGPT, architecture "manifest" :
 *
 *  Bloc 1 (STABLE, prompt caching) : socle (Coachello.RAG/salesos/socle.md) +
 *    catalogue des packs auto-généré depuis leurs frontmatters.
 *  Bloc 2 (dynamique, hors cache) : utilisateur connecté, équipe HubSpot
 *    (cachée 1h et triée pour ne pas invalider le cache à chaque appel),
 *    date, canal Slack éventuel, better thinking, instructions perso.
 *
 * Tout ce qui varie est en FIN de system : le préfixe (tools + bloc 1) reste
 * identique à chaque appel et chaque tour, condition du cache Anthropic.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { hubspot } from "../tools/hubspot";
import { loadGuideBundle, renderCatalog, type GuideBundle } from "../rag/guide-loader";
import { FALLBACK_SOCLE } from "./fallback";

// ── Équipe HubSpot (owners), cache 1h, tri stable ────────────────────────────

type Owner = { id: string; name: string; email: string };
let ownersCache: { data: Owner[]; fetchedAt: number } | null = null;
const OWNERS_TTL_MS = 60 * 60 * 1000;

export async function getOwners(): Promise<Owner[]> {
  if (ownersCache && Date.now() - ownersCache.fetchedAt < OWNERS_TTL_MS) return ownersCache.data;
  try {
    const ownersData = await hubspot("/crm/v3/owners?limit=100");
    const owners: Owner[] = (ownersData.results ?? [])
      .map((o: { id: string; firstName?: string; lastName?: string; email?: string }) => ({
        id: o.id,
        name: [o.firstName, o.lastName].filter(Boolean).join(" "),
        email: o.email ?? "",
      }))
      .sort((a: Owner, b: Owner) => a.id.localeCompare(b.id));
    ownersCache = { data: owners, fetchedAt: Date.now() };
    return owners;
  } catch {
    return ownersCache?.data ?? [];
  }
}

// ── Assemblage ───────────────────────────────────────────────────────────────

export type BuildSystemArgs = {
  userDisplay: string;
  userOwnerId: string | null;
  userPrompt?: string;
  channelName?: string;
  betterThinking?: boolean;
};

export type BuiltPrompt = {
  system: Anthropic.TextBlockParam[];
  bundle: GuideBundle | null;
};

export async function buildSystem(args: BuildSystemArgs): Promise<BuiltPrompt> {
  const { userDisplay, userOwnerId, userPrompt, channelName, betterThinking } = args;

  // Bloc 1 : socle + catalogue (stable, caché).
  let bundle: GuideBundle | null = null;
  let socle = FALLBACK_SOCLE;
  try {
    bundle = await loadGuideBundle();
    if (bundle.socle.trim()) {
      const catalog = renderCatalog(bundle);
      socle = `${bundle.socle.trim()}\n\nGUIDES DISPONIBLES (charge le ou les pertinents via load_guide AVANT une tâche non triviale ; plusieurs en parallèle si question mixte) :\n${catalog}`;
    }
  } catch (e) {
    console.warn("[prompt] guide bundle unavailable, using fallback socle:", e);
  }

  // Bloc 2 : contexte dynamique (fin de system, hors cache).
  const owners = await getOwners();
  const teamLines = owners.map((o) => `- ${o.name} (owner_id: ${o.id}, ${o.email})`).join("\n");

  let dynamic = `CONTEXTE\nDate du jour : ${new Date().toISOString().slice(0, 10)}.\nL'utilisateur connecté est ${userDisplay}${userOwnerId ? ` (HubSpot owner ID : ${userOwnerId})` : ""}.\nQuand il dit "mes deals" → utilise my_deals_only: true.\nQuand il dit "les deals de [prénom]" → résous le prénom ci-dessous et utilise owner_id.\n\nÉQUIPE COMMERCIALE (owners HubSpot) :\n${teamLines || "Aucun owner trouvé"}\n\n- "deals perdu" / "lost" = stage closedlost ; "deals gagné" / "won" = stage closedwon\n- Ne JAMAIS chercher un commercial comme un contact : ce sont des owners\n- Ne pose AUCUNE question de clarification - déduis du contexte`;

  // Contexte canal : la question est posée dans un canal Slack précis. Si ce
  // canal est dédié à un client/compte et que le périmètre n'est pas précisé,
  // on demande d'abord (seule question de clarification autorisée).
  if (channelName) {
    dynamic += `\n\nCONTEXTE CANAL SLACK\nCette conversation a lieu dans le canal Slack #${channelName}. Tu sais donc toujours où tu te trouves : sers-toi de ce nom dans ta question.\nSi ce canal semble dédié à un client ou un compte précis (ex: #engie → Engie, #adyen → Adyen, #salomon → Salomon) et que la question ne précise pas le périmètre, NE déduis PAS le compte tout seul : pose d'abord une question courte qui cite le canal, du type « Je dois baser ma réponse seulement sur le canal #${channelName} (compte associé) ou chercher partout, avec tous mes outils (HubSpot, Slack, Drive, LinkedIn…) ? » (exemple en français, à formuler dans la langue de l'utilisateur), puis attends la réponse avant de lancer tes recherches. C'est la SEULE question de clarification autorisée (elle prime sur la règle "ne pose aucune question").\nLe périmètre est considéré comme "précisé" si l'utilisateur nomme un client, dit "partout" / "tous les outils" / "ce canal", ou a déjà répondu à cette question plus haut dans le fil : dans ce cas, respecte-le sans reposer la question. Un client explicitement nommé prime toujours sur le canal.\nPour un canal générique (ex: #general, #11-everything-prospects), ne déduis aucun compte et ne pose pas la question : réponds normalement.`;
  }

  // Mode "réflexion approfondie" (toggle "Better thinking" de la webapp).
  if (betterThinking) {
    dynamic += `\n\nMODE RÉFLEXION APPROFONDIE (BETTER THINKING) ACTIVÉ\nL'utilisateur a activé le mode "réflexion approfondie" pour cette réponse. Tu dois :\n- Être extrêmement rigoureux et précis : raisonne étape par étape avant de conclure, vérifie chaque affirmation et ne fais aucune supposition non étayée.\n- Être exhaustif sur les données : ne te contente jamais de la première source. Mobilise TOUS tes outils pertinents (HubSpot, Slack, Google Drive, Gmail, LinkedIn, Claap, Notion, recherche web) et croise les informations pour ne rien manquer.\n- Aller au bout des recherches : enchaîne autant d'appels d'outils que nécessaire, explore les pistes connexes, et confronte les sources entre elles quand elles divergent.\n- Produire une réponse très détaillée et structurée : contexte, éléments factuels (avec leur source), analyse, puis conclusion et recommandations concrètes. Indique systématiquement d'où vient chaque information.\n- Si une donnée reste introuvable ou incertaine après recherche, dis-le explicitement plutôt que de l'inventer.\nCe mode prime sur toute consigne de concision : privilégie la complétude et la fiabilité, même si la réponse est longue.`;
  }

  if (userPrompt?.trim()) {
    dynamic += `\n\n--- INSTRUCTIONS PERSONNELLES DE L'UTILISATEUR ---\n${userPrompt.trim()}`;
  }

  return {
    system: [
      { type: "text", text: socle, cache_control: { type: "ephemeral" } },
      { type: "text", text: dynamic },
    ],
    bundle,
  };
}
