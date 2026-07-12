# Web Admin Depth Pass — Foundation & Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Borteh admin real loading and error states, bounded queries, and a single source of truth for its card and button chrome — proven end-to-end on the Overview → Orders list → Order detail path.

**Architecture:** Three layers, built bottom-up. A test harness (Vitest for logic and copy, Playwright for pixel-neutrality) so every claim is verified rather than asserted. A data layer that moves aggregation into SQL views and puts `.range()` behind every list. A presentation layer where the existing `<Card>` and `<Skeleton>` components are finally adopted, with the owner-supplied v5 radius and bevel promoted from thirteen copy-pasted strings into two tokens.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Tailwind v4, shadcn/ui on Base UI (`@base-ui/react`), Supabase (`@supabase/supabase-js`), Phosphor icons, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-10-web-admin-redesign-design.md`

## Global Constraints

- **This pass is pixel-neutral for cards and buttons.** The 12px card radius and the button bevel `inset 0 1px 0 rgba(255,255,255,.14), inset 0 -1px 0 rgba(0,0,0,.25), 0 1px 0 rgba(26,26,26,.07)` are owner-supplied "Borteh Admin v5" design. Promote them; never delete them.
- **The code is the source of truth**, not `DESIGN.md` / `PRODUCT.md`. Inter, bronze `#8A5327` as `--brand`, ink `#2E2C29` as `--primary`, control radius `0.375rem`.
- **v5 is light-only.** No theme toggle ships.
- **Migration naming (HARD RULE, root `CLAUDE.md`):** name every migration `supabase/migrations/$(date -u +%Y%m%d%H%M%S)_short_name.sql`. Run `ls supabase/migrations | tail` immediately before creating it and confirm the name sorts last. Never hand-increment. As of writing, the tail is `20260710121959_notification_image.sql`.
- **The owner applies migrations.** Never run `supabase db push`. This sandbox has no database access. Tests must therefore never require a live Supabase.
- **No user-facing string may contain the words "Supabase", "env", or a file path.** Error copy is plain English addressed to a shop owner.
- **Base UI, not Radix:** use the `render` prop, not `asChild`. When a `Button` renders an anchor, set `nativeButton={false}`.
- **Server components** import icons from `@phosphor-icons/react/dist/ssr` and pass `weight="duotone"`.
- **Money is integer SLE minor units.** Never float-math it. Format at the edge with `formatLe` from `@/lib/format`.
- **Order status has exactly seven legal values**, per the `check` constraint at `supabase/migrations/20260616090002_schema.sql:323`, never widened since: `pending_payment`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`, `returned`. The strings `pending`, `cod_pending`, `packing`, `ready`, `dispatched`, and `completed` appear in `web/src/app/(dashboard)/orders/page.tsx` and `page.tsx` but **cannot exist in the database**. Never write a query, view, or filter against them.
- **`payment_method` has exactly two legal values:** `monime`, `cash_on_delivery`. (`pos/actions.ts:41` maps its internal `"cash"` to `cash_on_delivery` before insert.)
- **Card and button chrome are utilities, not arbitrary values:** `rounded-card`, `shadow-card`, `shadow-bevel`. No `rounded-[…]` or `shadow-[…]` may be introduced outside `components/ui/`.

---

### Task 0: Clean the working tree and branch

**Files:**
- Modify: none (git operations only)

**Interfaces:**
- Consumes: nothing
- Produces: a clean `main`, and a branch `web-depth-pass` that every later task commits to

The repo currently has modified and untracked feature work (combos, leaderboard, tips, POS, storefront). A 27-page refactor diff tangled with that is unreviewable.

- [ ] **Step 1: See what is uncommitted**

Run: `git status --short`
Expected: modified files under `mobile/` and `web/`, untracked `mobile/app/combo/`, `web/src/app/(dashboard)/combos/`, and several `supabase/migrations/*.sql`.

- [ ] **Step 2: Commit the in-flight feature work**

Ask the owner to confirm this work is ready to land. Then:

```bash
git add -A
git commit -m "feat: combos, leaderboard, tips, POS walk-in gate

Lands the in-flight work from the combos and leaderboard sessions so the
web admin depth pass starts from a clean tree.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Reconcile migration state before adding any new SQL**

Ask the owner to run, from their own terminal:

```bash
supabase migration list
```

Expected: the six previously-unpushed migrations are visible. Do not proceed to Task 6 until the owner confirms remote state matches local.

- [ ] **Step 4: Branch**

```bash
git checkout -b web-depth-pass
git status --short
```
Expected: clean tree, on branch `web-depth-pass`.

---

### Task 1: Vitest + Testing Library harness

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/src/test/setup.ts`
- Create: `web/src/lib/format.test.ts`
- Modify: `web/package.json` (add `test` script + devDependencies)

**Interfaces:**
- Consumes: nothing
- Produces: `pnpm --dir web test` (or `npm --prefix web test`) runs Vitest in jsdom. Later tasks import `describe`/`it`/`expect` from `vitest` and `render`/`screen` from `@testing-library/react`.

There is currently no test runner and no test file anywhere in `web/`. Nothing later in this plan is verifiable without this.

- [ ] **Step 1: Install the harness**

```bash
cd web
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Write the Vitest config**

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Write the setup file**

Create `web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add the test script**

In `web/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a failing smoke test**

Create `web/src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatLe, formatInt, formatPct } from "@/lib/format";

describe("formatLe", () => {
  it("renders integer minor units as a Leone amount", () => {
    expect(formatLe(245_000)).toBe("Le 2,450");
  });

  it("renders two decimals when asked", () => {
    expect(formatLe(245_050, 2)).toBe("Le 2,450.50");
  });

  it("renders zero without a minus sign", () => {
    expect(formatLe(0)).toBe("Le 0");
  });
});

describe("formatInt", () => {
  it("groups thousands", () => {
    expect(formatInt(1280)).toBe("1,280");
  });
});

describe("formatPct", () => {
  it("renders one decimal", () => {
    expect(formatPct(0.626, 1)).toBe("62.6%");
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm --prefix web test`
Expected: PASS, 5 tests. These assertions were checked against `src/lib/format.ts` when the plan was written; `formatLe(245_050, 2)` is `"Le 2,450.50"`. If any fails, that is a real bug in `format.ts` — report it, do not weaken the test to match.

- [ ] **Step 7: Commit**

```bash
git add web/vitest.config.ts web/src/test/setup.ts web/src/lib/format.test.ts web/package.json web/package-lock.json
git commit -m "test: add vitest + testing-library harness

The web admin had no test runner. Everything in the depth pass is
verified rather than asserted, so the harness lands first.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Playwright visual harness and the v5 baseline

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/src/app/%5F%5Fvisual/page.tsx`
- Create: `web/e2e/visual.spec.ts`
- Modify: `web/package.json` (add `test:visual` script)

**Interfaces:**
- Consumes: nothing
- Produces: `npm --prefix web run test:visual` screenshot-diffs a page rendering every card and button variant. Tasks 3 and 4 must not change these screenshots.

This is the mechanism that enforces pixel-neutrality. The baseline is captured **now**, from the current hand-rolled chrome, *before* any refactor. The refactor's test is that the baseline still matches.

`/__visual` renders no data and needs no database — that is deliberate, because this sandbox cannot reach Supabase.

- [ ] **Step 1: Write the visual harness page**

Create `web/src/app/%5F%5Fvisual/page.tsx`. It reproduces the *current* v5 chrome literally, copied from `app/(dashboard)/page.tsx:39-43` and `app/(dashboard)/orders/page.tsx:96`:

```tsx
import { notFound } from "next/navigation";

// Dev-only visual baseline. Renders v5 chrome with no data so Playwright can
// screenshot-diff it. Task 3 and Task 4 must not change these pixels.
//
// 404s in production: this is a test fixture, not a page the shop owner or
// anyone else should ever be able to reach.
export const dynamic = "force-static";

const card =
  "rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]";
const bevel =
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(26,26,26,0.07)]";

export default function VisualBaselinePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="bg-background p-8">
      <div data-testid="card-default" className={`${card} w-80 p-4`}>
        <p className="text-[13px] font-semibold">Card title</p>
        <p className="mt-1 text-xs text-muted-foreground">Supporting line.</p>
      </div>

      <button
        data-testid="button-primary"
        className={`mt-8 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors ${bevel}`}
      >
        New order
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Write the Playwright config**

Create `web/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/__visual",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  expect: { toHaveScreenshot: { maxDiffPixels: 0 } },
});
```

- [ ] **Step 3: Install the Playwright test runner**

`playwright` is already a devDependency, but the test runner package is separate:

```bash
cd web
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 4: Write the visual spec**

Create `web/e2e/visual.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("card chrome is unchanged", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("card-default")).toHaveScreenshot("card.png");
});

test("primary button bevel is unchanged", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("button-primary")).toHaveScreenshot("button.png");
});
```

- [ ] **Step 5: Add the script**

In `web/package.json` `"scripts"`: `"test:visual": "playwright test"`

- [ ] **Step 6: Capture the baseline**

Run: `npm --prefix web run test:visual -- --update-snapshots`
Expected: two PNGs written under `web/e2e/visual.spec.ts-snapshots/`.

- [ ] **Step 7: Prove the baseline holds**

Run: `npm --prefix web run test:visual`
Expected: PASS, 2 tests. This is the green state Tasks 3 and 4 must preserve.

- [ ] **Step 8: Commit**

```bash
git add web/playwright.config.ts web/e2e web/src/app/__visual web/package.json web/package-lock.json
git commit -m "test: capture v5 card and button pixel baseline

Screenshots the owner-supplied v5 chrome before any refactor touches it.
The token extraction in the next two tasks must leave these unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Promote the v5 card into tokens and `<Card>`

**Files:**
- Modify: `web/src/app/globals.css` (add tokens to `:root` and `@theme inline`)
- Modify: `web/src/components/ui/card.tsx:15` (base classes)
- Modify: `web/src/app/%5F%5Fvisual/page.tsx` (switch to `<Card>`)
- Test: `web/e2e/visual.spec.ts` (unchanged — it is the test)

**Interfaces:**
- Consumes: the pixel baseline from Task 2.
- Produces: `--radius-card` and `--shadow-card` CSS custom properties; a `<Card>` whose default rendering is byte-identical to the v5 hand-rolled string. `Card` keeps its existing props: `React.ComponentProps<"div"> & { size?: "default" | "sm" }`.

`components/ui/card.tsx` currently renders stock shadcn chrome — `rounded-xl`, `ring-1 ring-foreground/10`, and forced `py-(--card-spacing)` padding. The v5 card is `rounded-[12px]`, `border border-border`, `shadow-[0_1px_0_rgba(26,26,26,0.07)]`, and unpadded. **`Card` must be retuned to v5**, not adopted as-is, or the 13 call sites in Phase 3 will all shift.

- [ ] **Step 1: Add the tokens**

Register them in the existing `@theme inline { … }` block in `web/src/app/globals.css`, beside the other `--radius-*` entries. Tailwind v4 turns the `--radius-*` and `--shadow-*` namespaces into `rounded-*` and `shadow-*` utilities, which is what keeps `rounded-[…]` out of the codebase.

Do **not** define these in `:root` and then re-declare them here as `--radius-card: var(--radius-card)` — that is a circular reference and resolves to nothing. The other tokens in this file work because their `:root` name differs from their theme name (`--color-card: var(--card)`).

```css
  /* v5 card chrome — 12px radius and a whisper-thin drop shadow.
     Owner-supplied; deliberately softer than the 0.375rem control radius. */
  --radius-card: 0.75rem;
  --shadow-card: 0 1px 0 rgba(26, 26, 26, 0.07);
