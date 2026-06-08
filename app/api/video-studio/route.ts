import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVideoStatus } from "@/lib/heygen/client";
import type { VideoJob } from "@/lib/video/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/video-studio
// Renvoie l'historique des vidéos (table video_jobs, 50 dernières). Pour chaque
// job encore "processing", interroge HeyGen, met à jour statut/url/erreur et
// persiste. C'est l'endpoint de polling de la page Video Studio.
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await db
    .from("video_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobs = (data ?? []) as VideoJob[];
  const pending = jobs.filter((j) => j.status === "processing");

  if (pending.length && process.env.HEYGEN_API_KEY) {
    await Promise.all(
      pending.map(async (job) => {
        try {
          const status = await getVideoStatus(job.heygen_video_id);
          if (status.status !== "processing") {
            job.status = status.status;
            job.video_url = status.videoUrl ?? null;
            job.error = status.error ?? null;
            await db
              .from("video_jobs")
              .update({
                status: job.status,
                video_url: job.video_url,
                error: job.error,
                updated_at: new Date().toISOString(),
              })
              .eq("id", job.id);
          }
        } catch {
          // Erreur transitoire de l'API status : on laisse le job en processing,
          // le prochain poll réessaiera.
        }
      }),
    );
  }

  return NextResponse.json({ jobs });
}
