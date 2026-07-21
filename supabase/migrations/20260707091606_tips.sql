-- "How to use Borteh" tips — short cards shown in-app, editable from the admin (CMS track).
-- DB-backed from day one so the owner edits copy without a code change. Same read/write RLS
-- pattern as home_carousel: public reads active rows, staff/owner manage everything.

create table if not exists public.tip (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  icon        text,                       -- optional phosphor icon name; the app maps a known set
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists idx_tip_active
  on public.tip (sort_order)
  where deleted_at is null and is_active;

create or replace trigger trg_tip_updated
  before update on public.tip
  for each row execute function public.set_updated_at();

alter table public.tip enable row level security;
create policy tip_read  on public.tip for select to anon, authenticated using (is_active and deleted_at is null);
create policy tip_staff on public.tip for all    to authenticated using (public.is_staff()) with check (public.is_staff());

-- seed — the loyalty loop in plain language. Only when the table is empty, so a re-run is a no-op.
insert into public.tip (title, body, icon, sort_order)
select v.title, v.body, v.icon, v.sort_order
from (values
  ('Earn points on every order',   'Every delivered order adds points to your account automatically. The more you shop, the faster they add up.',                    'Coins',      10),
  ('Spend points at checkout',     'Turn points into money off. Toggle them on at checkout and watch your total drop — no codes to remember.',                      'Handbag',    20),
  ('Climb to the Loyalty Card',    'Reach a spending tier and unlock a standing discount on every future order. Your progress lives on the Points screen.',        'Medal',      30),
  ('Invite friends, both win',     'Share your invite code. When a friend places their first order, you both earn bonus points.',                                   'UsersThree', 40),
  ('Save what you love',           'Tap the heart on any fragrance to save it. Your saved list is always a tap away from the bottom bar.',                          'Heart',      50),
  ('We call before we deliver',    'We confirm the delivery fee and call you before the rider leaves — no surprises at the door.',                                  'Phone',      60)
) as v(title, body, icon, sort_order)
where not exists (select 1 from public.tip);
