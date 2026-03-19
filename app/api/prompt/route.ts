import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function getDefaultPrompt(): string {
  return fs.readFileSync(path.join(process.cwd(), "prompt-guide.txt"), "utf-8");
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data, error } = await db
    .from("users")
    .select("user_prompt, name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) console.error("[GET /api/prompt] Supabase error:", error);

  const prompt = data?.user_prompt ?? getDefaultPrompt();
  const firstName = (data?.name ?? user.name ?? "").split(" ")[0] || "moi";

  return NextResponse.json({ prompt, firstName });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { prompt } = await req.json();
  if (typeof prompt !== "string") {
    return NextResponse.json({ error: "Prompt invalide" }, { status: 400 });
  }

  const { error } = await db
    .from("users")
    .update({ user_prompt: prompt })
    .eq("id", user.id);

  if (error) {
    console.error("[POST /api/prompt] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
