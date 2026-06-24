import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { draftProspectionEmail, type DraftRecipient } from "@/lib/watchlist/draft-email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export interface DraftEmailResponse {
  subject: string;
  body: string;
  error?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    instructions?: string;
    recipients?: DraftRecipient[];
    personalized?: boolean;
  };

  const result = await draftProspectionEmail({
    scopeCompanyId: id,
    userId: user.id,
    userEmail: user.email,
    instructions: body.instructions,
    recipients: Array.isArray(body.recipients) ? body.recipients : [],
    personalized: body.personalized === true,
  });

  if (result.error) {
    const status = result.error === "Account not found" ? 404 : 500;
    return NextResponse.json({ subject: "", body: "", error: result.error }, { status });
  }
  return NextResponse.json({ subject: result.subject, body: result.body });
}
