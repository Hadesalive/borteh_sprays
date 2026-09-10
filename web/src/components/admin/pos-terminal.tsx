"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Barcode, Cards, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";

import { formatLe } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cartTotals, type DiscountMode } from "@/lib/pos-cart";
import { createPosSale, type PosPayment, type SaleLine } from "@/app/(dashboard)/pos/actions";
import { PosCart, type CartLine, type PosCartHandlers, type PosCartModel } from "@/components/admin/pos-cart";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export type CatalogItem = {
  id: string;
  name: string;
  meta: string;
  sku: string;
  price: number;
  stock: number;
  image: string | null;
};

export type PosCombo = {
  id: string;
  name: string;
  items: { variantId: string; qty: number }[];
  sumMinor: number;
  dealMinor: number;
  savingsMinor: number;
};

// One tapped pair. Adding a combo drops its bottles into the cart and records a
// removable deal here; the saving is independent of the line items so staff can
// still adjust bottles by hand.
type Claim = { key: number; comboId: string; name: string; savingsMinor: number };

export function PosTerminal({ catalog, combos }: { catalog: CatalogItem[]; combos: PosCombo[] }) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimSeq, setClaimSeq] = useState(0);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("amount");
  const [discountRaw, setDiscountRaw] = useState("");
  const [tender, setTender] = useState<PosPayment>("cash");
  const [reference, setReference] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((c) => c.name.toLowerCase().includes(q) || c.sku?.toLowerCase().includes(q));
  }, [catalog, query]);

  const lines: CartLine[] = Object.entries(cart)
    .map(([id, qty]) => {
      const item = byId.get(id);
      return item ? { id, name: item.name, meta: item.meta, price: item.price, qty, stock: item.stock } : null;
    })
    .filter((l): l is CartLine => l !== null);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const comboSavings = claims.reduce((s, c) => s + c.savingsMinor, 0);
  const totals = cartTotals({ subtotal, comboSavings, discountRaw, discountMode });
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  function add(id: string) {
    const item = byId.get(id);
    if (!item || item.stock <= 0) return;
    setMessage(null);
    setCart((c) => ({ ...c, [id]: Math.min((c[id] ?? 0) + 1, item.stock) }));
  }

  function setQty(id: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  function addCombo(combo: PosCombo) {
    setMessage(null);
    setCart((c) => {
      const next = { ...c };
      for (const it of combo.items) next[it.variantId] = (next[it.variantId] ?? 0) + it.qty;
      return next;
    });
    setClaims((cs) => [...cs, { key: claimSeq, comboId: combo.id, name: combo.name, savingsMinor: combo.savingsMinor }]);
    setClaimSeq((n) => n + 1);
  }

  function removeClaim(key: number) {
    setClaims((cs) => cs.filter((c) => c.key !== key));
  }

  // A barcode scanner types the SKU and presses Enter; so does a cashier who
  // knows what they're looking for. Either way, one match means add it.
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || filtered.length === 0) return;
    e.preventDefault();
    const first = filtered[0];
    if (first.stock <= 0) return;
    add(first.id);
    setQuery("");
  }

  function charge() {
    if (lines.length === 0) return;
    setMessage(null);
    const payload: SaleLine[] = lines.map((l) => ({
      variantId: l.id,
      name: l.name,
      label: l.meta,
      sku: byId.get(l.id)?.sku ?? "",
      unitPriceMinor: l.price,
      qty: l.qty,
    }));
    start(async () => {
      const res = await createPosSale(payload, tender, tender === "mobile_money" ? reference : null, totals.discount);
      if (res.ok) {
        setCart({});
        setClaims([]);
        setDiscountRaw("");
        setReference("");
        setMessage({ ok: true, text: `Receipt ${res.receiptNumber} recorded.` });
        searchRef.current?.focus();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  const model: PosCartModel = { lines, claims, totals, discountMode, discountRaw, tender, reference, pending, message };
  const handlers: PosCartHandlers = {
    setQty,
    removeClaim,
    setDiscountMode,
    setDiscountRaw,
    setTender,
    setReference,
    charge,
  };

  return (
    <div className="lg:grid lg:grid-cols-[1fr_24rem] lg:items-start">
      {/* Catalog */}
      <div className="px-6 pb-28 pt-5 lg:border-r lg:border-border lg:px-8 lg:pb-8">
        <div className="relative mb-5 max-w-md">
          <label htmlFor="pos-search" className="sr-only">
            Search products by name or SKU
          </label>
          <Barcode className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="pos-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Scan or search — press Enter to add"
            autoFocus
            autoComplete="off"
            className="h-11 w-full border border-border bg-background pl-9 pr-10 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
          <MagnifyingGlass className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {query.trim() ? `${filtered.length} ${filtered.length === 1 ? "product" : "products"} match` : ""}
        </p>

        {combos.length > 0 ? (
          <section className="mb-5" aria-labelledby="pos-pairs">
            <h2 id="pos-pairs" className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Cards weight="duotone" className="size-3.5" /> Pairs
            </h2>
            <div className="flex flex-wrap gap-2">
              {combos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addCombo(c)}
                  aria-label={`Add the ${c.name} pair, saves ${formatLe(c.savingsMinor)}`}
                  className="inline-flex min-h-11 items-center gap-2 border border-border bg-background px-3 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="nums bg-success-soft px-1.5 py-0.5 text-[0.7rem] font-medium text-success-soft-foreground">
                    save {formatLe(c.savingsMinor)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <h2 className="sr-only">Products</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((p) => {
            const out = p.stock <= 0;
            const inCart = cart[p.id] ?? 0;
            const low = !out && p.stock <= 5;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p.id)}
                disabled={out || inCart >= p.stock}
                aria-label={`${p.name}, ${p.meta}, ${formatLe(p.price, 2)}, ${out ? "out of stock" : `${p.stock} in stock`}${inCart ? `, ${inCart} in the sale` : ""}`}
                className={cn(
                  "group relative flex flex-col overflow-hidden border bg-card text-left transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                  inCart > 0 ? "border-primary" : "border-border hover:border-foreground/25 hover:shadow-card",
                  out && "opacity-60",
                )}
              >
                {/* The bottle carries the tile — perfume photography is the
                    fastest way for a cashier to find the right shelf item. */}
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-muted-foreground/40">
                      <Sparkle weight="duotone" className="size-8" />
                    </span>
                  )}
                  {inCart > 0 ? (
                    <span className="nums absolute right-2 top-2 grid min-w-6 place-items-center bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground shadow-bevel">
                      {inCart}
                    </span>
                  ) : null}
                  {out ? (
                    <span className="absolute inset-x-0 bottom-0 bg-destructive/90 py-1 text-center text-[0.7rem] font-medium text-destructive-foreground">
                      Out of stock
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.meta}</p>
                  <div className="mt-auto flex items-baseline justify-between gap-2 pt-2.5">
                    <span className="nums text-sm font-semibold">{formatLe(p.price, 2)}</span>
                    {out ? null : (
                      <span className={cn("nums text-[0.7rem]", low ? "text-warning" : "text-muted-foreground")}>
                        {p.stock} left
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No products match.</p> : null}
      </div>

      {/* Desktop: the sale sits beside the catalog and never scrolls away.
          `top-14` clears the dashboard's sticky header. */}
      <aside
        aria-labelledby="pos-sale-heading"
        className="sticky top-14 hidden h-[calc(100svh-3.5rem)] flex-col lg:flex"
      >
        <h2 id="pos-sale-heading" className="shrink-0 px-4 pb-2 pt-5 text-sm font-semibold">
          Current sale
        </h2>
        <PosCart idPrefix="desk" model={model} on={handlers} />
      </aside>

      {/* Tablet and phone: a fixed bar you can always reach, opening the same
          cart as a sheet. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          disabled={lines.length === 0}
          className="inline-flex h-12 w-full items-center justify-between bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
        >
          <span className="nums">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
          <span>{lines.length === 0 ? "No items yet" : "Review & charge"}</span>
          <span className="nums">{formatLe(totals.total, 2)}</span>
        </button>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[92svh] gap-0 p-0">
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
            <SheetTitle>Current sale</SheetTitle>
            <SheetDescription className="sr-only">
              Review the items, apply a discount, choose a payment method, and charge.
            </SheetDescription>
          </SheetHeader>
          <PosCart idPrefix="sheet" model={model} on={handlers} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
