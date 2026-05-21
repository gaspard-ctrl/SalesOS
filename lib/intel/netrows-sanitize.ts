// Netrows /people/search refuse silencieusement (404 ou bug) les requêtes
// contenant certains caractères spéciaux. La doc liste explicitement
// "() {}, slashes /, or commas ,". On a observé en plus que les apostrophes
// et ampersands ("L'Oréal", "R&D", "Head of L&D") déclenchent aussi des 404
// inexpliqués. On normalise les accents (NFD) et on remplace tous ces
// caractères problématiques par un espace.
const STRIP_PATTERN = /[(){}\[\]\/\\,'"&;:*+!?]/g;

export function sanitizeNetrowsParam(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(STRIP_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function paramWasModifiedBySanitize(s: string): boolean {
  return sanitizeNetrowsParam(s) !== s.trim();
}
