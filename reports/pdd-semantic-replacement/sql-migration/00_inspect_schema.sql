-- READ ONLY: run first as the intended privileged migration role.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog,public;
WITH target AS (
 SELECT c.oid, n.nspname AS schema_name,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
        pg_get_userbyid(c.relowner) AS owner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('rooms','room_connections')
), details AS (
 SELECT jsonb_build_object(
 'tables', (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'oid' ORDER BY relname),'[]') FROM target t),
 'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.relname,'name',a.attname,
    'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,
    'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),
    'enum_labels',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=a.atttypid))
    ORDER BY t.relname,a.attnum),'[]') FROM target t JOIN pg_attribute a ON a.attrelid=t.oid
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped),
 'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.conname,
    'table',c.conrelid::regclass::text,'referenced_table',CASE WHEN c.confrelid<>0 THEN c.confrelid::regclass::text END,
    'type',c.contype,'validated',c.convalidated,'deferrable',c.condeferrable,'initially_deferred',c.condeferred,
    'definition',pg_get_constraintdef(c.oid,true)) ORDER BY c.conrelid::regclass::text,c.conname),'[]')
    FROM pg_constraint c WHERE c.conrelid IN (SELECT oid FROM target) OR c.confrelid IN (SELECT oid FROM target)),
 'indexes', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',i.indexrelid::regclass::text,
    'valid',i.indisvalid,'unique',i.indisunique,'definition',pg_get_indexdef(i.indexrelid)) ORDER BY i.indexrelid::regclass::text),'[]')
    FROM pg_index i WHERE i.indrelid IN (SELECT oid FROM target)),
 'user_triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',g.tgname,'table',g.tgrelid::regclass::text,
    'enabled',g.tgenabled,'definition',pg_get_triggerdef(g.oid,true),'function',pg_get_functiondef(g.tgfoid))
    ORDER BY g.tgrelid::regclass::text,g.tgname),'[]') FROM pg_trigger g WHERE NOT g.tgisinternal AND g.tgrelid IN (SELECT oid FROM target)),
 'policies', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname),'[]') FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename IN ('rooms','room_connections'))
 ) AS schema_details
) SELECT schema_details,md5(schema_details::text) AS schema_md5 FROM details;
SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user;
COMMIT;
