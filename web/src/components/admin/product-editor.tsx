"use client";

import { useId, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Plus, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/admin/toggle";
import { FormSection } from "@/components/admin/form-section";
import { FormField } from "@/components/admin/form-field";
import { useUnsavedChanges } from "@/components/admin/unsaved-changes-guard";
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
const smallInput = cn(inputClass, "h-8 text-[13px]");

const splitList = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
const toMinor = (major: string) => Math.round(parseFloat(major) * 100);
const toMajor = (minor: number | null) => (minor == null ? "" : (minor / 100).toString());
const notesFor = (notes: EditorInitial["notes"], pos: string) =>
  notes.filter((n) => n.position === pos).map((n) => n.name).join(", ");

type VariantState = EditorInitial["variants"][number] & { _key: string; priceText: string; compareText: string };

/** A compact labeled input for the Variants repeating list. FormField's
 * cloneElement contract expects one field per labeled block with room for
 * a full helper/error line below it — fine for the form above, but each
 * variant here is a whole row of 6 short fields, and FormField's padding
 * would blow up row height 6x per variant. This keeps the same "label
 * always visible above the input" requirement at table-row density. */
function CompactField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

type EditorFields = {
  name: string;
  brandId: string;
  categoryId: string;
  gender: string;
  description: string;
  scentFamily: string;
  accordsText: string;
  releaseYear: string;
  isActive: boolean;
  isFeatured: boolean;
  top: string;
  heart: string;
  base: string;
  variants: VariantState[];
};

/** Normalizes editor state into a string for equality comparison — used
 * to detect whether anything has actually changed since the last save
 * (or since mount), per the spec's dirty-gating requirement. Not the same
 * shape as ProductPayload; this only needs to be internally consistent. */
function snapshot(f: EditorFields): string {
  return JSON.stringify({
    name: f.name.trim(),
    brandId: f.brandId,
    categoryId: f.categoryId || null,
    gender: f.gender,
    description: f.description.trim(),
    scentFamily: f.scentFamily.trim(),
    accords: splitList(f.accordsText),
    releaseYear: f.releaseYear.trim(),
    isActive: f.isActive,
    isFeatured: f.isFeatured,
    top: splitList(f.top),
    heart: splitList(f.heart),
    base: splitList(f.base),
    variants: f.variants.map((v) => ({
      id: v.id,
      size_ml: v.size_ml,
      concentration: v.concentration,
      sku: v.sku.trim(),
      barcode: v.barcode?.trim() || null,
      priceText: v.priceText.trim(),
      compareText: v.compareText.trim(),
      is_active: v.is_active,
    })),
  });
}

export function ProductEditor({ initial, brands, categories }: { initial: EditorInitial; brands: Ref[]; categories: Ref[] }) {
  const router = useRouter();
  const uid = useId();
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
  const [scentFamilyTouched, setScentFamilyTouched] = useState(false);
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
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});

  const scentFamilyRef = useRef<HTMLInputElement>(null);
  const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const liveFields: EditorFields = { name, brandId, categoryId, gender, description, scentFamily, accordsText, releaseYear, isActive, isFeatured, top, heart, base, variants };
  const baselineSnapshot = useRef(snapshot({
    name: initial.name, brandId: initial.brand_id, categoryId: initial.category_id ?? "", gender: initial.gender,
    description: initial.description, scentFamily: initial.scent_family, accordsText: initial.main_accords.join(", "),
    releaseYear: initial.release_year?.toString() ?? "", isActive: initial.is_active, isFeatured: initial.is_featured,
    top: notesFor(initial.notes, "top"), heart: notesFor(initial.notes, "heart"), base: notesFor(initial.notes, "base"),
    variants: initial.variants.map((v) => ({ ...v, _key: v.id, priceText: toMajor(v.price_minor), compareText: toMajor(v.compare_at_price_minor) })),
  }));
  const isDirty = snapshot(liveFields) !== baselineSnapshot.current;

  const { setIsDirty } = useUnsavedChanges();
  useEffect(() => {
    setIsDirty(isDirty);
    return () => setIsDirty(false);
  }, [isDirty, setIsDirty]);
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const clearSavedFlag = () => { if (saved) setSaved(false); };
  function patchVariant(key: string, patch: Partial<VariantState>) {
    clearSavedFlag();
    setVariants((vs) => vs.map((v) => (v._key === key ? { ...v, ...patch } : v)));
    if (patch.priceText !== undefined) setVariantErrors((e) => { const { [key]: _drop, ...rest } = e; return rest; });
  }
  function addVariant() {
    clearSavedFlag();
    setVariants((vs) => [
      ...vs,
      { _key: `new-${keyer.current++}`, id: "", size_ml: 50, concentration: "EDP", sku: "", barcode: null, price_minor: 0, compare_at_price_minor: null, is_active: true, priceText: "", compareText: "" },
    ]);
  }
  function removeVariant(key: string) {
    clearSavedFlag();
    setVariants((vs) => vs.filter((v) => v._key !== key));
  }

  function save() {
    setError(null);
    setVariantErrors({});
    if (!scentFamily.trim()) {
      setError("Scent family is required — it's the gate that lets this product into recommendations.");
      setScentFamilyTouched(true);
      scentFamilyRef.current?.focus();
      return;
    }
    const notes: NoteInput[] = [
      ...splitList(top).map((n) => ({ name: n, position: "top" as const })),
      ...splitList(heart).map((n) => ({ name: n, position: "heart" as const })),
      ...splitList(base).map((n) => ({ name: n, position: "base" as const })),
    ];
    const badVariant = variants.find((v) => v.priceText.trim() && !Number.isFinite(toMinor(v.priceText)));
    if (badVariant) {
      setVariantErrors({ [badVariant._key]: "Enter a valid price." });
      setError(`Enter a valid price for SKU ${badVariant.sku || "—"}.`);
      priceRefs.current[badVariant._key]?.focus();
      return;
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
      if (creating) { router.push(`/products/${res.id}`); return; } // land on the new product to add images/stock
      baselineSnapshot.current = snapshot(liveFields); // this save IS the new baseline — otherwise isDirty flips true again on the next render
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <FormSection title="Details" description="What a customer sees on the product page.">
        <FormField label="Name" htmlFor={`${uid}-name`}>
          <input id={`${uid}-name`} className={inputClass} value={name} onChange={(e) => { setName(e.target.value); clearSavedFlag(); }} placeholder="e.g. Midnight Oud" />
        </FormField>
        <FormField label="Brand" htmlFor={`${uid}-brand`}>
          <select id={`${uid}-brand`} className={inputClass} value={brandId} onChange={(e) => { setBrandId(e.target.value); clearSavedFlag(); }}>
            <option value="" disabled>Select a brand…</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </FormField>
        <FormField label="Category" htmlFor={`${uid}-category`} optional>
          <select id={`${uid}-category`} className={inputClass} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); clearSavedFlag(); }}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Gender" htmlFor={`${uid}-gender`} optional>
          <select id={`${uid}-gender`} className={inputClass} value={gender} onChange={(e) => { setGender(e.target.value); clearSavedFlag(); }}>
            {GENDERS.map((g) => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
          </select>
        </FormField>
        <FormField label="Release year" htmlFor={`${uid}-release-year`} optional>
          <input id={`${uid}-release-year`} className={numInput} inputMode="numeric" value={releaseYear} onChange={(e) => { setReleaseYear(e.target.value); clearSavedFlag(); }} placeholder="2021" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Description" htmlFor={`${uid}-description`} optional helper="Feeds recommendations.">
            <textarea id={`${uid}-description`} rows={3} className={cn(inputClass, "h-auto resize-y py-2")} value={description} onChange={(e) => { setDescription(e.target.value); clearSavedFlag(); }} placeholder="The story a customer reads on the product page." />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Scent profile" description="Drives search filters and the recommendation engine.">
        <FormField
          label="Scent family"
          htmlFor={`${uid}-scent-family`}
          helper="e.g. Woody Spicy"
          error={scentFamilyTouched && !scentFamily.trim() ? "Required for this product to be recommended." : undefined}
        >
          <input
            ref={scentFamilyRef}
            id={`${uid}-scent-family`}
            className={inputClass}
            value={scentFamily}
            onChange={(e) => { setScentFamily(e.target.value); setScentFamilyTouched(true); clearSavedFlag(); }}
            placeholder="Oriental, Woody, Fresh…"
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Main accords" htmlFor={`${uid}-accords`} optional helper="Comma-separated, strongest first.">
            <input id={`${uid}-accords`} className={inputClass} value={accordsText} onChange={(e) => { setAccordsText(e.target.value); clearSavedFlag(); }} placeholder="amber, vanilla, oud" />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <span className="text-xs font-medium text-foreground">Notes <span className="font-normal text-muted-foreground">— comma-separated, new names are added to the catalog automatically</span></span>
          <div className="mt-1.5 grid gap-3 sm:grid-cols-3">
            <CompactField label="Top" htmlFor={`${uid}-note-top`}>
              <input id={`${uid}-note-top`} className={inputClass} value={top} onChange={(e) => { setTop(e.target.value); clearSavedFlag(); }} placeholder="Bergamot, Lemon" />
            </CompactField>
            <CompactField label="Heart" htmlFor={`${uid}-note-heart`}>
              <input id={`${uid}-note-heart`} className={inputClass} value={heart} onChange={(e) => { setHeart(e.target.value); clearSavedFlag(); }} placeholder="Rose, Jasmine" />
            </CompactField>
            <CompactField label="Base" htmlFor={`${uid}-note-base`}>
              <input id={`${uid}-note-base`} className={inputClass} value={base} onChange={(e) => { setBase(e.target.value); clearSavedFlag(); }} placeholder="Musk, Amber" />
            </CompactField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Variants" description="Each variant is a purchasable size/concentration combination.">
        <div className="sm:col-span-2">
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
                    <CompactField label="SKU" htmlFor={`${uid}-variant-${v._key}-sku`}>
                      <input id={`${uid}-variant-${v._key}-sku`} className={smallInput} value={v.sku} onChange={(e) => patchVariant(v._key, { sku: e.target.value })} />
                    </CompactField>
                    <CompactField label="Size (ml)" htmlFor={`${uid}-variant-${v._key}-size`}>
                      <input id={`${uid}-variant-${v._key}-size`} className={cn(smallInput, "nums")} inputMode="numeric" value={v.size_ml} onChange={(e) => patchVariant(v._key, { size_ml: Number(e.target.value) })} />
                    </CompactField>
                    <CompactField label="Concentration" htmlFor={`${uid}-variant-${v._key}-conc`}>
                      <select id={`${uid}-variant-${v._key}-conc`} className={smallInput} value={v.concentration} onChange={(e) => patchVariant(v._key, { concentration: e.target.value })}>
                        {CONCENTRATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </CompactField>
                    <div>
                      <CompactField label="Price (Le)" htmlFor={`${uid}-variant-${v._key}-price`}>
                        <input
                          ref={(el) => { priceRefs.current[v._key] = el; }}
                          id={`${uid}-variant-${v._key}-price`}
                          className={cn(smallInput, "nums", variantErrors[v._key] && "border-destructive")}
                          inputMode="decimal"
                          value={v.priceText}
                          onChange={(e) => patchVariant(v._key, { priceText: e.target.value })}
                          placeholder="0.00"
                          aria-invalid={!!variantErrors[v._key]}
                          aria-describedby={variantErrors[v._key] ? `${uid}-variant-${v._key}-price-error` : undefined}
                        />
                      </CompactField>
                      {variantErrors[v._key] ? (
                        <p id={`${uid}-variant-${v._key}-price-error`} className="mt-1 text-[11px] text-destructive">
                          {variantErrors[v._key]}
                        </p>
                      ) : null}
                    </div>
                    <CompactField label="Compare-at (Le)" htmlFor={`${uid}-variant-${v._key}-compare`}>
                      <input id={`${uid}-variant-${v._key}-compare`} className={cn(smallInput, "nums")} inputMode="decimal" value={v.compareText} onChange={(e) => patchVariant(v._key, { compareText: e.target.value })} placeholder="—" />
                    </CompactField>
                    <CompactField label="Barcode" htmlFor={`${uid}-variant-${v._key}-barcode`}>
                      <input id={`${uid}-variant-${v._key}-barcode`} className={smallInput} value={v.barcode ?? ""} onChange={(e) => patchVariant(v._key, { barcode: e.target.value })} />
                    </CompactField>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">{v.id ? "Stock is managed in the Inventory tab →" : "New — bootstraps at 0 stock; receive stock after creating."}</span>
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
        </div>
      </FormSection>

      <FormSection title="Visibility">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-[13px] font-medium">Active</p><p className="text-xs text-muted-foreground">Show this product and its variants in the app.</p></div>
          <Toggle defaultOn={isActive} label="Active" onChange={(v) => { setIsActive(v); clearSavedFlag(); }} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-[13px] font-medium">Featured</p><p className="text-xs text-muted-foreground">Eligible for featured placement on the app home.</p></div>
          <Toggle defaultOn={isFeatured} label="Featured" onChange={(v) => { setIsFeatured(v); clearSavedFlag(); }} />
        </div>
      </FormSection>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
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
          disabled={pending || !isDirty}
          className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? (creating ? "Creating…" : "Saving…") : creating ? "Create product" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
