# Admin Redesign — Wave 3b (Storefront, Onboarding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "App copy" admin feature entirely (an owner decision, not a spec requirement — the shop owner doesn't want to maintain this CMS surface), migrate Storefront's five curation sections onto `Card` primitives matching Product Detail's established pattern, and give Onboarding's slide editor visible field labels instead of placeholder-only inputs.

**Architecture:** This plan diverges from the original Wave 3 scoping (which paired Storefront with the whole "Content" area) at the owner's explicit request: "ditch app copy remove it." Onboarding stays in scope — it's a real, working feature (manual slide reordering, live-read by the app) — only the Copy editor (`/content/copy`, the page literally titled "App copy") is removed. Storefront and Onboarding are otherwise independent pages with no shared files, so they're batched into one plan for the same reason Wave 3a batched Collections/Brands: similar-sized, similar-risk work that's more efficient reviewed together than as two near-empty plans. Neither page had any hex/shadow/radius-bracket violations (confirmed by direct inspection) — this plan's work is a consistency migration (Product Detail's `Card` pattern, Forms UX's visible-labels rule), not a bug sweep, except for two genuine dead-code finds surfaced during this plan's own research (an orphaned, never-imported `content/actions.ts`, and the App-copy removal itself once it's decided to remove the feature).

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Tailwind v4, shadcn/ui, Vitest + Testing Library (`npm test`).

**Spec:** `docs/superpowers/specs/2026-09-02-admin-redesign-design.md`, "Wave 3 — Long tail" (Storefront, Content). The App-copy removal is **not** a spec requirement — it's an explicit owner decision made after the spec was written, documented here for the executor's context, not attributed to the spec.

## Global Constraints

- Every file this plan touches lives under `web/` — no `mobile/`/`supabase/` changes. Removing the App-copy admin UI does not touch the `app_content` database table itself — any existing override values already stored there are left exactly as they are; only the staff-facing editing page and its dedicated Server Action file are removed. The live customer-facing app's own copy-reading logic (wherever it queries `app_content`) is entirely outside `web/`'s admin dashboard and is not touched by this plan.
- Every remaining Server Action call (`setSlideActive`, `deleteSlide`, `setScentActive` in `storefront/actions.ts`; `createSlide`, `updateSlide`, `setSlideActive`, `deleteSlide`, `reorderSlides` in `content/onboarding/actions.ts`) is invoked with the exact same arguments as today.
- Do not modify `page-header.tsx`, `card.tsx` (including its `CardTitle` font-fix from Product Detail — already correct, nothing to change), `chip.tsx`, `toggle.tsx`, `storefront/actions.ts`, or `content/onboarding/actions.ts`'s business logic.
- Every `CardTitle` this plan introduces gets `role="heading" aria-level={2}` at the call site — `CardTitle` itself renders a `<div>`, and this per-call-site fix is the established pattern from Product Detail's final review (the primitive itself is intentionally left unfixed, per that plan's own reasoning, so every new consumer must apply this at its own call sites).
- Run `npx tsc --noEmit` (from `web/`) after every task — must be clean before moving to the next task.
- Run `npm test` (from `web/`) after every task — full suite must pass.

---

## File Structure

Deleted files (Task 1):
- `web/src/app/(dashboard)/content/copy/page.tsx`
- `web/src/app/(dashboard)/content/copy/actions.ts`
- `web/src/components/admin/copy-editor.tsx`
- `web/src/lib/content-registry.ts` (its only consumers are the two files above)
- `web/src/app/(dashboard)/content/actions.ts` (a pre-existing orphan — never imported anywhere, revalidates a `/content/screen` path that isn't a real route; found during this plan's research, removed as dead code rather than left behind)

Modified files:
- `web/src/lib/nav.ts` — remove the "App copy" entry and its now-unused `TextAa` icon import (Task 1)
- `web/src/components/admin/storefront-builder.tsx` — full rewrite onto `Card` primitives (Task 2)
- `web/src/components/admin/onboarding-editor.tsx` — visible field labels (Task 3)

New files:
- `web/src/app/(dashboard)/storefront/loading.tsx`, `error.tsx` (Task 4)
- `web/src/app/(dashboard)/content/onboarding/loading.tsx`, `error.tsx` (Task 4)

