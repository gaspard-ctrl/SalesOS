import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hubspotFetch } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTACT_PROPS = [
  "firstname",
  "lastname",
  "email",
  "lifecyclestage",
  "hs_lead_status",
  "hubspot_owner_id",
];

interface AnalysisRow {
  id: string;
  hubspot_contact_id: string;
}

type BatchReadResponse = {
  results?: { id: string; properties?: Record<string, string> }[];
};

type OwnersResponse = {
  results?: { id: string; firstName?: string; lastName?: string; email?: string }[];
};

async function fetchOwnersIndex(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return out;
  try {
    const owners = await hubspotFetch<OwnersResponse>("/crm/v3/owners?limit=200");
    for (const o of owners.results ?? []) {
      const name = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || "";
      if (o.id && name) out.set(o.id, name);
    }
  } catch {
    // non-fatal
  }
  return out;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN missing" }, { status: 500 });
  }

  let body: { limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body OK
  }
  const limit = Math.min(Math.max(body.limit ?? 100, 1), 200);

  const { data, error } = await db
    .from("lead_analyses")
    .select("id, hubspot_contact_id")
    .not("hubspot_contact_id", "is", null)
    .is("contact_hs_lead_status", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as AnalysisRow[];
  if (rows.length === 0) {
    return NextResponse.json({ processed: 0, ok: 0, errors: 0 });
  }

  // Batch-read up to 100 contacts at a time from HubSpot.
  const ownersIndex = await fetchOwnersIndex();
  let ok = 0;
  let errors = 0;
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const contactIds = Array.from(new Set(chunk.map((r) => r.hubspot_contact_id)));
    const propsById = new Map<string, Record<string, string>>();
    try {
      const res = await hubspotFetch<BatchReadResponse>(
        "/crm/v3/objects/contacts/batch/read",
        "POST",
        {
          properties: CONTACT_PROPS,
          inputs: contactIds.map((id) => ({ id })),
        },
      );
      for (const r of res.results ?? []) {
        if (r.id) propsById.set(r.id, r.properties ?? {});
      }
    } catch (e) {
      console.error("[backfill-contact-stage batch]", e instanceof Error ? e.message : e);
      errors += chunk.length;
      continue;
    }

    for (const row of chunk) {
      const p = propsById.get(row.hubspot_contact_id);
      if (!p) {
        errors++;
        continue;
      }
      const ownerId = p.hubspot_owner_id || null;
      const ownerName = ownerId ? ownersIndex.get(ownerId) ?? null : null;
      const fullName = `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim() || null;
      const { error: updErr } = await db
        .from("lead_analyses")
        .update({
          contact_email: p.email || null,
          contact_name: fullName,
          contact_lifecyclestage: p.lifecyclestage || null,
          contact_hs_lead_status: p.hs_lead_status || null,
          contact_owner_id: ownerId,
          contact_owner_name: ownerName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updErr) {
        console.error(`[backfill-contact-stage ${row.id}]`, updErr.message);
        errors++;
      } else {
        ok++;
      }
    }
  }

  return NextResponse.json({ processed: rows.length, ok, errors });
}
