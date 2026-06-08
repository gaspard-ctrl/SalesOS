import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { runCampaignGeneration } from "@/lib/mass-prospection/run-generation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// La génération enrichit chaque prospect via Bright Data (scrape LinkedIn,
// 10-60s/profil) → avec 10+ prospects ça dépasse la limite synchrone Netlify.
// On déclenche donc une Background Function (jusqu'à 15min) et on rend la main
// tout de suite ; le front poll le statut de la campagne.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  const { data: campaign } = await db
    .from("mass_campaigns")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const onlyErrors: boolean = body.onlyErrors ?? false;

  // Passe la campagne en "generating" tout de suite pour que le front affiche
  // l'état pendant que la background function démarre.
  await db.from("mass_campaigns").update({ status: "generating", updated_at: new Date().toISOString() }).eq("id", id);

  const isNetlifyEnv = !!(process.env.NETLIFY || process.env.URL || process.env.DEPLOY_URL);
  const isDev = process.env.NODE_ENV === "development";

  if (isNetlifyEnv && !isDev) {
    const internalSecret = process.env.INTERNAL_SECRET;
    if (!internalSecret) {
      return NextResponse.json({ error: "INTERNAL_SECRET not configured" }, { status: 500 });
    }
    try {
      const bgRes = await fetch(`${req.nextUrl.origin}/.netlify/functions/mass-prospection-generate-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
        body: JSON.stringify({ campaignId: id, userId: user.id, onlyErrors }),
        signal: AbortSignal.timeout(8000),
      });
      if (bgRes.status !== 202 && !bgRes.ok) {
        const text = await bgRes.text().catch(() => "");
        return NextResponse.json({ error: `Background non-202 (${bgRes.status}): ${text.slice(0, 200)}` }, { status: 502 });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Le timeout d'abort est normal (fire-and-forget) ; on ne le traite pas en erreur.
      if (!msg.includes("aborted") && !msg.includes("timeout") && !msg.includes("signal")) {
        console.error(`[mass-prospection/generate/${id}] bg trigger failed:`, msg);
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }
    return NextResponse.json({ triggered: true });
  }

  // Dev : pas de Background Function → on exécute inline et on attend.
  const result = await runCampaignGeneration(id, user.id, { onlyErrors });
  return NextResponse.json(result);
}
