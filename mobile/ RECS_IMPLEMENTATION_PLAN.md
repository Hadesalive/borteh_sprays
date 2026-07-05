# Borteh Sprays — Personalized Home Feed: Full ML Implementation Plan

End-to-end plan for the recommendation system powering the mobile app home screen.
Stack assumptions: Supabase (Postgres + pgvector), Node/Payload backend, React Native mobile app, Python for ML services. Execute phases in order — each phase ships something working on its own.

---

## Phase 0 — Foundations (½ day)

**Goal:** the ground the whole system stands on.

1. Enable pgvector on Supabase: `create extension if not exists vector;`
2. Create a dedicated schema `recs` so ML tables stay separate from app tables.
3. Confirm product data quality: every product MUST have fragrance family, top/heart/base notes, brand, description, price, and active status. The content model is only as good as this data — audit and backfill gaps in the CMS before anything else.
4. Create a `recs_config` table (key/value) for tunables: recency half-life days, module toggles, feed length, blend weights. Everything tunable lives here, nothing hardcoded.

**Done when:** pgvector enabled, product catalog audit passes with zero products missing notes/family.

---

## Phase 1 — Event Pipeline (2–3 days) — build FIRST, everything depends on it

**Goal:** clean first-party interaction data flowing from day one.

### 1.1 Schema

```sql
create table recs.events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  anon_id text,                          -- device id before sign-in, merged on auth
  event_type text not null check (event_type in
    ('view','dwell','search','filter','add_to_bag','remove_from_bag',
     'purchase','wishlist_add','wishlist_remove','notify_subscribe',
     'review','not_interested','module_impression','module_tap')),
  product_id uuid,
  module text,                           -- which home module served it (context!)
  position int,                          -- rank position within the module
  metadata jsonb default '{}',           -- dwell_ms, search query, filter values
  created_at timestamptz not null default now()
);
create index on recs.events (user_id, created_at desc);
create index on recs.events (product_id, event_type);
```

RLS: users can insert only their own events; no client read access; service role reads for training.

### 1.2 Implicit feedback weights (store in recs_config)

view=1, dwell>10s=2, wishlist_add=3, add_to_bag=4, purchase=5, notify_subscribe=3, review=4, not_interested=-3, remove/wishlist_remove=-1.

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

1. Phase 0 + 1.1–1.2 (SQL migrations, RLS, config)
2. Phase 1.3 (mobile event batching + instrumentation)
3. Phase 1.4 + 2.1–2.2 (rollup, embedding job, similar scents live)
4. Phase 2.3–2.4 (taste vectors, quiz, feed assembly v1)
5. Phase 3 (ALS job + blend + guardrails)
6. Phase 4 (features, ranker training, FastAPI service, fallback chain)
7. Phase 5 (eval harness, A/B, admin panel)
8. Phase 6 (hardening, runbook)

One session per line, each ends with something running. Keep this file in the repo root and point each session at its phase.