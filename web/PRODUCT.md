# Product

## Register

product

## Users

**Mr. Borteh — owner/admin (primary).** Runs a perfume shop in Freetown, Sierra Leone. Not highly technical. Works mostly on a laptop/desktop in the back office, occasionally on a mid-range Android phone. His jobs: keep one source of truth for stock across the counter and online, see what's selling, fulfil and dispatch orders reliably, set delivery fees, and read plain-language analytics without a data background.

**Shop assistant — counter staff (secondary).** Works the front counter on a shared device (often the Android browser). Records in-store (POS-lite) sales fast so the digital ledger matches the shelf, and makes simple stock adjustments. Wants minimum taps per sale and zero ambiguity.

Both operate on intermittent connectivity. The admin is online-first: reads are live; writes require a connection and must show clear "offline / retry" states. Auth is phone + password (no SMS OTP).

## Product Purpose

Borteh is a trust-first, data-frugal commerce system that unites a Freetown perfume shop's in-store counter and a new online channel onto a single inventory ledger, with the owner's own riders handling delivery. This admin dashboard is the owner's command center: catalog & inventory, POS-lite, orders & fulfilment, dispatch & riders, restock demand, and in-house analytics. Success is the owner trusting the numbers enough to run the whole business from this one screen — never overselling the last unit, always knowing what to restock, and seeing online demand he previously couldn't reach.

## Brand Personality

Three words: **trustworthy, composed, quietly premium.** The shop sells fragrance — an inherently sensory, refined category — but this is the back office, so the craft shows through restraint, not decoration: confident typography, a considered rose-and-gold palette, generous breathing room, and copy in plain, warm, clear English. The tool should feel like a well-made instrument the owner is proud to use, not a generic SaaS panel. Warmth comes from the brand color and type, never at the cost of legibility or speed.

## Anti-references

- Generic indigo/blue SaaS admin templates (the "Material dashboard" look) — no identity, no warmth.
- The hero-metric template: a wall of big-number stat cards with gradient accents.
- Identical card grids and nested cards standing in for real information design.
- Beige/cream/"warm-paper" backgrounds used to fake premium — the saturated AI default; warmth must live in the brand color, not the surface.
- Cramped, unstyled data tables with no states (the "it's just an admin tool" excuse).
- Decorative motion, gradient text, glassmorphism, side-stripe accent borders.

## Design Principles

- **The tool disappears into the task.** Earned familiarity over novelty; standard affordances done impeccably. Borrow the trust of Linear/Stripe/Notion, not their exact look.
- **Trust through precision.** Money, stock, and status are always exact, legible, and unambiguous (integer SLE minor units, "Le" formatting, clear order/payment states). Never make the owner guess.
- **Plain language, icon-supported.** Clear simple English plus consistent icons for low-literacy moments; no jargon, no clever labels.
- **Speed at the counter.** Fewest taps for the common path (record a sale, advance an order, assign a rider). Density where the owner needs it, calm where he doesn't.
- **Quiet confidence.** One restrained rose accent and a gold grace note carry the brand; the rest is structure, rhythm, and whitespace.

## Accessibility & Inclusion

- Target WCAG 2.1 AA: body text ≥4.5:1, large/UI text ≥3:1, visible focus states on every interactive element.
- English-only (simple, clear). "Le" currency display from integer minor units; SL phone numbers normalized to E.164 with one-tap `tel:` / WhatsApp deep links.
- Must work on a mid-range Android browser at the counter as well as desktop; responsive behavior is structural (collapsible nav, responsive tables), not fluid typography.
- Respect `prefers-reduced-motion`; never gate content visibility on animation.
- Clear offline/retry and error states on all writes, given intermittent connectivity.
