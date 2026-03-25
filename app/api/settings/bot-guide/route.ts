import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function getDefaultBotGuide(): string {
  return fs.readFileSync(path.join(process.cwd(), "prompt-guide.txt"), "utf-8");
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data } = await db
    .from("users")
    .select("user_prompt")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    guide: data?.user_prompt ?? null,
    default: getDefaultBotGuide(),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { guide } = await req.json();

  await db
    .from("users")
    .update({ user_prompt: guide ?? null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
