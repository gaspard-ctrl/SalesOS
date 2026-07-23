// ────────────────────────────────────────────────────────────────────────
// Reps dynamiques : la liste des AE affichés est pilotée par la table `users`
// (is_sales = true ET hubspot_owner_id renseigné). Le dashboard s'adapte à
// l'équipe sans modification de code.
// ────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { repAccent } from "@/lib/design/tokens";

export type SalesRep = {
  userId: string;
  ownerId: string; // hubspot_owner_id
  name: string;
  email: string | null;
  slackUserId: string | null;
  accent: string;
};

export async function listSalesReps(): Promise<SalesRep[]> {
  const { data, error } = await db
    .from("users")
    .select("id, name, email, hubspot_owner_id, slack_user_id, is_sales")
    .eq("is_sales", true)
    .not("hubspot_owner_id", "is", null);

  if (error || !data) {
    if (error) console.warn("[ae-activity] listSalesReps failed:", error.message);
    return [];
  }

  return (data as Array<{
    id: string;
    name: string | null;
    email: string | null;
    hubspot_owner_id: string | null;
    slack_user_id: string | null;
  }>)
    .filter((u) => !!u.hubspot_owner_id)
    .map((u) => ({
      userId: u.id,
      ownerId: String(u.hubspot_owner_id),
      name: u.name || u.email || "Sales",
      email: u.email ?? null,
      slackUserId: u.slack_user_id ?? null,
      accent: repAccent(u.name || u.email),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
