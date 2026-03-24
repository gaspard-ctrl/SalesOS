import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getGmailAccessToken } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const q = req.nextUrl.searchParams.get("q") ?? "";
    const maxResults = Math.min(parseInt(req.nextUrl.searchParams.get("maxResults") ?? "10", 10), 15);

    if (!q) return NextResponse.json({ messages: [] });

    const accessToken = await getGmailAccessToken(user.id);

    const listRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q, maxResults: String(maxResults) })}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) return NextResponse.json({ messages: [] });

    const listData = await listRes.json();
    const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);
    if (ids.length === 0) return NextResponse.json({ messages: [] });

    const details = await Promise.all(
      ids.map((id) =>
        fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then((r) => r.ok ? r.json() : null)
      )
    );

    const messages = details
      .filter(Boolean)
      .map((msg) => {
        const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
        const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
        return {
          id: msg.id,
          subject: get("Subject"),
          from: get("From"),
          date: get("Date"),
          snippet: msg.snippet ?? "",
        };
      });

    return NextResponse.json({ messages });
  } catch (e) {
    console.error("gmail/search error:", e);
    return NextResponse.json({ messages: [], error: String(e) });
  }
}
