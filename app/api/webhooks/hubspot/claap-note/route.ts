import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { fetchDealContext, hubspotFetch, type DealSnapshot } from "@/lib/hubspot";
import { companyFromEmail } from "@/lib/claap";
import { findChannelId } from "@/lib/slack-leads";
import { isClaapNote, parseClaapNote, type ParsedClaapNote } from "@/lib/claap-note-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SECTION_MAX_LEN = 2900;
const NOTE_OBJECT_TYPE_ID = "0-46";
const HMAC_MAX_AGE_MS = 5 * 60 * 1000;

type HubspotNoteResponse = {
  id: string;
  properties?: { hs_note_body?: string; hs_timestamp?: string };
  associations?: {
    deals?: { results?: Array<{ id?: string; toObjectId?: string }> };
    companies?: { results?: Array<{ id?: string; toObjectId?: string }> };
    contacts?: { results?: Array<{ id?: string; toObjectId?: string }> };
  };
};

type WorkflowPayload = {
  noteId?: string | number;
  objectId?: string | number;
  hs_object_id?: string | number;
  note?: { id?: string | number };
  dealId?: string;
};

type SubscriptionEvent = {
  eventId?: number;
  subscriptionId?: number;
  portalId?: number;
  subscriptionType?: string;
  objectId?: number | string;
  objectTypeId?: string;
  changeFlag?: string;
  occurredAt?: number;
};

type SlackUser = {
  id: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: { real_name?: string; display_name?: string };
};

type ProcessResult =
  | { ok: true; status: "posted" | "ignored"; reason?: string; dealId: string | null; mode: string; destination: string | null }
  | { ok: false; status: "error"; reason: string };

function verifySignature(req: NextRequest, rawBody: string): { ok: boolean; reason?: string } {
  // ── HubSpot Private App subscription: HMAC v3 ────────────────────────
  const sigV3 = req.headers.get("x-hubspot-signature-v3");
  const timestamp = req.headers.get("x-hubspot-request-timestamp");
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (sigV3 && timestamp) {
    if (!clientSecret) return { ok: false, reason: "HUBSPOT_CLIENT_SECRET not set" };
    const tsNum = Number(timestamp);
    if (!Number.isFinite(tsNum)) return { ok: false, reason: "invalid_timestamp" };
    if (Math.abs(Date.now() - tsNum) > HMAC_MAX_AGE_MS) return { ok: false, reason: "stale_timestamp" };

    const url = process.env.HUBSPOT_WEBHOOK_TARGET_URL || req.url;
    const dataToSign = `POST${url}${rawBody}${timestamp}`;
    const expected = crypto.createHmac("sha256", clientSecret).update(dataToSign, "utf8").digest("base64");

    if (sigV3 === expected) return { ok: true };
    return { ok: false, reason: "invalid_hmac_v3" };
  }

  // ── Workflow path: shared secret header ──────────────────────────────
  const sharedSecret = process.env.HUBSPOT_WEBHOOK_SECRET;
  if (sharedSecret) {
    const received = req.headers.get("x-hubspot-webhook-secret");
    if (received === sharedSecret) return { ok: true };
    return { ok: false, reason: "invalid_shared_secret" };
  }

  console.warn("[hubspot-claap-note] no signature method configured — accepting unsigned");
  return { ok: true };
}

function extractNoteIds(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return (payload as SubscriptionEvent[])
      .filter((e) => {
        if (!e || typeof e !== "object" || e.objectId == null) return false;
        const subType = (e.subscriptionType ?? "").toLowerCase();
        const isCreation = subType.includes("creation") || e.changeFlag === "CREATED";
        const isNote =
          !e.objectTypeId ||
          e.objectTypeId === NOTE_OBJECT_TYPE_ID ||
          subType.startsWith("note");
        return isCreation && isNote;
      })
      .map((e) => String(e.objectId));
  }
  if (payload && typeof payload === "object") {
    const p = payload as WorkflowPayload;
    const candidates = [p.noteId, p.objectId, p.hs_object_id, p.note?.id];
    for (const c of candidates) {
      if (c !== undefined && c !== null && String(c).trim() !== "") return [String(c)];
    }
  }
  return [];
}

