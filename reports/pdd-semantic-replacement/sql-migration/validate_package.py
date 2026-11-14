"""Offline artifact/source integrity validation. No database/network access."""
import collections,csv,hashlib,json,pathlib,re
out=pathlib.Path(__file__).resolve().parent;base=out.parent
source=base/'proposed-network.csv';manifest=json.loads((out/'source-manifest.json').read_text())
assert hashlib.sha256(source.read_bytes()).hexdigest()==manifest['source_sha256']
proposal=list(csv.DictReader(source.open()));rooms=json.loads((out/'rooms-reference.json').read_text());backup=json.loads((out/'existing-rows-backup.json').read_text())
assert len(proposal)==215 and len(rooms)==396 and len(backup)==1101
by_pdd={int(r['pdd']):r for r in rooms};degree=collections.Counter();pairs=set()
for e in proposal:
 a,b=int(e['from_pdd']),int(e['to_pdd']);assert 0<a<b and (a,b) not in pairs
 assert by_pdd[a]['word']==e['from_word'] and by_pdd[b]['word']==e['to_word']
 pairs.add((a,b));degree.update((a,b))
assert dict(collections.Counter(degree[n] for n in by_pdd))=={0:138,1:115,2:114,3:29}
assert len({r['id'] for r in backup})==1101
oldpairs={tuple(sorted((r['from_pdd'],r['to_pdd']))) for r in backup};assert len(oldpairs)==1101
assert (len(oldpairs & pairs),len(oldpairs-pairs),len(pairs-oldpairs))==(50,1051,165)
apply=(out/'02_replace_connections.sql').read_text();blocks=re.findall(r'\$pdd_data\$(.*?)\$pdd_data\$::jsonb',apply,re.S);assert len(blocks)==3
scope,embedded,old=map(json.loads,blocks)
assert len(scope)==396 and old==backup
expected=[]
for e in proposal:
 t=e['relationship_type'];expected.append(dict(from_pdd=int(e['from_pdd']),to_pdd=int(e['to_pdd']),relationship_type=t,strength=int(e['strength']),explanation_es=e['explanation_es'],connection_type='Contraste' if t.startswith(('contraste','antonimia')) else 'Directa'))
assert embedded==expected,'Embedded SQL diverges from exact source'
assert set(r['pdd'] for r in scope)==set(by_pdd)
assert all(r['room_id']==by_pdd[r['pdd']]['id'] for r in scope)
assert not re.search(r'\b(?:DELETE\s+FROM|TRUNCATE)\b',apply,re.I)
assert not re.search(r'\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.rooms\b',apply,re.I)
assert 'SET LOCAL row_security=off' in apply and "enabled=true" in apply
syntax={}
try:
 import pglast
 from pglast import parser
 for f in sorted(out.glob('*.sql')):
  sql=f.read_text();syntax[f.name]={'statements':len(parser.parse_sql(sql)),'plpgsql':'parsed'};parser.parse_plpgsql_json(sql)
 parser_version=pglast.__version__
except ImportError:
 parser_version='not available; source/artifact checks only'
results=dict(source_sha256=manifest['source_sha256'],source_connections=215,backup_rows=1101,reused_pairs=50,disabled_rows=1051,new_pairs=165,histogram={0:138,1:115,2:114,3:29},embedded_source_exact=True,sql_parser=parser_version,syntax=syntax,sql_sha256={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(out.glob('*.sql'))},production_executed=False)
(out/'validation-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
