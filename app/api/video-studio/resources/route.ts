import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { listAvatars, listVoices } from "@/lib/heygen/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/video-studio/resources[?q=][&lang=french][&gender=female]
// Helper de configuration : liste les avatars (studio + photo) et les voix du
// compte HeyGen pour récupérer les IDs à coller dans .env.local.
// - q : filtre par nom (insensible à la casse).
// - lang / gender : filtrent les voix (ex. ?lang=french&gender=female pour
//   trouver une voix FR). Quand lang ou gender est fourni, on ne renvoie que les
//   voix (les avatars seraient du bruit).
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!process.env.HEYGEN_API_KEY) {
    return NextResponse.json({ error: "HEYGEN_API_KEY missing" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const lang = (params.get("lang") ?? "").trim().toLowerCase();
  const gender = (params.get("gender") ?? "").trim().toLowerCase();
  const match = (s?: string) => !q || (s ?? "").toLowerCase().includes(q);
  const voicesOnly = Boolean(lang || gender);

  try {
    const [{ avatars, talking_photos }, voices] = await Promise.all([listAvatars(), listVoices()]);

    const voiceList = voices
      .filter((v) => match(v.name))
      .filter((v) => !lang || (v.language ?? "").toLowerCase().includes(lang))
      .filter((v) => !gender || (v.gender ?? "").toLowerCase() === gender)
      .map((v) => ({ voice_id: v.voice_id, name: v.name, language: v.language, gender: v.gender }));

    return NextResponse.json({
      avatars: voicesOnly
        ? []
        : avatars
            .filter((a) => match(a.avatar_name) || match(a.avatar_id))
            .map((a) => ({ avatar_id: a.avatar_id, name: a.avatar_name, gender: a.gender, preview: a.preview_image_url, use: "HEYGEN_AVATAR_TYPE=avatar" })),
      talking_photos: voicesOnly
        ? []
        : talking_photos
            .filter((p) => match(p.talking_photo_name) || match(p.talking_photo_id))
            .map((p) => ({ talking_photo_id: p.talking_photo_id, name: p.talking_photo_name, preview: p.preview_image_url, use: "HEYGEN_AVATAR_TYPE=talking_photo" })),
      voices: voiceList,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "HeyGen error" }, { status: 502 });
  }
}
