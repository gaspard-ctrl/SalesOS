import { NextRequest, NextResponse } from "next/server";
import { verifySlackSignature } from "@/lib/slack/verify";
import { getUserInfo, postMessage, publishHomeView } from "@/lib/slack/api";
import { buildHomeView } from "@/lib/slack/home-view";

export const dynamic = "force-dynamic";

/**
 * Endpoint Slack Events API pour SalesOS / CoachelloGPT.
 *
 * Reçoit tous les events que l'app souscrit côté api.slack.com :
 *  - `url_verification` : challenge initial pour valider l'URL.
 *  - `app_home_opened`  : publie la vue Home Tab personnalisée.
 *  - `app_mention`      : @SalesOS dans un canal → déclenche CoachelloGPT.
 *  - `message.im`       : DM direct au bot → déclenche CoachelloGPT.
 *
 * Contraintes Slack :
 *  - ACK 200 en moins de 3s sinon retry automatique.
 *  - Signature HMAC-SHA256 vérifiée avec SLACK_SIGNING_SECRET (cf. verify.ts).
 *  - Le body doit être lu BRUT (req.text()) pour que la signature matche.
 *
 * Pour les events lourds (CoachelloGPT = boucle agentic 30s-2min), on ACK
 * immédiatement et on délègue à une Background Function Netlify. Cette
 * partie est stubée pour l'instant — branchement dans une PR suivante.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySlackSignature({
    rawBody,
    timestamp: req.headers.get("x-slack-request-timestamp"),
    signature: req.headers.get("x-slack-signature"),
  })) {
    console.warn("[slack/events] signature invalide");
    return new NextResponse("invalid signature", { status: 401 });
  }

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  // ── Challenge initial Slack ─────────────────────────────────────────────
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // ── Event callback ──────────────────────────────────────────────────────
  if (payload.type === "event_callback" && payload.event) {
    const event = payload.event;

    // Slack retry si on ne répond pas en 3s. On dispatch en fire-and-forget
    // pour les events qui nécessitent un travail long. Pour Home Tab, c'est
    // assez rapide pour rester en sync.
    try {
      if (event.type === "app_home_opened" && event.tab === "home") {
        await handleAppHomeOpened(event);
        return NextResponse.json({ ok: true });
      }

      if (event.type === "message" && event.channel_type === "im") {
        // Skip les messages du bot lui-même (sinon boucle infinie)
        if (event.bot_id || event.subtype === "bot_message") {
          return NextResponse.json({ ok: true });
        }
        await handleUserMessage(event, "im");
        return NextResponse.json({ ok: true });
      }

      if (event.type === "app_mention") {
        await handleUserMessage(event, "mention");
        return NextResponse.json({ ok: true });
      }
    } catch (e) {
      console.error("[slack/events] handler error:", e);
      // On répond quand même 200 pour éviter le retry storm Slack.
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ ok: true });
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleAppHomeOpened(event: SlackEvent) {
  const userId = event.user;
  if (!userId) return;

  let userName: string | null = null;
  try {
    const info = await getUserInfo(userId);
    userName = info.profile?.display_name || info.profile?.real_name || info.real_name || null;
    // Slack renvoie parfois display_name = "" — on retombe sur real_name
    if (userName) userName = userName.split(" ")[0];
  } catch (e) {
    console.warn("[slack/events] users.info failed:", e);
  }

  await publishHomeView({
    user_id: userId,
    view: buildHomeView({ userName }),
  });
}

/**
 * Placeholder : pour l'instant on répond juste un accusé de réception.
 * Le branchement vers `runChat()` + Background Function viendra dans la
 * prochaine étape, une fois la route déployée et la Request URL validée
 * par Slack.
 */
async function handleUserMessage(event: SlackEvent, source: "im" | "mention") {
  const channel = event.channel;
  const text = event.text ?? "";
  if (!channel) return;

  const placeholder = source === "mention"
    ? "👋 Je suis en train d'être branché à CoachelloGPT. Bientôt, je répondrai pour de vrai à tes mentions !"
    : "👋 Je suis en train d'être branché à CoachelloGPT. Bientôt, je répondrai pour de vrai à tes DMs ! (message reçu : " + text.slice(0, 80) + ")";

  await postMessage({
    channel,
    text: placeholder,
    thread_ts: source === "mention" ? event.ts : undefined,
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

type SlackEvent = {
  type: string;
  user?: string;
  channel?: string;
  channel_type?: string;
  tab?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
};

type SlackEventPayload =
  | { type: "url_verification"; challenge: string }
  | {
      type: "event_callback";
      event: SlackEvent;
      team_id?: string;
      api_app_id?: string;
    };
