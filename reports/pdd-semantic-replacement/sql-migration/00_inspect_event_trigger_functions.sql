-- READ ONLY follow-up. Return the single inspection_json cell/CSV.
-- No migration, schema changes, privilege changes or approval settings.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,public;
SELECT jsonb_pretty(jsonb_build_object(
 'generated_at',now(),
 'database_create',has_database_privilege(current_user,current_database(),'CREATE'),
 'session_replication_role',current_setting('session_replication_role'),
 'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'trigger',e.evtname,'enabled',e.evtenabled,'tags',e.evttags,'event',e.evtevent,
   'function',e.evtfoid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
   'security_definer',p.prosecdef,'function_settings',p.proconfig,
   'definition_md5',md5(pg_get_functiondef(e.evtfoid)),
   'definition',pg_get_functiondef(e.evtfoid)) ORDER BY e.evtname),'[]')
   FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid
   WHERE e.evtname IN ('pgrst_ddl_watch','pgrst_drop_watch'))
)) AS inspection_json;
COMMIT;
