import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { NoticeComposer } from "@/components/admin/notice-composer";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const db = createServerClient();
  const [allRes, mktRes] = await Promise.all([
    db.from("app_user").select("id", { count: "exact", head: true }).eq("role", "customer").eq("is_blocked", false),
    db.from("notification_preference").select("user_id", { count: "exact", head: true }).eq("marketing_opt_in", true),
  ]);
  if (allRes.error) throw allRes.error;
  if (mktRes.error) throw mktRes.error;

  return (
    <>
      <PageHeader title="Public notices" description="Broadcast to every customer's inbox — holiday hours, delivery changes, or a promotion." />

      <div className="px-5 pb-6 pt-2">
        <Link
          href="/settings"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>

        <Card className="mt-4 p-4">
          <NoticeComposer allCount={allRes.count ?? 0} marketingCount={mktRes.count ?? 0} />
        </Card>
      </div>
    </>
  );
}
