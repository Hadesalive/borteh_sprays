import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";
import { NotifControls } from "@/components/admin/notif-controls";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();

  const db = createServerClient();
  const { data, error } = user
    ? await db
        .from("notification_preference")
        .select("in_app_enabled, push_enabled, marketing_opt_in")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null, error: null };
  if (error) throw error;

  const pref = data as {
    in_app_enabled: boolean | null;
    push_enabled: boolean | null;
    marketing_opt_in: boolean | null;
  } | null;

  return (
    <>
      <PageHeader title="Notifications" description="Choose how Borteh keeps you in the loop." />

      <div className="px-5 pb-6 pt-2">
        <Link
          href="/settings"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>

        <Card className="mt-4 overflow-hidden p-0">
          {user ? (
            <NotifControls
              userId={user.id}
              inApp={pref?.in_app_enabled ?? true}
              push={pref?.push_enabled ?? false}
              marketing={pref?.marketing_opt_in ?? false}
            />
          ) : (
            <EmptyState title="Not signed in." />
          )}
        </Card>
      </div>
    </>
  );
}
