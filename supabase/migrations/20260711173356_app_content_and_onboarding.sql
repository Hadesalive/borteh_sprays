-- App-wide CMS — Phase 1 vertical slice.
-- Two layers, both editable from the web admin without a code change:
--   1. onboarding_slide — a structured, ordered list with images (the `tip` shape).
--   2. app_content      — a generic copy/content store for the long tail of one-off
--                         editable strings, keyed by a stable `screen.slot` string.
-- Same read/write RLS pattern as home_carousel / tip: public reads, staff/owner manage.
-- Seeded so the app is full on day one; the mobile app also ships bundled fallbacks so a
-- missing row or a slow network can never blank a screen.

-- =====================================================================
-- 1. onboarding_slide — the 3 intro slides (title / body / image), curated + ordered
-- =====================================================================
create table if not exists public.onboarding_slide (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  image_path  text,                       -- optional Storage object key; app falls back to a bundled image by order
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.app_user(id) on delete set null,
  deleted_at  timestamptz
);
create index if not exists idx_onboarding_slide_active
  on public.onboarding_slide (sort_order)
  where deleted_at is null and is_active;

create or replace trigger trg_onboarding_slide_updated
  before update on public.onboarding_slide
  for each row execute function public.set_updated_at();

alter table public.onboarding_slide enable row level security;
create policy onboarding_slide_read  on public.onboarding_slide for select to anon, authenticated using (is_active and deleted_at is null);
create policy onboarding_slide_staff on public.onboarding_slide for all    to authenticated using (public.is_staff()) with check (public.is_staff());

-- seed — the three intro slides currently hardcoded in mobile/app/onboarding.tsx.
-- image_path stays null: the app maps each slide to its bundled fallback image by order,
-- and the owner can upload real slide images later (media management phase).
insert into public.onboarding_slide (title, body, sort_order)
select v.title, v.body, v.sort_order
from (values
  ('The whole maison, in your pocket.', 'Browse every fragrance on the shelf, with live stock straight from the Freetown counter.', 10),
  ('Make it yours.',                    'Save the scents you love, leave reviews, and get told the moment a sold-out bottle returns.', 20),
  ('Order without the errand.',         'Check out in the app, pay the rider at your door, and follow every step on the way.',        30)
) as v(title, body, sort_order)
where not exists (select 1 from public.onboarding_slide);

-- =====================================================================
-- 2. app_content — generic key/value copy store (the long tail)
-- =====================================================================
-- key   : stable `screen.slot` string, e.g. "onboarding.taste.title"
-- kind  : "text" (value_text), "richtext" (value_text), "json" (value_json), "image" (image_path)
-- The mobile useContent(key, fallback) hook returns value_text (or the bundled fallback).
create table if not exists public.app_content (
  key         text primary key,
  kind        text not null default 'text' check (kind in ('text','richtext','json','image')),
  value_text  text,
  value_json  jsonb,
  image_path  text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.app_user(id) on delete set null
);

create or replace trigger trg_app_content_updated
  before update on public.app_content
  for each row execute function public.set_updated_at();

alter table public.app_content enable row level security;
-- Copy is public content: anyone (signed in or not) may read it; only staff/owner may write.
create policy app_content_read  on public.app_content for select to anon, authenticated using (true);
create policy app_content_staff on public.app_content for all    to authenticated using (public.is_staff()) with check (public.is_staff());

-- seed — the incidental copy for the Onboarding screen (the structured slides live above).
-- Only inserts a key when it's absent, so a re-run and later hand-edits are safe.
insert into public.app_content (key, kind, value_text)
select v.key, 'text', v.value_text
from (values
  ('onboarding.slide_cta',        'Continue'),
  ('onboarding.skip',             'Skip'),
  ('onboarding.taste.title',      'What do you love?'),
  ('onboarding.taste.body',       'We''ll tune your home to it — from day one. You can change this any time in your profile.'),
  ('onboarding.taste.cta',        'Get started'),
  ('onboarding.taste.cta_busy',   'Setting up…'),
  ('onboarding.taste.picked_word','picked')
) as v(key, value_text)
where not exists (select 1 from public.app_content c where c.key = v.key);
