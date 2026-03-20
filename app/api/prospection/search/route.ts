import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function hubspot(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`HubSpot ${method} ${path} → ${res.status}`);
  return res.json();
}

const PROPS = [
  "firstname", "lastname", "email", "jobtitle", "company",
  "industry", "lifecyclestage", "city", "country",
];

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const lifecyclestage = searchParams.get("lifecyclestage")?.trim() ?? "";
  const industry = searchParams.get("industry")?.trim() ?? "";
  const after = searchParams.get("after")?.trim() ?? "";

  // Build filter groups
  const filters: { propertyName: string; operator: string; value: string }[] = [];
  if (lifecyclestage) filters.push({ propertyName: "lifecyclestage", operator: "EQ", value: lifecyclestage });
  if (industry) filters.push({ propertyName: "industry", operator: "EQ", value: industry });

  const body: Record<string, unknown> = {
    limit: 50,
    properties: PROPS,
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  };
  if (q) body.query = q;
  if (filters.length) body.filterGroups = [{ filters }];
  if (after) body.after = after;

  const data = await hubspot("/crm/v3/objects/contacts/search", "POST", body);

  const results = (data.results ?? []).map((c: {
    id: string;
    properties: Record<string, string>;
  }) => ({
    id: c.id,
    firstName: c.properties.firstname ?? "",
    lastName: c.properties.lastname ?? "",
    email: c.properties.email ?? "",
    jobTitle: c.properties.jobtitle ?? "",
    company: c.properties.company ?? "",
    industry: c.properties.industry ?? "",
    lifecyclestage: c.properties.lifecyclestage ?? "",
    city: c.properties.city ?? "",
    country: c.properties.country ?? "",
  }));

  const nextCursor: string | null = (data.paging as { next?: { after?: string } } | undefined)?.next?.after ?? null;
  const total: number | null = data.total ?? null;

  return NextResponse.json({ results, nextCursor, total });
}
