# Admin Redesign — Wave 0 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin's design tokens to match the mobile app's bronze/paper/serif/square identity, build the 7 shared components every later page will consume, and prove the whole system live on the Dashboard (Overview) and Orders list pages.

**Architecture:** Token changes live entirely in `globals.css` + root `layout.tsx` (font loading) — no component code depends on their literal values, only on class names that already exist, so this is a safe foundation layer. Shared components go in `web/src/components/admin/` (existing convention) and `web/src/components/ui/chart.tsx` (shadcn-generated). Two pages (`(dashboard)/page.tsx`, `(dashboard)/orders/page.tsx`) migrate onto the new system to prove it before Wave 1 touches anything else.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Tailwind v4 (`@theme inline`), shadcn/ui, Vitest + Testing Library (`npm test`), Playwright visual regression (`npm run test:visual`).

**Spec:** `docs/superpowers/specs/2026-09-02-admin-redesign-design.md` (supersedes `docs/superpowers/specs/2026-07-10-web-admin-redesign-design.md` for visual direction; this plan implements only the "Wave 0 — Foundation" section of the rollout).

## Global Constraints

- Every new/modified file lives under `web/` — this plan never touches `mobile/` or `supabase/`.
- No new Supabase migrations in this wave — `admin_overview_stats` (via `getOverviewStats`) already returns every count this wave needs (`pending_count`, `low_stock_count`, `out_of_stock_count`, `out_for_delivery_count`).
- Radius collapses to `0` everywhere except avatars, status dots, and pills (unchanged: `rounded-full` usages, `Avatar`, `SidebarMenuBadge`'s pill shape).
- `--shadow-card` / `--shadow-bevel` are NOT removed — they're intentional v5 depth cues (protected by the July spec, unaffected by this pass).
- `--destructive` / `--success` / `--warning` / `--info` (and their `-soft` pairs) are NOT changed in light mode — they're an already-accessible two-tier status system, distinct from the neutral/brand palette this wave aligns to mobile.
- Every new component is a named export from its own file under `web/src/components/admin/`, kebab-case filename matching the existing convention (`page-header.tsx`, `chip.tsx`, etc.).
- Run `npx tsc --noEmit` (from `web/`) after every task — must be clean before moving to the next task.

---

## File Structure

New files this plan creates:
- `web/src/components/admin/empty-state.tsx` — "nothing here yet" component
- `web/src/components/admin/stat-card.tsx` — single big-number stat display
- `web/src/components/admin/data-table.tsx` — shared table chrome (card wrapper, summary strip, search/filter slot, shadcn `Table`, empty state, pagination)
- `web/src/components/admin/form-section.tsx` — labeled fieldset wrapper
- `web/src/components/admin/form-field.tsx` — label + helper + inline error wrapper around one input
- `web/src/components/ui/chart.tsx` — shadcn-generated Recharts wrapper (via CLI, not hand-written)
- Vitest test files colocated with each new component (`*.test.tsx`)

Modified files:
- `web/src/app/globals.css` — tokens, radius, dark mode, serif font binding
- `web/src/app/layout.tsx` — add Instrument Serif font loading
- `web/src/app/%5F%5Fvisual/page.tsx` + `web/e2e/visual.spec.ts` — extend the existing visual-regression fixture for the new tokens
- `web/src/components/admin/page-header.tsx` — serif heading
- `web/src/components/admin/revenue-chart.tsx` — rewritten on shadcn chart primitives
- `web/src/components/admin/orders-table.tsx` — refactored onto `DataTable`
- `web/src/lib/nav.ts` — remove hardcoded badge numbers
- `web/src/app/(dashboard)/layout.tsx` — remove notification bell, compute + pass live badge counts
- `web/src/components/app-sidebar.tsx` — consume live badge counts
- `web/src/app/(dashboard)/page.tsx` — migrate to `PageHeader` + `StatCard` + new chart, kill hardcoded hex
- `web/src/app/(dashboard)/orders/page.tsx` — migrate to `PageHeader`

Explicitly NOT touched this wave (Wave 1+): `orders/[id]`, `products/*`, `inventory`, `dispatch`, `pos`, `customers/*`, `collections/*`, `combos/*`, `brands/*`, `storefront`, `content/*`, `analytics`, `settings/*`.

---

### Task 1: Design tokens — bronze/paper/ink alignment, square radius, rebuilt dark mode

**Files:**
- Modify: `web/src/app/globals.css`
- Modify: `web/src/app/layout.tsx`
- Modify: `web/src/app/%5F%5Fvisual/page.tsx`
- Modify: `web/e2e/visual.spec.ts`

**Interfaces:**
- Produces: the CSS custom properties `--background`, `--foreground`, `--card`, `--border`, `--primary`, `--brand`, `--radius`, `--radius-card`, and a new `--font-serif` variable — every later task and every migrated page reads these by name, never by literal value.

- [ ] **Step 1: Update the light `:root` tokens in `globals.css`**

Replace the `:root` block (currently `web/src/app/globals.css:87-147`) with mobile-aligned values. `--brand`/`--ring` are already the exact same hex as mobile's accent, so they don't change. Status colors (`--destructive`/`--success`/`--warning`/`--info` and their `-soft` pairs) are untouched — only neutrals, primary, brand-foreground, radius, and chart/sidebar neutrals move:

```css
:root {
  --radius: 0;

  /* Borteh Admin v6 — aligned to the mobile app's Maison palette (paper/ink/bronze) */
  --background: #fcfbf9;
  --foreground: #221e19;
  --card: #fcfbf9;
  --card-foreground: #221e19;
  --popover: #fcfbf9;
  --popover-foreground: #221e19;
  --secondary: #edece9;
  --secondary-foreground: #221e19;
  --muted: #edece9;
  --muted-foreground: #6f675c;
  --accent: #f3eadd;
  --accent-foreground: #221e19;
  --border: #e6e3dd;
  --input: #e6e3dd;

  /* Primary — dark ink (buttons/actions). Bronze is the brand accent. */
  --primary: #221e19;
  --primary-foreground: #fcfbf9;
  --brand: #8a5327;
  --brand-foreground: #fcfbf9;
  --ring: #8a5327;

  /* Semantic — unchanged from v5, already accessible, not part of this pass */
  --destructive: #8e0b21;
  --destructive-foreground: #ffffff;
  --destructive-soft: #fee8eb;
  --destructive-soft-foreground: #8e0b21;
  --success: #014b40;
  --success-foreground: #ffffff;
  --success-soft: #cdfed4;
  --success-soft-foreground: #014b40;
  --warning: #5e4200;
  --warning-foreground: #ffffff;
  --warning-soft: #fff1e3;
  --warning-soft-foreground: #5e4200;
  --info: #00527c;
  --info-foreground: #ffffff;
  --info-soft: #eaf4ff;
  --info-soft-foreground: #00527c;

  /* Charts — bronze lead, warm neutral + status support (rewritten fully in Task 6) */
  --chart-1: #8a5327;
  --chart-2: #6f675c;
  --chart-3: #00527c;
  --chart-4: #014b40;
  --chart-5: #a39a8d;

  /* Sidebar — light paper rail with bronze accents */
  --sidebar: #edece9;
  --sidebar-foreground: #6f675c;
  --sidebar-primary: #8a5327;
  --sidebar-primary-foreground: #fcfbf9;
  --sidebar-accent: #fcfbf9;
  --sidebar-accent-foreground: #221e19;
  --sidebar-border: #e6e3dd;
  --sidebar-ring: #8a5327;
}
```

- [ ] **Step 2: Rebuild `.dark` on mobile's dark palette instead of deleting it**

Replace the entire `.dark { ... }` block (currently `globals.css:149-200`) with warm dark values derived from `mobile/lib/theme.ts`'s `darkColors`. Mobile has no `info` status color and flat (non-soft) functional colors, so `-soft`/`info` variants below extend mobile's pattern consistently (brightened solid + dark-tinted soft, same relationship the light theme already uses) rather than being invented from nothing:

```css
.dark {
  --background: #16130f;
  --foreground: #f2ede4;
  --card: #16130f;
  --card-foreground: #f2ede4;
  --popover: #16130f;
  --popover-foreground: #f2ede4;
  --secondary: #211c16;
  --secondary-foreground: #f2ede4;
  --muted: #211c16;
  --muted-foreground: #a8a093;
  --accent: #2a2019;
  --accent-foreground: #f2ede4;
  --border: #322b22;
  --input: #322b22;

  --primary: #f2ede4;
  --primary-foreground: #16130f;
  --brand: #c08a4e;
  --brand-foreground: #16130f;
  --ring: #c08a4e;

  --destructive: #e0715f;
  --destructive-foreground: #16130f;
  --destructive-soft: #3a2119;
  --destructive-soft-foreground: #f2c4b8;
  --success: #5b9e77;
  --success-foreground: #0e1f16;
  --success-soft: #16281d;
  --success-soft-foreground: #a8dabb;
  --warning: #c79a3e;
  --warning-foreground: #221a08;
  --warning-soft: #2e2610;
  --warning-soft-foreground: #e8ce8f;
  --info: #5fa8d6;
  --info-foreground: #0c1e29;
  --info-soft: #142631;
  --info-soft-foreground: #a9d4ee;

  --chart-1: #c08a4e;
  --chart-2: #a8a093;
  --chart-3: #5fa8d6;
  --chart-4: #5b9e77;
  --chart-5: #6e665a;

  --sidebar: #16130f;
  --sidebar-foreground: #a8a093;
  --sidebar-primary: #c08a4e;
  --sidebar-primary-foreground: #16130f;
  --sidebar-accent: #211c16;
  --sidebar-accent-foreground: #f2ede4;
  --sidebar-border: #322b22;
  --sidebar-ring: #c08a4e;
}
```

- [ ] **Step 3: Collapse `--radius-card` to square and bind `--font-display` to serif**

In the `@theme inline` block (`globals.css:7-85`):

```css
  --font-sans: var(--font-inter);
  --font-heading: var(--font-inter);
  --font-display: var(--font-serif);
  --font-mono: var(--font-jetbrains);
```

And change the card-chrome comment block:

```css
  /* v6 card chrome — square corners (0 radius), matching the mobile app's
     "Maison" identity. Shadow stays: a whisper-thin drop shadow, unchanged
     from v5 — depth cue, not a rounding decision. */
  --radius-card: 0;
  --shadow-card: 0 1px 0 rgba(26, 26, 26, 0.07);
```

(`--shadow-bevel` directly below stays byte-for-byte unchanged.)

- [ ] **Step 4: Load Instrument Serif in the root layout**

Modify `web/src/app/layout.tsx` — add the import and font instance (same pattern already used in `web/src/app/privacy/page.tsx`):

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});
```

And add `instrumentSerif.variable` to the `<html className>` list:

```tsx
      className={`${inter.variable} ${jetbrains.variable} ${instrumentSerif.variable} h-full antialiased`}
