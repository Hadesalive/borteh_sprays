-- 20260616090001_init_extensions_helpers.sql
-- Borteh Sprays 001 — extensions, shared helper functions, order-number generator.
-- Source of truth: docs/06-data-model.md. Money is integer SLE minor units (ADR-009).

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- trigram fuzzy / substring search

-- Shared updated_at maintenance (attached per-table in 0003).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Human-friendly order numbers, e.g. BS-2026-000123 (used as a column default on "order").
create sequence if not exists public.order_number_seq;

create or replace function public.gen_order_number()
returns text
language sql
volatile
as $$
  select 'BS-' || to_char(now(), 'YYYY') || '-'
         || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;
