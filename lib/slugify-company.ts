/**
 * Convertit un nom d'entreprise en slug LinkedIn plausible.
 * Gère accents ("Crédit Agricole" → "credit-agricole"), apostrophes
 * ("L'Oréal" → "loreal"), espaces multiples et symboles.
 *
 * ⚠️ Heuristique : le vrai slug LinkedIn peut différer (ex: "totalenergies").
 * À utiliser comme fallback quand on n'a pas le vrai username.
 *
 * Fonction pure, sans dépendance — sûre à importer dans un composant client.
 */
export function slugifyCompany(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
