import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return NextResponse.json({ channels: [] });

  try {
    const res = await fetch("https://slack.com/api/conversations.list?limit=200&types=public_channel,private_channel", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ channels: [] });

    const channels = (data.channels ?? [])
      .filter((c: { is_archived: boolean }) => !c.is_archived)
      .map((c: { id: string; name: string; is_private: boolean }) => ({ id: c.id, name: c.name, is_private: c.is_private ?? false, type: "channel" as const }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    // Also fetch team members for DM option
    let members: { id: string; name: string; type: "dm" }[] = [];
    try {
      const usersRes = await fetch("https://slack.com/api/users.list?limit=200", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const usersData = await usersRes.json();
      if (usersData.ok) {
        members = (usersData.members ?? [])
          .filter((m: { is_bot: boolean; deleted: boolean; id: string }) => !m.is_bot && !m.deleted && m.id !== "USLACKBOT")
          .map((m: { id: string; real_name?: string; profile?: { display_name?: string } }) => ({
            id: m.id,
            name: m.real_name || m.profile?.display_name || m.id,
            type: "dm" as const,
          }))
          .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
      }
    } catch { /* ignore */ }

    return NextResponse.json({ channels, members });
  } catch {
    return NextResponse.json({ channels: [] });
  }
}
