# Web-admin staff auth gate — decision & implementation

_Status: implemented (Phase 0 of the Mobile CMS track). Path taken: **build it**, not propose._

## Why this had to land before any CMS editor

The admin performs all writes with the Supabase **service secret** via `createAdminClient()`,
which **bypasses RLS**. A CMS massively widens that write surface (every screen's copy, images,
curated lists). So the write path must be gated on an authenticated staff/owner user, independent
of RLS.

## What already existed (parallel-session work, kept — not rebuilt)

- `web/src/app/login/page.tsx` — email + password sign-in; rejects non-`owner`/`staff`.
- `web/src/lib/supabase/auth-server.ts` / `auth-browser.ts` — cookie-backed SSR/browser auth clients.
- `web/src/proxy.ts` — Next 16 **proxy** (renamed from middleware) that redirects any non-staff
  request to `/login` and keeps signed-in staff out of `/login`. Its matcher covers all dashboard
  routes **and** the POST paths that Server Actions use, so it is the first line of defence.

## What this run added (defence-in-depth)

Next.js guidance is explicit: *treat every Server Action as a public endpoint and authorize inside
it* — a matcher change can silently drop proxy coverage. So:

1. **`getStaffUser()` / `requireStaff()`** in `web/src/lib/supabase/auth-server.ts`.
   - `getStaffUser()` returns the signed-in user only if staff, checking **either** the JWT
     `app_metadata.role` claim (what the proxy uses) **or** the canonical DB role via the
     `is_staff()` RPC (SECURITY DEFINER over `app_user.role` — the same predicate that gates table
     RLS). Accepting either signal means it can **never reject a user the proxy already admits**,
     while also enforcing the DB source of truth.
   - `requireStaff()` throws if not staff — one line at the top of an action, type-safe regardless
     of the action's return shape.
2. **Dashboard layout** (`web/src/app/(dashboard)/layout.tsx`) now `redirect("/login")` when the
   session isn't staff — belt-and-suspenders for the initial server render.
3. **Every Server Action is gated.** All 16 `actions.ts` files (14 pre-existing +
   `content/onboarding` + `content/copy`) call `requireStaff()`/`getStaffUser()` before mutating.
   Verified: funcs == guards in each file.

## The one owner operational prerequisite

The gate authorizes against **staff/owner** identity. For the owner to get in:

- The owner's **auth account** (email + password, e.g. `borteh@borteh.app`) must exist, and its
  matching `public.app_user.role` must be `owner` (or `staff`). The Settings → Staff page already
  lists owner/staff from `app_user.role`, so if the owner appears there, `is_staff()` will pass.
- Optionally, set the JWT claim `app_metadata.role = 'owner'` on that auth user (via the Supabase
  dashboard or `auth.admin.updateUserById`). The proxy's optimistic redirect reads this claim; the
  `is_staff()` fallback covers the case where it isn't set, but setting it makes the proxy redirect
  correct on the very first request too. There is **no** `custom_access_token` hook wired
  (`supabase/config.toml` has it commented out), so this claim is not auto-populated.

No code change is required from the owner — this is a one-time account/claim setup.

## Not done (future hardening, out of scope for this run)

- A staff-management UI to create/promote accounts (Settings → Staff is read-only today).
- Moving the proxy's role check onto the DB role via a `custom_access_token` hook so JWT and DB
  role are always in lock-step.
