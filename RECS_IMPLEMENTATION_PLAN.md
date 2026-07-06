# Borteh Sprays — Personalized Home Feed: Full ML Implementation Plan

End-to-end plan for the recommendation system powering the mobile app home screen.
Stack assumptions: Supabase (Postgres + pgvector), Next.js admin (`web/`) reading Supabase directly, React Native/Expo mobile app, Python for later ML jobs. Execute phases in order — each phase ships something working on its own.

> **Repo reality & Session-1 adaptations (agreed 2026-07-05) — applies throughout.**
> - **No Payload CMS.** The admin is Next.js (`web/`) reading Supabase directly; any "CMS hook/pin" below means a Postgres/Next mechanism, decided in Sessions 3–4.
> - **Singular product schema:** `public.product` (not `products`); price on `public.product_variant.price_minor`; notes via `public.product_scent_note` → `public.scent_note` (`position` ∈ top/heart/base); family on `public.product.scent_family`.
> - **Dedicated `recs` schema, NOT exposed to PostgREST.** All ML tables live there. Tunables live in **`recs.config`** (key / jsonb value), not a public `recs_config`.
> - **Sole client write path:** `public.fn_track_events(jsonb)` — SECURITY DEFINER, forces `user_id := auth.uid()`. Clients never touch `recs.events`; RLS is defense-in-depth.
> - **`events.user_id` is nullable** with `check (user_id is not null or anon_id is not null)` for pre-sign-in anon events.

---

## 📍 Status & Roadmap — updated 2026-07-06

**Phases 0–3 are LIVE; Phase 4 is scaffolded.** The recommender personalizes the mobile home end-to-end today; the learned-ranking layer is built and waiting on data.

### Progress at a glance
| Phase | What | Status | Key migrations / files |
|---|---|---|---|
| 0 Foundations | pgvector, `recs` schema, `recs.config`, catalog audit gate | ✅ live | `…090013`; `scripts/recs-audit-products.mjs` |
| 1 Event pipeline | events + RLS + `fn_track_events`; mobile instrumentation (14 event types); anon→user merge; nightly profile rollup | ✅ live | `…090014`, `…090016`, `…090019`; `mobile/lib/track.ts` |
| 2 Content engine | product embeddings (MiniLM) + HNSW + `fn_similar_products` → product-page "Similar scents"; taste vectors + "Picked for you"; cold-start quiz; personalized home feed | ✅ live | `…090020/25/26`; `jobs/embed-products.mjs`; `mobile/lib/feed.ts` |
| 3 Collaborative filtering | item-item co-occurrence, `cf_candidates`, `fn_cf_picks`, kill-switch + guardrail, "Recommended for you" rail | ✅ built (data-gated) | `…151536` |
| 4 Learning-to-rank | **scaffolding only**: feature layer, training-example generator, model registry, ranker kill-switch, LGBMRanker trainer skeleton | ✅ scaffolded (needs data) | `…160502`; `jobs/train-ranker/` |
| 5 Eval & A/B + admin panel | offline NDCG/recall harness, stable A/B buckets, admin "Home algorithm" panel | ⬜ not started | — |
| 6 Hardening | feed cache, privacy cascade, health view, runbook | ⬜ not started | — |

### What the customer experiences today
Signed-in home = **Picked for you** · **Recommended for you** (CF) · **Because you viewed X** · **Back in stock for you** · **Still thinking about it** · **New in [family]** · **Trending** — deduped, thin rows hidden, never blank. New users get a **3-tap quiz** + Trending. Product pages show **embedding-based Similar scents**. Automation: editing a product re-embeds within ~a minute (GitHub Action via DB trigger); nightly pg_cron refreshes profiles + taste vectors + CF.

### ⚠️ Owner action items — DO NOW
1. **Push pending recs migrations:** `supabase db push` → applies `…090025` (taste), `…090026` (feed modules), `…151536` (CF), `…160502` (ranker scaffold). (`…090013`–`…090020` already pushed.)
2. **Seed taste vectors once** so existing users get "Picked for you" immediately (else wait for 02:00 UTC nightly): `select recs.fn_refresh_user_profiles();`
3. **Reload the mobile app** to pick up the personalized-home code.
4. **After any big catalog change:** re-run `node scripts/recs-audit-products.mjs` (blocks family-less products from the recs).

### What to do next — and WHEN

**A. Activate the ranker (Phase 4 serving) — WHEN `recs.events` has ~10k+ rows with real `module_tap` volume.** Check `select count(*) from recs.events;`.
   1. Train: `cd jobs/train-ranker && pip install -r requirements.txt && DATABASE_URL=… python train_ranker.py` — only activates a model that beats the popularity baseline on a time holdout.
   2. Build the (~1) serving function: gather the candidate pool (existing module RPCs) → `fn_candidate_features` → score with the active model → ordered feed, with the fallback chain **model → rules feed → Trending**. Point `useHomeFeed` at it when `rank.enabled` is true.
   *Until then `rank.enabled=false` ⇒ the app already serves the rules feed. No gap, no rush.*

