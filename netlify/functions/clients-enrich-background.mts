import { runClientEnrichment } from "../../lib/clients/run-enrichment";

export default async (req: Request) => {
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret || req.headers.get("x-internal-secret") !== internalSecret) {
    console.error("[clients-enrich-bg] unauthorized");
    return;
  }

  let id: string | undefined;
  try {
    const body = (await req.json()) as { id?: string };
    id = body.id;
  } catch {
    console.error("[clients-enrich-bg] invalid JSON body");
    return;
  }

  if (!id) {
    console.error("[clients-enrich-bg] missing id");
    return;
  }

  const result = await runClientEnrichment(id);
  if (!result.ok) {
    console.error(`[clients-enrich-bg] ${id} failed:`, result.error);
  } else if (result.alreadyDone) {
    console.log(`[clients-enrich-bg] ${id} already done/running, skipped`);
  } else {
    console.log(`[clients-enrich-bg] ${id} done`);
  }
};
