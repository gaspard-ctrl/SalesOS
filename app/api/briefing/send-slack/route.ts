import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function slackPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack ${path} → ${data.error}`);
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { userEmail, briefingText, eventTitle } = await req.json() as {
      userEmail: string;
      briefingText: string;
      eventTitle: string;
    };

    // Find Slack user by email
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(userEmail)}`,
      { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } }
    );
    const userData = await res.json();
    if (!userData.ok) {
      return NextResponse.json({ error: "Utilisateur Slack introuvable" }, { status: 404 });
    }

    const dm = await slackPost("/conversations.open", { users: userData.user.id });
    const channel = dm.channel.id;

    await slackPost("/chat.postMessage", {
      channel,
      text: `📋 *Briefing : ${eventTitle}*\n\n${briefingText}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("briefing/send-slack error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
