-- Logical rollback: restore all original rows; retain inserted IDs disabled.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SET LOCAL idle_in_transaction_session_timeout='120s';
SET LOCAL timezone='UTC';
SET LOCAL search_path=pg_catalog,public;
SET LOCAL row_security=off;
LOCK TABLE public.rooms IN SHARE MODE;
LOCK TABLE public.room_connections IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE _pdd_schema ON COMMIT DROP AS
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
DO $guard$
BEGIN
 IF nullif(current_setting('pdd_migration.approved_schema_md5',true),'') IS DISTINCT FROM (SELECT schema_md5 FROM _pdd_schema) THEN
   RAISE EXCEPTION 'Schema has not been inspected/approved, or has changed. Run 00_inspect_schema.sql and review its complete result first.';
 END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('rooms','room_connections') AND c.relkind='r')<>2 THEN
   RAISE EXCEPTION 'Expected two ordinary public tables; views/partitions require separate review';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid IN ('public.rooms'::regclass,'public.room_connections'::regclass) AND NOT tgisinternal) THEN
   RAISE EXCEPTION 'User triggers require separate reviewed migration; no trigger is disabled or bypassed';
 END IF;
 IF (SELECT array_agg(attname::text ORDER BY attname) FROM pg_attribute WHERE attrelid='public.room_connections'::regclass AND attnum>0 AND NOT attisdropped)
 IS DISTINCT FROM ARRAY['connection_type','created_at','enabled','featured','from_pdd','id','reason','relationship','strength','to_pdd']::text[] THEN
   RAISE EXCEPTION 'Unexpected connection columns/status fields: migration requires revision';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.room_connections'::regclass AND attname IN ('enabled','featured') AND atttypid<>'boolean'::regtype) OR
    EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.room_connections'::regclass AND attname IN ('id','from_pdd','to_pdd') AND atttypid NOT IN ('integer'::regtype,'bigint'::regtype)) OR
    EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.room_connections'::regclass AND attname='strength' AND atttypid NOT IN ('smallint'::regtype,'integer'::regtype,'bigint'::regtype)) OR
    EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.room_connections'::regclass AND attname IN ('reason','relationship','connection_type') AND (atttypid NOT IN ('text'::regtype,'character varying'::regtype) OR attgenerated<>'')) THEN
   RAISE EXCEPTION 'Unexpected connection types/generated columns; no implicit schema conversion permitted';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.room_connections'::regclass AND attname='relationship' AND attnotnull) THEN
   RAISE EXCEPTION 'Expected nullable relationship as observed in backup';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid='public.room_connections'::regclass AND a.attname='id' AND (a.attidentity<>'' OR d.oid IS NOT NULL)) THEN
   RAISE EXCEPTION 'Connection IDs need an existing identity/default; migration will not allocate IDs manually';
 END IF;
 -- Outgoing foreign keys, when present, must express the endpoint semantics used by the application.
 IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.room_connections'::regclass AND c.contype='f' AND NOT (
   c.confrelid='public.rooms'::regclass AND cardinality(c.conkey)=1 AND cardinality(c.confkey)=1 AND
   (SELECT attname FROM pg_attribute WHERE attrelid=c.conrelid AND attnum=c.conkey[1]) IN ('from_pdd','to_pdd') AND
   (SELECT attname FROM pg_attribute WHERE attrelid=c.confrelid AND attnum=c.confkey[1])='pdd')) THEN
   RAISE EXCEPTION 'Unexpected foreign-key mapping; rooms.pdd must not be confused with rooms.id';
 END IF;
 -- Never modify an existing referenced key through an update cascade.
 IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.confrelid='public.room_connections'::regclass AND c.contype='f' AND NOT (
   cardinality(c.confkey)=1 AND (SELECT attname FROM pg_attribute WHERE attrelid=c.confrelid AND attnum=c.confkey[1])='id')) THEN
   RAISE EXCEPTION 'Inbound foreign key references mutable metadata; separate review required';
 END IF;
END $guard$;

DO $check$ BEGIN
 IF (SELECT state FROM pdd_semantic_215_backup_20261031.run_state WHERE singleton) IS DISTINCT FROM 'applied' THEN RAISE EXCEPTION 'No applied run to roll back'; END IF;
 IF (SELECT schema_md5 FROM pdd_semantic_215_backup_20261031.run_state WHERE singleton) IS DISTINCT FROM (SELECT schema_md5 FROM _pdd_schema) THEN RAISE EXCEPTION 'Schema changed since apply'; END IF;
 IF EXISTS(SELECT 1 FROM pdd_semantic_215_backup_20261031.after_rows a LEFT JOIN public.room_connections c ON c.id=a.id WHERE c.id IS NULL OR to_jsonb(c) IS DISTINCT FROM a.row_data) THEN
   RAISE EXCEPTION 'Affected rows changed after migration; no blind rollback'; END IF;
 IF EXISTS(SELECT 1 FROM public.room_connections c WHERE (c.from_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope) OR c.to_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope))
   AND c.id NOT IN(SELECT id FROM pdd_semantic_215_backup_20261031.after_rows)) THEN RAISE EXCEPTION 'Additional incident rows require reviewed rollback'; END IF;
END $check$;
CREATE TEMP TABLE _pdd_rollback_unrelated ON COMMIT DROP AS SELECT c.id,to_jsonb(c) AS row_data FROM public.room_connections c WHERE c.id NOT IN(SELECT id FROM pdd_semantic_215_backup_20261031.after_rows);
-- Do not delete new rows: preserving IDs avoids damaging downstream references.
UPDATE public.room_connections c SET enabled=false WHERE c.id IN(SELECT id FROM pdd_semantic_215_backup_20261031.new_ids);
UPDATE public.room_connections c SET enabled=b.enabled,featured=b.featured,strength=b.strength,reason=b.reason,relationship=b.relationship,connection_type=b.connection_type
 FROM (SELECT (jsonb_populate_record(NULL::public.room_connections,row_data)).* FROM pdd_semantic_215_backup_20261031.before_rows) b WHERE c.id=b.id;
SET CONSTRAINTS ALL IMMEDIATE;
DO $restore$ BEGIN
 IF EXISTS(SELECT 1 FROM pdd_semantic_215_backup_20261031.before_rows b LEFT JOIN public.room_connections c ON c.id=b.id WHERE c.id IS NULL OR to_jsonb(c) IS DISTINCT FROM b.row_data) THEN RAISE EXCEPTION 'Original rows not restored exactly'; END IF;
 IF EXISTS(SELECT 1 FROM pdd_semantic_215_backup_20261031.new_ids n LEFT JOIN public.room_connections c ON c.id=n.id WHERE c.id IS NULL OR c.enabled IS DISTINCT FROM false) THEN RAISE EXCEPTION 'New rows were not safely disabled'; END IF;
 IF EXISTS((SELECT id,row_data FROM _pdd_rollback_unrelated EXCEPT SELECT c.id,to_jsonb(c) FROM public.room_connections c WHERE c.id NOT IN(SELECT id FROM pdd_semantic_215_backup_20261031.after_rows))
 UNION ALL (SELECT c.id,to_jsonb(c) FROM public.room_connections c WHERE c.id NOT IN(SELECT id FROM pdd_semantic_215_backup_20261031.after_rows) EXCEPT SELECT id,row_data FROM _pdd_rollback_unrelated)) THEN RAISE EXCEPTION 'Unrelated rows changed during rollback'; END IF;
END $restore$;
UPDATE pdd_semantic_215_backup_20261031.run_state SET state='rolled_back',rolled_back_at=now() WHERE singleton;
COMMIT;
