import { runAeActivityRefresh } from "../../lib/ae-activity/build-snapshot";

// Background function : recalcule le snapshot AE de tous les reps. Déclenchée
// soit par la route admin "Refresh" (x-internal-secret), soit par le cron
// hebdo ae-activity-refresh-scheduled (Bearer CRON_SECRET).
export default async (req: Request) => {
  const internalSecret = process.env.INTERNAL_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const internalOk = !!internalSecret && req.headers.get("x-internal-secret") === internalSecret;
  const cronOk = !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!internalOk && !cronOk) {
    console.error("[ae-activity-refresh-bg] unauthorized");
    return;
  }

  const result = await runAeActivityRefresh();
  if (!result.ok) {
    console.error("[ae-activity-refresh-bg] failed:", result.error);
  } else {
    console.log(`[ae-activity-refresh-bg] done: ${result.repCount} reps`);
  }
};