Explicitly NOT touched: `web/src/app/(dashboard)/storefront/page.tsx`, `web/src/app/(dashboard)/storefront/actions.ts`, `web/src/app/(dashboard)/content/onboarding/page.tsx`, `web/src/app/(dashboard)/content/onboarding/actions.ts` — no changes needed to any of these four; `web/src/components/app-sidebar.tsx` — `contentNav`'s one remaining item ("Onboarding") renders fine as a single-item group, no sidebar-structure change needed (confirmed: `contentNav`'s "App Studio" grouping comment is a code comment, not user-visible chrome — no `SidebarGroupLabel` renders it).

---

### Task 1: Remove the "App copy" feature

**Files:**
- Delete: `web/src/app/(dashboard)/content/copy/page.tsx`
- Delete: `web/src/app/(dashboard)/content/copy/actions.ts`
- Delete: `web/src/components/admin/copy-editor.tsx`
- Delete: `web/src/lib/content-registry.ts`
- Delete: `web/src/app/(dashboard)/content/actions.ts`
- Modify: `web/src/lib/nav.ts`

**Interfaces:**
- Produces: nothing — this task only removes exports/consumers. Confirm before deleting: `grep -rn "content/copy\|CopyEditor\|contentKeys\|contentGroups\|content-registry" web/src` should, after this task, return zero hits (it will naturally, since every consumer is one of the deleted files).

- [ ] **Step 1: Confirm the removal is safe (no other consumers)**

Run these two checks yourself before deleting anything — they confirm the research already done for this plan, they don't change it:
```bash
grep -rn "content/copy\|CopyEditor\|contentKeys\|contentGroups" web/src --include="*.tsx" --include="*.ts"
```
Expected: hits only inside the 4 files this task deletes (`content/copy/page.tsx`, `content/copy/actions.ts`, `copy-editor.tsx`, `lib/content-registry.ts`) — nothing outside them. If you find an additional consumer outside these 4 files, stop and report BLOCKED rather than deleting something still in use.
```bash
grep -rln "content/actions\"" web/src --include="*.tsx" --include="*.ts"
```
Expected: no results — `web/src/app/(dashboard)/content/actions.ts` (the top-level one, distinct from `content/copy/actions.ts`) is never imported by any file; it revalidates `/content/screen`, a path with no corresponding route anywhere in `web/src/app`.

- [ ] **Step 2: Delete the five files**

```bash
git rm "web/src/app/(dashboard)/content/copy/page.tsx" "web/src/app/(dashboard)/content/copy/actions.ts" web/src/components/admin/copy-editor.tsx web/src/lib/content-registry.ts "web/src/app/(dashboard)/content/actions.ts"
```
(This also removes the now-empty `web/src/app/(dashboard)/content/copy/` directory — `web/src/app/(dashboard)/content/onboarding/` and its contents are untouched, so `web/src/app/(dashboard)/content/` itself still exists and is still a valid route segment.)

- [ ] **Step 3: Remove the "App copy" nav entry**

In `web/src/lib/nav.ts`, remove `TextAa` from the icon import block:
```tsx
import {
  SquaresFour,
  ShoppingBag,
  Truck,
  Barcode,
  Package,
  Drop,
  Stack,
  Cards,
  Sparkle,
  DeviceMobile,
  ChartLineUp,
  UsersThree,
  GearSix,
  Presentation,
  TextAa,
  type Icon,
} from "@phosphor-icons/react";
```
→
```tsx
import {
  SquaresFour,
  ShoppingBag,
  Truck,
  Barcode,
  Package,
  Drop,
  Stack,
  Cards,
  Sparkle,
  DeviceMobile,
  ChartLineUp,
  UsersThree,
  GearSix,
  Presentation,
  type Icon,
} from "@phosphor-icons/react";
```
And remove the "App copy" entry from `contentNav`:
```tsx
export const contentNav: NavItem[] = [
  { title: "Onboarding", href: "/content/onboarding", icon: Presentation },
  { title: "App copy", href: "/content/copy", icon: TextAa },
];
```
→
```tsx
export const contentNav: NavItem[] = [
  { title: "Onboarding", href: "/content/onboarding", icon: Presentation },
];
```
Nothing else in `nav.ts` changes — `app-sidebar.tsx` renders `contentNav` generically via `<NavItems items={contentNav} />` with no assumption about its length, so a one-item array needs no other change.

- [ ] **Step 4: Typecheck and run the full suite**

Run: `cd web && npx tsc --noEmit && npm test`
Expected: no type errors (confirming nothing else referenced the deleted files); all suites pass.

- [ ] **Step 5: Manually verify**

Run `npm run dev`, sign in. Confirm: `/content/copy` now 404s (expected — the route no longer exists), the sidebar's "App Studio" group shows only "Onboarding" with no visual gap or orphaned divider, and `/content/onboarding` itself still works exactly as before (this task doesn't touch it).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(admin): remove the App copy admin feature

