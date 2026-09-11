"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Chip, type Tone } from "@/components/admin/chip";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";
import { createStaff, revokeStaff, setStaffRole, type StaffRole } from "@/app/(dashboard)/settings/staff/actions";

export type StaffMember = {
  id: string;
  name: string;
  contact: string;
  role: string;
  isMe: boolean;
};

const input =
  "h-9 w-full border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

const roleTone = (role: string): Tone => (role === "owner" ? "info" : "neutral");
const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function StaffManager({ staff, canManage }: { staff: StaffMember[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "", password: "", role: "staff" as StaffRole });

  const ownerCount = staff.filter((s) => s.role === "owner").length;

  function add() {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await createStaff(draft);
      if (res.ok) {
        setNotice(`${draft.name.trim()} can now sign in with that email and password. Ask them to change it.`);
        setDraft({ name: "", email: "", password: "", role: "staff" });
        setAdding(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function changeRole(member: StaffMember, role: StaffRole) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await setStaffRole(member.id, role);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function revoke(member: StaffMember) {
    if (!confirm(`Remove ${member.name}'s admin access? They keep their account and order history, but can no longer sign in here.`)) return;
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await revokeStaff(member.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="bg-destructive-soft px-3 py-2 text-[13px] text-destructive-soft-foreground">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="bg-success-soft px-3 py-2 text-[13px] text-success-soft-foreground">
          {notice}
        </p>
      ) : null}

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b pt-4">
          <CardTitle role="heading" aria-level={2}>Who can sign in</CardTitle>
          <CardDescription>
            Owners can add staff and change roles. Staff can run the shop but not change who has access.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {staff.length === 0 ? (
            <EmptyState title="No staff accounts yet." description="Add one so someone else can work the counter." />
          ) : (
            <ul className="divide-y divide-accent">
              {staff.map((s) => {
                const lastOwner = s.role === "owner" && ownerCount <= 1;
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {initials(s.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">
                        {s.name}
                        {s.isMe ? <span className="ml-1.5 font-normal text-muted-foreground">(you)</span> : null}
                      </p>
                      <p className="nums truncate text-xs text-muted-foreground">{s.contact}</p>
                    </div>

                    {canManage && !s.isMe && !lastOwner ? (
                      <>
                        <label className="sr-only" htmlFor={`role-${s.id}`}>
                          Role for {s.name}
                        </label>
                        <select
                          id={`role-${s.id}`}
                          value={s.role}
                          disabled={pending}
                          onChange={(e) => changeRole(s, e.target.value as StaffRole)}
                          className={cn(input, "h-8 w-auto text-[13px]")}
                        >
                          <option value="staff">Staff</option>
                          <option value="owner">Owner</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => revoke(s)}
                          disabled={pending}
                          className="inline-flex h-8 items-center px-2.5 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <Chip tone={roleTone(s.role)}>{capitalize(s.role)}</Chip>
                        {lastOwner ? <span className="text-xs text-muted-foreground">Only owner</span> : null}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        adding ? (
          <Card className="p-4">
            <h3 className="text-[13px] font-medium">Add a staff account</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              They sign in here with this email and password. There is no invitation email, so pass the password on
              yourself and ask them to change it.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Fatmata Kamara"
                  autoFocus
                  className={cn(input, "mt-1")}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Email</span>
                <input
                  type="email"
                  autoComplete="off"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="fatmata@borteh.app"
                  className={cn(input, "mt-1")}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Temporary password</span>
                <input
                  type="text"
                  autoComplete="off"
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  placeholder="At least 8 characters"
                  className={cn(input, "mt-1")}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Role</span>
                <select
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value as StaffRole })}
                  className={cn(input, "mt-1")}
                >
                  <option value="staff">Staff — runs the shop</option>
                  <option value="owner">Owner — can also manage staff</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={add}
                disabled={pending}
                className="inline-flex h-8 items-center bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setError(null);
                }}
                disabled={pending}
                className="inline-flex h-8 items-center border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setNotice(null);
            }}
            className="inline-flex h-8 items-center gap-1.5 border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted"
          >
            <Plus weight="duotone" className="size-4" />
            Add staff
          </button>
        )
      ) : (
        <p className="text-[13px] text-muted-foreground">Only an owner can add staff or change roles.</p>
      )}
    </div>
  );
}
