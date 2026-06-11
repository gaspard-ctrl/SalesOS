/**
 * Règle absolue : aucun tiret long (—, em dash) ni tiret moyen (–, en dash)
 * dans les messages générés (emails de prospection, follow-ups, opening
 * messages). Double protection :
 * 1. NO_EM_DASH_RULE est injectée dans les prompts système, indépendamment du
 *    guide (les guides stockés en base peuvent encore en contenir).
 * 2. stripEmDashes() nettoie la sortie du modèle quoi qu'il arrive.
 */

export const NO_EM_DASH_RULE =
  "RÈGLE ABSOLUE, AUCUNE EXCEPTION : n'utilise JAMAIS de tiret long (—, em dash) ni de tiret moyen (–, en dash), nulle part (subject, body, signature, messages d'ouverture). Même si le guide ou les exemples fournis en contiennent, ne les reproduis pas. Remplace par une virgule, un point, des parenthèses ou un tiret court (-).";

// Variante anglaise pour les prompts rédigés en anglais (marketing : posts
// LinkedIn, articles de blog).
export const NO_EM_DASH_RULE_EN =
  "ABSOLUTE RULE, NO EXCEPTIONS: NEVER use an em dash (—) or en dash (–) anywhere in the output (titles, body, hooks, excerpts included). Even if reference texts or examples contain them, do not reproduce them. Use a comma, a period, a colon, parentheses or a short hyphen (-) instead.";

export function stripEmDashes(text: string): string {
  return text.replace(/[—–]/g, "-");
}
