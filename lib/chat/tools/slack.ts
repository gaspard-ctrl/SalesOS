/**
 * Outils Slack de CoachelloGPT (extraits de l'ancien lib/chat/core.ts).
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { ToolModule } from "./types";
import { toSlackMrkdwn } from "@/lib/slack/mrkdwn";

// ── Helpers API ──────────────────────────────────────────────────────────────

async function slack(path: string, params?: Record<string, string>, token?: string) {
  const url = new URL(`https://slack.com/api${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token ?? process.env.SLACK_BOT_TOKEN}` },
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack ${path} → ${data.error}`);
  return data;
}

// Canaux balayés par defaut quand l'appelant n'en nomme aucun.
const DEFAULT_CHANNELS = [
  "general",
  "1y-new-meetings",
  "1a-new-incoming-leads",
  "10-sales-intelligence",
  "11-everything-prospects",
  "12-everything-clients",
];

// Repli par grep : bornes. Le budget total prime sur le budget par canal, pour
// ne jamais faire expirer la fonction Netlify.
const GREP_DEADLINE_MS = 30_000;
const GREP_MESSAGES_PER_CHANNEL = 400;
const GREP_MAX_CHANNELS = 12;

/** Tokens significatifs d'une requête, utilises pour repecher un canal dédié (#mbda). */
function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 3);
}

