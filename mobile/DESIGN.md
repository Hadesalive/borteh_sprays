# Borteh Mobile — Design Direction ("Maison")

The language for the mobile storefront. Start every screen from these rules so it lands at
"nearly right" instead of being relitigated. Tokens live in `lib/theme.ts`; the source of truth
for the look is the Claude Design canvas *Borteh Mobile Redesign* (imported 2026-07).

## Direction
**Editorial restraint — premium perfume retail (Aesop / Le Labo / SSENSE).** Paper base, near-black
ink, one bronze accent. Squared, quiet, type-led. The photography and the serif do the work; chrome
recedes. If a screen could be mistaken for a generic shopping-app template, it's wrong — rework the
premise, not the spacing.

## Color — `lib/theme.ts` (no gradients, anywhere)
| Token | Value | Use |
|---|---|---|
| `paper` | #FAF8F5 | app background |
| `surface` | #F2EEE7 | image beds, fills, skeletons |
| `ink` | #221E19 | text, primary buttons, active nav |
| `ink60` | #6F675C | secondary text |
| `ink40` | #A39A8D | tertiary, inactive icons, placeholders |
| `line` | #E4DFD6 | 1px borders & separators (used **instead of** shadows) |
| `accent` | #8A5327 | bronze — links, active selection, **one moment per screen** |
| `success` | #33714D | functional only (in stock, order placed) |
| `error` | #A63A2B | functional only (errors, destructive, sign-out) |
| `warning` | #94620D | functional only (low stock, awaiting confirmation) |

Bronze is spent **once per screen** — the active choice or the single link. Never decoration.

## Typography — exactly two faces
- **Display: Instrument Serif** 400 (`font.serif`) — screen titles, section heads, product names,
  prices ≥ 20px. Italic (`font.serifItalic`) is available but rare.
- **UI / body: Archivo** 400 / 500 / 600 (`font.regular / medium / semibold`).
- **Scale (size / line), nothing outside it:** 12/16 · 14/20 · 16/24 · 20/26 (serif) · 24/30 (serif)
  · 32/38 (serif). Use `AppText` variants — don't hand-roll sizes.
- **Label:** Archivo 600, 12px, uppercase, 0.08em tracking (`label` token). The one treatment for
  buttons, eyebrows, tab labels, tags. Not an eyebrow on *every* section — it's a deliberate accent.

## Spacing · radius · elevation · icons
- **4px grid:** 4 / 8 / 12 / 16 / 24 / 32 / 48. Screen gutter = 24.
- **Radius 0 — squared everything.** The only round things are avatars, notification dots,
  toggle knobs, and `FrostCircle` (`radius.circle`).
- **Elevation: none.** No drop shadows, no blur, no glass. 1px `line` borders separate layers.
  **Two sanctioned exceptions:** `FrostCircle` (in `ui.tsx`) — a frosted round bed behind the
  product-hero back/heart, which float over full-bleed photography with content scrolling under
  them. Functional contrast only, never decoration. **Card hearts don't get a bed** — they use a
  paper-filled heart layered under the ink glyph (halo, zero chrome; see `ProductCard`).
  And `NotificationToast` — the in-app heads-up banner is a solid **ink**, **rounded** card in
  messenger anatomy: the status glyph rides a semantic color chip (the "avatar"), "Borteh" is
  the sender. It mimics a *system* notification, not page chrome, so the radius-0 / one-accent
  rules don't govern it — standing out over any screen IS its function.
- **Status bar rule:** icons are always ink-on-paper. Photo-topped screens keep the photo *below*
  the top inset (Onboarding) or run a fixed paper mask over the inset (Product). Dark scrims
  (Filter, QuickPeek) flip `StatusBar` to `light` while open. Never let imagery or scrolled text
  sit under the clock.
- **Icons: Phosphor `regular`** weight (`weight="regular"`), 20px inline · 24px nav/actions. Active
  tab and a saved heart use `weight="fill"`. No emoji.

## Components — screens compose ONLY these (`components/`)
- **Button** — h52, squared, one primary per screen. Primary: ink bg / paper label. Secondary: 1px
  ink border. Ghost: underlined label. Label is 12px uppercase tracked. A price rides in the label:
  "Add to bag — Le 680".
- **Input / Field** — h52, paper bg, 1px `line` border, squared; label above in 12px uppercase
  `ink60`. Error: `error` border + `error` helper line beneath.
- **ProductCard** — 3:4 image on a `surface` bed, `ph-heart` (24) top-right; below: serif 20 name,
  12px `ink60` "brand · notes", 14/500 price. **Flat** — no border, no shadow on the card.
- **ListRow** — h56, 1px `line` separators, optional left icon (20), trailing value + `ph-arrow-right`
  (20). The workhorse for menus, info rows, orders.
- **Badge** — squared, 1px border, 12px uppercase; tinted only for semantic states (in stock / low /
  out / awaiting).
- **TabBar** — full-width, paper bg, 1px top border; 4 items (Home · Shop · Saved · Bag), icon 24 +
  12px label; active `ink` (fill icon), inactive `ink40`.
- **Header** — back (`ph-arrow-left` 24) at the gutter, serif 24 title below, always left-aligned.
  Every top-level screen (tabs, Bag, Checkout) carries `HeaderActions` (bell + avatar) top-right.
- **EmptyState / Skeleton** — `surface` blocks, **no spinners**.

## Motion (kept from the build ethos)
- Built-in **`Animated` + `LayoutAnimation`** — `react-native-reanimated` is NOT installed.
- Subtle and ease-out, **no bounce/elastic**: sheet rise + fade on mount, quantity pop, heart pop,
  CTA press-spring. Motion is part of the build, not decoration.
- Pair state changes with **haptics** (`Haptics.selectionAsync` on selects, `notificationAsync` on
  success). Tap targets ≥ 44pt.

## Edge cases (non-negotiable)
- Every state has a **way back** — loading and error screens render the back control too.
- **Skeletons, not "Loading…"** — pulsing `surface` blocks.
- **Out of stock** swaps the CTA to "Notify me when back in stock" and hides quantity.
- **Honest affordances** — controls reflect real, persisted state (wishlist → `lib/wishlist.ts`,
  cart → `lib/cart.ts`).
- Guard fixed-height text with `maxFontSizeMultiplier` (≈1.2–1.3) so Dynamic Type can't shatter
  buttons/steppers.

## Responsiveness
- Use **`useWindowDimensions()`**, never module-load `Dimensions.get()`. **Clamp** proportional
  sizes (e.g. hero height between a floor and ceiling).

## Anti-AI checklist (run before shipping a screen)
- [ ] Squared, paper/ink, two faces — not the default white + single-sans template
- [ ] Bronze appears **once**; no gradient slabs, no glass, no drop shadows
- [ ] Hierarchy is intentional (one thing leads); the serif carries the display, Archivo the rest
- [ ] Labels are used deliberately, not stamped above every block
- [ ] Motion present and purposeful; haptics on key actions
- [ ] Contrast ≥ AA for text

## Auth note
Login is **phone + password, no OTP** (SMS is too costly) — admin-assisted recovery. The redesign's
"Verification / OTP" screen is intentionally **not** built. Signup is phone-first (email optional).

## Data note
Screens read live from Supabase via React Query (`lib/api.ts`, `lib/*`). The redesign is a reskin +
restructure over that data layer — presentation changes, the data plumbing stays.
