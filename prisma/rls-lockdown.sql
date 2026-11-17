-- RLS lockdown for the clip-mvp tables on Supabase-hosted Postgres.
--
-- Why this exists
-- ---------------
-- Supabase publishes every table in the `public` schema over its Data API
-- (PostgREST), reachable with the project's anon key. That endpoint has nothing
-- to do with this app: the app never calls it, and the app's only database
-- client is Prisma over `DATABASE_URL`. But a table sitting in `public` with
-- default grants is readable through that API by anyone holding the anon key.
--
-- The fix is the blunt one: enable RLS with ZERO policies, and revoke the API
-- roles. With no policy, `anon` and `authenticated` match no rows. The table
-- owner (the role Prisma connects as) is exempt from RLS unless FORCE ROW LEVEL
-- SECURITY is set, so Prisma keeps working unchanged. Note that FORCE is
-- deliberately NOT used here — it would lock out the app itself.
--
-- What this does NOT do
-- ---------------------
-- It does not make RLS a boundary between app users. Every request is scoped in
-- application code (`requireUser` + `userId`-scoped queries). This closes the
-- Supabase Data API door; it does not replace per-user authorization.
--
-- Idempotent on Supabase, Neon, and local Postgres. RLS is enabled everywhere;
-- revocations run only where the Supabase API roles exist.
--
-- Apply with: npm run db:rls     (uses DIRECT_URL, port 5432 — DDL needs the
--                                 direct connection, not the transaction pooler)

DO $$
DECLARE
  target record;
  tbl    text;
  tables text[] := ARRAY[
    'User', 'BrandSetting', 'MediaAsset', 'ClipProject',
    'Transcript', 'RenderJob', 'ProcessingLog', 'ScoutJob'
  ];
  applied int := 0;
  missing int := 0;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl AND c.relkind = 'r'
    ) THEN
      missing := missing + 1;
      RAISE NOTICE 'RLS lockdown: table public.% not found, skipped.', tbl;
      CONTINUE;
    END IF;

    -- 1) Turn RLS on with no policies => no rows for anyone but the owner.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- 2) Remove the Data API's table privileges as well, so even a future
    --    permissive policy cannot expose rows to anon/authenticated by default.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', tbl);
    END IF;

    applied := applied + 1;
    RAISE NOTICE 'RLS lockdown: public.% enabled + revoked from anon/authenticated.', tbl;
  END LOOP;

  RAISE NOTICE 'RLS lockdown complete: % table(s) locked down, % missing.', applied, missing;
END $$;

-- Verification (run by hand; expect rls_enabled = true for all 8 rows and
-- zero rows in pg_policies):
--
--   SELECT c.relname, c.relrowsecurity AS rls_enabled,
--          count(p.policyname) AS policies
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
--   WHERE n.nspname = 'public' AND c.relkind = 'r'
--   GROUP BY 1, 2
--   ORDER BY 1;
--
-- Rollback (only if the Supabase Data API is ever wanted for these tables —
-- it is not wanted today):
--
--   ALTER TABLE public."User" DISABLE ROW LEVEL SECURITY;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."User" TO anon, authenticated;
