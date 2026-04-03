import { NextResponse } from "next/server";
import { DEFAULT_BOT_GUIDE } from "@/lib/guides/bot";

export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(DEFAULT_BOT_GUIDE, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
