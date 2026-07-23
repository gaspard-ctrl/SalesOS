import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { sendRagRecap } from "@/lib/rag-insights/slack-recap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/rag/send-recap — envoie le recap Slack maintenant.
// Envoi sync : le rendu est déterministe (aucun appel LLM), ça tient largement
// dans les ~26s d'une fonction Netlify. `force` ignore la garde d'idempotence.
export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await sendRagRecap({ force: true });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
