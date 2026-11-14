"""Disposable PostgreSQL integration tests. Never accepts a remote/database URL.
Supply only --bin-dir pointing to local PostgreSQL executables. All data/socket paths
are created under a fresh TemporaryDirectory; TCP listening is disabled.
"""
import argparse,collections,csv,hashlib,json,pathlib,re,subprocess,tempfile,time
p=argparse.ArgumentParser();p.add_argument('--bin-dir',type=pathlib.Path,required=True);args=p.parse_args()
out=pathlib.Path(__file__).resolve().parent;base=out.parent
rows=json.loads((out/'existing-rows-backup.json').read_text());rooms=json.loads((out/'rooms-reference.json').read_text())
apply=(out/'02_replace_connections.sql').read_text();rollback=(out/'04_rollback.sql').read_text();verify=(out/'03_verify.sql').read_text()
def lit(x):return "'"+json.dumps(x,ensure_ascii=False).replace("'","''")+"'::jsonb"
tests=[]
with tempfile.TemporaryDirectory(prefix='pdd-sql-fixture-') as tmp:
 root=pathlib.Path(tmp);data=root/'data';sock=root/'socket';sock.mkdir();port='55439'
 def cmd(name,argv,**kw):return subprocess.run([str(args.bin_dir/name)]+argv,text=True,capture_output=True,**kw)
 init=cmd('initdb',['-D',str(data),'-U','postgres','-A','trust','--no-locale','-E','UTF8']);assert init.returncode==0,init.stderr
 options=f"-k {sock} -p {port} -c listen_addresses='' -c shared_buffers=16MB -c max_connections=10"
 start=cmd('pg_ctl',['-D',str(data),'-l',str(root/'server.log'),'-o',options,'-w','start']);assert start.returncode==0,start.stderr+(root/'server.log').read_text()
 try:
  def sql(text,db='postgres',ok=True):
   q=cmd('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',str(sock),'-p',port,'-U','postgres','-d',db],input="SET timezone='UTC';\n"+text)
   if ok and q.returncode:raise AssertionError(q.stderr[-4000:])
   if not ok:assert q.returncode!=0,'Expected failure'
   return q.stdout.strip() if ok else q.stderr
  version=sql('SELECT version();')
  def fixture(n,extra=''):
   db='pdd_fixture_'+str(n);sql('CREATE DATABASE '+db+';')
   types=sorted({e['connection_type'] for e in rows});allowed=','.join("'"+t.replace("'","''")+"'" for t in types)
   ddl="""SET timezone='UTC';
CREATE TABLE public.rooms(id bigint PRIMARY KEY,pdd integer NOT NULL UNIQUE,word text,published boolean,description text,room_type text);
CREATE TABLE public.room_connections(id bigserial PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),from_pdd integer NOT NULL REFERENCES public.rooms(pdd),to_pdd integer NOT NULL REFERENCES public.rooms(pdd),relationship text,strength smallint CHECK(strength BETWEEN 1 AND 3),reason text,featured boolean NOT NULL DEFAULT false,enabled boolean NOT NULL DEFAULT true,connection_type text CHECK(connection_type IN("""+allowed+""")),CHECK(from_pdd<>to_pdd));
CREATE UNIQUE INDEX pair_unique ON public.room_connections(least(from_pdd,to_pdd),greatest(from_pdd,to_pdd));
CREATE TABLE public.connection_notes(id integer PRIMARY KEY,connection_id bigint REFERENCES public.room_connections(id) ON DELETE CASCADE,note text);
ALTER TABLE public.room_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY browser_enabled ON public.room_connections FOR SELECT TO PUBLIC USING(enabled=true);
"""
   ddl+='INSERT INTO public.rooms SELECT * FROM jsonb_populate_recordset(NULL::public.rooms,'+lit(rooms)+');\n'
   ddl+='INSERT INTO public.room_connections SELECT * FROM jsonb_populate_recordset(NULL::public.room_connections,'+lit(rows)+');\n'
   ddl+="INSERT INTO public.rooms(id,pdd,word,published,room_type) VALUES (900001,900001,'unrelated one',true,'other'),(900002,900002,'unrelated two',true,'other');\n"
   ddl+="INSERT INTO public.room_connections(id,from_pdd,to_pdd,enabled,relationship,reason,strength,connection_type) VALUES(900001,900001,900002,true,'unrelated','Must remain unchanged',2,'Directa');\nSELECT setval(pg_get_serial_sequence('public.room_connections','id'),900001);\n"+extra
   sql(ddl,db);return db
  def approval(db):
   line=sql((out/'00_inspect_schema.sql').read_text(),db).splitlines()[0]
   md5=line.rsplit('|',1)[1];assert re.fullmatch('[0-9a-f]{32}',md5)
   return "SET pdd_migration.approved_schema_md5='"+md5+"';\n"
  def fingerprint(db):return sql("SELECT md5(jsonb_agg(to_jsonb(c) ORDER BY id)::text) FROM public.room_connections c;",db)
  def expect_abort(db,text,match):
   before=fingerprint(db);err=sql(text,db,False);assert match in err,err
   assert fingerprint(db)==before,'Failed transaction changed connection data'
   return err
  # Success on real PostgreSQL, with FKs, check constraints, uniqueness, RLS and unrelated data.
  db=fixture(1);before=fingerprint(db);ap=approval(db);sql(ap+apply,db);v=sql(verify,db)
  assert json.loads(v)['enabled_semantic_pairs']==215,v
  assert json.loads(v)['degree_histogram']=={'0':138,'1':115,'2':114,'3':29},v
  assert sql("SELECT count(*) FROM public.room_connections WHERE enabled=true;",db)=='216' # one unrelated enabled row
  assert sql("SELECT reason FROM public.room_connections WHERE id=900001;",db)=='Must remain unchanged'
  sql("INSERT INTO public.connection_notes SELECT 1,id,'reference must survive rollback' FROM pdd_semantic_215_backup_20261031.new_ids ORDER BY id LIMIT 1;",db)
  # Accidental apply rerun aborts; it cannot create duplicates.
  expect_abort(db,ap+apply,'Existing row missing or changed')
  sql(ap+rollback,db)
  assert sql("SELECT count(*) FROM public.room_connections WHERE enabled=true;",db)=='1102'
  assert sql("SELECT count(*) FROM public.connection_notes n JOIN public.room_connections c ON c.id=n.connection_id WHERE c.enabled=false;",db)=='1'
  assert sql("SELECT count(*) FROM pdd_semantic_215_backup_20261031.before_rows b JOIN public.room_connections c ON c.id=b.id WHERE b.row_data IS DISTINCT FROM to_jsonb(c);",db)=='0'
  expect_abort(db,ap+rollback,'No applied run to roll back')
  tests.append('Apply + verification + logical rollback with FKs/checks/unique/RLS, UTF-8 explanations, unrelated rows, inbound reference preservation and rerun guards: PASS')
  db=fixture(2,"UPDATE public.room_connections SET reason='edited after snapshot' WHERE id=2;");expect_abort(db,approval(db)+apply,'Existing row missing or changed');tests.append('Stale snapshot abort: PASS')
  db=fixture(3,"INSERT INTO public.room_connections(id,from_pdd,to_pdd,enabled,connection_type,strength) VALUES(900002,1,900001,false,'Directa',2);");expect_abort(db,approval(db)+apply,'Additional/hidden incident connection');tests.append('Additional disabled incident row abort: PASS')
  db=fixture(4);expect_abort(db,apply,'Schema has not been inspected/approved');tests.append('Missing schema approval abort: PASS')
  db=fixture(5,"ALTER TABLE public.room_connections ADD CONSTRAINT reject_nonnull_relationship CHECK(id=900001 OR relationship IS NULL);");expect_abort(db,approval(db)+apply,'reject_nonnull_relationship');assert sql("SELECT to_regnamespace('pdd_semantic_215_backup_20261031') IS NULL;",db)=='t';tests.append('Mid-transaction check-constraint failure rolls back data AND private backup DDL: PASS')
  db=fixture(6);blocks=list(re.finditer(r'\$pdd_data\$(.*?)\$pdd_data\$::jsonb',apply,re.S));assert len(blocks)==3
  original=blocks[1].group(1);bad=json.loads(original);bad[0]['from_pdd']=bad[1]['from_pdd'];bad[0]['to_pdd']=bad[1]['to_pdd'];tampered=apply[:blocks[1].start(1)]+json.dumps(bad,ensure_ascii=False,separators=(',',':'))+apply[blocks[1].end(1):]
  expect_abort(db,approval(db)+tampered,'duplicate key');tests.append('Duplicate proposal pair abort: PASS')
  db=fixture(7,"ALTER TABLE public.room_connections ADD COLUMN status text DEFAULT 'active';");expect_abort(db,approval(db)+apply,'Unexpected connection columns/status');tests.append('Unreviewed status column abort: PASS')
  db=fixture(8);ap=approval(db);sql(ap+apply,db);sql("UPDATE public.room_connections SET reason='later edit' WHERE id=(SELECT min(id) FROM pdd_semantic_215_backup_20261031.after_rows);",db);expect_abort(db,ap+rollback,'Affected rows changed after migration');tests.append('Rollback refuses to overwrite later edits: PASS')
  db=fixture(9);ap=approval(db);sql('ALTER TABLE public.rooms ADD COLUMN new_field text;',db);expect_abort(db,ap+apply,'Schema has not been inspected/approved');tests.append('Schema drift abort: PASS')
  db=fixture(10);bad=json.loads(original);bad[0]['from_pdd']=24;bad[0]['to_pdd']=96;tampered=apply[:blocks[1].start(1)]+json.dumps(bad,ensure_ascii=False,separators=(',',':'))+apply[blocks[1].end(1):]
  expect_abort(db,approval(db)+tampered,'Proposed endpoint exceeds three');tests.append('Overfull endpoint rejected before persistent writes: PASS')
  db=fixture(11,'ALTER TABLE public.room_connections DROP CONSTRAINT room_connections_from_pdd_fkey; ALTER TABLE public.room_connections ADD CONSTRAINT wrong_fk FOREIGN KEY(from_pdd) REFERENCES public.rooms(id) NOT VALID;');expect_abort(db,approval(db)+apply,'Unexpected foreign-key mapping');tests.append('rooms.id foreign-key mismatch rejected: PASS')
  # Recreate the returned production table definitions, constraints and policies.
  report=json.loads((out/'production-inspection-results.json').read_text())
  db='pdd_production_shape';sql('CREATE DATABASE '+db+';')
  commands=[]
  for table in ['rooms','room_connections']:
   cols=[]
   for c in report['schema_details']['columns']:
    if c['table']!=table:continue
    definition='"'+c['name']+'" '+c['type']
    if c['identity']:definition+=' GENERATED BY DEFAULT AS IDENTITY'
    elif c['default'] is not None:definition+=' DEFAULT '+c['default']
    if c['not_null']:definition+=' NOT NULL'
    cols.append(definition)
   commands.append('CREATE TABLE public.'+table+' ('+', '.join(cols)+');')
  for c in report['schema_details']['constraints']:
   commands.append('ALTER TABLE public.'+c['table']+' ADD CONSTRAINT "'+c['name']+'" '+c['definition']+';')
  for table in ['rooms','room_connections']:
   commands.append('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY;')
  for pol in report['schema_details']['policies']:
   commands.append('CREATE POLICY "'+pol['policyname']+'" ON public.'+pol['tablename']+' FOR SELECT TO PUBLIC USING ('+pol['qual']+');')
  commands.append('INSERT INTO public.rooms SELECT * FROM jsonb_populate_recordset(NULL::public.rooms,'+lit(rooms)+');')
  commands.append('INSERT INTO public.room_connections SELECT * FROM jsonb_populate_recordset(NULL::public.room_connections,'+lit(rows)+');')
  commands.append("SELECT setval('public.room_connections_id_seq',1102,true);")
  sql('\n'.join(commands),db)
  ap=approval(db)
  assert ap.split("'")[1]==report['schema_md5'],'Reconstructed table schema fingerprint differs'
  sql(ap+apply,db);actual=sql(verify,db)
  assert json.loads(actual)['degree_histogram']=={'0':138,'1':115,'2':114,'3':29},actual
  sql(ap+rollback,db)
  assert sql('SELECT count(*) FROM public.room_connections WHERE enabled=true;',db)=='1101'
  assert sql('SELECT count(*) FROM public.room_connections;',db)=='1266'
  tests.append('Returned production table definitions, smallint, identities, constraints and RLS recreated with identical schema fingerprint; apply/verify/rollback: PASS (DDL event triggers not replicated)')
  result=dict(postgres_version=version,environment='Disposable local PostgreSQL fixture only; production schema is not certified.',tests=tests,production_writes=0)
  (out/'local-postgres-test-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,indent=2))
 finally:
  stop=cmd('pg_ctl',['-D',str(data),'-m','immediate','-w','stop']);assert stop.returncode==0,stop.stderr
