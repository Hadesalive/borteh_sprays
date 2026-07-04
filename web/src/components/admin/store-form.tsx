"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateStore } from "@/app/(dashboard)/settings/store/actions";

export type StoreValues = {
  id: string;
  name: string;
  code: string;
  address: string;
};

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function StoreForm({ initial }: { initial: StoreValues }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateStore(initial.id, { name, address });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      className="mx-auto max-w-2xl space-y-8 px-6 py-8 lg:px-10"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>
      ) : null}

      <Field label="Name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Borteh Freetown"
        />
      </Field>

      <Field label="Address" hint="optional">
        <textarea
          rows={3}
          className={`${inputClass} h-auto resize-y py-2`}
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setSaved(false);
          }}
          placeholder="Street, area, landmark — what a rider needs to find you."
        />
      </Field>

      <Field label="Code" hint="set when the store was created">
        <p className="flex h-9 w-full items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">
          {initial.code || "—"}
        </p>
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved ? <span className="text-sm text-muted-foreground">Saved</span> : null}
      </div>
    </form>
  );
}
