"use client";

import { useMemo, useState, useTransition } from "react";
import { Barcode, Cards, DeviceMobile, MagnifyingGlass, Minus, Money, Plus, Sparkle, Trash, X } from "@phosphor-icons/react";

import { formatLe } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createPosSale, type SaleLine } from "@/app/(dashboard)/pos/actions";

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
  const [tender, setTender] = useState<"cash" | "monime">("cash");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((c) => c.name.toLowerCase().includes(q) || c.sku?.toLowerCase().includes(q));
  }, [catalog, query]);

  const lines = Object.entries(cart).map(([id, qty]) => ({ item: byId.get(id)!, qty })).filter((l) => l.item);
  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const discount = Math.min(claims.reduce((s, c) => s + c.savingsMinor, 0), subtotal);
  const total = subtotal - discount;

  function add(id: string) {
    setMsg(null);
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
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
    setMsg(null);
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

  function charge() {
    if (lines.length === 0) return;
    setMsg(null);
    const payload: SaleLine[] = lines.map((l) => ({
      variantId: l.item.id,
      name: l.item.name,
      label: l.item.meta,
      sku: l.item.sku ?? "",
      unitPriceMinor: l.item.price,
      qty: l.qty,
    }));
    start(async () => {
      const res = await createPosSale(payload, tender, discount);
      if (res.ok) {
        setCart({});
        setClaims([]);
        setMsg({ ok: true, text: `Sale ${res.orderNumber} recorded.` });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="grid gap-0 lg:grid-cols-[1fr_22rem]">
      {/* Catalog */}
      <div className="border-b border-border px-6 py-5 lg:border-r lg:border-b-0 lg:px-10">
        <div className="relative mb-5 max-w-md">
          <Barcode className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product or SKU…"
            className="h-10 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
          <MagnifyingGlass className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        {combos.length > 0 ? (
          <div className="mb-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Cards weight="duotone" className="size-3.5" /> Pairs
            </p>
            <div className="flex flex-wrap gap-2">
              {combos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addCombo(c)}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="nums rounded bg-success-soft px-1.5 py-0.5 text-[0.7rem] font-medium text-success-soft-foreground">
                    save {formatLe(c.savingsMinor)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p.id)}
              disabled={p.stock <= 0}
              className="flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-50"
            >
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="size-12 rounded-md object-cover ring-1 ring-border" />
              ) : (
                <span className="grid size-12 place-items-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
                  <Sparkle weight="duotone" className="size-5" />
                </span>
              )}
              <span className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.meta}</span>
              <span className="nums text-sm font-semibold">{formatLe(p.price, 2)}</span>
              <span className={cn("nums text-[0.7rem]", p.stock <= 0 ? "text-destructive" : "text-muted-foreground")}>
                {p.stock <= 0 ? "Out of stock" : `${p.stock} in stock`}
              </span>
            </button>
          ))}
          {filtered.length === 0 ? <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No products match.</p> : null}
        </div>
      </div>

      {/* Cart / tender */}
      <aside className="flex flex-col px-6 py-5 lg:px-6">
        <h2 className="text-sm font-semibold">Current sale</h2>

        <ul className="mt-4 flex-1 divide-y divide-border">
          {lines.map((l) => (
            <li key={l.item.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{l.item.meta}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setQty(l.item.id, l.qty - 1)} className="grid size-6 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted">
                  <Minus className="size-3" />
                </button>
                <span className="nums w-5 text-center text-sm">{l.qty}</span>
                <button type="button" onClick={() => setQty(l.item.id, Math.min(l.qty + 1, l.item.stock))} className="grid size-6 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted">
                  <Plus className="size-3" />
                </button>
              </div>
              <span className="nums w-20 text-right text-sm font-semibold">{formatLe(l.item.price * l.qty, 2)}</span>
              <button type="button" aria-label="Remove" onClick={() => setQty(l.item.id, 0)} className="text-muted-foreground transition-colors hover:text-destructive">
                <Trash className="size-4" />
              </button>
            </li>
          ))}
          {lines.length === 0 ? <li className="py-10 text-center text-sm text-muted-foreground">Tap a product to start a sale.</li> : null}
        </ul>

        <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          {claims.length > 0 ? (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="nums">{formatLe(subtotal, 2)}</span>
              </div>
              {claims.map((c) => (
                <div key={c.key} className="flex items-center justify-between text-success-soft-foreground">
                  <span className="flex items-center gap-1.5">
                    {c.name} deal
                    <button type="button" aria-label={`Remove ${c.name} deal`} onClick={() => removeClaim(c.key)} className="text-muted-foreground transition-colors hover:text-destructive">
                      <X className="size-3.5" />
                    </button>
                  </span>
                  <span className="nums">−{formatLe(c.savingsMinor, 2)}</span>
                </div>
              ))}
            </>
          ) : null}
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="nums">{formatLe(total, 2)}</span>
          </div>
        </div>

        {msg ? (
          <p className={cn("mt-3 rounded-md px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success-soft-foreground" : "bg-destructive-soft text-destructive-soft-foreground")}>
            {msg.text}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["cash", "monime"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTender(t)}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
                tender === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
              )}
            >
              {t === "cash" ? <Money weight="duotone" className="size-4" /> : <DeviceMobile weight="duotone" className="size-4" />}
              {t === "cash" ? "Cash" : "Monime"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={charge}
          disabled={lines.length === 0 || pending}
          className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Recording…" : `Charge ${formatLe(total, 2)}`}
        </button>
      </aside>
    </div>
  );
}