**B. Phase 5 (eval + A/B + admin "Home algorithm" panel) — WHEN ~2–4 weeks from a real launch** (needs live traffic to mean anything). Offline recall@10/NDCG@10 → `recs.eval_runs` (alert on >10% regression); stable hashed A/B buckets (ranker vs rules, ≥2 weeks); web admin panel over `recs.config` (module toggles, weights, kill-switches, per-module tap/ATB table, "preview feed as user X").

**C. Phase 6 (hardening) — WHEN pre-launch.** Per-user feed cache (session TTL, payload <30KB); privacy: user-deletion cascade to `recs.events` + profile (no FK today — add here); `recs.health` view + nightly job alerts; runbook (retrain, roll back a model, kill-switch to rules, reseed embeddings).

**D. Data quality (ongoing):** every active product needs `scent_family` + notes; keep the audit gate green.

### Config kill-switches (all in `recs.config` — tune with no deploy)
`feed.length` · `modules.enabled` · `blend.weights` · `recency.half_life_days` · `feedback.weights` · `cf.enabled` / `cf.min_events_for_cf` / `cf.model_freshness_hours` · `rank.enabled` / `rank.candidate_pool`.

---

## Phase 0 — Foundations (½ day) — ✅ DONE (Session 1)

**Goal:** the ground the whole system stands on.

1. `create extension if not exists vector;` (pgvector).
2. Dedicated `recs` schema (unexposed in PostgREST) so ML tables stay separate from app tables.
3. **Catalog audit gate:** every ACTIVE `public.product` MUST have `scent_family`, top+heart+base `product_scent_note`s, a brand, a `description`, and a priced active `product_variant`. Script `scripts/recs-audit-products.mjs` (anon REST, exits non-zero on any gap). BLOCKING — backfill gaps in the admin before anything else.
4. `recs.config` (key / jsonb value / description) holds every tunable: recency half-life, feed length, blend weights, module toggles, and the Phase 1.2 feedback weights. Nothing hardcoded.

**Done when:** pgvector enabled, `recs.config` seeded, catalog audit passes with zero products missing notes/family.

_Files: `supabase/migrations/20260705090013_recs_foundations.sql`, `scripts/recs-audit-products.mjs`._

---

## Phase 1 — Event Pipeline (2–3 days) — build FIRST, everything depends on it

**Goal:** clean first-party interaction data flowing from day one.

### 1.1 Schema — ✅ DONE (Session 1)

`recs.events` — append-only, in the unexposed `recs` schema. As-built:

```sql
create table recs.events (
  id          bigint generated always as identity primary key,
  user_id     uuid,                                  -- forced to auth.uid() by the RPC; nullable for anon
  anon_id     text,                                  -- device id before sign-in; merged on auth
  event_type  text not null check (event_type in
    ('view','dwell','search','filter','add_to_bag','remove_from_bag',
     'purchase','wishlist_add','wishlist_remove','notify_subscribe',
     'review','not_interested','module_impression','module_tap')),
  product_id  uuid,                                  -- bare uuid (no FK): append-only log survives soft-deletes
  module      text,                                  -- which home module served it (context!)
  position    int,                                   -- rank within that module
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  constraint events_actor_present   check (user_id is not null or anon_id is not null),
  constraint events_surface_context check (
    event_type not in ('module_impression','module_tap')
    or (module is not null and position is not null)   -- context mandatory on every impression/tap
  )
);
create index on recs.events (user_id, created_at desc);
create index on recs.events (product_id, event_type);
create index on recs.events (anon_id, created_at desc) where anon_id is not null;
```

**RLS (defense-in-depth):** authenticated may INSERT only rows where `user_id = auth.uid()`; no client SELECT/UPDATE/DELETE; `service_role` reads for training. Clients never reach this table (schema unexposed) — the only write path is `public.fn_track_events(jsonb)` (SECURITY DEFINER; forces `user_id := auth.uid()`, batches inserts, clamps `created_at ≤ now()`, skips typeless rows). Proof: `supabase/tests/recs_events_rls.sql` (own-insert ✓ / cross-user ✗ / client read ✗ / service-role read ✓).

_Files: `supabase/migrations/20260705090014_recs_events.sql`, `supabase/tests/recs_events_rls.sql`._

### 1.2 Implicit feedback weights (stored in `recs.config`) — ✅ DONE (Session 1)

view=1, dwell>10s=2, wishlist_add=3, add_to_bag=4, purchase=5, notify_subscribe=3, review=4, not_interested=-3, remove/wishlist_remove=-1.

