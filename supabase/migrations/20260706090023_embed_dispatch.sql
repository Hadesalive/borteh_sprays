-- 20260706090023_embed_dispatch.sql
-- Instant embeddings: when a product is created or its content changes, fire a GitHub
-- repository_dispatch (via pg_net) so the "Embed products" workflow runs within seconds and
-- (re)embeds the stale product. Batch/nightly still covers everything as a backstop.
--
-- Safety:
--   • Loop-proof: the UPDATE trigger only fires when EMBEDDING-INPUT columns change, so the
--     embed job's own write (embedding + embedded_at) never re-triggers it.
--   • Non-blocking: pg_net queues the HTTP call asynchronously; a failure is swallowed so a
--     webhook problem can never roll back a catalog write.
--   • The GitHub token is NOT in this file — it's read from Supabase Vault (see one-time setup
--     at the bottom). No token in Vault ⇒ the trigger cleanly no-ops.

do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net unavailable — embed dispatch will no-op until it is enabled';
end $$;

create or replace function public.fn_dispatch_embed()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token
    from vault.decrypted_secrets where name = 'github_embed_token' limit 1;
  if coalesce(v_token, '') = '' then
    return null;                       -- no token configured yet → skip quietly
  end if;

  perform net.http_post(
    url     := 'https://api.github.com/repos/Hadesalive/borteh_sprays/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Accept',        'application/vnd.github+json',
      'Content-Type',  'application/json',
      'User-Agent',    'borteh-embed-dispatch'
    ),
    body    := jsonb_build_object('event_type', 'embed-products')
  );
  return null;
exception when others then
  return null;                         -- never break a product write on a webhook error
end;
$$;

drop trigger if exists trg_product_embed_ins on public.product;
create trigger trg_product_embed_ins
  after insert on public.product
  for each row execute function public.fn_dispatch_embed();

drop trigger if exists trg_product_embed_upd on public.product;
create trigger trg_product_embed_upd
  after update on public.product
  for each row
  when (
       old.name          is distinct from new.name
    or old.scent_family  is distinct from new.scent_family
    or old.description   is distinct from new.description
    or old.main_accords  is distinct from new.main_accords
    or old.brand_id      is distinct from new.brand_id
    or old.is_active     is distinct from new.is_active
    or old.deleted_at    is distinct from new.deleted_at
  )
  execute function public.fn_dispatch_embed();

-- ONE-TIME SETUP (run once; NOT committed — contains the secret):
--   select vault.create_secret('<github_PAT>', 'github_embed_token');
-- where <github_PAT> is a token that can POST repository_dispatch to Hadesalive/borteh_sprays
-- (fine-grained PAT with Contents: Read and write on that repo, or a classic PAT with 'repo').
-- To rotate:  select vault.update_secret((select id from vault.secrets where name='github_embed_token'), '<new_PAT>');
