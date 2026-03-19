import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — client is only created on first DB call, not at module load
// This prevents build failures when SUPABASE_URL is not set (e.g. Netlify build)
let _client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    _client = createClient(url, key);
  }
  return _client;
}

// Proxy so callers use `db.from(...)` as before — no API change needed
export const db: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof value === "function" ? (value as any).bind(client) : value;
  },
});
