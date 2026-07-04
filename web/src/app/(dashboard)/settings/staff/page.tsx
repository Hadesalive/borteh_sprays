import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { StatusPill, type PillTone } from "@/components/admin/status-pill";

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

function roleTone(role: string): PillTone {
  return role === "owner" ? "info" : "neutral";
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export default async function StaffPage() {
  const db = createServerClient();
  const { data } = await db
    .from("app_user")
    .select("id, display_name, phone, email, role, created_at")
    .in("role", ["owner", "staff"])
    .order("created_at", { ascending: true });

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
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Staff &amp; roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">Owner and counter staff who can sign in.</p>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-2 lg:px-10">
        <ul className="divide-y divide-border">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {initials(s.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="nums truncate text-sm text-muted-foreground">{s.contact}</p>
                </div>
              </div>
              <StatusPill tone={roleTone(s.role)}>{capitalize(s.role)}</StatusPill>
            </li>
          ))}
          {staff.length === 0 ? (
            <li className="py-10 text-center text-sm text-muted-foreground">No staff accounts yet.</li>
          ) : null}
        </ul>

        <p className="mt-2 border-t border-border py-4 text-sm text-muted-foreground">
          Adding staff accounts from here is coming soon.
        </p>
      </div>
    </>
  );
}
