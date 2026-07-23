import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { readAeActivity } from "@/lib/ae-activity/build-snapshot";

export const dynamic = "force-dynamic";

// GET /api/admin/ae-activity — snapshot complet (tous les reps) + meta refresh.
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const data = await readAeActivity();
  return NextResponse.json(data);
}
