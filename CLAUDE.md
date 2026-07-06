# Borteh monorepo — rules for all Claude sessions

## Migration naming (HARD RULE — collisions have burned us 4×)

Multiple Claude sessions work this repo in parallel. Migration versions are a
shared global namespace; two files with the same version make `supabase db push`
fail (or worse, silently skip a renumbered file).

1. **Name every new migration with the real current timestamp, to the second:**
   `supabase/migrations/$(date -u +%Y%m%d%H%M%S)_short_name.sql`
   Never hand-increment the previous file's number. Never reuse a "sequence slot".
2. **Immediately before creating the file**, run `ls supabase/migrations | tail`
   and confirm the name sorts after everything present.
3. **If `db push` fails with "duplicate key … schema_migrations_pkey"**: your
   file collided with an already-recorded version. Rename YOUR file to a fresh
   current timestamp and push again. NEVER renumber or edit a migration that may
   already be applied remotely — content recorded under an old version re-applies
   or skips silently.
4. **The owner applies migrations** by running `supabase db push` from their own
   terminal (sandboxes have no direct DB access). Don't apply schema through the
   dashboard or ad hoc SQL.
5. When in doubt about remote state, ask the owner to run `supabase migration list`
   and reconcile before pushing anything.
