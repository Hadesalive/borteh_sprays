import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY;

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/**
 * Read client for admin pages (server-side only). Uses the secret key when set
 * so admins also see hidden/inactive rows; otherwise the anon key (which RLS
 * limits to active rows). Either way reads work.
 */
export function createServerClient() {
  return createClient(url, secret || anon, opts);
}

/**
 * Privileged client for writes — bypasses RLS. Server-only (Server Actions).
 * Throws a clear error until SUPABASE_SECRET_KEY is set in web/.env.local.
 */
export function createAdminClient() {
  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set — admin writes are disabled. Add it to web/.env.local (Supabase → Settings → API keys → secret key)."
    );
  }
  return createClient(url, secret, opts);
}
