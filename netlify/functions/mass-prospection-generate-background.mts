import { runCampaignGeneration } from "../../lib/mass-prospection/run-generation";

export default async (req: Request) => {
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret || req.headers.get("x-internal-secret") !== internalSecret) {
    console.error("[mass-prospection-generate-bg] unauthorized");
    return;
  }

  let campaignId: string | undefined;
  let userId: string | undefined;
  let onlyErrors = false;
  try {
    const body = (await req.json()) as { campaignId?: string; userId?: string; onlyErrors?: boolean };
    campaignId = body.campaignId;
    userId = body.userId;
    onlyErrors = body.onlyErrors ?? false;
  } catch {
    console.error("[mass-prospection-generate-bg] invalid JSON body");
    return;
  }

  if (!campaignId || !userId) {
    console.error("[mass-prospection-generate-bg] missing campaignId or userId");
    return;
  }

  try {
    const result = await runCampaignGeneration(campaignId, userId, { onlyErrors });
    console.log(`[mass-prospection-generate-bg] ${campaignId} done:`, JSON.stringify(result));
  } catch (e) {
    console.error(`[mass-prospection-generate-bg] ${campaignId} failed:`, e instanceof Error ? e.message : e);
  }
};
