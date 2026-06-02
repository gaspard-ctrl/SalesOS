import { db } from "@/lib/db";

/**
 * Résout le modèle Claude configuré dans l'admin (/admin > Modèles IA) pour une
 * feature donnée. Les préférences sont stockées en JSON dans
 * `guide_defaults.model_preferences` (clé -> id de modèle). Retourne `fallback`
 * si la clé n'est pas configurée, si la table est vide ou en cas d'erreur.
 *
 * Best-effort : ne throw jamais, pour ne jamais bloquer une génération.
 */
export async function getModelPreference(key: string, fallback: string): Promise<string> {
  try {
    const { data } = await db
      .from("guide_defaults")
      .select("content")
      .eq("key", "model_preferences")
      .maybeSingle();
    const prefs = data?.content ? (JSON.parse(data.content as string) as Record<string, string>) : {};
    return prefs[key] || fallback;
  } catch {
    return fallback;
  }
}