```

Update the comment above `const inter = Inter({` from `// Borteh Admin v5 — warm paper + bronze, Inter throughout.` to `// Borteh Admin v6 — warm paper + bronze, matching the mobile app. Inter for UI/body, Instrument Serif for display headings.`

- [ ] **Step 5: Extend the visual-regression fixture for the new chrome**

Modify `web/src/app/%5F%5Fvisual/page.tsx` — update the stale comment and add a dark-mode and serif-heading sample:

```tsx
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Dev-only visual baseline. Renders v6 chrome with no data so Playwright can
// screenshot-diff it. This page's whole purpose is catching UNINTENTIONAL
// pixel drift in later waves — its own baselines were deliberately updated
// for the v6 bronze/paper/square pass (see docs/superpowers/specs/
// 2026-09-02-admin-redesign-design.md). Don't reflexively regenerate
// snapshots if this page's rendering changes later — check whether the
// change was intended first.
//
// 404s in production: this is a test fixture, not a page the shop owner or
// anyone else should ever be able to reach.
export const dynamic = "force-static";

export default function VisualBaselinePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="bg-background p-8">
      <h1 data-testid="heading-display" className="font-display text-3xl text-foreground">
        Borteh Admin
      </h1>

      <Card data-testid="card-default" className="mt-8 w-80 p-4">
        <p className="text-[13px] font-semibold">Card title</p>
        <p className="mt-1 text-xs text-muted-foreground">Supporting line.</p>
      </Card>

      <Button data-testid="button-primary" className="mt-8">
        New order
      </Button>

      <div className="dark mt-8 bg-background p-8">
        <Card data-testid="card-dark" className="w-80 p-4">
          <p className="text-[13px] font-semibold">Card title</p>
          <p className="mt-1 text-xs text-muted-foreground">Supporting line.</p>
        </Card>
        <Button data-testid="button-dark" className="mt-8">
          New order
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Update the visual spec's assertions and intent**

Replace `web/e2e/visual.spec.ts` entirely — the old file asserted v5 chrome was *unchanged*; this pass deliberately changes it, so the test now exists to catch the *next* unintended drift, not this one:

```ts
import { test, expect } from "@playwright/test";

test("card chrome (v6 — square, bronze/paper)", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("card-default")).toHaveScreenshot("card.png");
});

test("primary button (v6 — square, bronze/paper)", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("button-primary")).toHaveScreenshot("button.png");
});

test("display heading uses Instrument Serif", async ({ page }) => {
  await page.goto("/__visual");
  const heading = page.getByTestId("heading-display");
  await expect(heading).toHaveScreenshot("heading.png");
  const family = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family.toLowerCase()).toContain("instrument serif");
});

test("dark mode card chrome", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("card-dark")).toHaveScreenshot("card-dark.png");
});