```

- [ ] **Step 1b: Confirm the utilities generate**

Run: `npm --prefix web run build`
Expected: compiles. Then `grep -rn "rounded-card\|shadow-card" web/.next/static/css/*.css | head -1` finds the generated rule. If nothing generates, the tokens landed in `:root` instead of `@theme inline`.

- [ ] **Step 2: Run the visual test to confirm it still passes**

Run: `npm --prefix web run test:visual`
Expected: PASS. Adding unused tokens changes nothing.

- [ ] **Step 3: Retune `Card` to the v5 chrome**

In `web/src/components/ui/card.tsx`, replace the `className` argument to `cn(...)` on line 15 with:

```tsx
        "group/card flex flex-col gap-(--card-spacing) rounded-card border border-border bg-card text-sm text-card-foreground shadow-card [--card-spacing:--spacing(4)] data-[size=sm]:[--card-spacing:--spacing(3)]",
```

Note what was dropped and why: `ring-1 ring-foreground/10` (v5 uses a real border), `rounded-xl` (v5 is 12px), `py-(--card-spacing)` (v5 call sites supply their own padding), `overflow-hidden` and the `*:[img:…]` rules (no v5 card contains a bleed image).

- [ ] **Step 4: Point the visual harness at `<Card>`**

The folder is named `%5F%5Fvisual` on disk (literal percent-encoding), NOT `__visual`. This is deliberate and correct: a plain `__visual` folder starts with `_`, which Next.js treats as a private folder excluded from routing, so `/__visual` would 404 and the Playwright baseline could never load. The `%5F` escape forces the route to resolve. **Do not rename it.**

In `web/src/app/%5F%5Fvisual/page.tsx`, delete the `card` string constant and replace the first block:

```tsx
import { Card } from "@/components/ui/card";

// …

      <Card data-testid="card-default" className="w-80 p-4">
        <p className="text-[13px] font-semibold">Card title</p>
        <p className="mt-1 text-xs text-muted-foreground">Supporting line.</p>
      </Card>
```

- [ ] **Step 5: Run the visual test — this is the real assertion**

Run: `npm --prefix web run test:visual`
Expected: PASS, 2 tests, zero pixel difference. If `card.png` differs, `<Card>` is not yet v5. Read the diff image Playwright writes to `web/test-results/`, fix `card.tsx`, and re-run. **Do not update the snapshot.**

- [ ] **Step 6: Commit**

```bash
git add web/src/app/globals.css web/src/components/ui/card.tsx web/src/app/%5F%5Fvisual/page.tsx
git commit -m "refactor(ui): promote v5 card chrome into Card and tokens

Card shipped unused while 13 files hand-rolled rounded-[12px]. Retunes
Card to the v5 chrome and extracts --radius-card / --shadow-card.
Pixel-neutral: the Task 2 screenshot baseline is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Promote the v5 bevel into a `<Button>` variant

**Files:**
- Modify: `web/src/app/globals.css` (add `--shadow-bevel`)
- Modify: `web/src/components/ui/button.tsx:12` (the `default` variant)
- Modify: `web/src/app/%5F%5Fvisual/page.tsx` (switch to `<Button>`)
- Test: `web/e2e/visual.spec.ts` (unchanged)

**Interfaces:**
- Consumes: `--radius-card` pattern from Task 3.
- Produces: `<Button>` with `variant="default"` renders the v5 ink button with its bevel. Call sites that today hand-roll `<Link className="…bg-primary…">` can become `<Button render={<Link href="…" />} nativeButton={false}>`.

The bevel appears literally in five places. `buttonVariants`' `default` variant is `"bg-primary text-primary-foreground hover:bg-primary/80"` — no bevel, and a different hover (`/80` vs the hand-rolled `hover:bg-[#1a1917]`).

- [ ] **Step 1: Add the token**

In `web/src/app/globals.css`, in the `@theme inline` block beside `--shadow-card` (not in `:root` — see Task 3 Step 1):

```css
  /* v5 ink button bevel — a lit top edge, a shaded bottom, a hairline drop. */
  --shadow-bevel: inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -1px 0 rgba(0, 0, 0, 0.25), 0 1px 0 rgba(26, 26, 26, 0.07);
