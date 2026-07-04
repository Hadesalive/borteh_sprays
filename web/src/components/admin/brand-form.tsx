"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, UploadSimple } from "@phosphor-icons/react";

import { createBrand, updateBrand } from "@/app/(dashboard)/brands/actions";
import { Toggle } from "@/components/admin/toggle";

export type BrandValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  active?: boolean;
  featured?: boolean;
};

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

const slugify = (v: string) =>
  v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ToggleRow({ title, description, on, onChange }: { title: string; description: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Toggle defaultOn={on} label={title} onChange={onChange} />
    </div>
  );
}

export function BrandForm({ initial }: { initial?: BrandValues }) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    const input = { name, slug, description: description || null, active, featured };
    start(async () => {
      const res = editing ? await updateBrand(initial!.id!, input) : await createBrand(input);
      if (res.ok) router.push("/brands");
      else setError(res.error);
    });
  }

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/brands" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Brands
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{editing ? initial?.name : "New brand"}</h1>
          <div className="flex items-center gap-2">
            <Link href="/brands" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Create brand"}
            </button>
          </div>
        </div>
      </div>

      <form className="mx-auto max-w-2xl space-y-8 px-6 py-8 lg:px-10" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>
        ) : null}

        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
            <UploadSimple weight="duotone" className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">Logo</p>
            <p className="text-xs text-muted-foreground">Square PNG or SVG. Image upload to Storage is coming with media management.</p>
          </div>
        </div>

        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="e.g. Velvet & Oud"
          />
        </Field>

        <Field label="Slug" hint="used in links — lowercase, no spaces">
          <input
            className={inputClass}
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
            placeholder="velvet-oud"
          />
        </Field>

        <Field label="Description" hint="optional">
          <textarea
            rows={3}
            className={`${inputClass} h-auto resize-y py-2`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short line shown on the brand page."
          />
        </Field>

        <div className="divide-y divide-border border-t border-border">
          <ToggleRow title="Active" description="Show this brand and its products in the app." on={active} onChange={setActive} />
          <ToggleRow title="Feature on app home" description="Include in the home “Shop by brand” rail." on={featured} onChange={setFeatured} />
        </div>
      </form>
    </>
  );
}
