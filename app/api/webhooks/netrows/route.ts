import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import type { RadarWebhookPayload } from "@/lib/netrows";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RadarWebhookPayload;

    const secret = process.env.NETROWS_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers.get("x-netrows-signature");
      const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
      if (signature !== expected) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    console.log("[netrows-webhook]", body.event, body.summary);

    // ── Company changed ──────────────────────────────────────────────
    if (body.event === "company.changed" && body.company) {
      const staffChange = body.changes.find((c) => c.field === "staffCount");
      if (staffChange) {
        const oldCount = Number(staffChange.oldValue) || 0;
        const newCount = Number(staffChange.newValue) || 0;
        const diff = Math.abs(newCount - oldCount);
        const pct = oldCount > 0 ? (diff / oldCount) * 100 : 100;

        if (pct > 5 || diff > 50) {
          const companyName = (body.newSnapshot.name as string) ?? body.company.username;
          const { data: allUsers } = await db.from("users").select("id");
          if (allUsers?.length) {
            await db.from("market_signals").insert(
              allUsers.map((u: { id: string }) => ({
                user_id: u.id,
                company_name: companyName,
                signal_type: "hiring",
                title: `${companyName} : effectifs ${newCount > oldCount ? "en hausse" : "en baisse"} (${oldCount} → ${newCount})`,
                summary: `Changement de ${diff} employés (${pct.toFixed(0)}%) détecté via LinkedIn.`,
                strength: pct > 20 ? 3 : 2,
                score: pct > 20 ? 80 : 60,
                source_url: body.company!.url,
                source_domain: "linkedin.com",
                why_relevant: "Changement significatif d'effectifs — besoin potentiel de coaching managers.",
                suggested_action: "Contacter le DRH pour proposer un accompagnement.",
                action_type: "email",
                is_read: false,
                is_actioned: false,
              }))
            );
          }
        }
      }
    }

    // ── Profile changed ──────────────────────────────────────────────
    if (body.event === "profile.changed" && body.profile) {
      const titleChange = body.changes.find((c) => c.field === "headline" || c.field === "position");
      if (titleChange) {
        const username = body.profile.username;
        const oldValue = String(titleChange.oldValue ?? "");
        const newValue = String(titleChange.newValue ?? "");

        // Update linkedin_monitored_profiles
        const { data: monitored } = await db
          .from("linkedin_monitored_profiles")
          .select("full_name, company, headline")
          .eq("username", username)
          .maybeSingle();

        const displayName = monitored?.full_name ?? username;
        const company = monitored?.company ?? "—";

        await db.from("linkedin_monitored_profiles")
          .update({
            headline: newValue,
            last_snapshot: body.newSnapshot,
            last_change_at: new Date().toISOString(),
          })
          .eq("username", username);

        // Create signal for all users
        const { data: allUsers } = await db.from("users").select("id");
        if (allUsers?.length) {
          await db.from("market_signals").insert(
            allUsers.map((u: { id: string }) => ({
              user_id: u.id,
              company_name: company,
              signal_type: "job_change",
              title: `${displayName} change de poste chez ${company}`,
              summary: `${oldValue} → ${newValue}`,
              strength: 3,
              score: 85,
              source_url: body.profile!.url,
              source_domain: "linkedin.com",
              why_relevant: `${displayName} a changé de poste — nouveau décideur potentiel pour le coaching.`,
              suggested_action: `Contacter ${displayName} pour se présenter et proposer un accompagnement.`,
              action_type: "linkedin",
              is_read: false,
              is_actioned: false,
            }))
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[netrows-webhook] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