async function slackAllChannels(): Promise<{ name: string; id: string }[]> {
  const all: { name: string; id: string }[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { limit: "1000", types: "public_channel,private_channel" };
    if (cursor) params.cursor = cursor;
    const data = await slack("/conversations.list", params);
    all.push(...(data.channels ?? []));
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return all;
}

async function slackPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack ${path} → ${data.error}`);
  return data;
}

// ── Définitions ──────────────────────────────────────────────────────────────

const defs: Anthropic.Tool[] = [
  {
    name: "search_slack",
    description:
      "Recherche des messages Slack par mot-clé. Réservé à l'approfondissement de 1 à 3 deals/comptes déjà identifiés : JAMAIS en recherche de masse (pas de boucle Slack sur 20 deals). Les canaux clients dédiés existent (ex: #engie, #adyen, #salomon) : nomme-les dans `channels` pour un compte précis. " +
      "LIS TOUJOURS le champ `coverage` du résultat : il dit ce que la recherche a réellement couvert, et `channels_skipped` liste les canaux qui ont échoué (bot non membre, canal privé). Un résultat vide est un « je n'ai pas trouvé dans ce périmètre », JAMAIS un « ça n'existe pas dans Slack » : reformule-le ainsi dans ta réponse, en nommant les canaux consultés.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Mots-clés à rechercher (insensible à la casse)" },
        channels: { type: "array", items: { type: "string" }, description: "Canaux où chercher (sans #). Par défaut : les canaux sales génériques, plus tout canal dont le NOM contient la requête (ex: 'MBDA' ouvre #mbda)." },
        limit: { type: "number", description: "Nombre de messages remontés par canal en mode repli (défaut : 400)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_slack_channel_history",
    description:
      "Récupère l'historique COMPLET d'un canal Slack (toutes les pages via pagination, pas seulement les 100 derniers messages). Par défaut, remonte tout l'historique accessible. Ne contient PAS les réponses en fil (thread replies) : ne conclus jamais qu'un sujet n'a pas été discuté sur la seule base de cet historique.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel_name: { type: "string", description: "Nom du canal sans #" },
        limit: { type: "number", description: "Plafond optionnel sur le nombre total de messages. Si omis, remonte TOUT l'historique du canal." },
      },
      required: ["channel_name"],
    },
  },
  {
    name: "send_slack_message",
    description:
      "Envoie un message dans un canal Slack ou en DM à un utilisateur. UNIQUEMENT sur demande explicite de l'utilisateur, et TOUJOURS après lui avoir demandé confirmation du contenu et du destinataire.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Nom du canal sans # (ex: sales) ou email de l'utilisateur pour un DM" },
        message: { type: "string", description: "Contenu du message à envoyer" },
      },
      required: ["channel", "message"],
    },
  },
];

// ── Handlers ─────────────────────────────────────────────────────────────────

const module_: ToolModule = {
  defs,
  handlers: {
    search_slack: async (input, ctx) => {
      const rawQuery = String(input.query ?? "").trim();
      // Sans garde, une requête vide fait matcher TOUS les messages balayés.
      if (!rawQuery) return "Erreur : `query` est vide. Précise les mots-clés à chercher.";
      const needle = rawQuery.toLowerCase();
      const explicit = ((input.channels as string[] | undefined) ?? [])
        .map((c) => String(c).replace("#", "").trim())
        .filter(Boolean);

      // ── Mode 1 : vraie recherche Slack ────────────────────────────────────
      // search.messages couvre TOUT le workspace visible par le token
      // utilisateur : canaux non rejoints, fils de discussion, DM. C'est le
      // seul mode dont un résultat vide veut dire quelque chose.
      const userToken = process.env.SLACK_USER_TOKEN;
      let nativeSearchError: string | undefined;
      if (userToken) {
        try {
          const scoped = explicit.length
            ? `${rawQuery} ${explicit.map((c) => `in:#${c}`).join(" ")}`
            : rawQuery;
          ctx.onProgress(`Searching Slack for "${rawQuery}"...`);
          const data = await slack("/search.messages", { query: scoped, count: "50" }, userToken);
          type Match = {
            text?: string;
            ts?: string;
            username?: string;
            permalink?: string;
            channel?: { name?: string };
          };
          const matches = ((data.messages?.matches ?? []) as Match[]).map((m) => ({
            channel: m.channel?.name ?? "?",
            text: m.text ?? "",
            user: m.username ?? "?",
            timestamp: m.ts ? new Date(parseFloat(m.ts) * 1000).toISOString() : "",
            permalink: m.permalink,
          }));
          ctx.onSource({ kind: "slack", title: `Search "${rawQuery}" (${matches.length} results)` });
          return JSON.stringify({
            mode: "search.messages",
            query: scoped,
            match_count: matches.length,
            matches,
            coverage:
              "Recherche Slack native : tous les canaux publics, les canaux privés et les DM visibles par le token, fils de discussion inclus.",
          });
        } catch (e) {
          // On bascule sur le repli, mais JAMAIS en silence : le modèle doit
          // savoir que le mode complet n'a pas tourné.
          nativeSearchError = e instanceof Error ? e.message : "erreur inconnue";
        }
      }

      // ── Mode 2 : repli par balayage des canaux ────────────────────────────
      const allChannels = await slackAllChannels();
      const channelMap = new Map(allChannels.map((c) => [c.name, c.id]));
      const tokens = queryTokens(rawQuery);
      // Sans canal impose, on ajoute aux canaux génériques tout canal dont le
      // NOM contient la requête : c'est ce qui manquait le plus, un compte a
      // presque toujours son canal dédié (#mbda) et il n'etait jamais ouvert.
      const targets = explicit.length
        ? explicit
        : [
            ...DEFAULT_CHANNELS,
            ...allChannels.map((c) => c.name).filter((n) => tokens.some((t) => n.toLowerCase().includes(t))),
          ];
      const unique = [...new Set(targets)].slice(0, GREP_MAX_CHANNELS);
      const perChannel = Math.max(
        1,
        Math.min(2000, (input.limit as number | undefined) ?? GREP_MESSAGES_PER_CHANNEL)
      );
      const deadline = Date.now() + GREP_DEADLINE_MS;

      const searchedChannels: { channel: string; messages_scanned: number; truncated: boolean }[] = [];
      const skippedChannels: { channel: string; reason: string }[] = [];
      const hits: { channel: string; text: string; user: string; timestamp: string }[] = [];

      ctx.onProgress(`Scanning ${unique.length} Slack channels for "${rawQuery}"...`);
      await Promise.allSettled(
        unique.map(async (chName) => {
          const name = chName.replace("#", "");
          const chId = channelMap.get(name);
          if (!chId) {
            skippedChannels.push({ channel: name, reason: "canal introuvable ou invisible du bot" });
            return;
          }
          let cursor: string | undefined;
          let scanned = 0;
          let truncated = false;
          try {
            do {
              const params: Record<string, string> = { channel: chId, limit: "200" };
              if (cursor) params.cursor = cursor;
              const hist = await slack("/conversations.history", params);
              const msgs = (hist.messages ?? []) as { text?: string; ts: string; user?: string }[];
              scanned += msgs.length;
              for (const m of msgs) {
                if (m.text?.toLowerCase().includes(needle)) {
                  hits.push({
                    channel: name,
                    text: m.text,
                    user: m.user ?? "bot",
                    timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
                  });
                }
              }
              cursor = hist.response_metadata?.next_cursor || undefined;
              if (cursor && (scanned >= perChannel || Date.now() >= deadline)) {
                truncated = true;
                break;
              }
            } while (cursor);
            searchedChannels.push({ channel: name, messages_scanned: scanned, truncated });
          } catch (e) {
            // Ce catch etait vide : un canal où le bot n'est pas membre
            // disparaissait de la réponse, et son silence passait pour une
            // absence de message. Il est désormais rendu au modèle.
            skippedChannels.push({ channel: name, reason: e instanceof Error ? e.message : "erreur inconnue" });
          }
        })
      );

      // Noms d'auteurs résolus pour les seuls messages qui matchent (avant, on
      // résolvait tous les auteurs de tous les messages balayés).
      const userIds = [...new Set(hits.map((h) => h.user))].filter((u) => u && u !== "bot");
      const userMap: Record<string, string> = {};
      await Promise.allSettled(
        userIds.map(async (uid) => {
          try {
            const u = await slack("/users.info", { user: uid });
            userMap[uid] = u.user?.real_name ?? uid;
          } catch {
            userMap[uid] = uid;
          }
        })
      );
      const matches = hits.map((h) => ({ ...h, user: userMap[h.user] ?? h.user }));
      const scannedTotal = searchedChannels.reduce((n, c) => n + c.messages_scanned, 0);

      ctx.onSource({
        kind: "slack",
        title: `Scan ${searchedChannels.length} channels "${rawQuery}" (${matches.length} results)`,
      });
      return JSON.stringify({
        mode: "channel_scan",
        query: rawQuery,
        match_count: matches.length,
        matches,
        channels_searched: searchedChannels,
        channels_skipped: skippedChannels,
        messages_scanned: scannedTotal,
        coverage: `Balayage par mot-clé de ${scannedTotal} messages sur ${searchedChannels.length} canaux (liste dans channels_searched). NE COUVRE PAS : les réponses en fil de discussion, les DM, les canaux de channels_skipped, ni l'historique au-delà de la limite quand truncated vaut true. Un résultat vide ne vaut donc que pour ce périmètre : nomme les canaux consultés dans ta réponse au lieu d'écrire "aucune mention dans Slack".`,
        ...(nativeSearchError
          ? { slack_search_error: `La recherche Slack native a échoué (${nativeSearchError}), seul le balayage a tourné.` }
          : {}),
        ...(!userToken
          ? { slack_search_unavailable: "SLACK_USER_TOKEN absent : la recherche Slack complète (tous canaux, fils, DM) n'est pas disponible sur cette instance, seul le balayage a tourné." }
          : {}),
      });
    },

    get_slack_channel_history: async (input, ctx) => {
      const allChannels = await slackAllChannels();
      const searched = (input.channel_name as string).replace("#", "");
      const channel = allChannels.find((c) => c.name === searched);
      if (!channel) {
        const available = allChannels.map((c) => c.name).sort().join(", ");
        ctx.onSource({ kind: "slack", title: `#${searched} (canal introuvable)` });
        return `Canal "${searched}" introuvable. Canaux accessibles : ${available}`;
      }
      // On remonte TOUT l'historique du canal via pagination cursor (pas seulement la dernière page).
      // `limit` (optionnel) plafonne le nombre total de messages ; sinon on remonte tout.
      const cap = typeof input.limit === "number" && input.limit > 0 ? input.limit : Infinity;
      const deadline = Date.now() + 45_000; // garde-fou anti-timeout
      const rawMessages: { text: string; ts: string; user?: string }[] = [];
      let cursor: string | undefined;
      let truncated = false;
      do {
        const params: Record<string, string> = { channel: channel.id, limit: "200" };
        if (cursor) params.cursor = cursor;
        const histData = await slack("/conversations.history", params);
        rawMessages.push(...((histData.messages ?? []) as { text: string; ts: string; user?: string }[]));
        cursor = histData.response_metadata?.next_cursor || undefined;
        if (cursor && Date.now() >= deadline) { truncated = true; break; }
      } while (cursor && rawMessages.length < cap);
      const trimmed = cap === Infinity ? rawMessages : rawMessages.slice(0, cap);
      const userIds = [...new Set(trimmed.map((m) => m.user).filter(Boolean))] as string[];
      const userMap: Record<string, string> = {};
      await Promise.all(userIds.map(async (uid) => {
        try {
          const u = await slack("/users.info", { user: uid });
          userMap[uid] = u.user?.real_name ?? u.user?.name ?? uid;
        } catch { userMap[uid] = uid; }
      }));
      const messages = trimmed.map((m) => ({
        text: m.text,
        user: m.user ? (userMap[m.user] ?? m.user) : "bot",
        timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
      }));
      ctx.onSource({ kind: "slack", title: `#${channel.name} (${messages.length} messages)` });
      return JSON.stringify({ channel: channel.name, total: messages.length, truncated, messages });
    },

    send_slack_message: async (input) => {
      const target = input.channel as string;
      let channelId = target;
      if (target.includes("@")) {
        const usersData = await slack("/users.lookupByEmail", { email: target });
        const userId = usersData.user?.id;
        if (!userId) return `Utilisateur avec l'email "${target}" introuvable dans Slack.`;
        const dmData = await slackPost("/conversations.open", { users: userId });
        channelId = dmData.channel?.id;
      } else {
        const allChs = await slackAllChannels();
        const ch = allChs.find((c) => c.name === target.replace("#", ""));
        if (!ch) return `Canal "${target}" introuvable.`;
        channelId = ch.id;
      }
      await slackPost("/chat.postMessage", {
        channel: channelId,
        text: toSlackMrkdwn(input.message as string),
      });
      return `Message envoyé dans "${target}".`;
    },
  },
};

export const slackTools = module_;