Owner decision, not a spec requirement -- the Copy editor (/content/copy,
titled "App copy" in its own header) is being dropped rather than
redesigned. Removes its page, Server Action file, the CopyEditor
component, and lib/content-registry.ts (its only consumer). Also
removes web/src/app/(dashboard)/content/actions.ts, a pre-existing
orphan discovered during this removal's research -- never imported
anywhere, and it revalidated a /content/screen path with no
corresponding route. The underlying app_content table and whatever
overrides are already stored in it are untouched; only the staff-facing
editing surface is gone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Storefront — migrate onto `Card` primitives

**Files:**
- Modify: `web/src/components/admin/storefront-builder.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction` (`@/components/ui/card`, unchanged), `Chip` (`@/components/admin/chip`, imported under the alias `StatusChip` — this file already exports its own unrelated type named `Chip` for collections/brands data, so the component import must be aliased to avoid a name collision).
- Produces: `StorefrontBuilder({hero, collections, scents, brands})` — same prop signature, same `HeroSlide`/`Chip`/`ScentRow` exported types, unchanged. `storefront/page.tsx` (not touched by this task) keeps working with no changes.

- [ ] **Step 1: Rewrite `storefront-builder.tsx`**

Replace the file in full:
```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowRight, Stack, Trash } from "@phosphor-icons/react";

import { deleteSlide, setScentActive, setSlideActive } from "@/app/(dashboard)/storefront/actions";
import { storageUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/admin/toggle";
import { Chip as StatusChip } from "@/components/admin/chip";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";

export type HeroSlide = { id: string; label: string; title: string; cta: string; imagePath: string | null; active: boolean };
export type Chip = { name: string; imagePath: string | null };
export type ScentRow = { id: string; label: string; active: boolean };

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
    <div className={cn("mx-auto max-w-3xl space-y-6 px-6 py-8 lg:px-10", pending && "opacity-70 transition-opacity")}>
      {/* Hero carousel */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b pt-4">
          <CardTitle role="heading" aria-level={2}>Hero carousel</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {hero.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
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
            {hero.length === 0 ? <li className="px-4 py-6 text-sm text-muted-foreground">No hero slides yet.</li> : null}
          </ul>
        </CardContent>
      </Card>

      {/* Featured collections */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b pt-4">
          <CardTitle role="heading" aria-level={2}>Featured collections</CardTitle>
          <CardDescription>Shown on the home in this order. Edit in Collections.</CardDescription>
          <CardAction>
            <ManageLink href="/collections" />
          </CardAction>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
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
        </CardContent>
      </Card>

      {/* Shop by scent */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b pt-4">
          <CardTitle role="heading" aria-level={2}>Shop by scent</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {scents.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-medium">{s.label}</span>
                <Toggle defaultOn={s.active} label={`Show ${s.label}`} onChange={(on) => start(async () => { await setScentActive(s.id, on); })} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Shop by brand */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b pt-4">
          <CardTitle role="heading" aria-level={2}>Featured brands</CardTitle>
          <CardDescription>Promoted to the front of the brand rail. Edit in Brands.</CardDescription>
          <CardAction>
            <ManageLink href="/brands" />
          </CardAction>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
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
        </CardContent>
      </Card>

      {/* Rails & banners — automatic, not stored toggles */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b pt-4">
          <CardTitle role="heading" aria-level={2}>Rails &amp; banners</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {[
              { title: "Best sellers rail", desc: "Ranked by popularity." },
              { title: "Top rated rail", desc: "Ranked by rating." },
              { title: "Discount banner", desc: "Shows when any product is on sale." },
            ].map((r) => (
              <li key={r.title} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
                <StatusChip tone="success">Automatic</StatusChip>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```
