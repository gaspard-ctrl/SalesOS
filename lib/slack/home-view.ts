import type { SlackBlock } from "./api";

/**
 * Vue Block Kit affichée dans l'onglet "Accueil" de l'app SalesOS sur Slack.
 * Publiée à chaque event `app_home_opened` via /views.publish.
 *
 * On reste sobre : un header personnalisé, une explication, et 3 actions
 * rapides pour amorcer une conversation. Les boutons posent simplement un
 * message-template dans la DM (le bot interceptera ensuite la réponse comme
 * un message normal).
 */
export function buildHomeView(args: {
  userName: string | null;
}): { type: "home"; blocks: SlackBlock[] } {
  const greeting = args.userName ? `Salut ${args.userName} 👋` : "Salut 👋";

  return {
    type: "home",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: greeting, emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "Je suis *CoachelloGPT*, ton assistant commercial connecté à HubSpot, Gmail, Drive, LinkedIn et Slack.\n" +
            "Pose-moi une question dans l'onglet *Chat* et je te réponds avec le contexte de tes deals et de ton équipe.",
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: "*Exemples de questions*" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "• _Quels sont mes deals en stage \"Demo completed\" ?_\n" +
            "• _Résume-moi le dernier meeting avec Lacoste._\n" +
            "• _Trouve le Head of L&D de Danone et son email._\n" +
            "• _Cherche dans Slack ce qu'on a dit sur Engie cette semaine._",
        },
      },
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Tape ta question dans l'onglet *Chat* ci-dessus, ou mentionne *@SalesOS* dans n'importe quel canal.",
          },
        ],
      },
    ],
  };
}
