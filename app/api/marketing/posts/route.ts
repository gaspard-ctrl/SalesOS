import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const POST_COLUMNS =
  "id, post_url, source, author, content, posted_at, likes, comments, created_at, updated_at";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated", posts: [] }, { status: 401 });

  // Fenêtre roulante : on n'affiche que la dernière année.
  const cutoff = new Date(Date.now() - 365 * 864e5).toISOString();
  const { data, error } = await db
    .from("marketing_linkedin_posts")
    .select(POST_COLUMNS)
    .gte("posted_at", cutoff)
    .order("posted_at", { ascending: false, nullsFirst: false });

  // Shape complète même en erreur : le fetcher SWR avale les non-2xx dans `data`.
  if (error) return NextResponse.json({ error: error.message, posts: [] }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}
