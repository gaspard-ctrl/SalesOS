import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/chat/[jobId]/feedback — 👍/👎 du user sous une réponse du chat.
// Une row chat_jobs = un tour, donc le feedback vit directement dessus. Il est
// ensuite lu par RAG Insights, où il prime sur l'estimation du juge LLM.
// `rating: null` retire le feedback (re-clic sur le bouton déjà actif).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { jobId } = await params;
  const { rating } = (await req.json().catch(() => ({}))) as { rating?: unknown };

  if (rating !== "up" && rating !== "down" && rating !== null) {
    return NextResponse.json({ error: "rating must be 'up', 'down' or null" }, { status: 400 });
  }

  const { data: job } = await db
    .from("chat_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await db
    .from("chat_jobs")
    .update({ feedback: rating, feedback_at: rating ? new Date().toISOString() : null })
    .eq("id", jobId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rating });
}
