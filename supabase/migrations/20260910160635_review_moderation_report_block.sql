-- App Store Guideline 1.2 (user-generated content) for product reviews.
--
-- Apple requires four things of any app carrying user content: a filter that
-- keeps objectionable material from being posted, a way to report it, a way to
-- block abusive users, and published contact details. Only the last existed.
--
-- The review table was always designed for moderation — status defaults to
-- 'pending' and the admin has publish/reject tooling — but the mobile client
-- inserted with status 'published' explicitly, and the RLS insert policy let it,
-- so nothing was ever moderated. (mobile/lib/reviews.ts's own doc comment said
-- "Re-enters moderation as 'pending'" while the code did the opposite.)
--
-- This migration:
--   1. takes review writes away from clients entirely — they go through
--      fn_submit_review, which decides the status;
--   2. adds a maintainable word filter that routes a match to 'pending'
--      instead of publishing it;
--   3. adds reporting (a report hides the review pending staff review) and
--      per-user blocking (a blocked author's reviews disappear for you).

-- ---------------------------------------------------------------------
-- 1. Word filter
-- ---------------------------------------------------------------------
create table if not exists public.moderation_term (
  term       text primary key,
  created_at timestamptz not null default now()
);
comment on table public.moderation_term is
  'Words that route a review to moderation instead of publishing it. Staff may add terms without a migration; matching is case-insensitive on whole words.';

alter table public.moderation_term enable row level security;
drop policy if exists moderation_term_staff on public.moderation_term;
create policy moderation_term_staff on public.moderation_term
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- A starter list. Deliberately short: it exists so objectionable text is held
-- back rather than published, and staff extend it from the admin as needed.
insert into public.moderation_term(term) values
  ('fuck'), ('shit'), ('bitch'), ('cunt'), ('bastard'), ('asshole'),
  ('whore'), ('slut'), ('rape'), ('nigger'), ('faggot'), ('retard')
on conflict (term) do nothing;

/** True when the text trips the word filter (whole word, case-insensitive). */
create or replace function public.fn_text_is_flagged(p_text text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.moderation_term t
     where coalesce(p_text, '') ~* ('\m' || regexp_replace(t.term, '([^a-zA-Z0-9])', '\\\1', 'g') || '\M')
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Reports and blocks
-- ---------------------------------------------------------------------
create table if not exists public.review_report (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.review(id) on delete cascade,
  reporter_id uuid not null references public.app_user(id) on delete cascade,
  reason      text not null check (reason in ('offensive','spam','irrelevant','other')),
  detail      text,
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at  timestamptz not null default now(),
  constraint uq_review_report_once unique (review_id, reporter_id)
);
create index if not exists idx_review_report_open on public.review_report (status, created_at desc);
comment on table public.review_report is
  'A customer reporting a review as objectionable. Filing one hides the review pending staff review (App Store Guideline 1.2).';

create table if not exists public.user_block (
  blocker_id uuid not null references public.app_user(id) on delete cascade,
  blocked_id uuid not null references public.app_user(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint ck_no_self_block check (blocker_id <> blocked_id)
);
comment on table public.user_block is
  'One customer choosing not to see another customer''s reviews. Personal to the blocker; never visible to the blocked user.';

alter table public.review_report enable row level security;
alter table public.user_block enable row level security;

drop policy if exists review_report_own on public.review_report;
create policy review_report_own on public.review_report
  for select to authenticated using (reporter_id = auth.uid());
drop policy if exists review_report_staff on public.review_report;
create policy review_report_staff on public.review_report
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists user_block_own on public.user_block;
create policy user_block_own on public.user_block
  for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Reviews: clients may read, never write directly
-- ---------------------------------------------------------------------
-- Writes now go through fn_submit_review so the client cannot choose its own
-- moderation status. Reads additionally hide anyone the caller has blocked.
drop policy if exists rev_insert on public.review;
drop policy if exists rev_update on public.review;
drop policy if exists rev_read on public.review;
create policy rev_read on public.review for select to anon, authenticated
using (
  (status = 'published' or user_id = auth.uid())
  and not exists (
    select 1 from public.user_block b
     where b.blocker_id = auth.uid() and b.blocked_id = review.user_id
  )
);

/**
 * Create or update the caller's review of a product (one per product).
 * Returns the status it landed in: 'published', or 'pending' when the filter
 * held it back for staff.
 */
create or replace function public.fn_submit_review(
  p_product uuid,
  p_rating int,
  p_title text default null,
  p_body text default null,
  p_reviewer_name text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_status text;
begin
  if v_user is null then raise exception 'sign in to leave a review'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;
  if exists (select 1 from public.app_user u where u.id = v_user and u.is_blocked) then
    raise exception 'this account cannot post reviews';
  end if;

  v_status := case
    when public.fn_text_is_flagged(coalesce(p_title, '') || ' ' || coalesce(p_body, '') || ' ' || coalesce(p_reviewer_name, ''))
      then 'pending' else 'published' end;

  insert into public.review(product_id, user_id, rating, title, body, reviewer_name, status, updated_at)
    values (p_product, v_user, p_rating, nullif(trim(coalesce(p_title, '')), ''),
            nullif(trim(coalesce(p_body, '')), ''), nullif(trim(coalesce(p_reviewer_name, '')), ''),
            v_status, now())
  on conflict (user_id, product_id) do update
    set rating = excluded.rating, title = excluded.title, body = excluded.body,
        reviewer_name = excluded.reviewer_name, status = excluded.status, updated_at = now();

  return v_status;
end;
$$;

/** Report a review. Hides it immediately, pending a staff decision. */
create or replace function public.fn_report_review(p_review uuid, p_reason text, p_detail text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_author uuid;
begin
  if v_user is null then raise exception 'sign in to report a review'; end if;
  if p_reason not in ('offensive','spam','irrelevant','other') then
    raise exception 'unknown report reason';
  end if;

  select user_id into v_author from public.review where id = p_review;
  if not found then raise exception 'review not found'; end if;
  if v_author = v_user then raise exception 'you cannot report your own review'; end if;

  insert into public.review_report(review_id, reporter_id, reason, detail)
    values (p_review, v_user, p_reason, nullif(trim(coalesce(p_detail, '')), ''))
  on conflict (review_id, reporter_id) do update set reason = excluded.reason, detail = excluded.detail;

  -- Out of sight while staff decide. Deliberately on the first report: at this
  -- shop's volume a wrongly-hidden review is a minute of staff time, whereas
  -- objectionable text left up is what fails review.
  update public.review set status = 'pending', updated_at = now()
   where id = p_review and status = 'published';

  return true;
end;
$$;

/** Stop seeing a customer's reviews. Personal to the caller. */
create or replace function public.fn_block_user(p_user uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'sign in to block someone'; end if;
  if p_user = v_user then raise exception 'you cannot block yourself'; end if;
  if not exists (select 1 from public.app_user where id = p_user) then raise exception 'no such account'; end if;
  insert into public.user_block(blocker_id, blocked_id) values (v_user, p_user)
    on conflict do nothing;
  return true;
end;
$$;

create or replace function public.fn_unblock_user(p_user uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'sign in first'; end if;
  delete from public.user_block where blocker_id = v_user and blocked_id = p_user;
  return true;
end;
$$;

-- Callable by signed-in customers (each function checks auth.uid() itself);
-- the filter helper stays internal.
revoke execute on function public.fn_text_is_flagged(text) from public, anon, authenticated;
grant execute on function public.fn_text_is_flagged(text) to service_role;
revoke execute on function
  public.fn_submit_review(uuid,int,text,text,text),
  public.fn_report_review(uuid,text,text),
  public.fn_block_user(uuid),
  public.fn_unblock_user(uuid)
  from public, anon;
grant execute on function
  public.fn_submit_review(uuid,int,text,text,text),
  public.fn_report_review(uuid,text,text),
  public.fn_block_user(uuid),
  public.fn_unblock_user(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Hold back anything already published that the filter would catch
-- ---------------------------------------------------------------------
update public.review
   set status = 'pending', updated_at = now()
 where status = 'published'
   and public.fn_text_is_flagged(coalesce(title, '') || ' ' || coalesce(body, ''));