Seeded under `recs.config` key `feedback.weights` (+ `feedback.dwell_threshold_ms = 10000` for the ">10s" rule). `search`, `filter`, `module_impression`, `module_tap` carry no implicit weight — they are context/eval signals only.

### 1.3 Mobile client instrumentation

- Event batching module: queue events locally, flush every 15s or 20 events or on background, retry with backoff, drop after 24h. Never one request per event.
- Track: product view (with dwell timer on unmount), search submits + applied filters, all bag/wishlist/notify/review actions, long-press "Not interested".
- Track module_impression (section actually scrolled into viewport, once per session) and module_tap with module name + position. **Non-negotiable — this context is what makes Phase 4 evaluation and de-biasing possible.**
- Anonymous users get a persistent anon_id; on sign-in, backend merges anon events into user_id.

### 1.4 Nightly rollup

Materialized view or cron-built table `recs.user_profile`: per user — weighted top-3 fragrance families, price band (p25–p75 of engaged products), brand affinities, event counts, last_active. Refresh nightly. This powers rules, features, and debugging.

**Done when:** events visible in the table from a real device session, batching confirmed, profile rollup populates.

---## Phase 2 — Content-Based Engine with Embeddings (3–4 days) — ships visible features

**Goal:** "Similar scents", "Layers well with" candidates, and "Picked for you" v1 — works with zero interaction history.

### 2.1 Product embeddings

```sql
alter table products add column if not exists embedding vector(384);
create index on products using hnsw (embedding vector_cosine_ops);
```

- Python script `jobs/embed_products.py`: for each active product, build a text doc — `name, brand, fragrance family, concentration, top notes, heart notes, base notes, description` — embed with `sentence-transformers/all-MiniLM-L6-v2` (384-dim, local, free), upsert into the column.
- Run as a job triggered on product create/update (Payload hook → queue) + weekly full refresh. NEVER embed at request time.

### 2.2 Similarity queries (pure SQL, instant)

- Similar scents: `select * from products where id != :id and active order by embedding <=> (select embedding from products where id = :id) limit 8;`
- Exclude same product line/variants; optionally filter to ±40% price band.
- These power the product-detail "Similar scents" section immediately — wire that first, it's the fastest visible win.

### 2.3 User taste vector

- Nightly job: taste_vector(user) = Σ (event_weight × e^(−days_ago/14) × product_embedding) over last 90 days, normalized. Store in `recs.user_profile.taste_embedding vector(384)`.
- "Picked for you" v1 = nearest active, in-stock, not-owned products to taste vector.
- Taste quiz (3 taps: family, intensity, budget) → average embeddings of matching products → seed taste vector instantly. Cold start solved with the same math path.

### 2.4 Feed assembly v1 (rules, in the Node backend for now)

Modules: CMS-pinned (hero, featured — always at pinned positions), Picked for you, Because you viewed X, Layers well with X, Back in stock for you, Still thinking about it (max 1/session, item viewed 2+ times), New in [top family], Trending (7d weighted popularity — the universal fallback). Rules: module hides below 4 strong items; no two adjacent modules dominated by the same family; cap one family at 60% of feed; re-rank per session not per scroll; total feed length from recs_config.

**Done when:** home feed renders personalized modules for a test user with seeded events, cold-start user gets Trending + quiz card, product detail shows embedding-based similar scents.

---

## Phase 3 — Collaborative Filtering (2–3 days build; activate at ~50 active users / few thousand events)

**Goal:** learn "users like you also loved" signals content can't see.

- `jobs/train_als.py`: load events → weighted user×item matrix → ALS from the `implicit` library (factors=32, regularization=0.05, iterations=20 as starting point; tune later). Trains in seconds at this scale.
- Write top-50 candidates per user with scores into `recs.cf_candidates (user_id, product_id, score, model_version, created_at)`. Nightly cron (GitHub Actions scheduled job or a small VPS cron — no GPU, no special infra).
- Blend rule in feed assembly: where CF score exists and model_version is fresh (<48h), CF candidates join the pool; content-based fills gaps and low-confidence users. Users below 5 events stay pure content-based.
- Guardrail: if training fails or data looks degenerate (e.g. one product = >50% of interactions), keep serving the previous model version. Never serve a broken model.

**Done when:** nightly job writes candidates, blend visibly changes a heavy test user's feed, kill-switch toggle in recs_config works.

---

## Phase 4 — Learning-to-Rank (4–5 days build; activate when module_tap data is meaningful, ~10k+ events)

**Goal:** learned final ordering over all candidate sources. This is the differentiator layer.

### 4.1 Training data
From logged impressions/taps (Phase 1.3): each (user, product, module, position) impression is a row; label = engagement within session (tap=1, add_to_bag=2, purchase=3, none=0). Position bias mitigation: include position as a feature at training, set to constant at inference.

