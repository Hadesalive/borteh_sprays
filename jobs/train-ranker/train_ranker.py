# pyright: reportMissingImports=false
# ^ deps (numpy/psycopg/lightgbm/scikit-learn) live in requirements.txt and are installed only
#   at activation — see README. This is an offline job, never imported by the app/tsc build.
"""
Phase 4 — learning-to-rank trainer (SCAFFOLD; activate at ~10k events).

Until there's enough labelled data, a learned ranker can't beat the Phase 2-3 rules feed, so
this stays dormant: `recs.config.rank.enabled` is false and serving falls back to the rules
feed. When the data is there, this job:

  1. pulls labelled examples (recs.fn_training_examples) + the SHARED feature layer
     (recs.fn_candidate_features) — the exact same features used at inference,
  2. trains a LightGBM LGBMRanker (lambdarank / NDCG), grouped by user, time-split
     (train on the earlier days, validate on the most recent),
  3. evaluates NDCG@10 vs a popularity baseline,
  4. ONLY if it beats the baseline: writes the artifact + metrics to recs.model_registry and
     flips it active. A worse/degenerate model is never activated — serving keeps the last good
     one (or the rules fallback).

Python (not Node) is deliberate here: LightGBM's LGBMRanker has no Node equivalent. This is the
only Python in the stack, and it only runs offline/nightly once activated.

Run:
  cd jobs/train-ranker && pip install -r requirements.txt
  DATABASE_URL=postgres://postgres:...@db.<ref>.supabase.co:5432/postgres python train_ranker.py
(recs.* is not reachable via PostgREST, so this uses a direct Postgres connection.)
"""

import os
import json
import numpy as np
import psycopg
import lightgbm as lgb
from sklearn.metrics import ndcg_score

# Feature order MUST match what the serving layer feeds the model; it's persisted in the registry.
FEATURES = [
    "taste_sim", "cf_score", "pop_7d", "pop_30d", "price_dist", "family_match",
    "brand_affinity", "days_since_seen", "product_age_days", "stock_level",
    "user_event_count", "rating", "review_count",
]
MIN_EXAMPLES = 2000        # refuse to train on too little data (would underperform the rules feed)
HOLDOUT_FRACTION = 0.25    # most-recent quarter of days = validation (time-based, never random)


def fetch_examples(conn):
    """Labelled (user, product, label, day) rows joined to the shared feature layer, per user."""
    rows = conn.execute(
        """
        select t.user_id::text, t.label, t.group_day,
               f.taste_sim, f.cf_score, f.pop_7d, f.pop_30d, f.price_dist, f.family_match,
               f.brand_affinity, f.days_since_seen, f.product_age_days, f.stock_level,
               f.user_event_count, f.rating, f.review_count
        from recs.fn_training_examples() t
        join lateral recs.fn_candidate_features(t.user_id, array[t.product_id]) f
          on f.product_id = t.product_id
        order by t.group_day, t.user_id
        """
    ).fetchall()
    return rows


def time_split(rows):
    days = sorted({r[2] for r in rows})
    if len(days) < 2:
        return rows, []
    cut = days[int(len(days) * (1 - HOLDOUT_FRACTION))]
    return [r for r in rows if r[2] < cut], [r for r in rows if r[2] >= cut]


def to_xygroups(rows):
    """Return feature matrix X, labels y, and lambdarank group sizes (consecutive same-user)."""
    X = np.array([r[3:] for r in rows], dtype=float)
    y = np.array([r[1] for r in rows], dtype=int)
    groups, last, n = [], None, 0
    for r in rows:
        if r[0] != last and last is not None:
            groups.append(n); n = 0
        last, n = r[0], n + 1
    if n:
        groups.append(n)
    return X, y, groups


def ndcg_at_10(model_or_none, rows):
    """NDCG@10 averaged over user groups; model_or_none=None ⇒ popularity (pop_7d) baseline."""
    scores_all, from_idx = [], 0
    _, _, groups = to_xygroups(rows)
    X = np.array([r[3:] for r in rows], dtype=float)
    preds = model_or_none.predict(X) if model_or_none is not None else X[:, FEATURES.index("pop_7d")]
    vals = []
    for g in groups:
        sl = slice(from_idx, from_idx + g); from_idx += g
        true = np.array([r[1] for r in rows[sl]])
        if len(true) < 2 or true.max() == 0:
            continue
        vals.append(ndcg_score([true], [preds[sl]], k=10))
    return float(np.mean(vals)) if vals else 0.0


def main():
    db = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not db:
        raise SystemExit("Set DATABASE_URL (direct Postgres connection).")

    with psycopg.connect(db) as conn:
        rows = fetch_examples(conn)
        if len(rows) < MIN_EXAMPLES:
            print(f"Only {len(rows)} labelled examples (< {MIN_EXAMPLES}). "
                  f"Not enough to beat the rules feed — leaving rank.enabled off.")
            return

        train, valid = time_split(rows)
        Xtr, ytr, gtr = to_xygroups(train)
        model = lgb.LGBMRanker(objective="lambdarank", metric="ndcg",
                               n_estimators=300, learning_rate=0.05, num_leaves=31)
        model.fit(Xtr, ytr, group=gtr)

        eval_rows = valid or train
        ndcg = ndcg_at_10(model, eval_rows)
        baseline = ndcg_at_10(None, eval_rows)
        print(f"NDCG@10 ranker={ndcg:.4f}  baseline={baseline:.4f}")

        if ndcg <= baseline:
            print("Ranker does not beat the popularity baseline — NOT activating.")
            return

        version = f"ranker-{max(r[2] for r in rows):%Y%m%d}-{len(rows)}"
        artifact = f"models/{version}.txt"
        model.booster_.save_model(artifact)  # TODO: upload `artifact` to the Supabase storage bucket
        metrics = {"ndcg10": ndcg, "baseline_ndcg10": baseline, "examples": len(rows)}
        with psycopg.connect(db) as w:
            w.execute("update recs.model_registry set is_active = false where is_active")
            w.execute(
                "insert into recs.model_registry(model_version, feature_list, artifact_path, metrics, is_active) "
                "values (%s, %s, %s, %s, true)",
                (version, json.dumps(FEATURES), artifact, json.dumps(metrics)),
            )
            w.execute("update recs.config set value = 'true'::jsonb where key = 'rank.enabled'")
        print(f"Activated {version}: {metrics}")


if __name__ == "__main__":
    main()
