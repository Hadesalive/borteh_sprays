"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowRight, Stack, Trash } from "@phosphor-icons/react";

import { deleteSlide, setScentActive, setSlideActive } from "@/app/(dashboard)/storefront/actions";
import { storageUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/admin/toggle";

export type HeroSlide = { id: string; label: string; title: string; cta: string; imagePath: string | null; active: boolean };
export type Chip = { name: string; imagePath: string | null };
export type ScentRow = { id: string; label: string; active: boolean };

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

function ManageLink({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      Manage
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

export function StorefrontBuilder({
  hero,
  collections,
  scents,
  brands,
}: {
  hero: HeroSlide[];
  collections: Chip[];
  scents: ScentRow[];
  brands: Chip[];
}) {
  const [pending, start] = useTransition();

  return (
    <div className={cn("mx-auto max-w-3xl space-y-12 px-6 py-8 lg:px-10", pending && "opacity-70 transition-opacity")}>
      {/* Hero carousel */}
      <section>
        <SectionLabel>Hero carousel</SectionLabel>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {hero.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              {storageUrl(s.imagePath) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storageUrl(s.imagePath)!} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover ring-1 ring-border" />
              ) : (
                <span className="h-10 w-16 shrink-0 rounded-md bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[s.label, s.cta].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Toggle defaultOn={s.active} label={`Show ${s.title}`} onChange={(on) => start(async () => { await setSlideActive(s.id, on); })} />
              <button
                type="button"
                aria-label="Remove slide"
                className="text-muted-foreground transition-colors hover:text-destructive"
                onClick={() => { if (confirm("Remove this slide?")) start(async () => { await deleteSlide(s.id); }); }}
              >
                <Trash className="size-4" />
              </button>
            </li>
          ))}
          {hero.length === 0 ? <li className="py-6 text-sm text-muted-foreground">No hero slides yet.</li> : null}
        </ul>
      </section>

      {/* Featured collections */}
      <section>
        <SectionLabel action={<ManageLink href="/collections" />}>Featured collections</SectionLabel>
        <p className="mt-1 text-xs text-muted-foreground">Shown on the home in this order. Edit in Collections.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {collections.map((c) => (
            <span key={c.name} className="inline-flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm">
              {storageUrl(c.imagePath) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storageUrl(c.imagePath)!} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <span className="grid size-6 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Stack weight="duotone" className="size-3.5" />
                </span>
              )}
              {c.name}
            </span>
          ))}
          {collections.length === 0 ? <span className="text-sm text-muted-foreground">None featured — feature some in Collections.</span> : null}
        </div>
      </section>

      {/* Shop by scent */}
      <section>
        <SectionLabel>Shop by scent</SectionLabel>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {scents.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium">{s.label}</span>
              <Toggle defaultOn={s.active} label={`Show ${s.label}`} onChange={(on) => start(async () => { await setScentActive(s.id, on); })} />
            </li>
          ))}
        </ul>
      </section>

      {/* Shop by brand */}
      <section>
        <SectionLabel action={<ManageLink href="/brands" />}>Featured brands</SectionLabel>
        <p className="mt-1 text-xs text-muted-foreground">Promoted to the front of the brand rail. Edit in Brands.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {brands.map((b) => (
            <span key={b.name} className="inline-flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm">
              {storageUrl(b.imagePath) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storageUrl(b.imagePath)!} alt="" className="size-6 rounded-full bg-white object-contain p-0.5 ring-1 ring-border" />
              ) : (
                <span className="grid size-6 place-items-center rounded-full bg-muted text-[0.6rem] font-semibold text-muted-foreground">
                  {b.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              {b.name}
            </span>
          ))}
          {brands.length === 0 ? (
            <span className="text-sm text-muted-foreground">None featured — the app shows all brands alphabetically. Promote some in Brands.</span>
          ) : null}
        </div>
      </section>

      {/* Rails & banners — automatic, not stored toggles */}
      <section>
        <SectionLabel>Rails &amp; banners</SectionLabel>
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {[
            { title: "Best sellers rail", desc: "Ranked by popularity." },
            { title: "Top rated rail", desc: "Ranked by rating." },
            { title: "Discount banner", desc: "Shows when any product is on sale." },
          ].map((r) => (
            <li key={r.title} className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-soft-foreground">Automatic</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
