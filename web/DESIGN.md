# Design

Visual system for the **Borteh admin dashboard** — a clean, restrained, quietly premium product UI. All color in OKLCH. Tokens live in `src/app/globals.css`; this file is the rationale.

## Theme

- **Register:** product (a tool; design serves the task).
- **Mood:** "the back office of a fragrance house as a precise instrument" — composed, exact, premium through restraint rather than decoration.
- **Default mode:** light; a warm near-black dark theme is defined for evening use.
- **Color strategy:** Restrained. Neutral surfaces carry the structure; **ink (near-black) is the primary** for actions, active nav, and the headline stat panel; a single **brass** accent marks brand/loyalty/active moments. No rose, no second hue — identity comes from type, iconography, and the ink/brass discipline.
- **Anti-AI stance:** explicitly avoids the defaults a model reaches for — no rose/indigo/purple, no warm-cream background, no Inter+serif pairing, no icon-in-tinted-square. Background stays pure white; warmth is a whisper in the neutrals, not a tint.

## Color

Pure-white surfaces, warm-neutral grays (hue ~75–80, chroma ≤0.006), **ink** primary, **brass** accent (`--gold` token, ~oklch(0.58 0.095 78)). Semantic vocab: success / warning / danger / info, each as fill + `-soft` bg + ink-on-soft. Charts are brass-led (`--chart-1`) with neutral graphite/steel/clay/sage support. Full light + dark token sets in `globals.css`.

Text-on-fill: white on ink/saturated fills; dark ink only on `-soft` tints. Body text ≥7:1, muted ≥4.5:1. Focus ring is brass.

## Typography

A **sans + display-grotesque + mono** trio, deliberately **serif-free** (the inverse of the Inter-plus-a-serif AI reflex).

- **UI (everything — headings, labels, buttons, body):** `Hanken Grotesk` → `--font-sans`.
- **Wordmark + rare brand moments:** `Bricolage Grotesque` → `--font-display` (`.font-display`). Never on UI labels.
- **Data — money, stock, counts, KPIs:** `JetBrains Mono` → `--font-mono`, applied via `.nums` with tabular figures. Numerals read like an instrument and align in columns.
- **Scale:** fixed rem, ratio ≈1.2, no clamp. Weights 400/500/600. Headings tracking ≈ -0.01em.

## Iconography

**Phosphor, duotone weight**, everywhere. Global default for client components via `IconProvider` (`IconContext` weight `duotone`); **server components import from `@phosphor-icons/react/dist/ssr` and pass `weight="duotone"`** (the SSR entry avoids the React-context crash in RSC). One family, paired with plain-English labels on critical actions.

## Spacing & Layout

- Base unit 4px; radius `--radius` 0.5rem (tighter = more precise). Vary spacing for rhythm.
- **App shell:** collapsible left sidebar (near-white, label-free groups split by a separator) + slim top bar + content on white. Panels are cards with a 1px border; not everything is a card.
- Density where the work needs it (tables, ledgers); calm elsewhere. Flexbox 1D, Grid 2D. Responsive is structural (collapse sidebar, responsive tables), never fluid type.
- Z-index scale: dropdown 10 · sticky 20 · backdrop 30 · modal 40 · toast 50 · tooltip 60.

## Components

shadcn/ui on **Base UI** (`@base-ui/react`) — use the `render` prop, not `asChild`; `nativeButton={false}` when a `Button` renders a link. Every interactive element has default/hover/focus-visible/active/disabled/loading. Status pills use semantic `-soft` bg + ink. Product imagery (perfume bottles, via next/image) carries color in lists and catalog; the chrome stays restrained. Tables: sticky header, hairline rows, row hover, right-aligned mono money, skeleton loading, teaching empty states. Dialogs sparing; prefer inline. Command palette (⌘K) for power navigation.

## Motion

150–220ms, ease-out; state-only (open/close, commit, status advance, toast), never page-load choreography. Skeletons over spinners. Honor `prefers-reduced-motion`.
