import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { AeActivityDashboard } from "./_components/dashboard";

export const dynamic = "force-dynamic";

// Page admin "AE Sales Activity" — vue manager de l'activité commerciale des AE.
// Réservée aux admins (users.is_admin). Les données viennent du cache Supabase
// (ae_activity_snapshots) via /api/admin/ae-activity.
export default async function AeActivityPage() {
  const user = await getAuthenticatedUser();
  if (!user || !isAdmin(user)) redirect("/");
  return <AeActivityDashboard />;
}