async function slackPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack ${path} → ${data.error}`);
  return data;
}

async function findSlackUserDmChannel(displayName: string): Promise<string> {
  const listRes = await fetch(`https://slack.com/api/users.list?limit=200`, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  const listData = await listRes.json();
  if (!listData.ok) throw new Error(`Slack users.list → ${listData.error}`);

  const needle = displayName.toLowerCase();
  const member = (listData.members ?? []).find((m: SlackUser) => {
    if (m.deleted || m.is_bot) return false;
    const realName = (m.profile?.real_name ?? "").toLowerCase();
    const dn = (m.profile?.display_name ?? "").toLowerCase();
    return realName.includes(needle) || dn.includes(needle);
  });
  if (!member) throw new Error(`Slack user "${displayName}" not found`);

  const dm = await slackPost("/conversations.open", { users: member.id });
  return (dm as { channel: { id: string } }).channel.id;
}

function getFirstAssociationId(
  results: Array<{ id?: string; toObjectId?: string }> | undefined,
): string | null {
  if (!results || results.length === 0) return null;
  const r = results[0];
  return r.toObjectId ? String(r.toObjectId) : r.id ? String(r.id) : null;
}

async function fetchCompanyName(companyId: string): Promise<string | null> {
  try {
    const res = await hubspotFetch<{ properties?: { name?: string } }>(
      `/crm/v3/objects/companies/${companyId}?properties=name`,
    );
    return res.properties?.name ?? null;
  } catch (e) {
    console.warn("[hubspot-claap-note] fetchCompanyName failed:", e);
    return null;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function buildBlocks(args: {
  parsed: ParsedClaapNote;
  dealName: string;
  ownerName: string | null;
  companyName: string | null;
  testPrefix: boolean;
}): Array<Record<string, unknown>> {
  const { parsed, dealName, ownerName, companyName, testPrefix } = args;
  const dateStr = parsed.meetingDate ?? "—";
  const headerText = `${testPrefix ? "[TEST] " : ""}Rencontre ${dealName} — ${dateStr}`;

  const contextParts: string[] = [];
  if (ownerName) contextParts.push(`👤 ${ownerName}`);
  if (companyName) contextParts.push(`🏢 ${companyName}`);
  if (parsed.claapUrl) contextParts.push(`<${parsed.claapUrl}|Voir le meeting Claap>`);

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: truncate(headerText, 150), emoji: true },
    },
  ];
  if (contextParts.length > 0) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: contextParts.join("  •  ") }],
    });
  }
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*💡 Key takeaways*\n${parsed.keyTakeaways ? truncate(parsed.keyTakeaways, SECTION_MAX_LEN) : "_Aucun élément_"}`,
    },
  });
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*✅ Action items*\n${parsed.actionItems ? truncate(parsed.actionItems, SECTION_MAX_LEN) : "_Aucune action_"}`,
    },
  });
  return blocks;
}

