# Borteh recs — offline jobs

Batch ML jobs for the recommendation system. They run **offline** (your terminal or CI), never at request time.

## `embed-products.mjs` — product embeddings (Phase 2.1)

Builds a text doc per active product (name, brand, family, concentration, top/heart/base
notes, accords, description), embeds it with **all-MiniLM-L6-v2** (384-dim, local, free) via
transformers.js, and writes the vector into `public.product.embedding`. This powers the
product page's "Similar scents" (`fn_similar_products`) and, later, taste vectors.

### Setup (once)
```bash
cd jobs
npm install                     # pulls transformers.js; the ~90MB model downloads on first run
```
No extra config: the job reads `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (service role) and
writes via the REST API. Those already live in `scripts/.env` (auto-loaded), so if the audit
script works, this does too. (You can also put them in `jobs/.env` or the shell env.)

### Run
```bash
npm run embed        # embed only new/changed products (embedded_at null or stale)
npm run embed:all    # re-embed every active product
```

### When to run
- After bulk catalog edits (new products, changed notes/family/description).
- **Weekly full refresh** (`npm run embed:all`) — e.g. a cron or CI schedule.
- The migration `20260705090020_product_embeddings.sql` must be applied first (`supabase db push`).

### Verify
```sql
select count(*) filter (where embedding is not null) as embedded,
       count(*) as active
from public.product where is_active and deleted_at is null;
-- then, for any product id:
select product_id, distance from public.fn_similar_products('<uuid>', 8);
```