### 4.2 Features (~15, computed from tables you already have)
Embedding similarity (user taste ↔ product), ALS score (0 if none), product 7d/30d popularity, price distance from user band, family match flag, brand affinity, days since user last saw product, product age, stock level, user event count (proxy for profile confidence), module type, hour-of-day bucket.

### 4.3 Model + serving
- `jobs/train_ranker.py`: LightGBM LGBMRanker (lambdarank, NDCG objective), grouped by user-session. Time-based split: train on weeks 1–3, validate week 4 — never random split on temporal data.
- Save model artifact + feature list versioned in a `recs.model_registry` table (storage bucket for the file).
- FastAPI service `recs-service`: `GET /feed/:userId` → gather candidates (CF + content + trending) → compute features → score → apply diversity rules → return ordered module JSON. Target <50ms; precompute everything precomputable nightly.
- Node backend calls it with a 300ms timeout → falls back to Phase 2 rules feed → falls back to CMS default. **Personalization can never break or blank the home screen.**

**Done when:** offline NDCG@10 of ranker beats popularity baseline on held-out week; service p95 <100ms; fallback chain verified by killing the service deliberately.

---

## Phase 5 — Evaluation & Experimentation (2 days, then ongoing) — do not skip

- **Offline harness** `eval/offline.py`: for each model version compute recall@10 and NDCG@10 on last-week holdout; append to `recs.eval_runs`. Run automatically after every training job; alert (or just log loudly) on regression >10%.
- **Online A/B:** hash user_id → bucket (stable). Variants: A = ranker feed, B = rules feed (Phase 2). Metrics per bucket from event logs: module tap-through, add-to-bag rate, purchase rate, session length. Minimum 2 weeks per test at your traffic. Assignment logged on every module_impression.
- **Dashboard integration:** "Home algorithm" panel in the admin — module toggles, pinned positions, feed length, blend weights (all backed by recs_config), per-module impression/tap/ATB table, current A/B readout, and "preview feed as user X".
- **Feedback-loop hygiene:** trending and popularity features computed from ALL events, not just recommended-surface events; keep 10% of feed slots as exploration (random eligible in-stock products in the last module) so the system keeps learning about the full catalog.

**Done when:** eval runs append automatically, A/B assignment verified stable, admin panel controls change the live feed.

---

## Phase 6 — Hardening & Ops (1–2 days)

- Latency: per-user feed cache (session TTL), all hot queries indexed, feed payload <30KB.
- Privacy: events are first-party only; user deletion cascades to events + profile; no PII inside metadata jsonb.
- Monitoring: nightly job success/failure notifications; a `recs.health` view (events last 24h, model freshness, cache hit rate).
- Runbook in repo README: retrain manually, roll back a model version, kill-switch to rules feed, reseed embeddings.

---

## Sequencing & Effort Summary

| Order | Phase | Effort | Activate when |
|---|---|---|---|
| 1 | 0 Foundations | ½ day | now |
| 2 | 1 Events | 2–3 days | now |
| 3 | 2 Content engine | 3–4 days | now (works day one) |
| 4 | 3 CF (ALS) | 2–3 days | ~50 active users |
| 5 | 4 Ranker | 4–5 days | ~10k events |
| 6 | 5 Eval/A-B | 2 days | with Phase 4 |
| 7 | 6 Hardening | 1–2 days | pre-launch + ongoing |

Build 0→2 now and ship; they deliver visible personalization immediately and start accumulating the data 3–5 need. Build 3–5's code whenever, but don't trust their output until the data thresholds hit. Total hands-on effort: roughly 3–4 weeks of focused sessions.

## Claude Code session map

1. ✅ Phase 0 + 1.1–1.2 (SQL migrations, RLS, config) — **DONE.** Files: `supabase/migrations/20260705090013_recs_foundations.sql`, `20260705090014_recs_events.sql`, `scripts/recs-audit-products.mjs`, `supabase/tests/recs_events_rls.sql`. ⚠️ Session 2 must first run the catalog audit gate against live data.
2. Phase 1.3 (mobile event batching + instrumentation) → calls `public.fn_track_events(jsonb)` (already built); assigns each device a persistent `anon_id`.
3. Phase 1.4 + 2.1–2.2 (rollup, embedding job, similar scents live)
4. Phase 2.3–2.4 (taste vectors, quiz, feed assembly v1)
5. Phase 3 (ALS job + blend + guardrails)
6. Phase 4 (features, ranker training, FastAPI service, fallback chain)
7. Phase 5 (eval harness, A/B, admin panel)
8. Phase 6 (hardening, runbook)

One session per line, each ends with something running. Keep this file in the repo root and point each session at its phase.