BEGIN;
DO $$ BEGIN
 IF has_schema_privilege('anon','pdr_private','USAGE') OR has_schema_privilege('authenticated','pdr_private','USAGE') THEN RAISE EXCEPTION 'Private PDR schema exposed'; END IF;
 IF has_function_privilege('anon','public.pdr_load_tegny()','EXECUTE') OR has_function_privilege('authenticated','public.pdr_load_tegny()','EXECUTE') THEN RAISE EXCEPTION 'Adventure secrets exposed'; END IF;
 IF has_function_privilege('anon','public.reserve_pdr_warden_calls(integer)','EXECUTE') OR has_function_privilege('authenticated','public.reserve_pdr_warden_calls(integer)','EXECUTE') THEN RAISE EXCEPTION 'Quota exposed'; END IF;
 IF NOT has_function_privilege('service_role','public.pdr_load_tegny()','EXECUTE') OR NOT has_function_privilege('service_role','public.reserve_pdr_warden_calls(integer)','EXECUTE') THEN RAISE EXCEPTION 'Server RPC not executable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pdr_private' AND c.relname='warden_quota' AND c.relrowsecurity) THEN RAISE EXCEPTION 'Missing quota RLS'; END IF;
END $$;
SET LOCAL ROLE service_role;
SELECT (public.pdr_load_tegny()->>'id')='tegny-v1' AS adventure_ready;
SELECT public.reserve_pdr_warden_calls(2) AS quota_ready;
-- Rollback makes this quota test non-consuming.
ROLLBACK;
