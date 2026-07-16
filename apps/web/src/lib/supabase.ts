/**
 * Supabase browser client. Guests never touch tables directly (RLS denies anon,
 * §4.2) — they go through the edge functions. This client exists for future
 * authenticated marketing/self-serve flows and realtime on the guest page.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasBackend } from './env';

let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!hasBackend) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}