Notes on what changed and why:
- Every `<section>`/`SectionLabel` pair becomes a `Card`/`CardHeader`/`CardTitle`, matching the pattern Product Detail established for its own five read/mutate panels — this page had zero hex/shadow violations, so this is a consistency migration, not a bug fix.
- `role="heading" aria-level={2}` on every `CardTitle` — required at each call site since `CardTitle` itself renders a `<div>` (the primitive was deliberately left unfixed in Product Detail's final review; every new consumer applies this itself).
- "Featured collections" and "Featured brands" keep their exact existing behavior — a read-only chip list plus a "Manage" link to the (already-redesigned, Wave 3a) Collections/Brands pages. Featuring itself is edited there, not here; this task does not add any new interaction to these sections, matching the "no new features" scoping decision made at the start of this whole redesign.
- The old `SectionLabel` local helper is retired — `CardHeader`'s own grid layout (auto-arranging `CardTitle`/`CardDescription`/`CardAction`) replaces its `flex items-center justify-between` role.
- The "Automatic" badge changes from a hand-rolled `<span className="rounded-full bg-success-soft ...">` to `<StatusChip tone="success">` — matching the exact "use the established status vocabulary component, not a one-off span" lesson from Wave 3a's own final review (`StatusPill` → `Chip` fix).
- Outer wrapper's `space-y-12` becomes `space-y-6` — a small deliberate tightening now that each section has its own visible `Card` border; five stacked cards at 48px apart read as more disconnected than at 24px. Flag if you'd prefer the original spacing, it's a one-word revert.
- `Chip` (component) is imported as `StatusChip` specifically because this file already exports its own type named `Chip` (collections/brands chip data) — the alias avoids a name collision, not a style preference.

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 3: Manually verify**

Run `npm run dev`, open `/storefront`. Confirm: five sections each render as a bordered square-cornered card; hiding/showing a hero slide or scent still works; deleting a hero slide still prompts and removes it; the "Manage" links still navigate to `/collections` and `/brands`.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/admin/storefront-builder.tsx
git commit -m "feat(admin): migrate Storefront onto Card primitives

Storefront's five sections (Hero carousel, Featured collections, Shop
by scent, Featured brands, Rails & banners) now compose Card/CardHeader/
CardTitle/CardDescription/CardContent/CardAction, matching the pattern
Product Detail established for its own panels. No hex/shadow debt
existed here -- this is a visual consistency migration. Featured
collections/brands keep their exact existing read-only-chips-plus-
Manage-link behavior; featuring itself is still edited in Collections/
Brands, not here.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Onboarding — visible field labels

**Files:**
- Modify: `web/src/components/admin/onboarding-editor.tsx`

**Interfaces:**
- Consumes: nothing new — no new imports needed beyond what's already there.
- Produces: `OnboardingEditor({slides})` — same prop signature, same `Slide` type, unchanged.

Every text input in this file (`SlideCard`'s Title/Body, and the "Add slide" panel's Title/Body) is placeholder-only today — no visible `<label>` at all, violating the spec's "Labels are always visible... never placeholder-only" convention. This task adds a compact local field wrapper (the same shape as Product Editor's `CompactField`, since these are dense per-card fields, not a full multi-column `FormSection` form) and wires it onto all four inputs.

- [ ] **Step 1: Add the `CompactField` helper and wire it onto `SlideCard`'s inputs**

Add this small helper near the top of the file, after the `inputClass` constant and before `SlideCard`:
```tsx
function CompactField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
```
(Same shape as `product-editor.tsx`'s own `CompactField` — kept as a separate local definition here rather than a shared export, since it's a small, file-scoped convenience and there's no established shared-component home for it yet; if a third file needs the identical helper, that's the point to extract it into a real shared component, not before.)

In `SlideCard`, replace the Title/Body inputs:
```tsx
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Slide title"
          />
          <textarea
            rows={2}
            className={`${inputClass} h-auto resize-y py-2`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Slide body"
          />
```
with:
```tsx
          <CompactField label="Title" htmlFor={`slide-${slide.id}-title`}>
            <input
              id={`slide-${slide.id}-title`}
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Slide title"
            />
          </CompactField>
          <CompactField label="Body" htmlFor={`slide-${slide.id}-body`}>
            <textarea
              id={`slide-${slide.id}-body`}
              rows={2}
              className={`${inputClass} h-auto resize-y py-2`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Slide body"
            />
          </CompactField>
```
(`id`s are derived from `slide.id`, which is already a stable unique database id — no new id-generation mechanism needed, and every rendered `SlideCard` gets naturally-unique field ids.)

- [ ] **Step 2: Wire `CompactField` onto the "Add slide" panel's inputs**

Replace:
```tsx
          <input className={inputClass} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Slide title" />
          <textarea
            rows={2}
            className={`${inputClass} h-auto resize-y py-2`}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Slide body"
          />
```
with:
```tsx
          <CompactField label="Title" htmlFor="new-slide-title">
            <input id="new-slide-title" className={inputClass} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Slide title" />
          </CompactField>
          <CompactField label="Body" htmlFor="new-slide-body">
            <textarea
              id="new-slide-body"
              rows={2}
              className={`${inputClass} h-auto resize-y py-2`}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Slide body"
            />
          </CompactField>
```
(Static ids are safe here — only one "Add slide" panel is ever rendered at a time, per the existing `adding` boolean toggle.)

