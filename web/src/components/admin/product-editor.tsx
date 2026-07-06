"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CheckCircle, Plus, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/admin/toggle";
import { saveProduct, type ProductPayload, type NoteInput } from "@/app/(dashboard)/products/actions";

export type EditorInitial = {
  id: string;
  name: string;
  brand_id: string;
  category_id: string | null;
  gender: string;
  description: string;
  scent_family: string;
  main_accords: string[];
  release_year: number | null;
  is_active: boolean;
  is_featured: boolean;
  notes: { name: string; position: "top" | "heart" | "base" }[];
  variants: {
    id: string;
    size_ml: number;
    concentration: string;
    sku: string;
    barcode: string | null;
    price_minor: number;
    compare_at_price_minor: number | null;
    is_active: boolean;
  }[];
};

type Ref = { id: string; name: string };

const CONCENTRATIONS = ["EDC", "EDT", "EDP", "Parfum", "Extrait"];
const GENDERS = ["unisex", "male", "female"];

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";
const numInput = cn(inputClass, "nums");

const splitList = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
const toMinor = (major: string) => Math.round(parseFloat(major) * 100);
const toMajor = (minor: number | null) => (minor == null ? "" : (minor / 100).toString());
const notesFor = (notes: EditorInitial["notes"], pos: string) =>
  notes.filter((n) => n.position === pos).map((n) => n.name).join(", ");

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-4 first:border-t-0">
      <h2 className="mb-3 text-[13px] font-[650] tracking-[-0.1px]">{title}</h2>
      {children}
    </section>
  );
}

type VariantState = EditorInitial["variants"][number] & { _key: string; priceText: string; compareText: string };

