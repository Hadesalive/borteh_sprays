# Onboarding scent quiz — design

**Date:** 2026-07-20
**Status:** approved (scope + signals confirmed by owner)

## Problem

The onboarding "scent taste" step is a flat 40-chip `ScentPicker` plus a gender toggle. It works
and seeds the taste vector, but it asks nothing that builds a *profile* and reads as an
afterthought. With real vendor stock now live and a TestFlight beta imminent, first-run
personalization is the app's first impression and needs to feel deliberate.

## Goal

A short, real quiz (5 steps) that captures a richer signal, seeds the recommendation taste
vector more sharply (including scents to push AWAY), works signed-out, and ends on a payoff that
tells the user what it learned.

## What it captures

| Step | Question | Stored as | Feeds |
|------|----------|-----------|-------|
| 1 | Who's it for | `gender` | taste gender filter |
| 2 | Scent world (Fresh / Warm & spicy / Sweet & gourmand / Woody & oud / Floral) — multi | `scent` (loved, families) | taste seed (+) |
| 3 | Intensity (subtle ↔ bold) + Sweetness (dry ↔ sweet) | `intensity`, `sweetness` | expand loved terms |
| 4 | Love these / Not these — curated note grid, per direction | `scent` (loved) / `avoid` | taste seed (+ / −) |
| 5 | Occasion (everyday/office/date night/going out — multi) + Budget band | `occasion`, `budget` | stored for ranking/filter |
| — | Result card: "Your profile: warm · sweet · oud-forward" | — | payoff, then seeds + enters app |

Budget is captured but soft: prices are still placeholders until the owner sets them, so it is
stored for later ranking, not used to hard-filter yet.

## Data model

Extend the existing `recs.user_scent_prefs (user_id, kind, value)` — no new table.
- Add `weight numeric not null default 1` (additive; supports weighted loves later).
- `kind` is free text (no check constraint), so new kinds `avoid`, `intensity`, `sweetness`,
  `occasion`, `budget` need no schema change.

New RPC `public.fn_set_quiz_prefs(p_loved text[], p_avoided text[], p_gender text, p_dims jsonb)`:
1. Replace the caller's prefs (delete + insert loved as `scent`, avoided as `avoid`, gender,
   and each `p_dims` entry as its own kind row — occasion arrays expand to multiple rows).
2. Seed the taste vector as
   `l2_normalize( Lc − Ac * fill(0.5) )`
   where `Lc = l2_normalize(sum(embedding of loved-matching products))` and
   `Ac = l2_normalize(sum(embedding of avoid-matching products))`, gender-filtered. The
   `array_fill(0.5, [384])::vector` scale is the same proven trick used in
   `20260706090025_recs_taste_vectors.sql`. Avoided scents rotate the vector away from that
   region rather than just being absent.
3. Return the count of loved-matching products (0 = nothing in catalog yet; prefs still saved).

The old `fn_set_scent_prefs` stays (settings picker, back-compat). "Seed only, behavior wins":
the nightly rollup overwrites taste from real engagement once events accrue.

## Answer → term mapping (client side)

The quiz maps its friendly answers to the family/note terms the catalog actually carries, so the
RPC stays generic. e.g. direction "Warm & spicy" → `["Amber","Spicy","Woody"]`; intensity "bold"
adds `["Oud","Amber"]`; sweetness "sweet" adds `["Vanilla","Gourmand"]`. Avoid picks map straight
to their terms. Mapping lives in `mobile/lib/quiz.ts` so it is unit-testable and tweakable
without touching UI.

## UI

- New `mobile/components/quiz/` — one presentational component per question type (SingleChoice,
  MultiChoice card grid, a two-ended Segment for intensity/sweetness, NoteGrid with love/avoid
  toggle) + a `QuizResult` card. Each is dumb: props in, `onChange` out.
- `mobile/app/onboarding.tsx` drives the flow: intro slides (unchanged) → quiz steps → result →
  `saveScentPrefs`/`saveQuizPrefs` → `markOnboarded` → `/(tabs)`.
- Keeps the existing Maison design language (paper/ink/bronze, squared chrome, `AppText`
  variants, haptics on every selection). Progress dots already exist.
- Fully skippable at every step (Apple + good UX); skipping saves nothing and enters the app.
- Signed-out: answers saved locally via `saveScentPrefs`/new local mirror; pushed on sign-in by
  the existing `syncScentPrefs`, extended to the new fields.

## Non-goals

- No change to ranking to *consume* occasion/budget yet (captured now, wired later).
- No new analytics events beyond what exists.
- Settings scent editor keeps the simple picker for now.

## Risks

- Migration is not locally testable (no Docker). Mitigation: parse with the real Postgres
  grammar (`scripts/check-migration-syntax.mjs`), verify every referenced column via REST, and
  reuse only pgvector patterns already proven in shipped migrations. Owner pushes it alongside
  the recs migration; `scripts/verify-recs.mjs`-style check confirms.
- Budget signal is soft until real prices exist — surfaced in copy, not used to hard-filter.