Everything else in this file — the manual up/down reorder logic (`move`), `createSlide`/`updateSlide`/`deleteSlide`/`reorderSlides`/`setSlideActive` calls, the `dirty`-gated Save button, `location.reload()` after adding a slide — stays completely unchanged. The reorder mechanism here is real (calls `reorderSlides` with the new id order, unlike Collections/Brands' now-removed decorative drag handle from Wave 3a) — nothing about it needs fixing.

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 4: Manually verify**

Run `npm run dev`, open `/content/onboarding`. Confirm: every slide card now shows "Title"/"Body" labels above their inputs; the "Add slide" panel shows the same; editing a slide's title/body and clicking Save still works; reordering with the up/down arrows still works; adding a new slide still works.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/admin/onboarding-editor.tsx
git commit -m "feat(admin): add visible field labels to Onboarding's slide editor

Title and Body inputs (both on existing slide cards and the 'Add slide'
panel) were placeholder-only, violating the spec's 'labels are always
visible, never placeholder-only' convention. Adds a compact local
CompactField helper (same shape as Product Editor's) rather than
FormField, since these are dense per-card fields, not a multi-column
form. No behavior changes -- reorder, save, add, and delete logic are
all untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `loading.tsx` + `error.tsx` for Storefront and Onboarding

Deliberately last — Tasks 2-3 restructure both pages' layouts; writing skeletons against the final shapes avoids the skeleton/header-mismatch class of bug found in Wave 1's final review.

**Files:**
- Create: `web/src/app/(dashboard)/storefront/loading.tsx`, `error.tsx`
- Create: `web/src/app/(dashboard)/content/onboarding/loading.tsx`, `error.tsx`

**Interfaces:**
- Consumes: `Skeleton` (`@/components/ui/skeleton`), `PageError` (`@/components/admin/page-error`) — both pre-existing.

- [ ] **Step 1: Storefront loading/error**

Create `web/src/app/(dashboard)/storefront/loading.tsx`:
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function StorefrontLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-1.5 h-3 w-72" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8 lg:px-10">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </>
  );
}
```
(Five blocks, matching the five `Card` sections Task 2 shipped.)

Create `web/src/app/(dashboard)/storefront/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function StorefrontError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load the storefront" reset={reset} />;
}
```

- [ ] **Step 2: Onboarding loading/error**

Create `web/src/app/(dashboard)/content/onboarding/loading.tsx`:
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-1.5 h-3 w-80" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-3 px-6 py-8 lg:px-10">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </>
  );
}
```

Create `web/src/app/(dashboard)/content/onboarding/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function OnboardingError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load onboarding slides" reset={reset} />;
}
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 4: Manually verify**

Run `npm run dev`, throttle network (DevTools → Slow 3G) or trust each skeleton's shape by eye against the loaded page.

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(dashboard)/storefront/loading.tsx" "web/src/app/(dashboard)/storefront/error.tsx" "web/src/app/(dashboard)/content/onboarding/loading.tsx" "web/src/app/(dashboard)/content/onboarding/error.tsx"
git commit -m "feat(admin): add loading/error states to Storefront and Onboarding

Authored against the Card-based Storefront layout and the labeled
Onboarding editor Tasks 2-3 shipped, not the prior layouts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

(Completed during plan-writing, not left for the executor.)

- **Spec coverage:** Storefront and Onboarding are both named under "Wave 3 — Long tail" in the rollout table; both get their scoped work here. The App-copy removal is explicitly flagged as an owner decision outside the spec's own scope, not silently attributed to it.
- **Placeholder scan:** none found — every task gives literal target code or literal git commands for every file it touches or deletes.
- **Type consistency:** `HeroSlide`/`Chip`/`ScentRow` (storefront) and `Slide` (onboarding) are unchanged from before this plan — only the components rendering around them change. The `Chip`-type-vs-`Chip`-component naming collision in `storefront-builder.tsx` is resolved via an import alias, called out explicitly so a reviewer doesn't mistake the aliasing for an odd style choice.
- **Scope:** `storefront/actions.ts` and `content/onboarding/actions.ts` are explicitly confirmed unchanged in the File Structure section. The `app_content` database table itself, and any live customer-facing app code that reads it, are explicitly out of scope for the App-copy removal — only the staff-facing editing UI is removed.