export function ProductEditor({ initial, brands, categories }: { initial: EditorInitial; brands: Ref[]; categories: Ref[] }) {
  const router = useRouter();
  const creating = !initial.id;
  const keyer = useRef(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(initial.name);
  const [brandId, setBrandId] = useState(initial.brand_id);
  const [categoryId, setCategoryId] = useState(initial.category_id ?? "");
  const [gender, setGender] = useState(initial.gender);
  const [description, setDescription] = useState(initial.description);
  const [scentFamily, setScentFamily] = useState(initial.scent_family);
  const [accordsText, setAccordsText] = useState(initial.main_accords.join(", "));
  const [releaseYear, setReleaseYear] = useState(initial.release_year?.toString() ?? "");
  const [isActive, setIsActive] = useState(initial.is_active);
  const [isFeatured, setIsFeatured] = useState(initial.is_featured);

  const [top, setTop] = useState(notesFor(initial.notes, "top"));
  const [heart, setHeart] = useState(notesFor(initial.notes, "heart"));
  const [base, setBase] = useState(notesFor(initial.notes, "base"));

  const [variants, setVariants] = useState<VariantState[]>(
    initial.variants.map((v) => ({ ...v, _key: v.id, priceText: toMajor(v.price_minor), compareText: toMajor(v.compare_at_price_minor) }))
  );

  const dirty = () => { if (saved) setSaved(false); };
  function patchVariant(key: string, patch: Partial<VariantState>) {
    dirty();
    setVariants((vs) => vs.map((v) => (v._key === key ? { ...v, ...patch } : v)));
  }
  function addVariant() {
    dirty();
    setVariants((vs) => [
      ...vs,
      { _key: `new-${keyer.current++}`, id: "", size_ml: 50, concentration: "EDP", sku: "", barcode: null, price_minor: 0, compare_at_price_minor: null, is_active: true, priceText: "", compareText: "" },
    ]);
  }
  function removeVariant(key: string) {
    dirty();
    setVariants((vs) => vs.filter((v) => v._key !== key));
  }

  function save() {
    setError(null);
    if (!scentFamily.trim()) {
      setError("Scent family is required — it's the gate that lets this product into recommendations.");
      return;
    }
    const notes: NoteInput[] = [
      ...splitList(top).map((n) => ({ name: n, position: "top" as const })),
      ...splitList(heart).map((n) => ({ name: n, position: "heart" as const })),
      ...splitList(base).map((n) => ({ name: n, position: "base" as const })),
    ];
    for (const v of variants) {
      if (v.priceText.trim() && !Number.isFinite(toMinor(v.priceText))) { setError(`Enter a valid price for SKU ${v.sku || "—"}.`); return; }
    }
    const payload: ProductPayload = {
      id: initial.id,
      name: name.trim(),
      brand_id: brandId,
      category_id: categoryId || null,
      gender,
      description: description.trim() || null,
      scent_family: scentFamily.trim(),
      main_accords: splitList(accordsText),
      release_year: releaseYear.trim() ? parseInt(releaseYear, 10) : null,
      is_active: isActive,
      is_featured: isFeatured,
      notes,
      variants: variants.map((v) => ({
        id: v.id,
        size_ml: Number(v.size_ml),
        concentration: v.concentration,
        sku: v.sku.trim(),
        barcode: v.barcode?.trim() || null,
        price_minor: toMinor(v.priceText || "0"),
        compare_at_price_minor: v.compareText.trim() ? toMinor(v.compareText) : null,
        is_active: v.is_active,
      })),
    };
    start(async () => {
      const res = await saveProduct(payload);
      if (!res.ok) { setError(res.error); return; }
      if (creating) router.push(`/products/${res.id}`); // land on the new product to add images/stock
      else { setSaved(true); router.refresh(); }
    });
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
      <Section title="Scent profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); dirty(); }} placeholder="e.g. Midnight Oud" />
          </Field>
          <Field label="Brand" required>
            <select className={inputClass} value={brandId} onChange={(e) => { setBrandId(e.target.value); dirty(); }}>
              <option value="" disabled>Select a brand…</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select className={inputClass} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); dirty(); }}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Gender">
            <select className={inputClass} value={gender} onChange={(e) => { setGender(e.target.value); dirty(); }}>
              {GENDERS.map((g) => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Scent family" required hint="e.g. Woody Spicy — feeds recs">
            <input
              className={cn(inputClass, !scentFamily.trim() && "border-warning")}
              value={scentFamily}
              onChange={(e) => { setScentFamily(e.target.value); dirty(); }}
              placeholder="Oriental, Woody, Fresh…"
            />
          </Field>
          <Field label="Release year">
            <input className={numInput} inputMode="numeric" value={releaseYear} onChange={(e) => { setReleaseYear(e.target.value); dirty(); }} placeholder="2021" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Main accords" hint="comma-separated, strongest first — feeds recs">
              <input className={inputClass} value={accordsText} onChange={(e) => { setAccordsText(e.target.value); dirty(); }} placeholder="amber, vanilla, oud" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" hint="feeds recs">
              <textarea rows={3} className={cn(inputClass, "h-auto resize-y py-2")} value={description} onChange={(e) => { setDescription(e.target.value); dirty(); }} placeholder="The story a customer reads on the product page." />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Notes">
        <p className="mb-3 text-xs text-muted-foreground">Comma-separated note names. New names are added to the catalog automatically.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Top"><input className={inputClass} value={top} onChange={(e) => { setTop(e.target.value); dirty(); }} placeholder="Bergamot, Lemon" /></Field>
          <Field label="Heart"><input className={inputClass} value={heart} onChange={(e) => { setHeart(e.target.value); dirty(); }} placeholder="Rose, Jasmine" /></Field>
          <Field label="Base"><input className={inputClass} value={base} onChange={(e) => { setBase(e.target.value); dirty(); }} placeholder="Musk, Amber" /></Field>
        </div>
      </Section>

      <Section title="Variants">
        {variants.length === 0 ? (
          <p className="mb-3 text-[13px] text-muted-foreground">No variants yet. Add at least one size to sell this scent.</p>
        ) : (
          <div className="space-y-3">
            {variants.map((v) => (
              <div key={v._key} className="relative rounded-md border border-border p-3">
                {!v.id ? (
                  <button
                    type="button"
                    onClick={() => removeVariant(v._key)}
                    aria-label="Remove variant"
                    className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="SKU"><input className={inputClass} value={v.sku} onChange={(e) => patchVariant(v._key, { sku: e.target.value })} /></Field>
                  <Field label="Size (ml)"><input className={numInput} inputMode="numeric" value={v.size_ml} onChange={(e) => patchVariant(v._key, { size_ml: Number(e.target.value) })} /></Field>
                  <Field label="Concentration">
                    <select className={inputClass} value={v.concentration} onChange={(e) => patchVariant(v._key, { concentration: e.target.value })}>
                      {CONCENTRATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Price (Le)"><input className={numInput} inputMode="decimal" value={v.priceText} onChange={(e) => patchVariant(v._key, { priceText: e.target.value })} placeholder="0.00" /></Field>
                  <Field label="Compare-at (Le)" hint="optional"><input className={numInput} inputMode="decimal" value={v.compareText} onChange={(e) => patchVariant(v._key, { compareText: e.target.value })} placeholder="—" /></Field>
                  <Field label="Barcode" hint="optional"><input className={inputClass} value={v.barcode ?? ""} onChange={(e) => patchVariant(v._key, { barcode: e.target.value })} /></Field>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">{v.id ? "Stock is managed in the Inventory panel →" : "New — bootstraps at 0 stock; receive stock after creating."}</span>
                  <span className="flex items-center gap-2 text-[13px]">
                    <span className="text-muted-foreground">Active</span>
                    <Toggle defaultOn={v.is_active} label={`Variant ${v.sku} active`} onChange={(on) => patchVariant(v._key, { is_active: on })} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addVariant}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <Plus weight="duotone" className="size-4" /> Add variant
        </button>
      </Section>

      <Section title="Visibility">
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <div><p className="text-[13px] font-medium">Active</p><p className="text-xs text-muted-foreground">Show this product and its variants in the app.</p></div>
            <Toggle defaultOn={isActive} label="Active" onChange={(v) => { setIsActive(v); dirty(); }} />
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <div><p className="text-[13px] font-medium">Featured</p><p className="text-xs text-muted-foreground">Eligible for featured placement on the app home.</p></div>
            <Toggle defaultOn={isFeatured} label="Featured" onChange={(v) => { setIsFeatured(v); dirty(); }} />
          </div>
        </div>
      </Section>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
        <div className="min-w-0 text-[13px]">
          {error ? (
            <span className="text-destructive-soft-foreground">{error}</span>
          ) : saved ? (
            <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle weight="duotone" className="size-4" /> Saved — content changes re-embed within a minute.</span>
          ) : creating ? (
            <span className="text-muted-foreground">New products are embedded for recommendations on creation.</span>
          ) : (
            <span className="text-muted-foreground">Saving content re-embeds the product for recommendations.</span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(26,26,26,0.07)] transition-colors hover:bg-[#1a1917] disabled:opacity-60"
        >
          {pending ? (creating ? "Creating…" : "Saving…") : creating ? "Create product" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