async function processNote(noteId: string): Promise<ProcessResult> {
  let note: HubspotNoteResponse;
  try {
    note = await hubspotFetch<HubspotNoteResponse>(
      `/crm/v3/objects/notes/${encodeURIComponent(noteId)}?properties=hs_note_body,hs_timestamp&associations=deals,companies,contacts`,
    );
  } catch (e) {
    console.error(`[hubspot-claap-note] note fetch failed (noteId=${noteId}):`, e);
    return { ok: false, status: "error", reason: "note_fetch_failed" };
  }

  const noteBody = note.properties?.hs_note_body ?? "";
  if (!isClaapNote(noteBody)) {
    console.log(`[hubspot-claap-note] ignored: not_a_claap_note (noteId=${noteId})`);
    return {
      ok: true,
      status: "ignored",
      reason: "not_a_claap_note",
      dealId: null,
      mode: "n/a",
      destination: null,
    };
  }

  const parsed = parseClaapNote(noteBody);
  if (!parsed.keyTakeaways) {
    console.warn(`[hubspot-claap-note] section missing: keyTakeaways (noteId=${noteId})`);
  }
  if (!parsed.actionItems) {
    console.warn(`[hubspot-claap-note] section missing: actionItems (noteId=${noteId})`);
  }

  const dealId = getFirstAssociationId(note.associations?.deals?.results);
  let dealSnap: DealSnapshot | null = null;
  if (dealId) {
    try {
      dealSnap = await fetchDealContext(dealId);
    } catch (e) {
      console.warn("[hubspot-claap-note] fetchDealContext failed:", e);
    }
  }

  const dealName = dealSnap?.name?.trim() || parsed.title || "Meeting Claap";
  const ownerName = dealSnap?.owner_name ?? null;
  const isClosedWon = dealSnap?.is_closed_won === true;

  let companyName: string | null = null;
  const companyId = getFirstAssociationId(note.associations?.companies?.results);
  if (companyId) {
    companyName = await fetchCompanyName(companyId);
  }
  if (!companyName) {
    const externalContact = (dealSnap?.contacts ?? []).find((c) => {
      const domain = c.email?.split("@")[1]?.toLowerCase();
      return domain && domain !== "coachello.io";
    });
    if (externalContact?.email) companyName = companyFromEmail(externalContact.email);
  }

  const mode = process.env.CLAAP_NOTE_SLACK_MODE === "channels" ? "channels" : "dm";
  let channelId: string;
  let destination: string;

  if (mode === "channels") {
    const channelName = isClosedWon ? "12-everything-clients" : "11-everything-prospects";
    const id = await findChannelId(channelName);
    if (!id) {
      console.error(`[hubspot-claap-note] channel not found: ${channelName}`);
      return { ok: false, status: "error", reason: `channel_not_found:${channelName}` };
    }
    channelId = id;
    destination = `#${channelName}`;
  } else {
    const targetUser = process.env.CLAAP_NOTE_SLACK_TEST_USER || "Arthur Czernichow";
    try {
      channelId = await findSlackUserDmChannel(targetUser);
      destination = `dm:${targetUser}`;
    } catch (e) {
      console.error("[hubspot-claap-note] DM resolution failed:", e);
      return { ok: false, status: "error", reason: "dm_resolution_failed" };
    }
  }

  const blocks = buildBlocks({ parsed, dealName, ownerName, companyName, testPrefix: mode === "dm" });
  const fallbackText = `${mode === "dm" ? "[TEST CLAAP→SLACK] " : ""}Rencontre ${dealName} (${parsed.meetingDate ?? "—"}) — résumé Claap`;

  try {
    await slackPost("/chat.postMessage", {
      channel: channelId,
      text: fallbackText,
      blocks,
      unfurl_links: false,
    });
  } catch (e) {
    console.error("[hubspot-claap-note] slack post failed:", e);
    return { ok: false, status: "error", reason: "slack_post_failed" };
  }

  console.log("[hubspot-claap-note]", {
    noteId,
    dealId,
    mode,
    destination,
    takeawaysLen: parsed.keyTakeaways.length,
    actionsLen: parsed.actionItems.length,
  });

  return { ok: true, status: "posted", dealId, mode, destination };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const sig = verifySignature(req, rawBody);
    if (!sig.ok) {
      console.warn("[hubspot-claap-note] signature rejected:", sig.reason);
      return NextResponse.json({ error: "Invalid signature", reason: sig.reason }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const noteIds = extractNoteIds(payload);
    if (noteIds.length === 0) {
      console.warn("[hubspot-claap-note] no note ids in payload");
      return NextResponse.json({ ok: true, processed: 0, results: [] });
    }

    const settled = await Promise.allSettled(noteIds.map(processNote));
    const results = settled.map((s, i) => ({
      noteId: noteIds[i],
      ...(s.status === "fulfilled" ? s.value : { ok: false, status: "error", reason: String(s.reason) }),
    }));

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e) {
    console.error("[hubspot-claap-note] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
