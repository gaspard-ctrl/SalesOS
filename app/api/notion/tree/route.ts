import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isNotionConfigured } from "@/lib/notion/client";
import { listChildPages, listDatabaseRowPages, type NotionTreeChild } from "@/lib/notion/read";

export const dynamic = "force-dynamic";

// Racine de la base de connaissance : la page 🧭 DATABASE (registre de
// l'AGENT_GUIDE). Surchargeable si l'arbre déménage.
const ROOT_PAGE_ID = process.env.NOTION_ROOT_PAGE_ID ?? "3911c2f23b0e81368321d2f8a4ea524e";

// Cache in-memory par nœud (l'arbre bouge peu, l'API Notion est limitée ~3 req/s).
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { children: NotionTreeChild[]; at: number }>();

/**
 * GET /api/notion/tree?id=<pageId>&kind=page|database
 * Enfants directs d'un nœud de la base Notion (explorateur "What's on the
 * Notion", chargement paresseux par branche). Sans `id` : la racine 🧭 DATABASE.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isNotionConfigured()) {
    return NextResponse.json({ error: "Intégration Notion non configurée (NOTION_TOKEN)." }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? ROOT_PAGE_ID;
  const kind = req.nextUrl.searchParams.get("kind") === "database" ? "database" : "page";
  const cacheKey = `${kind}:${id}`;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ children: hit.children });
  }

  try {
    const children = kind === "database"
      ? await listDatabaseRowPages(id)
      : await listChildPages(id);
    cache.set(cacheKey, { children, at: Date.now() });
    return NextResponse.json({ children });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur Notion" },
      { status: 502 }
    );
  }
}
