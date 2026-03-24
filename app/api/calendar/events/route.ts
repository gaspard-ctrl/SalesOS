import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getCalendarEvents } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10);

    const events = await getCalendarEvents(user.id, days);
    return NextResponse.json({ events, calendarConnected: true });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "scope_missing" || err.message === "calendar_scope_missing") {
      return NextResponse.json({ events: [], calendarConnected: false, reason: "scope_missing" });
    }
    if (err.message?.includes("Gmail non connecté")) {
      return NextResponse.json({ events: [], calendarConnected: false, reason: "not_connected" });
    }
    console.error("calendar/events error:", e);
    return NextResponse.json({ events: [], calendarConnected: false, reason: "error" });
  }
}
