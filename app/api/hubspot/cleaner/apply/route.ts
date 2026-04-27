import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  hubspotMerge,
  hubspotUpdate,
  hubspotArchive,
  hubspotAssociate,
  type HubspotObjectType,
} from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type ApplyItem =
  | { action: "merge"; auditType: string; objectType: HubspotObjectType; id: string; primaryId: string }
  | { action: "archive"; auditType: string; objectType: HubspotObjectType; id: string }
  | { action: "update"; auditType: string; objectType: HubspotObjectType; id: string; properties: Record<string, string> }
  | { action: "associate"; auditType: string; objectType: HubspotObjectType; id: string; targetType: HubspotObjectType; targetId: string };

type ApplyResult = {
  index: number;
  status: "success" | "error";
  error?: string;
};

const RATE_LIMIT_DELAY_MS = 110;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function logAction(userId: string, item: ApplyItem, status: "success" | "error", errorMessage?: string) {
  try {
    await db.from("hubspot_cleaner_actions").insert({
      user_id: userId,
      audit_type: item.auditType,
      action: item.action,
      object_type: item.objectType,
      object_id: item.id,
      payload: item as unknown as Record<string, unknown>,
      status,
      error_message: errorMessage ?? null,
    });
  } catch {
    // Logging failure is non-fatal for the apply itself
  }
}

async function runItem(item: ApplyItem): Promise<void> {
  switch (item.action) {
    case "merge":
      await hubspotMerge(item.objectType, item.primaryId, item.id);
      return;
    case "archive":
      await hubspotArchive(item.objectType, item.id);
      return;
    case "update":
      await hubspotUpdate(item.objectType, item.id, item.properties);
      return;
    case "associate":
      await hubspotAssociate(item.objectType, item.id, item.targetType, item.targetId);
      return;
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: { items?: ApplyItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const items = body.items ?? [];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Aucun item" }, { status: 400 });
  }
  if (items.length > 200) {
    return NextResponse.json({ error: "Trop d'items (max 200)" }, { status: 400 });
  }

  const results: ApplyResult[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await runItem(item);
      results.push({ index: i, status: "success" });
      await logAction(user.id, item, "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      results.push({ index: i, status: "error", error: message });
      await logAction(user.id, item, "error", message);
    }
    if (i < items.length - 1) await sleep(RATE_LIMIT_DELAY_MS);
  }

  const successes = results.filter((r) => r.status === "success").length;
  const failures = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ results, successes, failures, total: items.length });
}
