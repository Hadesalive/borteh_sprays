-- 20260621090012_review_name.sql
-- Reviews are written client-side (RLS rev_insert), but app_user is readable only by its owner,
-- so a review can't join to the author's name. Snapshot the reviewer's display name on the row.
alter table public.review add column if not exists reviewer_name text;
