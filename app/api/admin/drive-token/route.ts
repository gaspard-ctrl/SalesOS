import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { data } = await db
    .from("user_integrations")
    .select("encrypted_refresh, refresh_iv, refresh_auth_tag, connected")
    .eq("user_id", user.id)
    .eq("provider", "gmail")
    .single();

  if (!data?.connected) {
    return NextResponse.json({ error: "Gmail non connecté. Connecte Gmail d'abord." }, { status: 404 });
  }

  const refreshToken = decrypt({
    encryptedKey: data.encrypted_refresh,
    iv: data.refresh_iv,
    authTag: data.refresh_auth_tag,
  });

  return NextResponse.json({
    success: true,
    token_preview: `...${refreshToken.slice(-8)}`,
    instruction: "Le refresh token a été vérifié. Utilise la console Supabase ou le dashboard pour le récupérer si nécessaire.",
  });
}
