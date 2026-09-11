import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Chip, type Tone } from "@/components/admin/chip";
import { EmptyState } from "@/components/admin/empty-state";

export const dynamic = "force-dynamic";

type Staff = {
  id: string;
  name: string;
  contact: string;
  role: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function roleTone(role: string): Tone {
  return role === "owner" ? "info" : "neutral";
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export default async function StaffPage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("app_user")
    .select("id, display_name, phone, email, role, created_at")
    .in("role", ["owner", "staff"])
    .order("created_at", { ascending: true });
  if (error) throw error;

  const staff: Staff[] = ((data ?? []) as {
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
  }));

  return (
    <>
      <PageHeader title="Staff & roles" description="Owner and counter staff who can sign in." />

      <div className="px-5 pb-6 pt-2">
        <Link
          href="/settings"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>

        <Card className="mt-4 overflow-hidden p-0">
          {staff.length === 0 ? (
            <EmptyState title="No staff accounts yet." />
          ) : (
            <ul className="divide-y divide-border">
              {staff.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {initials(s.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{s.name}</p>
                      <p className="nums truncate text-xs text-muted-foreground">{s.contact}</p>
                    </div>
                  </div>
                  <Chip tone={roleTone(s.role)}>{capitalize(s.role)}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="mt-4 text-[13px] text-muted-foreground">Adding staff accounts from here is coming soon.</p>
      </div>
    </>
  );
}
