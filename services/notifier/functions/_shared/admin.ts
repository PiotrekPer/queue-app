/**
 * Service-role Supabase client for edge functions (§4.2).
 *
 * Guests have NO direct table access — RLS denies anon. Every guest read/mutate
 * flows through these functions, which look up the visit by `public_token` and
 * then act with `service_role` (bypassing RLS). This client must therefore never
 * be exposed to a browser bundle; it lives only in the Deno function runtime.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** A required environment variable, or a thrown config error at first use. */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`missing_env: ${name}`);
  }
  return value;
}

/** Optional environment variable (undefined when unset). */
export function optionalEnv(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

/**
 * The shared service-role client. Auth persistence is off (stateless functions);
 * realtime is unused server-side.
 */
export function adminClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'x-stoliq-notifier': '1' } },
      },
    );
  }
  return cached;
}
