import csv,json,collections,datetime,pathlib
out=pathlib.Path(__file__).resolve().parent
rooms=json.load(open(out/'vocabulary-snapshot.json')); existing=json.load(open(out/'existing-connections-snapshot.json'))
r={int(x['pdd']):x for x in rooms}
draft=list(csv.DictReader(open(out/'curated-candidates.tsv'),delimiter='\t'))
admissible={}
for e in draft:
 a,b=int(e['from_pdd']),int(e['to_pdd']); pair=tuple(sorted((a,b)))
 assert pair not in admissible and a in r and b in r and a!=b
 e=dict(e);e['from_pdd'],e['to_pdd']=pair
 admissible[pair]=e
# Balanced deterministic sparse selection: strongest first, favouring underconnected endpoints.
degree=collections.Counter(); selected={}; remaining=dict(admissible)
while remaining:
 feasible=[p for p in remaining if degree[p[0]]<3 and degree[p[1]]<3]
 if not feasible:break
 # First give isolated rooms a route; then approach two, then allow a third to serve a sparse endpoint.
 def priority(p):
  a,b=p;ds=(degree[a],degree[b]); strength=int(remaining[p]['strength'])
  return (sum(d==0 for d in ds),sum(d<2 for d in ds),strength,-sum(ds),-a,-b)
 p=max(feasible,key=priority)
 if min(degree[p[0]],degree[p[1]])>=2:break
 selected[p]=remaining.pop(p)
 degree.update(p)

def write(name,fields,rows,delimiter=','):
 with open(out/name,'w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=fields,delimiter=delimiter,extrasaction='ignore');w.writeheader();w.writerows(rows)
fields=['from_pdd','to_pdd','relationship_type','strength','explanation_es']

network=[]
for p,e in sorted(selected.items()):
 network.append(dict(e,from_word=r[p[0]]['word'],to_word=r[p[1]]['word'],review_status='propuesta_no_aprobada'))
write('proposed-network.csv',['from_pdd','from_word','to_pdd','to_word','relationship_type','strength','explanation_es','review_status'],network)
oldpairs=collections.defaultdict(list); olddegree=collections.Counter()
for e in existing:
 p=tuple(sorted((int(e['from_pdd']),int(e['to_pdd']))));oldpairs[p].append(e)
 if e['enabled']:olddegree.update(p)
neighbours=collections.defaultdict(list)
for a,b in selected:neighbours[a].append(b);neighbours[b].append(a)
roomrows=[]
for p,x in sorted(r.items()):
 roomrows.append(dict(pdd=p,word=x['word'],short_definition=x['short_definition'],existing_enabled_rows=olddegree[p],proposed_connections=degree[p],neighbour_pdds=';'.join(map(str,sorted(neighbours[p]))),neighbour_words=' | '.join(r[n]['word'] for n in sorted(neighbours[p])),review_note=('Sin pareja suficientemente cercana en esta propuesta; revisar acepciones antes de añadir enlaces.' if degree[p]==0 else 'Objetivo de dos no alcanzado sin ampliar el criterio semántico.' if degree[p]==1 else '')))
rf=list(roomrows[0]);write('connections-per-room.csv',rf,roomrows);write('rooms-with-zero-connections.csv',rf,[x for x in roomrows if x['proposed_connections']==0]);write('rooms-exceeding-three.csv',rf,[x for x in roomrows if x['proposed_connections']>3])
disables=[]; dispositions=[]
for e in existing:
 a,b=int(e['from_pdd']),int(e['to_pdd']);p=tuple(sorted((a,b)))
 if p in selected:
  status='conservar_par_revisar_metadatos';reason=selected[p]['explanation_es']
 elif p in admissible:
  status='proponer_desactivar_por_presupuesto';reason='Relación semántica admisible, omitida por el presupuesto de grado y el objetivo de dos vecinos: '+admissible[p]['explanation_es']
 else:
  status='proponer_desactivar_sin_justificacion_estrecha';reason=f"No se ha justificado sinonimia, oposición ni equivalencia de uso entre «{r[a]['word']}» ({r[a]['short_definition']}) y «{r[b]['word']}» ({r[b]['short_definition']}). El motivo existente «{e.get('reason') or ''}» no basta para retener el par bajo el criterio estricto; la omisión no prueba que toda acepción posible sea incompatible."
 row=dict(connection_id=e['id'],from_pdd=a,from_word=r[a]['word'],to_pdd=b,to_word=r[b]['word'],existing_enabled=e['enabled'],existing_type=e.get('connection_type'),existing_strength=e.get('strength'),existing_featured=e.get('featured'),existing_reason=e.get('reason'),proposed_disposition=status,explanation_es=reason,review_status='pendiente_revision_no_importar')
 dispositions.append(row)
 if p not in selected and e['enabled']:disables.append(row)
ef=list(dispositions[0]);write('existing-connections-review.csv',ef,dispositions);write('existing-connections-proposed-for-disabling.csv',ef,disables)
write('admissible-alternatives.csv',fields,[remaining[p] for p in sorted(remaining)])
for name,data in [('vocabulary-snapshot.json',rooms),('existing-connections-snapshot.json',existing)]:
 (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
hist=collections.Counter(degree[p] for p in r)
metrics=dict(rooms=len(r),existing_rows=len(existing),admissible_pairs=len(admissible),proposed_pairs=len(selected),degree_histogram=dict(sorted(hist.items())),existing_pairs_retained=sum(p in selected for p in oldpairs),new_pairs=sum(p not in oldpairs for p in selected),existing_enabled_rows_proposed_disabled=len(disables),max_degree=max(degree.values()),mean_degree=sum(degree.values())/len(r))
assert len(r)==396 and len(existing)==1101
assert all(a in r and b in r and a<b for a,b in selected)
assert max(degree.values())<=3 and sum(degree.values())==2*len(selected)
assert len(network)==len({(e['from_pdd'],e['to_pdd']) for e in network})
assert len(dispositions)==len(existing)
assert all(e['explanation_es'].strip() and int(e['strength']) in (2,3) for e in network)
(out/'validation.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(metrics,ensure_ascii=False,indent=2))
