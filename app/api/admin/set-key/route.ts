import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, claudeKey } = await req.json();
  if (!userId || !claudeKey) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: targetUser } = await db
    .from("users")
    .select("id")
    .eq("id", userId)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { encryptedKey, iv, authTag } = encrypt(claudeKey);

  // Force delete + insert to guarantee the key is replaced
  const { error: delError } = await db.from("user_keys")
    .delete()
    .eq("user_id", userId)
    .eq("service", "claude");

  console.log(`[set-key] Delete old key for ${userId}: ${delError ? delError.message : "OK"}`);

  const { error: insError } = await db.from("user_keys").insert({
    user_id: userId,
    service: "claude",
    encrypted_key: encryptedKey,
    iv,
    auth_tag: authTag,
    is_active: true,
  });

  if (insError) {
    console.error(`[set-key] Insert failed for ${userId}:`, insError.message);
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  console.log(`[set-key] Key saved for ${userId}: encrypted_len=${encryptedKey.length}, starts="${claudeKey.slice(0, 7)}"`);
  return NextResponse.json({ success: true });
}
