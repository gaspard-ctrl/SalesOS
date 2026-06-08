// Détection légère EN/FR d'un script vidéo, pour choisir la voix HeyGen
// (Teresa anglaise vs voix française). Heuristique suffisante pour ce choix
// binaire : accents français + mots-outils fréquents de chaque langue.

const FR_WORDS = /\b(le|la|les|une|des|vous|votre|nous|notre|pour|avec|bonjour|merci|est|sur|dans|chez|ravi|échanger|vos|aux|du)\b/g;
const EN_WORDS = /\b(the|you|your|we|our|for|with|hello|thanks|and|to|in|is|of|on|at|this)\b/g;
const FR_ACCENTS = /[éèêàâîôûùçëï]/g;

export function detectScriptLang(text: string): "fr" | "en" {
  const t = (text || "").toLowerCase();
  const fr = (t.match(FR_WORDS)?.length ?? 0) + (t.match(FR_ACCENTS)?.length ?? 0);
  const en = t.match(EN_WORDS)?.length ?? 0;
  return fr > en ? "fr" : "en";
}
