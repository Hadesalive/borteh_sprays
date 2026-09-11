import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { getStaffUser } from "@/lib/supabase/auth-server";
import { StaffManager, type StaffMember } from "@/components/admin/staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const me = await getStaffUser();
  const db = createServerClient();
  const { data, error } = await db
    .from("app_user")
    .select("id, display_name, phone, email, role, created_at")
    .in("role", ["owner", "staff"])
    .order("created_at", { ascending: true });
  if (error) throw error;

  const staff: StaffMember[] = ((data ?? []) as {
    id: string;
    display_name: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
    created_at: string | null;
  }[]).map((u) => ({
    id: u.id,
    name: u.display_name?.trim() || "Unnamed",
    contact: u.phone || u.email || "—",
    role: u.role || "staff",
    isMe: u.id === me?.id,
  }));

  // Read my role from app_user, not the session: getStaffUser falls back to
  // "staff" whenever the JWT claim is missing, which would hide the controls
  // from a real owner.
  const iAmOwner = staff.some((s) => s.isMe && s.role === "owner");

  return (
    <>
      <PageHeader title="Staff & roles" description="Everyone who can sign in to this admin, and what they're allowed to do." />

      <div className="px-5 pb-6 pt-2">
        <Link
          href="/settings"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>

        <div className="mt-4">
          <StaffManager staff={staff} canManage={iAmOwner} />
        </div>
      </div>
    </>
  );
}
