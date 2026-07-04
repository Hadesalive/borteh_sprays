import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client for auth (sign in / sign out), cookie-backed session. */
export function createAuthBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
