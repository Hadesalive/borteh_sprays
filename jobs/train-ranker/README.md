# Ranker trainer (Phase 4 — learning-to-rank)

The learned layer that orders candidates from **all** sources (content/taste + CF + trending +
popularity) with one model. **Dormant until ~10k events** — before that a learned ranker can't
beat the rules feed, so `recs.config.rank.enabled` stays `false` and the app serves the Phase
2–3 rules feed. This directory is the ready-to-run scaffold.

## What's already in place (DB scaffolding, `…160502` migration)
- **`recs.fn_candidate_features(user, product_ids[])`** — the shared feature layer (~13 features:
  taste similarity, CF score, 7d/30d popularity, price distance from band, family match, brand
  affinity, days-since-seen, product age, stock level, user event count, rating, reviews). Used
  identically at train and inference time — no train/serve skew.
- **`recs.fn_training_examples()`** — labelled rows (purchase 3, add_to_bag 2, tap/wishlist 1,
  view-only 0) with module + position context, grouped by day for a time-based split.
- **`recs.model_registry`** — versioned artifacts + metrics; exactly one row is active.
- **`rank.enabled`** kill-switch + **`rank.candidate_pool`** cap in `recs.config`.

## Run (once there's data)
```bash
cd jobs/train-ranker && pip install -r requirements.txt
DATABASE_URL=postgres://postgres:...@db.<ref>.supabase.co:5432/postgres python train_ranker.py
```
It trains an `LGBMRanker` (lambdarank/NDCG), evaluates **NDCG@10 vs a popularity baseline** on a
time holdout, and **only activates a model that beats the baseline** (`model_registry` +
`rank.enabled=true`). A worse or degenerate model is never activated — the last good model (or
the rules fallback) keeps serving. Schedule nightly (cron/CI) alongside the embed job.

## Still to build at activation time (needs a trained model to exist)
- **Serving**: a scoring path that gathers the candidate pool (via the existing module RPCs),
  calls `fn_candidate_features`, scores with the active model, applies diversity rules, and
  returns the ordered feed. Options: a small FastAPI service (per the plan) or model inference
  in a Supabase Edge Function. It **must** keep the fallback chain: model → rules feed → Trending.
  Until then, `rank.enabled=false` means the app already serves the rules feed — no gap.
- Upload the saved artifact to a Supabase Storage bucket (the trainer writes it locally + records
  the path; wire the upload when the bucket exists).
