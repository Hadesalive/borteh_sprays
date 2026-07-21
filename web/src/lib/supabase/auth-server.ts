import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server Supabase client bound to the request cookies — reads the current staff session. */
export async function createAuthServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — the proxy refreshes the session cookie instead.
          }
        },
      },
    }
  );
}

export type StaffUser = { id: string; role: string };

/**
 * The current signed-in user IF they are staff/owner, else null.
 *
 * The proxy (route gate) checks the JWT `app_metadata.role` claim; this is the canonical,
 * defence-in-depth check used inside Server Actions and pages — treat every Server Action as a
 * public endpoint (Next.js data-security guidance) since admin writes use the service key and
 * bypass RLS. We accept EITHER the JWT claim OR the DB role via the `is_staff()` RPC
 * (SECURITY DEFINER on `app_user.role` — the same predicate that gates table RLS), so this can
 * never reject a user the proxy already lets through, while also enforcing the DB source of truth.
 */
export async function getStaffUser(): Promise<StaffUser | null> {
  const auth = await createAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return null;

  const metaRole = user.app_metadata?.role as string | undefined;
  if (metaRole === "owner" || metaRole === "staff") return { id: user.id, role: metaRole };

  try {
    const { data: staff } = await auth.rpc("is_staff");
    if (staff === true) return { id: user.id, role: "staff" };
  } catch {
    // RPC unavailable (e.g. migration not yet applied) — fall through to "not staff".
  }
  return null;
}

/**
 * Guard for Server Actions: returns the staff user or throws. One `await requireStaff()` at the
 * top of an action makes it safe regardless of its return type. The thrown error surfaces to the
 * caller's transition as a failed action; the proxy already redirects unauthenticated navigations.
 */
export async function requireStaff(): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) throw new Error("Not authorized — staff sign-in required.");
  return user;
}
