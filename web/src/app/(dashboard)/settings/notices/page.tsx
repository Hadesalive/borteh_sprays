import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { NoticeComposer } from "@/components/admin/notice-composer";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const db = createServerClient();
  const [allRes, mktRes] = await Promise.all([
    db.from("app_user").select("id", { count: "exact", head: true }).eq("role", "customer").eq("is_blocked", false),
    db.from("notification_preference").select("user_id", { count: "exact", head: true }).eq("marketing_opt_in", true),
  ]);

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Public notices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Broadcast to every customer&apos;s inbox — holiday hours, delivery changes, or a promotion.
        </p>
      </div>

      <NoticeComposer allCount={allRes.count ?? 0} marketingCount={mktRes.count ?? 0} />
    </>
  );
}
