"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { ArrowLeft, UploadSimple } from "@phosphor-icons/react";

import { createCollection, updateCollection } from "@/app/(dashboard)/collections/actions";
import { Toggle } from "@/components/admin/toggle";
import { FormSection } from "@/components/admin/form-section";
import { FormField } from "@/components/admin/form-field";

export type CollectionValues = {
  id?: string;
  name?: string;
  slug?: string;
  active?: boolean;
  featured?: boolean;
};

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function CollectionForm({ initial }: { initial?: CollectionValues }) {
  const router = useRouter();
  const uid = useId();
  const editing = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [nameTouched, setNameTouched] = useState(Boolean(initial?.name));
  const [active, setActive] = useState(initial?.active ?? true);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  function save() {
    setError(null);
    if (!name.trim()) {
      setNameTouched(true);
      nameRef.current?.focus();
      return;
    }
    if (!slug.trim()) {
      setSlugTouched(true);
      slugRef.current?.focus();
      return;
    }
    const input = { name, slug, active, featured };
    start(async () => {
      const res = editing ? await updateCollection(initial!.id!, input) : await createCollection(input);
      if (res.ok) router.push("/collections");
      else setError(res.error);
    });
  }

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/collections" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Collections
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-semibold tracking-tight">{editing ? initial?.name : "New collection"}</h1>
          <div className="flex items-center gap-2">
            <Link href="/collections" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Create collection"}
            </button>
          </div>
        </div>
      </div>

      <form className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-10" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>
        ) : null}

        <FormSection title="Details">
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-foreground">Cover image <span className="font-normal text-muted-foreground">— optional</span></p>
            <p className="mt-0.5 text-xs text-muted-foreground">Shown on the app home card. Upload to Storage is coming with media management.</p>
            <span className="mt-2 grid aspect-[16/9] w-full max-w-sm place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
              <span className="flex flex-col items-center gap-1.5 text-xs">
                <UploadSimple weight="duotone" className="size-5" />
                Upload cover
              </span>
            </span>
          </div>
          <FormField label="Name" htmlFor={`${uid}-name`} error={nameTouched && !name.trim() ? "Name is required." : undefined}>
            <input
              ref={nameRef}
              id={`${uid}-name`}
              className={inputClass}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameTouched(true); if (!slugTouched) setSlug(slugify(e.target.value)); }}
              placeholder="e.g. Date night"
            />
          </FormField>
          <FormField label="Slug" htmlFor={`${uid}-slug`} helper="Used in links — lowercase, no spaces." error={slugTouched && !slug.trim() ? "Slug is required." : undefined}>
            <input
              ref={slugRef}
              id={`${uid}-slug`}
              className={inputClass}
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="date-night"
            />
          </FormField>
        </FormSection>

        <FormSection title="Visibility">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[13px] font-medium">Active</p><p className="text-xs text-muted-foreground">Show this collection in the app.</p></div>
            <Toggle defaultOn={active} label="Active" onChange={setActive} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[13px] font-medium">Feature on app home</p><p className="text-xs text-muted-foreground">Include in the home collections rail.</p></div>
            <Toggle defaultOn={featured} label="Feature on app home" onChange={setFeatured} />
          </div>
        </FormSection>
      </form>
    </>
  );
}
