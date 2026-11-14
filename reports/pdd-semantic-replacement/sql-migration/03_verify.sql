-- Assertions plus results; no production data writes. Run after apply, before rollback.
BEGIN READ ONLY;
SET LOCAL timezone='UTC';
SET LOCAL row_security=off;
DO $journal$
BEGIN
 IF (SELECT state FROM pdd_semantic_215_backup_20261031.run_state WHERE singleton) IS DISTINCT FROM 'applied' THEN
  RAISE EXCEPTION 'Execution journal is not marked applied; do not rerun migration or rollback without review'; END IF;
 IF (SELECT proposal_sha256 FROM pdd_semantic_215_backup_20261031.run_state WHERE singleton) IS DISTINCT FROM '05439a9e34968ce4be32041833944b2ba25fecb00fca73b8b41b73e275aca740' THEN RAISE EXCEPTION 'Journal source checksum mismatch'; END IF;
 IF (SELECT count(*) FROM pdd_semantic_215_backup_20261031.before_rows)<>1101
 OR (SELECT count(*) FROM pdd_semantic_215_backup_20261031.after_rows)<>1266
 OR (SELECT count(*) FROM pdd_semantic_215_backup_20261031.new_ids)<>165 THEN RAISE EXCEPTION 'Incomplete private backup journal'; END IF;
 IF EXISTS(SELECT 1 FROM pdd_semantic_215_backup_20261031.after_rows a LEFT JOIN public.room_connections c ON c.id=a.id WHERE c.id IS NULL OR a.row_data IS DISTINCT FROM to_jsonb(c)) THEN RAISE EXCEPTION 'Live rows differ from recorded after-images'; END IF;
END $journal$;
DO $verify$
DECLARE actual jsonb;
BEGIN
 IF (SELECT count(*) FROM public.room_connections c WHERE c.enabled=true AND (c.from_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope) OR c.to_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope)))<>215 THEN
   RAISE EXCEPTION 'Expected exactly 215 enabled PDD semantic connections';
 END IF;
 IF (SELECT count(*) FROM public.room_connections c JOIN pdd_semantic_215_backup_20261031.proposal p ON least(c.from_pdd,c.to_pdd)=p.from_pdd AND greatest(c.from_pdd,c.to_pdd)=p.to_pdd
     WHERE c.enabled=true AND c.reason IS NOT DISTINCT FROM p.explanation_es AND c.relationship IS NOT DISTINCT FROM p.relationship_type
       AND c.connection_type IS NOT DISTINCT FROM p.connection_type AND c.strength=p.strength AND c.featured=false)<>215 THEN
   RAISE EXCEPTION 'Proposal pairs/types/strengths/Spanish explanations differ from source';
 END IF;
 WITH endpoints AS (SELECT c.from_pdd AS pdd FROM public.room_connections c WHERE c.enabled=true AND (c.from_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope) OR c.to_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope))
 UNION ALL SELECT c.to_pdd FROM public.room_connections c WHERE c.enabled=true AND (c.from_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope) OR c.to_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope))),
 degrees AS (SELECT s.pdd,count(e.pdd) AS degree FROM pdd_semantic_215_backup_20261031.scope s LEFT JOIN endpoints e USING(pdd) GROUP BY s.pdd),
 histogram AS (SELECT degree,count(*) AS rooms FROM degrees GROUP BY degree)
 SELECT jsonb_object_agg(degree::text,rooms) INTO actual FROM histogram;
 IF actual IS DISTINCT FROM '{"0":138,"1":115,"2":114,"3":29}'::jsonb THEN RAISE EXCEPTION 'Unexpected endpoint degree histogram: %',actual; END IF;
 IF EXISTS (SELECT least(c.from_pdd,c.to_pdd),greatest(c.from_pdd,c.to_pdd) FROM public.room_connections c
    WHERE c.enabled=true AND (c.from_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope) OR c.to_pdd IN(SELECT pdd FROM pdd_semantic_215_backup_20261031.scope))
    GROUP BY least(c.from_pdd,c.to_pdd),greatest(c.from_pdd,c.to_pdd) HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate enabled undirected pair'; END IF;
END $verify$;

WITH endpoints AS (
 SELECT c.from_pdd AS pdd FROM public.room_connections c WHERE c.enabled=true AND c.id IN(SELECT id FROM pdd_semantic_215_backup_20261031.after_rows)
 UNION ALL SELECT c.to_pdd FROM public.room_connections c WHERE c.enabled=true AND c.id IN(SELECT id FROM pdd_semantic_215_backup_20261031.after_rows)
), degrees AS (SELECT s.pdd,count(e.pdd) AS degree FROM pdd_semantic_215_backup_20261031.scope s LEFT JOIN endpoints e USING(pdd) GROUP BY s.pdd),
 histogram AS (SELECT degree,count(*) AS rooms FROM degrees GROUP BY degree)
SELECT jsonb_pretty(jsonb_build_object(
 'verification','passed',
 'execution',(SELECT to_jsonb(r) FROM pdd_semantic_215_backup_20261031.run_state r WHERE singleton),
 'enabled_semantic_pairs',215,
 'degree_histogram',(SELECT jsonb_object_agg(degree::text,rooms) FROM histogram),
 'backup_before_rows',(SELECT count(*) FROM pdd_semantic_215_backup_20261031.before_rows),
 'backup_after_rows',(SELECT count(*) FROM pdd_semantic_215_backup_20261031.after_rows),
 'inserted_ids',(SELECT count(*) FROM pdd_semantic_215_backup_20261031.new_ids)
)) AS verification_json;
COMMIT;
