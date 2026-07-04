import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { NotifControls } from "@/components/admin/notif-controls";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();

  const db = createServerClient();
  const { data } = user
    ? await db
        .from("notification_preference")
        .select("in_app_enabled, push_enabled, marketing_opt_in")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const pref = data as {
    in_app_enabled: boolean | null;
    push_enabled: boolean | null;
    marketing_opt_in: boolean | null;
  } | null;

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose how Borteh keeps you in the loop.</p>
      </div>

      {user ? (
        <NotifControls
          userId={user.id}
          inApp={pref?.in_app_enabled ?? true}
          push={pref?.push_enabled ?? false}
          marketing={pref?.marketing_opt_in ?? false}
        />
      ) : (
        <p className="mx-auto max-w-3xl px-6 py-10 text-center text-sm text-muted-foreground lg:px-10">Not signed in.</p>
      )}
    </>
  );
}