```

- [ ] **Step 2: Apply it to the `default` variant**

In `web/src/components/ui/button.tsx`, replace the `default` variant on line 12:

```ts
        default:
          "bg-primary text-primary-foreground shadow-bevel hover:bg-[#1a1917]",
```

- [ ] **Step 3: Point the visual harness at `<Button>`**

In `web/src/app/%5F%5Fvisual/page.tsx`, delete the `bevel` constant and replace the button:

```tsx
import { Button } from "@/components/ui/button";

// …

      <Button data-testid="button-primary" className="mt-8">
        New order
      </Button>
```

- [ ] **Step 4: Run the visual test**

Run: `npm --prefix web run test:visual`
Expected: PASS, 2 tests, zero pixel difference.

The hand-rolled button was `h-8 … px-3 text-[13px]`; `<Button size="default">` is `h-8 … px-2.5 text-sm`. If `button.png` differs, that padding/size delta is why. Resolve it by matching `<Button>`'s `default` size to v5 (`px-3 text-[13px]`) — the component bends to the design, never the reverse. Re-run. **Do not update the snapshot.**

- [ ] **Step 5: Commit**

```bash
git add web/src/app/globals.css web/src/components/ui/button.tsx web/src/app/%5F%5Fvisual/page.tsx
git commit -m "refactor(ui): promote v5 bevel into the default Button variant

The bevel was inlined at 5 call sites. Now it is --shadow-bevel, applied
once. Pixel-neutral against the Task 2 baseline.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Delete the orphaned dark theme

**Files:**
- Modify: `web/src/app/globals.css` (delete the `.dark` block)
- Modify: `web/src/app/(dashboard)/layout.tsx:7,51` (remove `ThemeToggle`)
- Delete: `web/src/components/theme-toggle.tsx`
- Test: `web/src/app/theme.test.ts` (new)

**Interfaces:**
- Consumes: nothing
- Produces: a single light theme. `ThemeProvider` stays in `app/layout.tsx` (already `defaultTheme="light" enableSystem={false}`) so dark can be reintroduced later as deliberate design work. `next-themes` stays in `package.json`.

The `.dark` block is entirely hue 265–270 — `--primary: oklch(0.62 0.17 270)` is indigo. It is the pre-v5 design, orphaned when v5 landed, and `ThemeToggle` still ships, so the owner can reach the exact look `PRODUCT.md` names as anti-reference #1.

- [ ] **Step 1: Write the failing test**

Create `web/src/app/theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

describe("theme", () => {
  it("ships exactly one theme — no orphaned .dark block", () => {
    expect(css).not.toMatch(/^\.dark\s*\{/m);
  });

  it("has no indigo tokens anywhere", () => {
    // The pre-v5 theme was hue 265-270. v5 is warm paper + bronze.
    expect(css).not.toMatch(/oklch\([^)]*\s2[67]\d(\.\d+)?\s*\)/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix web test -- theme`
Expected: FAIL, both assertions — the `.dark` block exists and contains `oklch(0.62 0.17 270)`.

- [ ] **Step 3: Delete the `.dark` block**

In `web/src/app/globals.css`, delete the entire `.dark { … }` rule.

- [ ] **Step 4: Remove the toggle from the layout**

In `web/src/app/(dashboard)/layout.tsx`, delete the import on line 7 (`import { ThemeToggle } …`) and the `<ThemeToggle />` element on line 51. The header's right-hand cluster keeps only the notifications button:

```tsx
            <div className="ml-auto flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Notifications"
                className="relative"
              >
                <Bell weight="duotone" />
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary ring-2 ring-background" />
              </Button>
            </div>
```

- [ ] **Step 5: Delete the component**

```bash
git rm web/src/components/theme-toggle.tsx
```

- [ ] **Step 6: Run the tests**

Run: `npm --prefix web test -- theme`
Expected: PASS, 2 tests.

Run: `npm --prefix web run lint`
Expected: no unused-import errors in `(dashboard)/layout.tsx`.

- [ ] **Step 7: Commit**

```bash
git add web/src/app/globals.css "web/src/app/(dashboard)/layout.tsx" web/src/app/theme.test.ts
git commit -m "fix(theme): delete the orphaned pre-v5 indigo dark theme

The .dark block was cool-slate + indigo primary, left behind when v5
landed, and ThemeToggle still shipped it. v5 is light-only. Keeps
next-themes so dark can return as real design work.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: SQL views for the Overview and Orders aggregates

**Files:**
- Create: `supabase/migrations/<FRESH_TIMESTAMP>_admin_stat_views.sql`

**Interfaces:**
- Consumes: nothing
- Produces: seven views the query layer reads in Task 7. Every one is inherently bounded — the panel views carry their own `limit`.
  - `admin_overview_stats` — 1 row: `revenue_today_minor bigint`, `revenue_7d_minor bigint`, `revenue_prev_7d_minor bigint`, `orders_7d int`, `orders_prev_7d int`, `pending_count int`, `confirmed_count int`, `out_for_delivery_count int`, `delivered_7d_count int`, `items_sold_7d int`, `low_stock_count int`, `out_of_stock_count int`, `restock_waiting_count int`.
  - `admin_order_stats` — 1 row: `pending_count int`, `confirmed_count int`, `out_for_delivery_count int`, `delivered_7d_count int`, `cancelled_count int`, `cod_to_collect_minor bigint`.
  - `admin_revenue_daily` — 7 rows: `day date`, `revenue_minor bigint`.
  - `admin_top_sellers` — ≤5 rows: `product_name text`, `variant_label text`, `revenue_minor bigint`.
  - `admin_low_stock` — ≤4 rows: `product_name text`, `size_ml int`, `qty_available int`.
  - `admin_restock_demand` — ≤4 rows: `product_name text`, `size_ml int`, `subscriber_count int`.
  - `admin_order_queue` — ≤5 rows: `id uuid`, `order_number text`, `status text`, `total_minor bigint`, `customer_name text`, `placed_at timestamptz`.

`app/(dashboard)/page.tsx:56-59` selects every row of `order`, `order_item`, and `inventory_item` and aggregates in JavaScript. `app/(dashboard)/orders/page.tsx:37-39` selects the whole `order` table to derive six numbers. Both move into SQL.

**The Overview renders more than scalars.** It derives top sellers (`:110-116`), a named low-stock list (`:128-133`), restock demand (`:137-145`), the live queue (`:148`), and a 7-day revenue series (`:100`) from those whole-table selects. `PRODUCT.md` names "see what's selling" as one of the owner's jobs, so **none of these panels may be deleted** — the redesign changes their hierarchy, not their existence. Each gets a bounded view.

**Known behavior change:** `admin_top_sellers` covers the last 7 days only. The current code falls back to all-time when the 7-day window is empty (`:106`). That fallback is dropped; on a quiet week the panel shows its empty state, which the page now has.

- [ ] **Step 1: Confirm the migration name sorts last (HARD RULE)**

```bash
ls supabase/migrations | tail
date -u +%Y%m%d%H%M%S
```
Expected: the printed timestamp sorts after every filename listed. Use that exact value as `<FRESH_TIMESTAMP>`. Do **not** reuse the timestamp written in this plan.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/<FRESH_TIMESTAMP>_admin_stat_views.sql`:

```sql
-- Admin stat views. The Overview and Orders pages previously selected whole
-- tables and aggregated in JavaScript; both now read one bounded row.
--
-- Status vocabulary is the check constraint on public."order".status
-- (20260616090002_schema.sql:323), which is the ONLY source of truth:
--   pending_payment, confirmed, preparing, out_for_delivery,
--   delivered, cancelled, returned
--
-- NOTE: the pages this replaces filtered on 'pending', 'cod_pending',
-- 'packing', 'ready', 'dispatched', and 'completed'. None of those can exist.
-- The Orders "pending" stat has therefore always read 0, and pending_payment
-- orders were counted in no bucket at all. These views fix that.

create or replace view public.admin_overview_stats as
with live as (
  select
    total_minor,
    status,
    coalesce(placed_at, created_at) as at
  from public."order"
  where status not in ('cancelled', 'returned')
)
select
  coalesce(sum(total_minor) filter (
    where at >= date_trunc('day', now())
  ), 0)::bigint as revenue_today_minor,

  coalesce(sum(total_minor) filter (
    where at >= date_trunc('day', now()) - interval '6 days'
  ), 0)::bigint as revenue_7d_minor,

  coalesce(sum(total_minor) filter (
    where at >= date_trunc('day', now()) - interval '13 days'
      and at <  date_trunc('day', now()) - interval '6 days'
  ), 0)::bigint as revenue_prev_7d_minor,

  count(*) filter (
    where at >= date_trunc('day', now()) - interval '6 days'
  )::int as orders_7d,

  count(*) filter (
    where at >= date_trunc('day', now()) - interval '13 days'
      and at <  date_trunc('day', now()) - interval '6 days'
  )::int as orders_prev_7d,

  count(*) filter (where status = 'pending_payment')::int
    as pending_count,
  count(*) filter (where status in ('confirmed', 'preparing'))::int
    as confirmed_count,
  count(*) filter (where status = 'out_for_delivery')::int
    as out_for_delivery_count,
  count(*) filter (
    where status = 'delivered'
      and at >= date_trunc('day', now()) - interval '6 days'
  )::int as delivered_7d_count,

  -- Uncorrelated scalar subqueries; legal beside aggregates.
  (select coalesce(sum(oi.qty), 0)
     from public.order_item oi
     join public."order" o on o.id = oi.order_id
    where o.status not in ('cancelled', 'returned')
      and coalesce(o.placed_at, o.created_at)
          >= date_trunc('day', now()) - interval '6 days')::int as items_sold_7d,

  (select count(*) from public.inventory_item
   where qty_available <= reorder_point)::int as low_stock_count,
  (select count(*) from public.inventory_item
   where qty_available <= 0)::int as out_of_stock_count,
  (select count(*) from public.restock_subscription
   where status = 'active')::int as restock_waiting_count
from live;

alter view public.admin_overview_stats set (security_invoker = on);

-- The 7-day trend line. generate_series guarantees a row per day even with
-- no orders, so the chart never collapses to fewer than 7 points.
create or replace view public.admin_revenue_daily as
select
  d::date as day,
  coalesce(sum(o.total_minor), 0)::bigint as revenue_minor
from generate_series(
       date_trunc('day', now()) - interval '6 days',
       date_trunc('day', now()),
       interval '1 day'
     ) as d
left join public."order" o
  on coalesce(o.placed_at, o.created_at) >= d
 and coalesce(o.placed_at, o.created_at) <  d + interval '1 day'
 and o.status not in ('cancelled', 'returned')
group by d
order by d;

alter view public.admin_revenue_daily set (security_invoker = on);

create or replace view public.admin_top_sellers as
select
  oi.product_name_snapshot            as product_name,
  min(oi.variant_label_snapshot)      as variant_label,
  sum(oi.line_total_minor)::bigint    as revenue_minor
from public.order_item oi
join public."order" o on o.id = oi.order_id
where o.status not in ('cancelled', 'returned')
  and coalesce(o.placed_at, o.created_at)
      >= date_trunc('day', now()) - interval '6 days'
group by oi.product_name_snapshot
order by revenue_minor desc
limit 5;

alter view public.admin_top_sellers set (security_invoker = on);

create or replace view public.admin_low_stock as
select
  p.name           as product_name,
  pv.size_ml,
  ii.qty_available
from public.inventory_item ii
join public.product_variant pv on pv.id = ii.variant_id
join public.product p         on p.id  = pv.product_id
where ii.qty_available <= ii.reorder_point
order by ii.qty_available asc
limit 4;

alter view public.admin_low_stock set (security_invoker = on);

create or replace view public.admin_restock_demand as
select
  p.name          as product_name,
  pv.size_ml,
  count(*)::int   as subscriber_count
from public.restock_subscription rs
join public.product_variant pv on pv.id = rs.variant_id
join public.product p         on p.id  = pv.product_id
where rs.status = 'active'
group by p.name, pv.size_ml
order by subscriber_count desc
limit 4;

alter view public.admin_restock_demand set (security_invoker = on);

-- The live queue: orders still needing the owner's attention.
create or replace view public.admin_order_queue as
select
  o.id,
  o.order_number,
  o.status,
  o.total_minor,
  coalesce(nullif(u.display_name, ''), 'Walk-in') as customer_name,
  coalesce(o.placed_at, o.created_at)             as placed_at
from public."order" o
left join public.app_user u on u.id = o.user_id
where o.status in ('pending_payment', 'confirmed', 'preparing', 'out_for_delivery')
order by coalesce(o.placed_at, o.created_at) desc
limit 5;

alter view public.admin_order_queue set (security_invoker = on);

create or replace view public.admin_order_stats as
select
  count(*) filter (where status = 'pending_payment')::int
    as pending_count,
  count(*) filter (where status in ('confirmed', 'preparing'))::int
    as confirmed_count,
  count(*) filter (where status = 'out_for_delivery')::int
    as out_for_delivery_count,
  count(*) filter (
    where status = 'delivered'
      and coalesce(placed_at, created_at) >= date_trunc('day', now()) - interval '6 days'
  )::int as delivered_7d_count,
  count(*) filter (where status in ('cancelled', 'returned'))::int
    as cancelled_count,
  coalesce(sum(total_minor) filter (
    where payment_method = 'cash_on_delivery'
      and status not in ('delivered', 'cancelled', 'returned')
  ), 0)::bigint as cod_to_collect_minor
from public."order";

alter view public.admin_order_stats set (security_invoker = on);
```

- [ ] **Step 3: Verify every status string in the view is legal**

This sandbox cannot reach Supabase, so check against the constraint instead:

Run: `sed -n '323,325p' supabase/migrations/20260616090002_schema.sql`
Expected: the seven-value `check (status in (…))`. Every string in your view's `filter (where status …)` clauses must appear in it. If you typed `pending` or `completed`, the count silently reads 0 forever — that is the exact bug this migration exists to fix.

Run: `grep -o "status = '[a-z_]*'" supabase/migrations/*_admin_stat_views.sql | sort -u`
Expected: only `pending_payment`, `out_for_delivery`, and `delivered`.

- [ ] **Step 4: Verify column names against the schema**

Run: `grep -n "total_minor\|placed_at\|qty_available\|reorder_point\|payment_method" "web/src/app/(dashboard)/page.tsx" | head`
Expected: every column referenced in the SQL appears here. `"order"` must stay double-quoted — it is a reserved word.

- [ ] **Step 5: Hand off to the owner**

The owner applies migrations from their own terminal. Ask them to run:

```bash
supabase db push
```

If it fails with `duplicate key … schema_migrations_pkey`, rename **your** file to a fresh `date -u +%Y%m%d%H%M%S` and push again. Never renumber a migration that may already be applied.

Ask them to confirm with:

```sql
select * from admin_overview_stats;
select * from admin_order_stats;
```
Expected: exactly one row each. `pending_count` should now be non-zero if any order is awaiting payment — before this change it was structurally always 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "db: admin_overview_stats + admin_order_stats views

Overview selected all of order, order_item, and inventory_item and
aggregated in JS. Both pages now read one bounded row.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Bounded query modules

**Files:**
- Create: `web/src/lib/queries/overview.ts`
- Create: `web/src/lib/queries/orders.ts`
- Create: `web/src/lib/queries/orders.test.ts`

**Interfaces:**
- Consumes: the two views from Task 6.
- Produces:
  - `getOverviewStats(db): Promise<OverviewStats>` where `OverviewStats` mirrors `admin_overview_stats`'s columns.
  - `listOrders(db, { page, pageSize }): Promise<{ rows: OrderRecord[]; total: number }>` — always calls `.range()`.
  - `getOrderStats(db): Promise<OrderStats>` mirroring `admin_order_stats`.
  - `PAGE_SIZE = 50`.
  - `OrderRecord = { id: string; order_number: string | null; status: string; fulfillment_type: string | null; payment_method: string | null; total_minor: number; created_at: string; placed_at: string | null; user_id: string | null }`

Of 111 `.from()` calls under `web/src/app`, four use `.limit()` or `.range()`. This task establishes the pattern the remaining pages adopt in the Phase 3 plan.

Extracting queries into modules is what makes them testable at all: a fake client lets us assert `.range()` was called without a database.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/queries/orders.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { listOrders, PAGE_SIZE } from "@/lib/queries/orders";

/** Minimal fake of the Supabase query builder, recording what was called. */
function fakeDb(rows: unknown[] = [], count = 0) {
  const calls: Record<string, unknown[]> = {};
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "range", "in", "eq"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls[method] = args;
      return builder;
    });
  }
  // Awaiting the builder resolves to the Supabase response shape.
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data: rows, count, error: null });
  return { db: { from: vi.fn(() => builder) }, calls };
}