test("dark mode primary button", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("button-dark")).toHaveScreenshot("button-dark.png");
});
```

- [ ] **Step 7: Run the visual suite and generate new baselines**

Run: `cd web && npm run test:visual -- --update-snapshots`
Expected: all 5 tests pass and create/update PNGs under `web/e2e/visual.spec.ts-snapshots/`.

Then run once more without the flag to confirm the new baselines are stable:

Run: `npm run test:visual`
Expected: PASS, 5/5.

- [ ] **Step 8: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add web/src/app/globals.css web/src/app/layout.tsx web/src/app/%5F%5Fvisual/page.tsx web/e2e/visual.spec.ts web/e2e/
git commit -m "feat(admin): rebuild design tokens on the mobile app's bronze/paper palette

Aligns background/foreground/border/primary/brand to mobile's exact
paper/ink/line/accent values, collapses card radius to square (0),
rebuilds dark mode on mobile's warm dark palette instead of the
orphaned indigo theme, and adds Instrument Serif for display headings.
Status colors (destructive/success/warning/info) are untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `PageHeader` gets the serif heading

**Files:**
- Modify: `web/src/components/admin/page-header.tsx`
- Test: `web/src/components/admin/page-header.test.tsx`

**Interfaces:**
- Consumes: nothing new (same `{ title, description, children }` props as today).
- Produces: `PageHeader({ title, description?, children? })` — unchanged signature. Every page migrated in this plan and every future wave imports this exact export.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/admin/page-header.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/admin/page-header";

describe("PageHeader", () => {
  it("renders the title in the display (serif) font", () => {
    render(<PageHeader title="Orders" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Orders" });
    expect(heading).toHaveClass("font-display");
  });

  it("renders an optional description", () => {
    render(<PageHeader title="Orders" description="Every order, newest first." />);
    expect(screen.getByText("Every order, newest first.")).toBeInTheDocument();
  });

  it("omits the description paragraph when none is given", () => {
    render(<PageHeader title="Orders" />);
    expect(screen.queryByText(/./, { selector: "p" })).not.toBeInTheDocument();
  });

  it("renders children as trailing actions", () => {
    render(<PageHeader title="Orders"><button>Export</button></PageHeader>);
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/components/admin/page-header.test.tsx`
Expected: FAIL on the first test — `toHaveClass("font-display")` fails because the current `<h1>` has no such class.

- [ ] **Step 3: Add the serif class to the heading**

Modify `web/src/components/admin/page-header.tsx` line 13:

```tsx
        <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
```

