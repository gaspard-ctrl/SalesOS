import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateVideo, type HeygenAvatarType } from "@/lib/heygen/client";
import { detectScriptLang } from "@/lib/video/lang";
import type { VideoJob } from "@/lib/video/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/video-studio/render
// Body: { prompt: string; script: string; clientId?: string; clientName?: string }
// Soumet la vidéo à HeyGen (avatar/voix/fond fixés en config) et insère un job
// "processing" dans la table autonome video_jobs. Renvoie le job. Le résultat est
// récupéré ensuite par polling (GET /api/video-studio).
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const avatarId = process.env.HEYGEN_AVATAR_ID;
  const voiceEn = process.env.HEYGEN_VOICE_ID;
  if (!process.env.HEYGEN_API_KEY || !avatarId || !voiceEn) {
    return NextResponse.json(
      { error: "HeyGen not configured (HEYGEN_API_KEY / HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID)" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    script?: string;
    clientId?: string;
    clientName?: string;
    speed?: number;
  };
  const prompt = (body.prompt ?? "").trim();
  const script = (body.script ?? "").trim();
  if (!script) return NextResponse.json({ error: "Script is required" }, { status: 400 });

  // Vitesse de parole : clampée dans la plage HeyGen [0.5, 1.5]. 0.85 par défaut
  // (l'avatar lit moins vite, meilleur rendu).
  const speed = Math.min(1.5, Math.max(0.5, Number(body.speed) || 0.85));

  // La langue suit le script : FR -> voix française (fallback EN si non configurée),
  // sinon voix anglaise (Teresa).
  const voiceId =
    detectScriptLang(script) === "fr" ? process.env.HEYGEN_VOICE_ID_FR || voiceEn : voiceEn;

  let videoId: string;
  try {
    ({ videoId } = await generateVideo({
      script,
      avatarId,
      voiceId,
      speed,
      avatarType: (process.env.HEYGEN_AVATAR_TYPE as HeygenAvatarType) || "avatar",
      backgroundImageId: process.env.HEYGEN_BACKGROUND_IMAGE_ID || undefined,
      backgroundUrl: process.env.HEYGEN_BACKGROUND_URL || undefined,
    }));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "HeyGen generate failed" },
      { status: 502 },
    );
  }

  const job: VideoJob = {
    id: randomUUID(),
    client_id: body.clientId ?? null,
    client_name: body.clientName ?? null,
    prompt,
    script,
    heygen_video_id: videoId,
    status: "processing",
    video_url: null,
    error: null,
    created_by: user.id,
    created_at: new Date().toISOString(),
  };

  const { error: insErr } = await db.from("video_jobs").insert(job);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ job });
}