describe("listOrders", () => {
  it("bounds the query with .range()", async () => {
    const { db, calls } = fakeDb();
    await listOrders(db as never, { page: 0, pageSize: PAGE_SIZE });
    expect(calls.range).toEqual([0, PAGE_SIZE - 1]);
  });

  it("offsets by page", async () => {
    const { db, calls } = fakeDb();
    await listOrders(db as never, { page: 2, pageSize: 50 });
    expect(calls.range).toEqual([100, 149]);
  });

  it("never issues an unbounded select", async () => {
    const { db, calls } = fakeDb();
    await listOrders(db as never, { page: 0, pageSize: 50 });
    expect(calls.range).toBeDefined();
  });

  it("returns the total row count for pagination", async () => {
    const { db } = fakeDb([{ id: "a" }], 3000);
    const result = await listOrders(db as never, { page: 0, pageSize: 50 });
    expect(result.total).toBe(3000);
    expect(result.rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix web test -- orders`
Expected: FAIL — `Cannot find module '@/lib/queries/orders'`.

- [ ] **Step 3: Write the orders query module**

Create `web/src/lib/queries/orders.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE_SIZE = 50;

export type OrderRecord = {
  id: string;
  order_number: string | null;
  status: string;
  fulfillment_type: string | null;
  payment_method: string | null;
  total_minor: number;
  created_at: string;
  placed_at: string | null;
  user_id: string | null;
};

export type OrderStats = {
  pending_count: number;
  confirmed_count: number;
  out_for_delivery_count: number;
  delivered_7d_count: number;
  cancelled_count: number;
  cod_to_collect_minor: number;
};

const COLUMNS =
  "id, order_number, status, fulfillment_type, payment_method, total_minor, created_at, placed_at, user_id";

/** One page of orders, newest first. Always bounded. */
export async function listOrders(
  db: SupabaseClient,
  { page, pageSize = PAGE_SIZE }: { page: number; pageSize?: number },
): Promise<{ rows: OrderRecord[]; total: number }> {
  const from = page * pageSize;
  const { data, count, error } = await db
    .from("order")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { rows: (data ?? []) as OrderRecord[], total: count ?? 0 };
}

/** The six numbers in the Orders summary strip, computed in SQL. */
export async function getOrderStats(db: SupabaseClient): Promise<OrderStats> {
  const { data, error } = await db.from("admin_order_stats").select("*").single();
  if (error) throw error;
  return data as OrderStats;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm --prefix web test -- orders`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the overview query module**

Create `web/src/lib/queries/overview.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type OverviewStats = {
  revenue_today_minor: number;
  revenue_7d_minor: number;
  revenue_prev_7d_minor: number;
  orders_7d: number;
  orders_prev_7d: number;
  pending_count: number;
  confirmed_count: number;
  out_for_delivery_count: number;
  delivered_7d_count: number;
  items_sold_7d: number;
  low_stock_count: number;
  out_of_stock_count: number;
  restock_waiting_count: number;
};

export type RevenueDay = { day: string; revenue_minor: number };
export type TopSeller = { product_name: string; variant_label: string; revenue_minor: number };
export type LowStockRow = { product_name: string; size_ml: number; qty_available: number };
export type RestockRow = { product_name: string; size_ml: number; subscriber_count: number };
export type QueueRow = {
  id: string;
  order_number: string | null;
  status: string;
  total_minor: number;
  customer_name: string;
  placed_at: string;
};

export type OverviewPanels = {
  revenueDaily: RevenueDay[];
  topSellers: TopSeller[];
  lowStock: LowStockRow[];
  restockDemand: RestockRow[];
  queue: QueueRow[];
};

/** One bounded row. Replaces three whole-table selects. */
export async function getOverviewStats(
  db: SupabaseClient,
): Promise<OverviewStats> {
  const { data, error } = await db
    .from("admin_overview_stats")
    .select("*")
    .single();
  if (error) throw error;
  return data as OverviewStats;
}

/**
 * The Overview's five panels. Every view carries its own LIMIT, so none of
 * these can grow with the shop's history.
 */
export async function getOverviewPanels(
  db: SupabaseClient,
): Promise<OverviewPanels> {
  const [daily, top, low, restock, queue] = await Promise.all([
    db.from("admin_revenue_daily").select("*"),
    db.from("admin_top_sellers").select("*"),
    db.from("admin_low_stock").select("*"),
    db.from("admin_restock_demand").select("*"),
    db.from("admin_order_queue").select("*"),
  ]);

  for (const r of [daily, top, low, restock, queue]) {
    if (r.error) throw r.error;
  }

  return {
    revenueDaily: (daily.data ?? []) as RevenueDay[],
    topSellers: (top.data ?? []) as TopSeller[],
    lowStock: (low.data ?? []) as LowStockRow[],
    restockDemand: (restock.data ?? []) as RestockRow[],
    queue: (queue.data ?? []) as QueueRow[],
  };
}
```

- [ ] **Step 6: Typecheck**

Run: `npm --prefix web run build`
Expected: compiles. (The pages do not import these yet; this proves the types.)

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/queries
git commit -m "feat(queries): bounded order + overview query modules

listOrders always calls .range(); stats come from the SQL views. Tested
with a fake client, so no database is needed to prove the bound.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Shared loading and error primitives

**Files:**
- Create: `web/src/components/admin/page-error.tsx`
- Create: `web/src/components/admin/page-error.test.tsx`
- Create: `web/src/components/admin/table-skeleton.tsx`

**Interfaces:**
- Consumes: `Skeleton` from `@/components/ui/skeleton`, `Button` from `@/components/ui/button`.
- Produces:
  - `<PageError title?: string; reset: () => void />` — a client component. Renders plain-English copy and a "Try again" button wired to `reset`.
  - `<TableSkeleton rows?: number; columns: number />` — server-safe, renders `Skeleton` bars sized like a table row.

There is no `error.tsx` anywhere in `web/src/app`. When the orders query fails today, `orders/page.tsx:88` tells the shop owner to *"check the Supabase keys in web/.env.local."*

- [ ] **Step 1: Write the failing test**

Create `web/src/components/admin/page-error.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageError } from "@/components/admin/page-error";

describe("PageError", () => {
  it("speaks plain English to a shop owner", () => {
    render(<PageError reset={() => {}} />);
    expect(screen.getByRole("heading")).toHaveTextContent(/couldn't load/i);
  });

  it("never leaks developer detail to the owner", () => {
    const { container } = render(<PageError reset={() => {}} />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/supabase/i);
    expect(text).not.toMatch(/env|\.local/i);
    expect(text).not.toMatch(/error:|stack|undefined/i);
  });

  it("offers a retry that calls reset", async () => {
    const reset = vi.fn();
    render(<PageError reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix web test -- page-error`
Expected: FAIL — `Cannot find module '@/components/admin/page-error'`.

- [ ] **Step 3: Write the component**

Create `web/src/components/admin/page-error.tsx`:

```tsx
"use client";

import { WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

/**
 * The error state every route segment shows. Addressed to the shop owner:
 * no stack traces, no file paths, no vendor names.
 */
export function PageError({
  title = "Couldn't load this page",
  reset,
}: {
  title?: string;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5 text-center">
      <WarningCircle weight="duotone" className="size-8 text-muted-foreground" />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        Check your internet connection and try again. If it keeps happening,
        the shop&apos;s data service may be down for a moment.
      </p>
      <Button onClick={reset} className="mt-1">
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npm --prefix web test -- page-error`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the table skeleton**

Create `web/src/components/admin/table-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

/** A loading placeholder shaped like the table it replaces — not a spinner. */
export function TableSkeleton({
  rows = 8,
  columns,
}: {
  rows?: number;
  columns: number;
}) {
  return (
    <div data-testid="table-skeleton" className="rounded-card border border-border bg-card">
      <div className="flex h-9 items-center gap-4 border-b border-border px-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-9 items-center gap-4 border-t border-accent px-3 first:border-t-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `npm --prefix web run build`
Expected: compiles.

```bash
git add web/src/components/admin/page-error.tsx web/src/components/admin/page-error.test.tsx web/src/components/admin/table-skeleton.tsx
git commit -m "feat(ui): PageError and TableSkeleton primitives

The admin had no error or loading state anywhere. PageError is tested to
never leak 'Supabase', a file path, or a stack trace to the shop owner.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Orders list — pagination, SQL stats, dead link removed

**Files:**
- Modify: `web/src/app/(dashboard)/orders/page.tsx`
- Create: `web/src/app/(dashboard)/orders/loading.tsx`
- Create: `web/src/app/(dashboard)/orders/error.tsx`
- Modify: `web/src/components/admin/orders-table.tsx` (accept `page`/`total`)

**Interfaces:**
- Consumes: `listOrders`, `getOrderStats`, `PAGE_SIZE` from `@/lib/queries/orders`; `PageError`, `TableSkeleton`; `Button`.
- Produces: `/orders?page=N` renders one bounded page. `OrdersTable` gains props `page: number` and `total: number` and renders pager controls.

Three defects land together here because they live in the same file: the unbounded select (`:37-39`), the six JS-computed summary stats (`:76-92`), the developer-facing error subtitle (`:88`), and the dead `/orders/new` link (`:96`). `app/(dashboard)/orders/` contains only `page.tsx`, `[id]/page.tsx`, and `actions.ts` — there is no `new` route. POS already records counter sales, so the button is removed rather than built.

- [ ] **Step 1: Write the loading state**

Create `web/src/app/(dashboard)/orders/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function OrdersLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <TableSkeleton columns={8} rows={10} />
    </div>
  );
}
```

- [ ] **Step 2: Write the error state**

Create `web/src/app/(dashboard)/orders/error.tsx`:

```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function OrdersError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load orders" reset={reset} />;
}
```

- [ ] **Step 3: Rewrite the page to use the bounded query**

Replace `web/src/app/(dashboard)/orders/page.tsx` entirely:

```tsx
import { createServerClient } from "@/lib/supabase/server";
import { humanize, statusTone } from "@/components/admin/chip";
import { formatInt, formatLe } from "@/lib/format";
import { ExportButton } from "@/components/admin/export-button";
import { listOrders, getOrderStats, PAGE_SIZE } from "@/lib/queries/orders";
import { OrdersTable, type OrderRow, type SummaryStat } from "@/components/admin/orders-table";

export const dynamic = "force-dynamic";

function paymentLabel(method: string): string {
  switch (method) {
    case "cash_on_delivery": return "COD";
    case "cash": return "Cash";
    case "monime": return "Monime";
    case "card": return "Card";
    default: return method ? humanize(method) : "—";
  }
}

function fmtPlaced(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const db = createServerClient();
  const page = Math.max(0, Number((await searchParams).page ?? "0") || 0);

  // Both throw on failure; error.tsx catches and shows plain-English copy.
  const [{ rows, total }, stats] = await Promise.all([
    listOrders(db, { page, pageSize: PAGE_SIZE }),
    getOrderStats(db),
  ]);

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
  const customers = new Map<string, { name: string; phone: string }>();
  if (userIds.length > 0) {
    const { data: users } = await db.from("app_user").select("id, display_name, phone").in("id", userIds);
    for (const u of (users ?? []) as Array<{ id: string; display_name: string | null; phone: string | null }>) {
      customers.set(u.id, { name: u.display_name ?? "", phone: u.phone ?? "" });
    }
  }

  const orders: OrderRow[] = rows.map((r) => {
    const cust = customers.get(r.user_id ?? "");
    return {
      id: r.id,
      number: r.order_number ?? "",
      placed: fmtPlaced(r.placed_at ?? r.created_at),
      customer: cust?.name || "Walk-in",
      phone: cust?.phone || "—",
      channel: humanize(r.fulfillment_type ?? ""),
      payment: paymentLabel(r.payment_method ?? ""),
      status: r.status,
      statusLabel: humanize(r.status),
      statusTone: statusTone(r.status),
      minor: r.total_minor,
    };
  });

  const summary: SummaryStat[] = [
    { n: formatInt(stats.pending_count), label: "pending", tone: "text-warning" },
    { n: formatInt(stats.confirmed_count), label: "confirmed", tone: "text-info" },
    { n: formatInt(stats.out_for_delivery_count), label: "out for delivery", tone: "text-info" },
    { n: formatInt(stats.delivered_7d_count), label: "delivered · 7d", tone: "text-success" },
    { n: formatInt(stats.cancelled_count), label: "cancelled", tone: "text-destructive" },
    { n: formatLe(stats.cod_to_collect_minor), label: "COD to collect", tone: "text-foreground" },
  ];

  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <h1 className="text-xl font-[650] tracking-[-0.2px]">Orders</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every online and counter order, newest first.
          </p>
        </div>
        <ExportButton
          label="Export this page"
          filename="borteh-orders.csv"
          headers={["Order", "Placed", "Customer", "Phone", "Channel", "Payment", "Status", "Total (Le)"]}
          rows={orders.map((o) => [`#${o.number}`, o.placed, o.customer, o.phone, o.channel, o.payment, o.statusLabel, formatLe(o.minor, 2)])}
        />
      </div>

      <OrdersTable orders={orders} summary={summary} page={page} total={total} />
    </div>
  );
}
```

Note what left: the `Plus` import, the `Link` import, the `/orders/new` button, the five status `Set`s, the `error` variable and its subtitle, and the whole JS summary computation.

`ExportButton` now exports the visible page only, so **it must be relabelled "Export this page"** — the owner decided against a silent regression. If `ExportButton` has no `label` prop, add one defaulting to `"Export"`, and pass the new label from here. A server-action full export is tracked as Phase 3 work.

Deleting those five `Set`s is what fixes the phantom-status bug. `PENDING` was `{"pending", "cod_pending"}`, and neither value is legal under the `order.status` check constraint, so the "pending" stat read `0` no matter how many orders awaited payment. `stats.pending_count` now counts `pending_payment`, which is the real status. **Expect this number to jump from 0 to a true count** — that is the fix landing, not a regression.

- [ ] **Step 4: Add pager controls to the table**

In `web/src/components/admin/orders-table.tsx`, extend the props type with `page: number; total: number;` and render below the table body:

```tsx
      {total > orders.length && (
        <nav
          aria-label="Orders pagination"
          className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground"
        >
          <span className="nums">
            {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + orders.length} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              disabled={page === 0}
              render={<a href={`/orders?page=${page - 1}`} />}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              disabled={(page + 1) * PAGE_SIZE >= total}
              render={<a href={`/orders?page=${page + 1}`} />}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
```

Import `Button` from `@/components/ui/button` and `PAGE_SIZE` from `@/lib/queries/orders` — never hardcode the page size in two places. `orders.ts` imports `SupabaseClient` as `import type`, so a client component pulling `PAGE_SIZE` from it adds nothing to the bundle. Base UI needs `nativeButton={false}` when a `Button` renders an anchor.

- [ ] **Step 5: Verify the dead route is really gone**

Run: `grep -rn "orders/new" web/src`
Expected: no matches.

- [ ] **Step 6: Verify no unbounded select remains on this page**

Run: `grep -n "from(\"order\")" "web/src/app/(dashboard)/orders/page.tsx"`
Expected: no matches — the page goes through `listOrders`.

- [ ] **Step 7: Build and run the full suite**

Run: `npm --prefix web run build && npm --prefix web test && npm --prefix web run lint`
Expected: compiles; all tests pass; no lint errors.

- [ ] **Step 8: Commit**

```bash
git add "web/src/app/(dashboard)/orders" web/src/components/admin/orders-table.tsx
git commit -m "feat(orders): paginate, move stats to SQL, add loading + error

Replaces a whole-table select with .range(), the six JS-computed summary
stats with admin_order_stats, and 'check the Supabase keys in
web/.env.local' with a plain-English retry. Removes the New order button,
which linked to a route that does not exist.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Overview — one bounded row, one headline number

**Files:**
- Modify: `web/src/app/(dashboard)/page.tsx`
- Create: `web/src/app/(dashboard)/loading.tsx`
- Create: `web/src/app/(dashboard)/error.tsx`

**Interfaces:**
- Consumes: `getOverviewStats` and `getOverviewPanels` from `@/lib/queries/overview`; `Card`, `PageError`, `Skeleton`.
- Produces: the Overview reads one scalar row plus five bounded panel views. No whole-table select remains.

`app/(dashboard)/page.tsx:56-59` currently selects every row of three tables. Hierarchy today is a flat grid of **six co-equal stat cards** (`:169-176`); `PRODUCT.md` names "the hero-metric template: a wall of big-number stat cards" as an anti-reference. Today's revenue becomes the single headline; the rest supports it.

**Preserve every panel.** Top sellers, low stock, restock demand, and the live queue all stay — they move down the page, they do not disappear. The six stat cards collapse into the headline plus inline supporting text.

- [ ] **Step 1: Write the loading and error states**

Create `web/src/app/(dashboard)/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-4 h-12 w-48" />
      <Skeleton className="mt-2 h-3 w-40" />
      <Skeleton className="mt-6 h-48 w-full rounded-card" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    </div>
  );
}
```

Create `web/src/app/(dashboard)/error.tsx`:

```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function OverviewError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load your overview" reset={reset} />;
}
```

- [ ] **Step 2: Rewrite the data fetch**

In `web/src/app/(dashboard)/page.tsx`, delete the four-query `Promise.all` (lines 56-59), the `app_user` name lookup, and **every derivation from `orders`, `items`, `inv`, and `restock`** — lines 81-151, i.e. `live`, `last7`, `prev7`, `revenue7d`, `items7`, `itemBase`, `itemsSold`, `perOrder`, `byProduct`, `topSellers`, `topMax`, `delivered7`, `deliveredRate`, `invByVariant`, `labelFor`, `lowRows`, `lowStock`, `outCount`, `restockByVariant`, `restockRows`, `waiting`, `queue`, `queueTotal`. The SQL views replace all of it.

```tsx
import { getOverviewStats, getOverviewPanels } from "@/lib/queries/overview";

// …

  const db = createServerClient();
  const [stats, panels] = await Promise.all([
    getOverviewStats(db),
    getOverviewPanels(db),
  ]);

  const ratio = (now: number, prev: number) => (prev === 0 ? 0 : (now - prev) / prev);

  const revenueDelta = ratio(stats.revenue_7d_minor, stats.revenue_prev_7d_minor);
  const deliveredRate =
    stats.orders_7d === 0 ? 0 : stats.delivered_7d_count / stats.orders_7d;
  const perOrder = stats.orders_7d === 0 ? 0 : stats.items_sold_7d / stats.orders_7d;
  const topMax = Math.max(...panels.topSellers.map((t) => t.revenue_minor), 1);
```

`panels.queue` already carries `customer_name`, so the separate `app_user` lookup and the `nameOf` helper both go away.

`RevenueChart` currently takes the `revenue7d` number array and `dayLabels`. Feed it from `panels.revenueDaily`:

```tsx
  const revenue7d = panels.revenueDaily.map((d) => d.revenue_minor);
  const dayLabels = panels.revenueDaily.map((d) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(d.day)),
  );
```

- [ ] **Step 3: Give the page a hierarchy**

The headline is today's revenue, at display size, with the 7-day delta beneath. Then the trend chart. Then two supporting panels — the order queue and low stock — as `<Card>`s, no longer co-equal stat tiles.

```tsx
      <header className="py-2 pb-6">
        <h1 className="text-xl font-[650] tracking-[-0.2px]">Overview</h1>
        <p className="mt-4 nums text-[2.75rem] leading-none font-semibold tracking-[-0.02em]">
          {formatLe(stats.revenue_today_minor)}
        </p>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>taken today</span>
          <Delta ratio={revenueDelta} />
          <span>vs the previous 7 days</span>
        </p>
      </header>
```

Keep the existing `Delta` component (`page.tsx:26-36`) and `RevenueChart` exactly as they are.

- [ ] **Step 4: Replace the hand-rolled card constant**

Delete `const card = "rounded-[12px] …"` (line 39) and its `cardHead` / `cardTitle` / `cardLink` siblings where they only carry chrome. Wrap each panel in `<Card className="p-4">` from `@/components/ui/card`.

- [ ] **Step 5: Verify the whole-table selects are gone**

Run: `grep -n 'from("order_item")\|from("inventory_item")\|from("restock_subscription")' "web/src/app/(dashboard)/page.tsx"`
Expected: no matches.

Run: `grep -rn "rounded-\[12px\]" "web/src/app/(dashboard)/page.tsx"`
Expected: no matches.

- [ ] **Step 6: Build, test, lint**

Run: `npm --prefix web run build && npm --prefix web test && npm --prefix web run lint`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add "web/src/app/(dashboard)/page.tsx" "web/src/app/(dashboard)/loading.tsx" "web/src/app/(dashboard)/error.tsx"
git commit -m "feat(overview): one bounded row, one headline number

Replaces three whole-table selects with admin_overview_stats. Today's
revenue leads; the queue and low-stock support it, rather than five
co-equal stat cards (PRODUCT.md anti-reference).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Order detail — header with key facts and one primary action

**Files:**
- Modify: `web/src/app/(dashboard)/orders/[id]/page.tsx`
- Create: `web/src/app/(dashboard)/orders/[id]/loading.tsx`
- Create: `web/src/app/(dashboard)/orders/[id]/error.tsx`

**Interfaces:**
- Consumes: `PageError`, `Card`, `Chip`/`statusTone`/`humanize` from `@/components/admin/chip`, and the existing `OrderStatusActions` from `@/components/admin/order-status-actions`, whose signature is `({ id, status }: { id: string; status: OrderStatus })` — note `id`, **not** `orderId`. `OrderStatus` is exported from `@/app/(dashboard)/orders/actions`.
- Produces: the detail-view archetype that Phase 3 applies to `products/[id]`, `customers/[id]`, `brands/[slug]`, `collections/[slug]`, and `combos/[id]`.

- [ ] **Step 1: Read the current page before changing it**

Run: `cat "web/src/app/(dashboard)/orders/[id]/page.tsx"`

Note its existing sections, the shape of its queries, and how `OrderStatusActions` is invoked. Preserve all behavior; this task changes layout and adds states, nothing else.

- [ ] **Step 2: Write the error state**

Create `web/src/app/(dashboard)/orders/[id]/error.tsx`:

```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function OrderDetailError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this order" reset={reset} />;
}
```

- [ ] **Step 3: Write the loading state**

Create `web/src/app/(dashboard)/orders/[id]/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-start justify-between py-2 pb-6">
        <div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}
```

- [ ] **Step 4: Restructure the header**

The header carries the order number, the status chip, the customer, the placed-at time, and the total — then the single primary action (advance status) right-aligned. Everything else moves into `<Card>` sections below.

```tsx
      <header className="flex items-start justify-between py-2 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-[650] tracking-[-0.2px]">#{order.order_number}</h1>
            <Chip tone={statusTone(order.status)}>{humanize(order.status)}</Chip>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {customerName} · {fmtPlaced(order.placed_at ?? order.created_at)} ·{" "}
            <span className="nums">{formatLe(order.total_minor)}</span>
          </p>
        </div>
        <OrderStatusActions id={order.id} status={order.status as OrderStatus} />
      </header>
```

Import `OrderStatus` as a type from `@/app/(dashboard)/orders/actions`. `OrderStatusActions` advances `pending_payment → confirmed → preparing → out_for_delivery → delivered` and renders nothing for the terminal states, so the header needs no fallback action.

- [ ] **Step 5: Adopt `<Card>` for the body sections**

Replace any hand-rolled `rounded-[12px] border …` wrapper on this page with `<Card className="p-4">`.

Run: `grep -n "rounded-\[" "web/src/app/(dashboard)/orders/[id]/page.tsx"`
Expected: no matches.

- [ ] **Step 6: Build, test, lint**

Run: `npm --prefix web run build && npm --prefix web test && npm --prefix web run lint`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add "web/src/app/(dashboard)/orders/[id]"
git commit -m "feat(order detail): key-facts header, Card sections, loading + error

Establishes the detail-view archetype for the Phase 3 extension.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Correct the design documentation

**Files:**
- Modify: `web/DESIGN.md`
- Modify: `web/PRODUCT.md:21` and `:38`

**Interfaces:**
- Consumes: the decisions made in Tasks 3–5.
- Produces: docs that describe the code. This is what stops the next session re-diverging.

`DESIGN.md` claims Hanken Grotesk + Bricolage Grotesque and a `0.5rem` radius; `app/layout.tsx:7` loads Inter and `globals.css:79` says `0.375rem`. `PRODUCT.md:21` claims "a considered rose-and-gold palette"; `globals.css:81` is warm paper + bronze.

- [ ] **Step 1: Fix the typography section of `DESIGN.md`**

Replace the Typography section with:

```markdown
## Typography

**Inter** for all UI — headings, labels, buttons, body (`--font-sans`, and
`.font-display` maps to it too; there is no separate display face).
**JetBrains Mono** for data — money, stock, counts, KPIs — via `.nums` with
tabular figures, so numerals align in columns.

Scale: fixed rem, ratio ≈1.2, no clamp. Weights 400/500/600. Headings
tracking ≈ -0.01em.
```

- [ ] **Step 2: Fix the spacing/layout section**

In the Spacing & Layout section, replace the radius sentence with:

```markdown
- Base unit 4px. Control radius `--radius` is `0.375rem`; **cards use
  `--radius-card` (0.75rem / 12px)** — the v5 card is deliberately softer than
  its controls. The v5 ink button carries `--shadow-bevel`.
```

- [ ] **Step 3: Fix the theme section**

Replace the "Default mode" line with:

```markdown
- **Mode:** light only. v5 was designed for a bright back office; the old dark
  theme was removed rather than left to rot. `next-themes` remains installed
  so dark can return as deliberate design work.
```

- [ ] **Step 4: Fix `PRODUCT.md`**

Line 21: replace "a considered rose-and-gold palette" with "a warm paper palette with a single bronze accent".
Line 38: replace "One restrained rose accent and a gold grace note carry the brand" with "Warm paper surfaces and a single bronze accent carry the brand".

- [ ] **Step 5: Verify no stale claim survives**

Run: `grep -rni "hanken\|bricolage\|rose\|0.5rem" web/DESIGN.md web/PRODUCT.md`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add web/DESIGN.md web/PRODUCT.md
git commit -m "docs: correct DESIGN.md and PRODUCT.md to describe the code

Docs claimed Hanken + Bricolage and a rose-and-gold palette; the code has
shipped Inter and bronze since v5. Code is the source of truth.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase gate

Stop here. The slice is Overview → Orders list → Order detail, and it must be reviewed before the remaining 24 pages adopt the system.

Before requesting review, verify against the spec's acceptance criteria — by exercising the app, not by reading the diff:

- [ ] `npm --prefix web test` — all green.
- [ ] `npm --prefix web run test:visual` — zero pixel diff. Cards are still 12px; buttons still carry the bevel.
- [ ] `npm --prefix web run build && npm --prefix web run lint` — clean.
- [ ] Start `npm --prefix web run dev`, throttle the network in devtools, and load `/` and `/orders`. A skeleton shaped like the page appears — not a spinner, not a frozen screen.
- [ ] Break `NEXT_PUBLIC_SUPABASE_URL` in `web/.env.local`, reload `/` and `/orders`. Both show "Couldn't load…" with a working **Try again**. Neither shows a stack trace, a blank screen, the word "Supabase", or a file path. **Restore the variable afterwards.**
- [ ] `grep -rn "orders/new" web/src` — no matches.
- [ ] Tab through `/orders`: every interactive element shows a visible focus ring, including the new pager.
- [ ] Ask the owner to seed ~3,000 orders on a non-production project and confirm `/` and `/orders` both still load promptly.

Then invoke `superpowers:requesting-code-review`.

**Not in this plan.** Phase 3 (the remaining 24 pages), Phase 4 (contrast and focus audit across the whole app), full-table CSV export, and any `<Card>` adoption outside the slice. Those follow in a second plan once the slice is approved.