(Full file otherwise unchanged — same props, same wrapper `div`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/page-header.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/admin/page-header.tsx web/src/components/admin/page-header.test.tsx
git commit -m "feat(admin): PageHeader title uses the new display (serif) font

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `EmptyState`

**Files:**
- Create: `web/src/components/admin/empty-state.tsx`
- Test: `web/src/components/admin/empty-state.test.tsx`

**Interfaces:**
- Produces: `EmptyState({ title, description?, action? }: { title: string; description?: string; action?: React.ReactNode })` — a default export-free named export `EmptyState`. `DataTable` (Task 5) renders this for zero-row tables; later waves use it for Dispatch's removed rider UI and Settings → Staff.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/admin/empty-state.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/admin/empty-state";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No combos yet." />);
    expect(screen.getByText("No combos yet.")).toBeInTheDocument();
  });

  it("renders an optional description", () => {
    render(<EmptyState title="No combos yet." description="Pair two fragrances to create your first." />);
    expect(screen.getByText("Pair two fragrances to create your first.")).toBeInTheDocument();
  });

  it("renders an optional action", () => {
    render(<EmptyState title="No combos yet." action={<button>New combo</button>} />);
    expect(screen.getByRole("button", { name: "New combo" })).toBeInTheDocument();
  });

  it("omits the action slot when none is given", () => {
    render(<EmptyState title="No combos yet." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/empty-state.test.tsx`
Expected: FAIL — `Cannot find module '@/components/admin/empty-state'`.

- [ ] **Step 3: Write the component**

Create `web/src/components/admin/empty-state.tsx`:

```tsx
/**
 * The one "nothing here yet" pattern in the app — replaces ad hoc per-page
 * text (bare table rows, one-off sentences). Voice: short, plain, names the
 * obvious first action when there is one. Existing copy that already gets
 * this right ("No combos yet. Pair two fragrances to create your first.")
 * is the model to match when writing new instances.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/empty-state.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/admin/empty-state.tsx web/src/components/admin/empty-state.test.tsx
git commit -m "feat(admin): add EmptyState component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `StatCard`

**Files:**
- Create: `web/src/components/admin/stat-card.tsx`
- Test: `web/src/components/admin/stat-card.test.tsx`

**Interfaces:**
- Consumes: `Card` from `@/components/ui/card` (already exists).
- Produces: `StatCard({ label, value, delta?, href? }: { label: string; value: string; delta?: { ratio: number; caption: string }; href?: string })`. `value` is a pre-formatted string (callers use the existing `formatLe`/`formatInt` from `@/lib/format` — `StatCard` does no formatting itself, matching the rest of the codebase's convention of formatting at the call site). Consumed by the Dashboard page (Task 10) for the revenue hero.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/admin/stat-card.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/admin/stat-card";

describe("StatCard", () => {
  it("renders the label and value", () => {
    render(<StatCard label="Taken today" value="Le 1,240" />);
    expect(screen.getByText("Taken today")).toBeInTheDocument();
    expect(screen.getByText("Le 1,240")).toBeInTheDocument();
  });

  it("renders a positive delta with an up caret and success tone", () => {
    render(<StatCard label="Taken today" value="Le 1,240" delta={{ ratio: 0.12, caption: "vs last 7 days" }} />);
    const delta = screen.getByText(/12(\.0)?%/);
    expect(delta.textContent).toMatch(/▲/);
    expect(delta).toHaveClass("text-success");
    expect(screen.getByText("vs last 7 days")).toBeInTheDocument();
  });

  it("renders a negative delta with a down caret and destructive tone", () => {
    render(<StatCard label="Taken today" value="Le 1,240" delta={{ ratio: -0.08, caption: "vs last 7 days" }} />);
    const delta = screen.getByText(/8(\.0)?%/);
    expect(delta.textContent).toMatch(/▼/);
    expect(delta).toHaveClass("text-destructive");
  });

  it("wraps in a link when href is given", () => {
    render(<StatCard label="Taken today" value="Le 1,240" href="/analytics" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/analytics");
  });

  it("is not a link when href is omitted", () => {
    render(<StatCard label="Taken today" value="Le 1,240" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/stat-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `web/src/components/admin/stat-card.tsx`:

```tsx
import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format";
import { Card } from "@/components/ui/card";

function Delta({ ratio, caption }: { ratio: number; caption: string }) {
  const up = ratio > 0;
  return (
    <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("nums text-xs font-medium", up ? "text-success" : "text-destructive")}>
        {up ? "▲" : "▼"} {formatPct(Math.abs(ratio), 1)}
      </span>
      <span>{caption}</span>
    </p>
  );
}

/**
 * One big number, its label, and an optional trend delta — the hero-metric
 * pattern used once per page (Dashboard's revenue number), never as a wall
 * of co-equal tiles (see docs/superpowers/specs/2026-09-02-admin-redesign-design.md).
 */
export function StatCard({
  label,
  value,
  delta,
  href,
}: {
  label: string;
  value: string;
  delta?: { ratio: number; caption: string };
  href?: string;
}) {
  const body = (
    <Card className="p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="nums mt-1 text-[2.75rem] leading-none font-semibold tracking-[-0.02em]">{value}</p>
      {delta ? <Delta ratio={delta.ratio} caption={delta.caption} /> : null}
    </Card>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/stat-card.test.tsx`
Expected: PASS, 5/5. (Confirm `formatPct` exists at `@/lib/format` with this signature first — it's already imported the same way in `web/src/app/(dashboard)/page.tsx:5`.)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/admin/stat-card.tsx web/src/components/admin/stat-card.test.tsx
git commit -m "feat(admin): add StatCard component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `DataTable` — shared table chrome

**Files:**
- Create: `web/src/components/admin/data-table.tsx`
- Test: `web/src/components/admin/data-table.test.tsx`

**Interfaces:**
- Consumes: `Card` (`@/components/ui/card`), `EmptyState` (Task 3).
- Produces: `DataTable<T>({ summary?, search?, filters?, columns, rows, rowKey, onRowClick?, empty, pagination? })`. Generic over row type `T`. `columns: { header: string; align?: "left" | "right"; render: (row: T) => React.ReactNode }[]`. This is the exact shape `orders-table.tsx` (Task 6) refactors onto, and the shape every later wave's list pages (Products, Inventory, Customers) will consume — get this interface right now since Wave 1+ depends on it without revisiting this task.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/admin/data-table.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "@/components/admin/data-table";

type Row = { id: string; name: string; total: number };

const rows: Row[] = [
  { id: "1", name: "Alpha", total: 100 },
  { id: "2", name: "Beta", total: 200 },
];

const columns = [
  { header: "Name", render: (r: Row) => r.name },
  { header: "Total", align: "right" as const, render: (r: Row) => String(r.total) },
];

describe("DataTable", () => {
  it("renders one row per item with the given columns", () => {
    render(<DataTable rows={rows} rowKey={(r) => r.id} columns={columns} empty="No rows." />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("shows the EmptyState when there are no rows", () => {
    render(<DataTable rows={[]} rowKey={(r: Row) => r.id} columns={columns} empty="No rows." />);
    expect(screen.getByText("No rows.")).toBeInTheDocument();
  });

  it("calls onRowClick with the row when a row is clicked", async () => {
    const onRowClick = vi.fn();
    render(<DataTable rows={rows} rowKey={(r) => r.id} columns={columns} empty="No rows." onRowClick={onRowClick} />);
    await userEvent.click(screen.getByText("Alpha"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("renders the summary strip when given", () => {
    render(
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        empty="No rows."
        summary={[{ n: "2", label: "total", tone: "text-foreground" }]}
      />,
    );
    expect(screen.getByText("total")).toBeInTheDocument();
  });

  it("renders pagination when given and disables Previous on the first page", () => {
    render(
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        empty="No rows."
        pagination={{ page: 0, pageSize: 2, total: 4, hrefFor: (p) => `/x?page=${p}` }}
      />,
    );
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/x?page=1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/data-table.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `web/src/components/admin/data-table.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";

export type DataTableColumn<T> = {
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
};

export type DataTableSummaryStat = { n: string; label: string; tone: string };

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
};

const th = "px-3 py-1.5 text-left text-xs font-medium text-muted-foreground";

/**
 * The shared chrome behind every list page: a Card frame, an optional
 * summary strip, an optional search/filter row, a table body built from
 * `columns`, an EmptyState for zero rows, and optional pagination. List
 * pages own their data and column definitions; this owns the frame so
 * every list reads as the same product (see docs/superpowers/specs/
 * 2026-09-02-admin-redesign-design.md, "Shared component layer").
 */
export function DataTable<T>({
  summary,
  search,
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  pagination,
}: {
  summary?: DataTableSummaryStat[];
  search?: React.ReactNode;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty: string;
  pagination?: DataTablePagination;
}) {
  return (
    <Card className="overflow-hidden p-0">
      {summary ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border px-4 py-2.5">
          {summary.map((s) => (
            <span key={s.label} className="text-[13px] text-muted-foreground">
              <span className={cn("nums font-[650]", s.tone)}>{s.n}</span> {s.label}
            </span>
          ))}
        </div>
      ) : null}

      {search ? <div className="flex flex-wrap items-center gap-2 px-4 py-3">{search}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c, i) => (
                <th
                  key={c.header}
                  className={cn(th, i === 0 && "pl-4", i === columns.length - 1 && "pr-4", c.align === "right" && "text-right")}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-t border-accent transition-colors",
                  onRowClick && "cursor-pointer hover:bg-muted",
                )}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.header}
                    className={cn(
                      "py-1.5",
                      i === 0 ? "pl-4 pr-3" : "px-3",
                      i === columns.length - 1 && "pr-4",
                      c.align === "right" && "text-right",
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 ? <EmptyState title={empty} /> : null}
      </div>

      {pagination && pagination.total > pagination.pageSize ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground"
        >
          <span className="nums">
            {pagination.page * pagination.pageSize + 1}–
            {Math.min((pagination.page + 1) * pagination.pageSize, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-1">
            <a
              href={pagination.page === 0 ? undefined : pagination.hrefFor(pagination.page - 1)}
              aria-disabled={pagination.page === 0}
              className={cn(
                "inline-flex h-8 items-center rounded-none border border-border px-3 text-[13px] font-medium",
                pagination.page === 0 ? "pointer-events-none opacity-50" : "hover:bg-muted",
              )}
            >
              Previous
            </a>
            <a
              href={pagination.hrefFor(pagination.page + 1)}
              aria-disabled={(pagination.page + 1) * pagination.pageSize >= pagination.total}
              className={cn(
                "inline-flex h-8 items-center rounded-none border border-border px-3 text-[13px] font-medium",
                (pagination.page + 1) * pagination.pageSize >= pagination.total
                  ? "pointer-events-none opacity-50"
                  : "hover:bg-muted",
              )}
            >
              Next
            </a>
          </div>
        </nav>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/data-table.test.tsx`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/admin/data-table.tsx web/src/components/admin/data-table.test.tsx
git commit -m "feat(admin): add DataTable shared list-page component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Refactor `OrdersTable` onto `DataTable`

**Files:**
- Modify: `web/src/components/admin/orders-table.tsx`
- Test: `web/src/components/admin/orders-table.test.tsx`

**Interfaces:**
- Consumes: `DataTable` (Task 5).
- Produces: same `OrdersTable({ orders, summary, page, total })` signature — `(dashboard)/orders/page.tsx` (Task 11) doesn't change how it calls this component, only what's inside changes.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/admin/orders-table.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrdersTable, type OrderRow } from "@/components/admin/orders-table";

const orders: OrderRow[] = [
  {
    id: "1",
    number: "1001",
    placed: "Sep 1, 2:30 PM",
    customer: "Aminata",
    phone: "+232 76 000000",
    channel: "Delivery",
    payment: "Cash on delivery",
    status: "pending",
    statusLabel: "Pending",
    statusTone: "warning",
    minor: 74000,
  },
];

describe("OrdersTable", () => {
  it("renders order rows without any hardcoded hex colors", () => {
    const { container } = render(<OrdersTable orders={orders} summary={[]} page={0} total={1} />);
    expect(screen.getByText("#1001")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("shows the empty state copy when there are no orders", () => {
    render(<OrdersTable orders={[]} summary={[]} page={0} total={0} />);
    expect(screen.getByText("No orders yet.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/orders-table.test.tsx`
Expected: FAIL — the current implementation hand-rolls the card/table, so `container.innerHTML` still contains `#B5B2AC` (lines 119, 122).

- [ ] **Step 3: Rewrite `OrdersTable` on `DataTable`**

Replace `web/src/components/admin/orders-table.tsx` in full:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import { PAGE_SIZE } from "@/lib/queries/orders";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";

export type OrderRow = {
  id: string;
  number: string;
  placed: string;
  customer: string;
  phone: string;
  channel: string;
  payment: string;
  status: string;
  statusLabel: string;
  statusTone: Tone;
  minor: number;
};

export type SummaryStat = { n: string; label: string; tone: string };

export function OrdersTable({
  orders,
  summary,
  page,
  total,
}: {
  orders: OrderRow[];
  summary: SummaryStat[];
  page: number;
  total: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filters = useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of orders) if (!seen.has(o.status)) seen.set(o.status, o.statusLabel);
    return [{ key: "all", label: "All" }, ...[...seen].map(([key, label]) => ({ key, label }))];
  }, [orders]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => filter === "all" || o.status === filter)
      .filter((o) => !q || o.number.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.phone.includes(q));
  }, [orders, filter, query]);

  const columns: DataTableColumn<OrderRow>[] = [
    {
      header: "Order",
      render: (o) => (
        <span className="nums font-medium">
          #{o.number} <span className="nums font-normal text-[12px] text-muted-foreground">{o.placed}</span>
        </span>
      ),
    },
    {
      header: "Customer",
      render: (o) => (
        <span>
          {o.customer} <span className="nums text-[12px] text-muted-foreground">{o.phone}</span>
        </span>
      ),
    },
    { header: "Channel", render: (o) => <span className="text-muted-foreground">{o.channel}</span> },
    { header: "Payment", render: (o) => <span className="text-muted-foreground">{o.payment}</span> },
    { header: "Status", render: (o) => <Chip tone={o.statusTone}>{o.statusLabel}</Chip> },
    {
      header: "Total",
      align: "right",
      render: (o) => <span className="nums font-medium">{formatLe(o.minor, 2)}</span>,
    },
  ];

  return (
    <DataTable
      summary={summary}
      search={
        <>
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order, name, phone"
              className="h-8 w-60 border border-border bg-card pl-8 pr-3 text-[13px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
            />
          </div>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-7 px-2.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </>
      }
      columns={columns}
      rows={rows}
      rowKey={(o) => o.id}
      onRowClick={(o) => router.push(`/orders/${o.id}`)}
      empty={orders.length === 0 ? "No orders yet." : "No orders match this view."}
      pagination={
        total > orders.length
          ? { page, pageSize: PAGE_SIZE, total, hrefFor: (p) => `/orders?page=${p}` }
          : undefined
      }
    />
  );
}
```

Note: the standalone `Button`-based pagination (`nativeButton={false}`) is replaced by `DataTable`'s own plain `<a>` pagination — this is an intentional simplification centralized in one place (Task 5) rather than kept per-table; every future list page gets the same pagination control for free.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/orders-table.test.tsx`
Expected: PASS, 2/2.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors — confirms `(dashboard)/orders/page.tsx`'s existing `<OrdersTable orders={orders} summary={summary} page={page} total={total} />` call site still matches.

```bash
git add web/src/components/admin/orders-table.tsx web/src/components/admin/orders-table.test.tsx
git commit -m "refactor(admin): OrdersTable onto DataTable, kill hardcoded hex colors

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `FormSection` and `FormField`

**Files:**
- Create: `web/src/components/admin/form-section.tsx`
- Create: `web/src/components/admin/form-field.tsx`
- Test: `web/src/components/admin/form-section.test.tsx`
- Test: `web/src/components/admin/form-field.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `FormSection({ title, description?, children })` and `FormField({ label, htmlFor, optional?, helper?, error?, children })`. Not consumed by any Wave 0 page (Dashboard/Orders aren't forms) — built and proven here per the spec's Wave 0 commitment, first consumed when Wave 1 migrates the Product editor.

- [ ] **Step 1: Write the failing tests**

Create `web/src/components/admin/form-section.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormSection } from "@/components/admin/form-section";

describe("FormSection", () => {
  it("renders a heading and its fields", () => {
    render(
      <FormSection title="Pricing & stock">
        <label htmlFor="price">Price</label>
      </FormSection>,
    );
    expect(screen.getByRole("heading", { name: "Pricing & stock" })).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
  });

  it("renders an optional description under the heading", () => {
    render(
      <FormSection title="Pricing & stock" description="What it costs and how many are in stock.">
        <div />
      </FormSection>,
    );
    expect(screen.getByText("What it costs and how many are in stock.")).toBeInTheDocument();
  });
});
```

Create `web/src/components/admin/form-field.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "@/components/admin/form-field";

describe("FormField", () => {
  it("renders a visible label associated with the field via htmlFor", () => {
    render(
      <FormField label="Price" htmlFor="price">
        <input id="price" />
      </FormField>,
    );
    const input = screen.getByLabelText("Price");
    expect(input).toBeInTheDocument();
  });

  it("marks optional fields, not required ones", () => {
    render(
      <FormField label="Notes" htmlFor="notes" optional>
        <input id="notes" />
      </FormField>,
    );
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("does not show 'Optional' when the field is required", () => {
    render(
      <FormField label="Price" htmlFor="price">
        <input id="price" />
      </FormField>,
    );
    expect(screen.queryByText("Optional")).not.toBeInTheDocument();
  });

  it("renders helper text when given and no error", () => {
    render(
      <FormField label="Price" htmlFor="price" helper="In Leones, no decimals.">
        <input id="price" />
      </FormField>,
    );
    expect(screen.getByText("In Leones, no decimals.")).toBeInTheDocument();
  });

  it("renders an inline error instead of helper text, associated via aria-describedby", () => {
    render(
      <FormField label="Price" htmlFor="price" helper="In Leones, no decimals." error="Price must be greater than 0.">
        <input id="price" />
      </FormField>,
    );
    expect(screen.getByText("Price must be greater than 0.")).toBeInTheDocument();
    expect(screen.queryByText("In Leones, no decimals.")).not.toBeInTheDocument();
    const input = screen.getByLabelText("Price");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("Price must be greater than 0.");
  });
});
```

- [ ] **Step 2: Run both to verify they fail**

Run: `npx vitest run src/components/admin/form-section.test.tsx src/components/admin/form-field.test.tsx`
Expected: FAIL — both modules not found.

- [ ] **Step 3: Write `FormSection`**

Create `web/src/components/admin/form-section.tsx`:

```tsx
/**
 * One named, visually distinct group of fields — the building block every
 * form is assembled from instead of a flat input stack (separation of
 * concerns per docs/superpowers/specs/2026-09-02-admin-redesign-design.md,
 * "Forms UX"). Mirrors the mobile checkout screen's DELIVERY / PAYMENT
 * METHOD grouping convention — one house pattern across both apps.
 */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
```

- [ ] **Step 4: Write `FormField`**

Create `web/src/components/admin/form-field.tsx`. The single child is always exactly one labelable input/select/textarea (true of every real call site in this codebase), so it's cloned to inject `aria-describedby` — the standard React pattern for wiring a generated id onto an opaque child:

```tsx
import { cloneElement, isValidElement, useId } from "react";

/**
 * Wraps one input with an always-visible label, optional helper text, and
 * an inline error slot. Labels are never placeholder-only — see "Forms UX"
 * in docs/superpowers/specs/2026-09-02-admin-redesign-design.md for why.
 * Marks optional fields "Optional" rather than marking required fields, since
 * most fields in these forms are required.
 */
export function FormField({
  label,
  htmlFor,
  optional,
  helper,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}) {
  const messageId = useId();
  const message = error ?? helper;

  const field = isValidElement(children)
    ? cloneElement(children, message ? { "aria-describedby": messageId } : {})
    : children;

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-1">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-xs font-medium text-foreground">
        <span>{label}</span>
        {optional ? <span className="font-normal text-muted-foreground">Optional</span> : null}
      </label>
      {field}
      {message ? (
        <p id={messageId} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Run both tests to verify they pass**

Run: `npx vitest run src/components/admin/form-section.test.tsx src/components/admin/form-field.test.tsx`
Expected: PASS, 2/2 and 5/5.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/admin/form-section.tsx web/src/components/admin/form-field.tsx web/src/components/admin/form-section.test.tsx web/src/components/admin/form-field.test.tsx
git commit -m "feat(admin): add FormSection and FormField components

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Chart primitives — install shadcn `chart.tsx`, rewrite `RevenueChart`

**Files:**
- Create: `web/src/components/ui/chart.tsx` (via shadcn CLI)
- Modify: `web/src/components/admin/revenue-chart.tsx`
- Test: `web/src/components/admin/revenue-chart.test.tsx`

**Interfaces:**
- Produces: `RevenueChart({ data, labels }: { data: number[]; labels: string[] })` — same signature as today, `(dashboard)/page.tsx` doesn't change its call site.

- [ ] **Step 1: Install the shadcn chart component**

Run: `cd web && npx shadcn@latest add chart`
Expected: creates `web/src/components/ui/chart.tsx` and adds `recharts` to `package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `web/src/components/admin/revenue-chart.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RevenueChart } from "@/components/admin/revenue-chart";

describe("RevenueChart", () => {
  it("renders without crashing given real data", () => {
    render(<RevenueChart data={[100, 200, 150, 300, 250, 400, 350]} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} />);
    expect(screen.getByRole("img", { name: "Revenue, last 7 days" })).toBeInTheDocument();
  });

  it("renders without crashing given all-zero data", () => {
    render(<RevenueChart data={[0, 0, 0, 0, 0, 0, 0]} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} />);
    expect(screen.getByRole("img", { name: "Revenue, last 7 days" })).toBeInTheDocument();
  });

  it("uses no hardcoded hex colors", () => {
    const { container } = render(<RevenueChart data={[100, 200]} labels={["Mon", "Tue"]} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/revenue-chart.test.tsx`
Expected: FAIL — current SVG has no `role="img"` accessible name matching exactly (it does have `role="img" aria-label="Revenue, last 7 days"` already, so this specific assertion may actually pass; the third test — no hex — FAILS, since the current file uses `fill-[#B5B2AC]` twice.

- [ ] **Step 4: Rewrite `RevenueChart` on the shadcn chart primitives**

Replace `web/src/components/admin/revenue-chart.tsx` in full:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/** Bar + trend-line revenue chart. Bars are daily revenue; the line traces
 *  the same series so the trend reads at a glance without a second metric. */
export function RevenueChart({ data, labels }: { data: number[]; labels: string[] }) {
  const rows = data.map((revenue, i) => ({ day: labels[i], revenue }));

  return (
    <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-44 w-full" role="img" aria-label="Revenue, last 7 days">
      <BarChart data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} className="text-muted-foreground" />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatLe(Number(value))} />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={0} />
      </BarChart>
    </ChartContainer>
  );
}

/** A second, line-only rendering of the same series — used where a trend
 *  needs to sit inline without the bars (kept separate rather than
 *  overloading RevenueChart with a `variant` prop no current caller needs). */
export function RevenueTrendLine({ data, labels }: { data: number[]; labels: string[] }) {
  const rows = data.map((revenue, i) => ({ day: labels[i], revenue }));

  return (
    <ChartContainer config={chartConfig} className="h-16 w-full">
      <LineChart data={rows} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
```

(`RevenueTrendLine` is unused by any Wave 0 page — it's here because Analytics' Wave 3 revenue-trend panel will need exactly this shape, and it costs nothing extra to define correctly now, next to the primitive it shares a `chartConfig` with. If `tsc`/`eslint` flags it as unused-export, that's expected and fine — it's a named export, not a local unused variable.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/revenue-chart.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add web/src/components/ui/chart.tsx web/src/components/admin/revenue-chart.tsx web/src/components/admin/revenue-chart.test.tsx web/package.json web/package-lock.json
git commit -m "feat(admin): rewrite RevenueChart on shadcn chart primitives

Replaces hand-rolled SVG (with 2 hardcoded hex colors) with Recharts via
shadcn's chart.tsx wrapper, token-driven color. Also adds RevenueTrendLine,
which Wave 3's Analytics page will need.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Sidebar — live badge counts, remove the notification bell

**Files:**
- Modify: `web/src/lib/nav.ts`
- Modify: `web/src/app/(dashboard)/layout.tsx`
- Modify: `web/src/components/app-sidebar.tsx`
- Test: `web/src/lib/nav.test.ts`

**Interfaces:**
- Consumes: `getOverviewStats(db)` from `@/lib/queries/overview` (already exists, already returns `pending_count`, `low_stock_count`, `out_of_stock_count`, `out_for_delivery_count` — no query changes needed).
- Produces: `badgeCountFor(href: string, counts: BadgeCounts): number | undefined` (new, in `nav.ts`) and `AppSidebar`'s new `badgeCounts?: BadgeCounts` prop.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/nav.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { badgeCountFor, type BadgeCounts } from "@/lib/nav";

const counts: BadgeCounts = { pending_count: 6, low_stock_count: 3, out_of_stock_count: 1, out_for_delivery_count: 2 };

describe("badgeCountFor", () => {
  it("returns pending_count for Orders", () => {
    expect(badgeCountFor("/orders", counts)).toBe(6);
  });

  it("returns low_stock_count + out_of_stock_count for Inventory", () => {
    expect(badgeCountFor("/inventory", counts)).toBe(4);
  });

  it("returns out_for_delivery_count for Dispatch", () => {
    expect(badgeCountFor("/dispatch", counts)).toBe(2);
  });

  it("returns undefined for a route with no badge, so the badge doesn't render at all", () => {
    expect(badgeCountFor("/products", counts)).toBeUndefined();
  });

  it("returns undefined instead of 0, so an empty queue shows no badge rather than a badge reading 0", () => {
    const zero: BadgeCounts = { pending_count: 0, low_stock_count: 0, out_of_stock_count: 0, out_for_delivery_count: 0 };
    expect(badgeCountFor("/orders", zero)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/nav.test.ts`
Expected: FAIL — `badgeCountFor` and `BadgeCounts` don't exist yet.

- [ ] **Step 3: Remove hardcoded badges, add `BadgeCounts` and `badgeCountFor`**

Modify `web/src/lib/nav.ts` — remove `badge: 6`, `badge: 3`, `badge: 4` from the three items (`badge` stays optional on the type for any future genuinely-static badge, just unused today), and append the new exports:

```ts
export type NavItem = {
  title: string;
  href: string;
  icon: Icon;
  /** Optional static count shown as a sidebar badge. Prefer badgeCountFor
   *  for anything that should reflect live data — see that function. */
  badge?: number;
};

// Daily-driver destinations — the things the owner touches every shift.
export const primaryNav: NavItem[] = [
  { title: "Overview", href: "/", icon: SquaresFour },
  { title: "Orders", href: "/orders", icon: ShoppingBag },
  { title: "Dispatch", href: "/dispatch", icon: Truck },
  { title: "Point of sale", href: "/pos", icon: Barcode },
];

// Catalog & merchandising — what the shop sells and how the app shows it.
export const catalogNav: NavItem[] = [
  { title: "Products", href: "/products", icon: Drop },
  { title: "Inventory", href: "/inventory", icon: Package },
  { title: "Collections", href: "/collections", icon: Stack },
  { title: "Combos", href: "/combos", icon: Cards },
  { title: "Brands", href: "/brands", icon: Sparkle },
  { title: "Storefront", href: "/storefront", icon: DeviceMobile },
];
```

(`contentNav`, `insightNav`, `settingsItem`, `allNavItems` are unchanged — leave them exactly as they are.)

Append at the end of the file:

```ts
export type BadgeCounts = {
  pending_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  out_for_delivery_count: number;
};

/**
 * Live sidebar badge counts, replacing the hardcoded literals this file
 * used to carry. Returns undefined (not 0) for both "no badge defined for
 * this route" and "the count is zero" — a badge that can read "0" is worse
 * than no badge, since it invites a glance that finds nothing wrong.
 */
export function badgeCountFor(href: string, counts: BadgeCounts): number | undefined {
  const n = (() => {
    switch (href) {
      case "/orders":
        return counts.pending_count;
      case "/inventory":
        return counts.low_stock_count + counts.out_of_stock_count;
      case "/dispatch":
        return counts.out_for_delivery_count;
      default:
        return undefined;
    }
  })();
  return n && n > 0 ? n : undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/nav.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Wire live counts through the layout, remove the notification bell**

Modify `web/src/app/(dashboard)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";

import { createAuthServerClient, getStaffUser } from "@/lib/supabase/auth-server";
import { createServerClient } from "@/lib/supabase/server";
import { getOverviewStats } from "@/lib/queries/overview";
import { AppSidebar } from "@/components/app-sidebar";
import { IconProvider } from "@/components/icon-provider";
import { CommandMenu } from "@/components/command-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defence-in-depth: the proxy gates navigations, but re-check here so a stale/partial render
  // can never leak the dashboard to a non-staff session.
  const staff = await getStaffUser();
  if (!staff) redirect("/login");

  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  const sidebarUser = user
    ? {
        name: (user.user_metadata?.display_name as string) ?? (user.phone as string) ?? "Staff",
        role: (user.app_metadata?.role as string) ?? staff.role,
      }
    : undefined;

  // Sidebar badges read from the same bounded view Overview already uses —
  // no new query. Never let a badge-count failure take the whole shell down.
  const db = createServerClient();
  const badgeCounts = await getOverviewStats(db).catch(() => undefined);

  return (
    <IconProvider>
      <TooltipProvider delay={200}>
      <SidebarProvider>
        <AppSidebar user={sidebarUser} badgeCounts={badgeCounts} />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-4">
            <SidebarTrigger className="text-muted-foreground" />
            <Separator orientation="vertical" className="mr-1 !h-5" />
            <CommandMenu />
            <div className="ml-auto flex items-center gap-0.5">
              <ThemeToggle />
            </div>
          </header>
          <div className="flex-1 overflow-x-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      </TooltipProvider>
    </IconProvider>
  );
}
```

(Removed: the `Bell` import, the `Button` import — it was only used by the bell — and the whole notification `<Button>` block. `getOverviewStats` returns more fields than `BadgeCounts` needs; that's fine, `badgeCountFor` only reads the four it uses, and TypeScript structural typing accepts the wider object.)

- [ ] **Step 6: Consume `badgeCounts` in `AppSidebar`**

Modify `web/src/components/app-sidebar.tsx`:

Change the `NavItems` function to accept and apply live counts:

```tsx
import { primaryNav, catalogNav, contentNav, insightNav, settingsItem, badgeCountFor, type NavItem, type BadgeCounts } from "@/lib/nav";

function NavItems({ items, badgeCounts }: { items: NavItem[]; badgeCounts?: BadgeCounts }) {
  const pathname = usePathname();
  return (
    <SidebarMenu>
      {items.map((item) => {
        const badge = badgeCounts ? badgeCountFor(item.href, badgeCounts) : item.badge;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={isActivePath(pathname, item.href)}
              tooltip={item.title}
              render={<Link href={item.href} />}
            >
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
            {badge ? (
              <SidebarMenuBadge className="text-sidebar-primary">{badge}</SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
```

Change `AppSidebar`'s signature and its two call sites that need live counts (`primaryNav` has Orders/Dispatch, `catalogNav` has Inventory — pass `badgeCounts` to both; `contentNav`/`insightNav` don't need it since none of their items have a live badge, but passing it through is harmless):

```tsx
export function AppSidebar({ user, badgeCounts }: { user?: { name: string; role: string }; badgeCounts?: BadgeCounts }) {
```

```tsx
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={primaryNav} badgeCounts={badgeCounts} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-2" />
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={catalogNav} badgeCounts={badgeCounts} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-2" />
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={contentNav} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-2" />
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={insightNav} />
          </SidebarGroupContent>
        </SidebarGroup>
```

- [ ] **Step 7: Verify the sidebar's built-in mobile behavior at a phone viewport**

Add one Playwright test to `web/e2e/visual.spec.ts` (append, don't replace the file written in Task 1):

```ts
test("sidebar collapses to an off-canvas drawer on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  // The dashboard route redirects unauthenticated requests to /login (see
  // (dashboard)/layout.tsx) — this test only needs to confirm the shell's
  // trigger renders correctly at phone width, not full authenticated content.
  // If a staff session is available in this environment, prefer asserting
  // against "/" directly and checking the sidebar's data-state attribute
  // instead of skipping to /login.
  expect(page.url()).toContain("/login");
});
```

Run: `npm run test:visual`
Expected: PASS. (This is a placeholder-strength check given no authenticated test fixture exists yet in this repo — flag to the human reviewer in the task's PR/commit description that a real authenticated mobile-viewport sidebar check needs a logged-in Playwright fixture, which doesn't exist yet and is out of scope to build for Wave 0 alone. Do not skip verifying it manually: run `npm run dev`, sign in, resize the browser to 375px, and confirm the sidebar becomes an off-canvas sheet before checking this task's box.)

- [ ] **Step 8: Typecheck, run the full test suite, and commit**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all vitest suites pass.

```bash
git add web/src/lib/nav.ts web/src/lib/nav.test.ts web/src/app/\(dashboard\)/layout.tsx web/src/components/app-sidebar.tsx web/e2e/visual.spec.ts
git commit -m "feat(admin): live sidebar badge counts, remove decorative notification bell

Orders/Inventory/Dispatch badges now read admin_overview_stats (already
bounded, already queried) instead of hardcoded literals. The notification
bell had no backing data model anywhere in the app — removed rather than
left as a fake indicator.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Migrate the Overview (Dashboard) page

**Files:**
- Modify: `web/src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 2), `StatCard` (Task 4), `RevenueChart` (Task 8) — all with the exact signatures defined in their tasks.

- [ ] **Step 1: Replace the hand-rolled header + hero with `PageHeader` + `StatCard`**

Modify `web/src/app/(dashboard)/page.tsx`. Replace the imports (add `PageHeader`, `StatCard`; drop nothing) and the header/hero block:

```tsx
import Link from "next/link";
import { DownloadSimple, Plus } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { formatInt, formatLe, formatPct } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { getOverviewStats, getOverviewPanels } from "@/lib/queries/overview";
import { listOrders, getMonimeChannels } from "@/lib/queries/orders";
import { paymentLabel } from "@/lib/payment-channel";
import { Chip, humanize, statusTone } from "@/components/admin/chip";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Card } from "@/components/ui/card";
```

Replace the `Delta` helper and the header/hero JSX (currently `page.tsx:16-107`, everything from `function Delta` through the closing `</Card>` of the Revenue card) with:

```tsx
const cardHead = "flex items-baseline justify-between";
const cardTitle = "text-[13px] font-semibold";
const cardLink = "text-xs font-medium text-brand hover:underline";
const rowLine = "flex items-center gap-2 h-9 border-t border-accent text-[13px] first:border-t-0";

export default async function OverviewPage() {
  const db = createServerClient();
  const [stats, panels, { rows: recent }] = await Promise.all([
    getOverviewStats(db),
    getOverviewPanels(db),
    listOrders(db, { page: 0, pageSize: 8 }),
  ]);

  const recentUserIds = [...new Set(recent.map((o) => o.user_id).filter(Boolean) as string[])];
  const recentNames = new Map<string, string>();
  if (recentUserIds.length > 0) {
    const { data: users } = await db.from("app_user").select("id, display_name").in("id", recentUserIds);
    for (const u of (users ?? []) as Array<{ id: string; display_name: string | null }>) {
      recentNames.set(u.id, u.display_name ?? "");
    }
  }
  const recentChannels = await getMonimeChannels(db, recent.filter((o) => o.payment_method === "monime").map((o) => o.id));

  const ratio = (now: number, prev: number) => (prev === 0 ? 0 : (now - prev) / prev);

  const revenueDelta = ratio(stats.revenue_7d_minor, stats.revenue_prev_7d_minor);
  const deliveredRate =
    stats.orders_7d === 0 ? 0 : stats.delivered_7d_count / stats.orders_7d;
  const perOrder = stats.orders_7d === 0 ? 0 : stats.items_sold_7d / stats.orders_7d;
  const topMax = Math.max(...panels.topSellers.map((t) => t.revenue_minor), 1);

  const revenue7d = panels.revenueDaily.map((d) => d.revenue_minor);
  const dayLabels = panels.revenueDaily.map((d) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(d.day)),
  );

  const queueTotal = panels.queue.reduce((s, o) => s + (o.total_minor ?? 0), 0);

  return (
    <div className="px-5 pb-6 pt-2">
      <PageHeader title="Overview">
        <Link href="/analytics" className="inline-flex h-8 items-center gap-1.5 border border-border bg-card px-3 text-[13px] font-medium shadow-card transition-colors hover:bg-muted">
          <DownloadSimple weight="duotone" className="size-4" />
          Reports
        </Link>
        <Link href="/pos" className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90">
          <Plus weight="duotone" className="size-4" />
          Open POS
        </Link>
      </PageHeader>

      <div className="mt-4">
        <StatCard
          label="Taken today"
          value={formatLe(stats.revenue_today_minor)}
          delta={{ ratio: revenueDelta, caption: "vs the previous 7 days" }}
        />
      </div>

      {/* Chart */}
      <Card className="mt-4 p-4">
        <div className={cardHead}>
          <span className={cardTitle}>Revenue</span>
          <span className="nums text-xs text-muted-foreground">Last 7 days · {formatLe(stats.revenue_7d_minor)}</span>
        </div>
        <RevenueChart data={revenue7d} labels={dayLabels} />
        <div className="mt-3 flex items-center gap-4 border-t border-accent pt-3 text-xs text-muted-foreground">
          <span className="nums">{formatInt(stats.orders_7d)} orders</span>
          <span className="nums">{perOrder.toFixed(1)} items / order</span>
          <span className="nums">{formatPct(deliveredRate)} delivered</span>
        </div>
      </Card>
```

Everything from `{/* Live queue + Low stock */}` (`page.tsx:109`) to the end of the file is unchanged — copy it forward as-is, EXCEPT the three `text-[#B5B2AC]` occurrences (currently `page.tsx:141,157,172,173`), which become `text-muted-foreground`:

```tsx
              <span className="min-w-0 flex-1 truncate">{r.product_name} <span className="text-muted-foreground">{r.size_ml} ml</span></span>
```

(apply the same swap at all three remaining sites: the low-stock row, the top-sellers row's `variant_label` span, and the restock-demand row).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the app and verify visually**

Run: `npm run dev`, sign in, open `/`.
Expected: revenue hero renders as a `StatCard` with the up/down delta, chart renders via Recharts with bronze bars, no `#B5B2AC` gray text anywhere (all rows now use `text-muted-foreground`, which is visually equivalent), header title is serif, "Reports"/"Open POS" buttons are square-cornered.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(dashboard)/page.tsx"
git commit -m "feat(admin): migrate Overview page to PageHeader, StatCard, new RevenueChart

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Migrate the Orders list page

**Files:**
- Modify: `web/src/app/(dashboard)/orders/page.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 2). `OrdersTable` (Task 6) is already migrated and its call site doesn't change.

- [ ] **Step 1: Replace the hand-rolled header with `PageHeader`**

Modify `web/src/app/(dashboard)/orders/page.tsx` — add the import and replace lines 73-87:

```tsx
import { PageHeader } from "@/components/admin/page-header";
```

```tsx
  return (
    <div className="px-5 pb-6 pt-2">
      <PageHeader title="Orders" description="Every online and counter order, newest first.">
        <ExportButton
          label="Export this page"
          filename="borteh-orders.csv"
          headers={["Order", "Placed", "Customer", "Phone", "Channel", "Payment", "Status", "Total (Le)"]}
          rows={orders.map((o) => [`#${o.number}`, o.placed, o.customer, o.phone, o.channel, o.payment, o.statusLabel, formatLe(o.minor, 2)])}
        />
      </PageHeader>

      <div className="mt-4">
        <PaymentAttention rows={attention} />

        <OrdersTable orders={orders} summary={summary} page={page} total={total} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the app and verify visually**

Run: `npm run dev`, sign in, open `/orders`.
Expected: header matches the Overview page's typography/spacing exactly (same `PageHeader`), export button sits in the header's action slot, table below renders with square corners and no visible pixel jump when navigating from `/` to `/orders`.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(dashboard)/orders/page.tsx"
git commit -m "feat(admin): migrate Orders list page to PageHeader

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

(Completed during plan-writing, not left for the executor.)

- **Spec coverage:** Design tokens (Task 1), Dark mode rebuild (Task 1), PageHeader consolidation (Task 2 + 10 + 11), Card enforcement (already true for these 2 pages, confirmed not duplicated), StatCard (Task 4), DataTable + bounded-by-construction pagination (Task 5-6), EmptyState (Task 3), Chart primitives (Task 8), FormSection/FormField (Task 7, unconsumed until Wave 1 — expected per spec), sidebar live badges (Task 9), notification bell removal (Task 9), hardcoded hex sweep on the 2 migrated pages (Tasks 6, 8, 10) all covered. StatusPill was in the original spec draft but dropped from this plan — `chip.tsx` already fills that role correctly (token-based, no hex) and inherits square radius automatically from the Task 1 token change with zero code edits; building a parallel component would have duplicated it. Loading/error states: Dashboard root and Orders list already have them (confirmed against the codebase before writing this plan) — nothing to add in Wave 0 for these two pages.
- **Placeholder scan:** none found — Task 9 Step 7's mobile-sidebar Playwright test is intentionally flagged as weak (asserts a redirect, not real sidebar state) with an explicit instruction to manually verify instead of silently trusting a weak automated check; this is a documented limitation, not a TBD.
- **Type consistency:** `OrderRow`, `SummaryStat`, `DataTableColumn<T>`, `DataTablePagination`, `BadgeCounts` are each defined once and referenced by the same name/shape everywhere they're used across tasks.
- **Scope:** Wave 1-3 (the other ~18 pages) are explicitly out of scope for this plan — each gets its own plan after this one ships and is reviewed, per the spec's rollout section.
