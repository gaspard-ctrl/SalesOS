import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { runAeActivityRefresh } from "@/lib/ae-activity/build-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/ae-activity/refresh — déclenche le recalcul du snapshot AE.
//
// En prod (Netlify) : POST vers la background function (retour immédiat, le
// travail continue en arrière-plan). En local : run inline best-effort.
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isNetlifyEnv = !!(process.env.NETLIFY || process.env.URL || process.env.DEPLOY_URL);

  if (!isNetlifyEnv) {
    void runAeActivityRefresh().catch((e) =>
      console.error("[ae-activity/refresh] inline run failed:", e instanceof Error ? e.message : e),
    );
    return NextResponse.json({ ok: true, mode: "inline" }, { status: 202 });
  }

  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret) {
    return NextResponse.json({ error: "INTERNAL_SECRET missing" }, { status: 500 });
  }

  const triggerUrl = `${req.nextUrl.origin}/.netlify/functions/ae-activity-refresh-background`;
  try {
    const res = await fetch(triggerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
      body: JSON.stringify({ trigger: "manual" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok && res.status !== 202) {
      const text = await res.text().catch(() => "");
      console.error(`[ae-activity/refresh] bg trigger ${res.status}:`, text.slice(0, 200));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("aborted") && !msg.includes("timeout")) {
      console.error("[ae-activity/refresh] bg trigger failed:", msg);
    }
  }

  return NextResponse.json({ ok: true, mode: "background" }, { status: 202 });
}
