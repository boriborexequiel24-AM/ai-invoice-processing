import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** Read-only client with the public key. Row level security limits what it can see. */
export function publicClient() {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey(), options);
}

/**
 * Server-only client with full access. Used for signed PDF links and rate limits.
 * Never import this from a client component.
 */
export function adminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), options);
}
