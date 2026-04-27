import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  const tokenPreview = token ? `${token.slice(0, 8)}…${token.slice(-4)}` : null;

  const tests: Array<{ name: string; status: number; ok: boolean; sample?: unknown; error?: string }> = [];

  async function probe(name: string, path: string, init?: RequestInit) {
    try {
      const res = await fetch(`https://api.hubapi.com${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      const text = await res.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* keep text */ }
      const sample = typeof body === "object" && body !== null
        ? {
            total: (body as { total?: number }).total,
            count: Array.isArray((body as { results?: unknown[] }).results)
              ? (body as { results: unknown[] }).results.length
              : undefined,
            firstKeys: Array.isArray((body as { results?: unknown[] }).results) && (body as { results: unknown[] }).results[0]
              ? Object.keys((body as { results: Array<Record<string, unknown>> }).results[0]).slice(0, 5)
              : undefined,
          }
        : text.slice(0, 200);
      tests.push({
        name,
        status: res.status,
        ok: res.ok,
        sample,
        ...(res.ok ? {} : { error: typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300) }),
      });
    } catch (e) {
      tests.push({
        name,
        status: 0,
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
      });
    }
  }

  await probe("contacts_list_3", "/crm/v3/objects/contacts?limit=3");
  await probe("deals_list_3", "/crm/v3/objects/deals?limit=3");
  await probe("companies_list_3", "/crm/v3/objects/companies?limit=3");
  await probe(
    "contacts_search_3",
    "/crm/v3/objects/contacts/search",
    {
      method: "POST",
      body: JSON.stringify({
        limit: 3,
        properties: ["email", "firstname"],
      }),
    },
  );

  return NextResponse.json({
    token_present: !!token,
    token_preview: tokenPreview,
    tests,
  });
}
