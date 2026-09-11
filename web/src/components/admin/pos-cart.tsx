"use client";

import { DeviceMobile, Minus, Money, Percent, Plus, Trash, X } from "@phosphor-icons/react";

import { formatLe } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartTotals, DiscountMode } from "@/lib/pos-cart";
import type { PosPayment } from "@/app/(dashboard)/pos/actions";

export type CartLine = { id: string; name: string; meta: string; price: number; qty: number; stock: number };
export type CartClaim = { key: number; name: string; savingsMinor: number };

export type PosCartModel = {
  lines: CartLine[];
  claims: CartClaim[];
  totals: CartTotals;
  discountMode: DiscountMode;
  discountRaw: string;
  tender: PosPayment;
  reference: string;
  pending: boolean;
  message: { ok: boolean; text: string } | null;
};

export type PosCartHandlers = {
  setQty: (id: string, qty: number) => void;
  removeClaim: (key: number) => void;
  setDiscountMode: (mode: DiscountMode) => void;
  setDiscountRaw: (raw: string) => void;
  setTender: (tender: PosPayment) => void;
  setReference: (reference: string) => void;
  charge: () => void;
};

const TENDERS: { value: PosPayment; label: string; Icon: typeof Money }[] = [
  { value: "cash", label: "Cash", Icon: Money },
  { value: "mobile_money", label: "Mobile money", Icon: DeviceMobile },
];

/**
 * The sale in progress: lines, deals, discount, tender, and the charge button.
 *
 * Rendered twice — once in the sticky desktop column, once inside the mobile
 * sheet — so every id is namespaced by `idPrefix`. Only one copy is ever in
 * the accessibility tree at a time: the other is `display:none` (which removes
 * it outright), which is also what keeps the single live region from being
 * announced twice.
 */
export function PosCart({
  idPrefix,
  model,
  on,
}: {
  idPrefix: string;
  model: PosCartModel;
  on: PosCartHandlers;
}) {
  const { lines, claims, totals, discountMode, discountRaw, tender, reference, pending, message } = model;
  const empty = lines.length === 0;
  const discountId = `${idPrefix}-discount`;
  const referenceId = `${idPrefix}-reference`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Lines — the only part that scrolls, so the totals and Charge below
          stay put however long the sale gets. */}
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-4", empty && "grid place-items-center")}>
        {empty ? (
          <p className="max-w-[16rem] text-balance text-center text-sm text-muted-foreground">
            Scan a barcode or tap a product to start a sale.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <div className="w-full min-w-0">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.meta} · {formatLe(l.price, 2)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => on.setQty(l.id, l.qty - 1)}
                    aria-label={`Remove one ${l.name}`}
                    className="grid size-11 place-items-center border border-border text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="nums w-8 text-center text-sm tabular-nums">{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => on.setQty(l.id, Math.min(l.qty + 1, l.stock))}
                    disabled={l.qty >= l.stock}
                    aria-label={`Add one ${l.name}`}
                    className="grid size-11 place-items-center border border-border text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <span className="nums ml-auto min-w-20 shrink-0 text-right text-sm font-semibold whitespace-nowrap">{formatLe(l.price * l.qty, 2)}</span>
                <button
                  type="button"
                  onClick={() => on.setQty(l.id, 0)}
                  aria-label={`Remove ${l.name} from the sale`}
                  className="grid size-11 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <Trash className="size-4" />
                </button>
                {l.qty >= l.stock ? (
                  <p className="w-full text-[0.7rem] text-warning">Only {l.stock} in stock.</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals, discount, tender, charge — pinned. */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="nums">{formatLe(totals.subtotal, 2)}</span>
          </div>

          {claims.map((c) => (
            <div key={c.key} className="flex items-center justify-between text-success-soft-foreground">
              <span className="flex items-center gap-1.5">
                {c.name} deal
                <button
                  type="button"
                  onClick={() => on.removeClaim(c.key)}
                  aria-label={`Remove the ${c.name} deal`}
                  className="grid size-11 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <X className="size-3.5" />
                </button>
              </span>
              <span className="nums">−{formatLe(c.savingsMinor, 2)}</span>
            </div>
          ))}

          <fieldset className="pt-1">
            <legend className="sr-only">Discount</legend>
            <div className="flex items-center gap-2">
              <label htmlFor={discountId} className="text-muted-foreground">
                Discount
              </label>
              <div className="ml-auto flex items-center gap-1">
                <div role="group" aria-label="Discount type" className="flex">
                  {(["amount", "percent"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => on.setDiscountMode(m)}
                      aria-pressed={discountMode === m}
                      aria-label={m === "amount" ? "Discount in Leones" : "Discount as a percentage"}
                      className={cn(
                        "grid h-11 w-10 place-items-center border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                        m === "percent" && "-ml-px",
                        discountMode === m
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {m === "amount" ? "Le" : <Percent className="size-3.5" />}
                    </button>
                  ))}
                </div>
                <input
                  id={discountId}
                  value={discountRaw}
                  onChange={(e) => on.setDiscountRaw(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  disabled={empty}
                  aria-describedby={totals.manualDiscount > 0 ? `${discountId}-applied` : undefined}
                  className="nums h-11 w-20 border border-border bg-background px-2 text-right text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-50"
                />
              </div>
            </div>
            {totals.manualDiscount > 0 ? (
              <p id={`${discountId}-applied`} className="mt-1 flex justify-between text-success-soft-foreground">
                <span>Discount applied</span>
                <span className="nums">−{formatLe(totals.manualDiscount, 2)}</span>
              </p>
            ) : null}
          </fieldset>

          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="nums">{formatLe(totals.total, 2)}</span>
          </div>
        </div>

        {/* One live region per rendered cart; the hidden copy is display:none,
            so a screen reader only ever hears this once. */}
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "mt-3 px-3 py-2 text-sm",
            !message && "sr-only",
            message?.ok && "bg-success-soft text-success-soft-foreground",
            message && !message.ok && "bg-destructive-soft text-destructive-soft-foreground",
          )}
        >
          {message?.text ?? ""}
        </p>

        <fieldset className="mt-3">
          <legend className="sr-only">Payment method</legend>
          <div className="grid grid-cols-2 gap-2">
            {TENDERS.map(({ value, label, Icon }) => (
              <label
                key={value}
                className={cn(
                  "inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 border text-sm font-medium transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40",
                  tender === value ? "border-primary bg-primary/10 text-foreground" : "border-border hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-tender`}
                  value={value}
                  checked={tender === value}
                  onChange={() => on.setTender(value)}
                  className="sr-only"
                />
                <Icon weight="duotone" className="size-4" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {tender === "mobile_money" ? (
          <div className="mt-2">
            <label htmlFor={referenceId} className="text-xs font-medium text-muted-foreground">
              Transaction reference <span className="font-normal">(optional)</span>
            </label>
            <input
              id={referenceId}
              value={reference}
              onChange={(e) => on.setReference(e.target.value)}
              placeholder="From the customer's confirmation SMS"
              autoComplete="off"
              className="nums mt-1 h-11 w-full border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={on.charge}
          disabled={empty || pending}
          className="mt-3 inline-flex h-12 w-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? "Recording…" : `Charge ${formatLe(totals.total, 2)}`}
        </button>
      </div>
    </div>
  );
}
