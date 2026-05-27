import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addProfileToRadar, resolveUsername } from "@/lib/netrows";
import { resolveRadarEmails, type RadarProfileForResolve } from "@/lib/intel/resolve-radar-email";
import type { ProfileSource } from "@/lib/intel-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface AddInput {
  username?: string | null;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  headline?: string | null;
  company?: string | null;
  profileUrl?: string | null;
  source?: ProfileSource;
  is_champion?: boolean;
  hubspotId?: string | null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!process.env.NETROWS_API_KEY) {
    return NextResponse.json({ error: "Netrows non configuré" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    profiles?: AddInput[];
    is_champion?: boolean;
  };
  const inputs = body.profiles ?? [];
  const globalChampion = body.is_champion === true;
  if (inputs.length === 0) return NextResponse.json({ error: "profiles[] requis" }, { status: 400 });

  const added: string[] = [];
  const skipped: string[] = [];
  const failed: { name: string; error: string }[] = [];
  const unresolved: { name: string; reason: string }[] = [];
  let resolvedCount = 0;

  for (const p of inputs.slice(0, 200)) {
    const displayName = p.fullName ?? [p.firstName, p.lastName].filter(Boolean).join(" ") ?? p.email ?? "?";

    // ── 1. Résoudre LinkedIn si manquant
    let username = p.username ?? null;
    if (!username) {
      try {
        username = await resolveUsername({
          email: p.email ?? undefined,
          firstName: p.firstName,
          lastName: p.lastName,
          company: p.company ?? undefined,
        });
        if (username) resolvedCount++;
      } catch {
        /* keep null */
      }
      // Rate limit la résolution (1.5s entre chaque)
      if (!username) {
        unresolved.push({
          name: displayName,
          reason: "LinkedIn introuvable — vérifie email/nom/entreprise",
        });
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    // ── 2. Skip si déjà actif au Radar (sauf si on veut le promouvoir champion)
    const wantChampion = globalChampion || p.is_champion === true;
    const { data: existing } = await db
      .from("linkedin_monitored_profiles")
      .select("radar_active, is_champion")
      .eq("username", username)
      .maybeSingle();

    if (existing?.radar_active === true) {
      // Déjà au Radar : si on demande le flag champion et qu'il ne l'est pas
      // encore, on flippe juste is_champion sans rappeler Netrows. On en profite
      // pour backfill le hubspot_id si on l'a et qu'il manque encore.
      const patch: Record<string, unknown> = {};
      if (wantChampion && existing.is_champion !== true) patch.is_champion = true;
      if (p.hubspotId) patch.hubspot_id = p.hubspotId;
      if (Object.keys(patch).length > 0) {
        await db.from("linkedin_monitored_profiles").update(patch).eq("username", username);
      }
      skipped.push(username);
      continue;
    }

    // ── 3. Add to Netrows Radar + upsert DB
    try {
      await addProfileToRadar(username);
      const shouldFlagChampion = globalChampion || p.is_champion === true;
      const incomingEmail = (p.email ?? "").trim();
      const row: Record<string, unknown> = {
        username,
        full_name: p.fullName ?? displayName,
        headline: p.headline ?? null,
        company: p.company ?? null,
        profile_url: p.profileUrl ?? `https://www.linkedin.com/in/${username}/`,
        source: p.source ?? "manual",
        radar_active: true,
      };
      if (p.hubspotId) row.hubspot_id = p.hubspotId;
      if (incomingEmail && incomingEmail.includes("@")) {
        row.email = incomingEmail;
        row.email_source = p.hubspotId ? "hubspot" : "netrows";
        row.email_resolved_at = new Date().toISOString();
      }
      // Ne JAMAIS écrire is_champion=false ici (sinon on désactiverait un
      // champion existant). On ne le set qu'à la promotion explicite.
      if (shouldFlagChampion) row.is_champion = true;
      await db
        .from("linkedin_monitored_profiles")
        .upsert(row, { onConflict: "username" });
      added.push(username);
    } catch (e) {
      failed.push({ name: username, error: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // ── 4. Auto-resolve email pour les profils ajoutés sans email mais avec
  // hubspot_id (HubSpot batch read = 1 appel, gratuit, rapide).
  let emailsAutoResolved = 0;
  if (added.length > 0) {
    const { data: needsEmail } = await db
      .from("linkedin_monitored_profiles")
      .select("id, username, full_name, headline, company, profile_url, hubspot_id, email, email_confidence, email_source")
      .in("username", added)
      .is("email", null)
      .not("hubspot_id", "is", null);
    const profilesToResolve = (needsEmail ?? []) as RadarProfileForResolve[];
    if (profilesToResolve.length > 0) {
      try {
        const { resolved } = await resolveRadarEmails(profilesToResolve);
        emailsAutoResolved = resolved.filter((r) => r.source === "hubspot").length;
      } catch (e) {
        console.warn("[add-to-radar] auto-resolve emails failed:", e instanceof Error ? e.message : e);
      }
    }
  }

  return NextResponse.json({
    added,
    skipped,
    failed,
    unresolved,
    resolvedCount,
    emailsAutoResolved,
  });
}
