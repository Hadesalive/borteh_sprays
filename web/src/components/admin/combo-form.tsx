"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Minus, Plus, X } from "@phosphor-icons/react";

import { createCombo, updateCombo } from "@/app/(dashboard)/combos/actions";
import { formatLe } from "@/lib/format";
import { Toggle } from "@/components/admin/toggle";

export type VariantOption = { id: string; label: string; priceMinor: number };
export type ComboValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  active?: boolean;
  items?: { variantId: string; qty: number }[];
  dealPriceMinor?: number | null;
};

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function ComboForm({ initial, variants }: { initial?: ComboValues; variants: VariantOption[] }) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [items, setItems] = useState<{ variantId: string; qty: number }[]>(initial?.items ?? []);
  // Deal price is edited in whole Leones; stored as minor units. Blank = no deal.
  const [deal, setDeal] = useState(initial?.dealPriceMinor != null ? String(initial.dealPriceMinor / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const chosen = new Set(items.map((i) => i.variantId));
  const available = variants.filter((v) => !chosen.has(v.id));
  const sumMinor = items.reduce((s, it) => s + (byId.get(it.variantId)?.priceMinor ?? 0) * it.qty, 0);
  const dealMinor = deal.trim() === "" ? null : Math.round(Number(deal) * 100);
  const dealValid = dealMinor == null || (Number.isFinite(dealMinor) && dealMinor > 0);
  const savingsMinor = dealMinor != null && dealValid && dealMinor < sumMinor ? sumMinor - dealMinor : 0;

  const addItem = (variantId: string) => setItems((prev) => [...prev, { variantId, qty: 1 }]);
  const setQty = (variantId: string, qty: number) =>
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.variantId !== variantId) : prev.map((i) => (i.variantId === variantId ? { ...i, qty } : i))));
  const removeItem = (variantId: string) => setItems((prev) => prev.filter((i) => i.variantId !== variantId));

  function save() {
    setError(null);
    if (dealMinor != null && !dealValid) {
      setError("Deal price must be a positive amount, or left blank.");
      return;
    }
    if (dealMinor != null && dealMinor >= sumMinor) {
      setError("Deal price must be below the pair’s sum — otherwise it isn’t a discount. Leave it blank to charge the sum.");
      return;
    }
    const input = { name, slug, description, active, items, dealPriceMinor: dealMinor };
    start(async () => {
      const res = editing ? await updateCombo(initial!.id!, input) : await createCombo(input);
      if (res.ok) router.push("/combos");
      else setError(res.error);
    });
  }

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/combos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Combos
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{editing ? initial?.name : "New combo"}</h1>
          <div className="flex items-center gap-2">
            <Link href="/combos" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Create combo"}
            </button>
          </div>
        </div>
      </div>

      <form className="mx-auto max-w-2xl space-y-8 px-6 py-8 lg:px-10" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>
        ) : null}

        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }}
            placeholder="e.g. The Signature Pair"
          />
        </Field>

        <Field label="Slug" hint="used in links — lowercase, no spaces">
          <input className={inputClass} value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="signature-pair" />
        </Field>

        <Field label="Description" hint="optional — shown on the pair's page">
          <textarea
            className={`${inputClass} h-20 py-2`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Two scents curated to wear together — day into night."
          />
        </Field>

        {/* the pair */}
        <div>
          <p className="text-sm font-medium">Fragrances in the pair</p>
          <p className="text-xs text-muted-foreground">Add two or more. Customers can add the whole pair to their bag in one tap.</p>

          <div className="mt-3 divide-y divide-border rounded-md border border-border">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No fragrances yet — add the first below.</p>
            ) : (
              items.map((it) => {
                const v = byId.get(it.variantId);
                return (
                  <div key={it.variantId} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{v?.label ?? "Unavailable fragrance"}</div>
                      <div className="nums text-xs text-muted-foreground">{formatLe((v?.priceMinor ?? 0) * it.qty)}</div>
                    </div>
                    <div className="flex items-center rounded-md border border-border">
                      <button type="button" className="grid size-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Decrease" onClick={() => setQty(it.variantId, it.qty - 1)}>
                        <Minus className="size-3.5" />
                      </button>
                      <span className="nums w-6 text-center text-sm">{it.qty}</span>
                      <button type="button" className="grid size-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Increase" onClick={() => setQty(it.variantId, it.qty + 1)}>
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <button type="button" className="text-muted-foreground transition-colors hover:text-destructive" aria-label="Remove" onClick={() => removeItem(it.variantId)}>
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <select
            className={`${inputClass} mt-3`}
            value=""
            onChange={(e) => { if (e.target.value) addItem(e.target.value); }}
            disabled={available.length === 0}
          >
            <option value="">{available.length === 0 ? "All fragrances added" : "Add a fragrance…"}</option>
            {available.map((v) => (
              <option key={v.id} value={v.id}>{v.label} · {formatLe(v.priceMinor)}</option>
            ))}
          </select>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Sum of fragrances</span>
            <span className="nums text-sm">{formatLe(sumMinor)}</span>
          </div>
        </div>

        {/* deal price */}
        <div>
          <Field label="Deal price" hint="optional — leave blank to charge the sum">
            <div className="relative max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Le</span>
              <input
                className={`${inputClass} pl-9`}
                inputMode="decimal"
                value={deal}
                onChange={(e) => setDeal(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={sumMinor ? String(Math.round(sumMinor / 100)) : "0"}
              />
            </div>
          </Field>
          {savingsMinor > 0 ? (
            <p className="mt-2 text-xs font-medium text-success-soft-foreground">
              Customers save {formatLe(savingsMinor)} versus buying the fragrances separately.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Set a price below {formatLe(sumMinor)} to offer the pair as a deal. Blank charges the honest sum.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border py-3">
          <div>
            <p className="text-sm font-medium">Active</p>
            <p className="text-xs text-muted-foreground">Show this pair in the app (needs every fragrance in stock).</p>
          </div>
          <Toggle defaultOn={active} label="Active" onChange={setActive} />
        </div>
      </form>
    </>
  );
}
