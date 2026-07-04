# Borteh Sprays — Mobile Design Direction

The language we converged on building the product page. Start new screens from these rules so
they land at "nearly right" instead of being relitigated from scratch.

## Direction
**Warm-boutique, light, editorial, type-led.** Monochrome base + one warm accent. Photo-led,
restrained chrome. The product and the type do the work — not decoration. If a screen could be
mistaken for a generic shopping-app template, it's wrong; rework the premise, not the spacing.

## Typography
- **One family: Encode Sans** (`font.regular / medium / semibold / bold`). No serif — Fraunces was
  tried and removed; the app reads as one voice.
- Hierarchy by **size + weight**, not decoration. Primary leads (e.g. product name ~27 bold),
  price is clearly secondary (~22), supporting section headers are **quiet** (15 semibold) so they
  don't compete with the hero cluster.
- **No uppercase tracked eyebrows on every section** — that "kicker above each block" is an AI tell.
- Guard fixed-height text with `maxFontSizeMultiplier` (≈1.2–1.3) so Dynamic Type can't shatter
  buttons/steppers.

## Color (tokens in `lib/theme.ts`)
- Base: `bg`/`surface` white, `ink` text, `inkSoft` secondary, `inkMute` tertiary, `line` hairlines.
- **One warm accent**: `accent` #9A5B2D (fills/CTAs), `accentInk` #7E3F1E (text on light/tint),
  `accentSoft` tint. Used sparingly — CTAs, active states, the amber dots.
- Status colors are darkened for AA on white (in-stock green `#1E8E4E`, low `#B26A12`, out `#B0413E`).
- Product stage is **near-white `#F6F5F3`**, not grey — so white-studio bottle photos blend instead
  of reading as a box.

## Chrome — keep it minimal
- **Fills over borders.** Avoid stacking many outlined elements.
- **No boxes around information** — e.g. concentration is plain type next to the price, not a pill.
- **No chips for content.** Selection controls (size pills) are fine; don't wrap facts/notes in pills.
- **No decorative flourishes** — no `BRAND ——— ◆` rule lines, no fake drag handles (an affordance
  that doesn't do anything is worse than none).
- **No shadow on a sheet that ends mid-scroll** — the blur leaks past the bottom edge and reads as a
  cut-off line. Separate layers with color contrast + rounded corners instead.

## Layout patterns (product page is the reference)
- **Full-bleed image on the near-white stage, scrolls *with* the content** (not pinned) so it pushes
  up as you scroll. Back/wishlist stay fixed so you can always get out.
- **White rounded sheet pulls up over the stage**, `flexGrow:1` so it always fills to the bottom
  (one seamless white surface). No drop shadow.
- **Floating CTA**: transparent footer (`pointerEvents="box-none"`) + a transparent→white
  `LinearGradient` fade behind the pill so content dissolves under it. The pill hovers.
- **Quantity belongs with configuration** (next to size selection), not buried in the buy bar.
- Multi-item info (accords, details) → **even 2-column dot lists** (amber dots), which scale cleanly
  from 1–7 items; short note lists → a single flowing ` · ` line.

## Motion
- Built-in **`Animated` + `LayoutAnimation`** (no native rebuild). `react-native-reanimated` is NOT
  installed — a true card→detail shared-element transition needs it.
- Patterns in use: sheet **rise + fade** on mount, quantity **pop** on change, heart **pop** on
  toggle, CTA **press-spring** (scale in/out), **animated layout** on read-more / stock swaps.
- Ease-out, subtle, **no bounce/elastic**. Motion is part of the build, not an afterthought.
- Pair state changes with **haptics** (`Haptics.selectionAsync` on selects, `notificationAsync` on
  success). Tap targets ≥ 44pt.

## Edge cases (non-negotiable)
- Every state has a **way back** — loading and error screens render the back button too.
- **Skeletons, not bare "Loading…"** (pulsing placeholder blocks).
- **Out of stock** swaps the CTA to "Notify me when back in stock" and hides quantity.
- **Honest affordances** — controls reflect real, persisted state (wishlist heart → `lib/wishlist.ts`,
  cart → `lib/cart.ts`).
- "Read more" uses **true line-count** (hidden measurer), not a char-count guess, and offers "Read less".

## Responsiveness
- Use **`useWindowDimensions()`**, never module-load `Dimensions.get()` (no rotation/iPad/foldable
  reactivity). **Clamp** proportional sizes (e.g. hero height `clamp(260, 46%, 460)`).

## Anti-AI checklist (run before shipping a screen)
- [ ] Not the default white + single-sans stacked template
- [ ] No chip grids, no stat-row "label-over-value" columns
- [ ] No gradient slabs, no glassmorphism-by-default
- [ ] No eyebrow/flourish on every section
- [ ] Hierarchy is intentional (one thing leads), spacing rhythm is varied, not metronomic
- [ ] Motion present and purposeful; haptics on key actions
- [ ] Contrast ≥ AA for text

## Data note
Richer perfume detail (year, scent family, accords, descriptions) is pulled from Fragrantica via the
jina reader proxy — `scripts/enrich-from-fragrantica.mjs` → `supabase/seed_fragrantica.sql`. Bottle
images load via `scripts/load-product-images.mjs` (optional background-removal cutout).
