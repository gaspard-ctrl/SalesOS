import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface StoredFile {
  id: string;
  name?: string;
  mimetype?: string;
  url_private?: string;
  thumb_url?: string;
}

// Proxy Slack private file bytes — the browser cannot fetch url_private directly
// because it requires the bot token. We fetch server-side and stream back.
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const leadId = req.nextUrl.searchParams.get("leadId");
  const fileId = req.nextUrl.searchParams.get("fileId");
  const variant = req.nextUrl.searchParams.get("variant") === "thumb" ? "thumb" : "full";

  if (!leadId || !fileId) {
    return NextResponse.json({ error: "leadId and fileId are required" }, { status: 400 });
  }

  const { data, error } = await db
    .from("leads")
    .select("files")
    .eq("id", leadId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const files = (data.files ?? []) as StoredFile[];
  const file = files.find((f) => f.id === fileId);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const url = variant === "thumb" ? file.thumb_url || file.url_private : file.url_private;
  if (!url) {
    return NextResponse.json({ error: "No URL for file" }, { status: 404 });
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 500 });
  }

  const slackRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!slackRes.ok) {
    return NextResponse.json({ error: `Slack file fetch failed: ${slackRes.status}` }, { status: 502 });
  }

  const contentType = slackRes.headers.get("content-type") ?? file.mimetype ?? "application/octet-stream";
  const body = await slackRes.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
