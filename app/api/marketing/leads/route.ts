import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { LeadValidationStatus } from "@/lib/marketing-types";

export const dynamic = "force-dynamic";

const LEADS_SINCE = "2025-01-01T00:00:00Z";
const VALID_STATUSES: LeadValidationStatus[] = ["pending", "validated", "rejected"];
type StatusFilter = LeadValidationStatus | "all";

function isValidStatus(s: string): s is LeadValidationStatus {
  return (VALID_STATUSES as string[]).includes(s);
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const statusParam = req.nextUrl.searchParams.get("status") ?? "pending";
  const status: StatusFilter =
    statusParam === "all" || isValidStatus(statusParam) ? (statusParam as StatusFilter) : "pending";

  let query = db
    .from("leads")
    .select("id, slack_ts, slack_permalink, author_name, text, files, posted_at, validation_status, validated_by, validated_at")
    .gte("posted_at", LEADS_SINCE)
    .order("posted_at", { ascending: false });

  if (status !== "all") query = query.eq("validation_status", status);

  const [listRes, pendingRes, validatedRes, rejectedRes] = await Promise.all([
    query,
    db.from("leads").select("id", { count: "exact", head: true }).eq("validation_status", "pending").gte("posted_at", LEADS_SINCE),
    db.from("leads").select("id", { count: "exact", head: true }).eq("validation_status", "validated").gte("posted_at", LEADS_SINCE),
    db.from("leads").select("id", { count: "exact", head: true }).eq("validation_status", "rejected").gte("posted_at", LEADS_SINCE),
  ]);

  if (listRes.error) {
    return NextResponse.json({ error: listRes.error.message, leads: [], counts: { pending: 0, validated: 0, rejected: 0 } }, { status: 500 });
  }

  return NextResponse.json({
    leads: listRes.data ?? [],
    counts: {
      pending: pendingRes.count ?? 0,
      validated: validatedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, status } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!status || !["validated", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "status must be validated, rejected or pending" }, { status: 400 });
  }

  const isTerminal = status === "validated" || status === "rejected";
  const { data, error } = await db
    .from("leads")
    .update({
      validation_status: status,
      validated_by: isTerminal ? user.id : null,
      validated_at: isTerminal ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id, validation_status, validated_by, validated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}
