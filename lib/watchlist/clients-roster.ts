import { db } from "@/lib/db";

export interface ClientRosterEntry {
  name: string;
  industry: string;
}

interface ClientRow {
  company_name: string | null;
  coach_brief: { industry?: string | null } | null;
}

/**
 * Roster des clients actuels (closed-won) avec leur secteur, pour servir de
 * social proof dans l'Analyse AE et le drafteur de mail ("on coache déjà X
 * dans votre secteur"). Le secteur vient de coach_brief.industry (rempli à
 * l'enrichissement). On ne garde que les clients ayant un nom ET un secteur.
 */
export async function loadClientsRoster(): Promise<ClientRosterEntry[]> {
  const { data } = await db
    .from("clients")
    .select("company_name, coach_brief")
    .order("closedwon_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const rows = (data ?? []) as ClientRow[];
  const seen = new Set<string>();
  const roster: ClientRosterEntry[] = [];
  for (const r of rows) {
    const name = (r.company_name ?? "").trim();
    const industry = (r.coach_brief?.industry ?? "").trim();
    if (!name || !industry) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    roster.push({ name, industry });
  }
  return roster;
}

/** Bloc texte "Nos clients actuels (référence sociale)" pour les prompts. */
export function formatClientsRoster(roster: ClientRosterEntry[]): string {
  if (roster.length === 0) {
    return "Aucun client de référence disponible.";
  }
  return roster
    .slice(0, 120)
    .map((c) => `- ${c.name} (${c.industry})`)
    .join("\n");
}
