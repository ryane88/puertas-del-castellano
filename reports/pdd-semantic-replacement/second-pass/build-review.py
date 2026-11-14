"""Regenerate offline second-pass reports; never write to the original proposal."""
import collections,csv,hashlib,json,pathlib
out=pathlib.Path(__file__).resolve().parent
base=out.parent
fingerprints=json.loads((out/'original-file-hashes.json').read_text())
def check_originals():
 for name,digest in fingerprints.items():
  assert hashlib.sha256((base/name).read_bytes()).hexdigest()==digest, 'Original changed: '+name
check_originals()
rooms={int(x['pdd']):x for x in json.loads((base/'vocabulary-snapshot.json').read_text())}
def read(path,delimiter=','):
 with path.open(newline='') as f:return list(csv.DictReader(f,delimiter=delimiter))
def write(name,rows,fields):
 with (out/name).open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
existing_ids=collections.defaultdict(list)
for x in json.loads((base/'existing-connections-snapshot.json').read_text()):
 existing_ids[tuple(sorted((int(x['from_pdd']),int(x['to_pdd']))))].append(x['id'])
original=read(base/'proposed-network.csv')
pairs={tuple(sorted((int(e['from_pdd']),int(e['to_pdd'])))) for e in original}
degree=collections.Counter()
for p in pairs:degree.update(p)
zeros={n for n in rooms if degree[n]==0}
assert len(pairs)==215 and len(rooms)==396 and len(zeros)==138
source=read(out/'editorial-candidates.tsv','\t')
extra=collections.Counter();seen=set()
for e in source:
 a,b=int(e['from_pdd']),int(e['to_pdd']);p=tuple(sorted((a,b)))
 assert a in rooms and b in rooms and a!=b
 assert a in zeros or b in zeros
 assert p not in pairs and p not in seen
 assert e['confidence'] in {'alta','media'}
 assert e['explanation_es'] and e['confidence_reason_es']
 seen.add(p);extra.update(p)
assert all(degree[n]+extra[n]<=3 for n in rooms)
candidates=[];evidence=[]
for e in sorted(source,key=lambda x:(int(x['from_pdd']),int(x['to_pdd']))):
 a,b=int(e['from_pdd']),int(e['to_pdd'])
 row=dict(from_pdd=a,from_word=rooms[a]['word'],to_pdd=b,to_word=rooms[b]['word'],relationship_type=e['relationship_type'],strength=int(e['strength']),confidence=e['confidence'],explanation_es=e['explanation_es'],confidence_reason_es=e['confidence_reason_es'],from_degree_original=degree[a],to_degree_original=degree[b],from_degree_if_all_accepted=degree[a]+extra[a],to_degree_if_all_accepted=degree[b]+extra[b],requires_vocabulary_clarification='si' if {a,b}&{367,400} else 'no',existing_connection_ids=';'.join(map(str,existing_ids[tuple(sorted((a,b)))])),review_status='candidato_pendiente_no_fusionado')
 candidates.append(row)
 evidence.append(dict(from_pdd=a,to_pdd=b,from_definition=rooms[a]['short_definition'],from_complete_description=rooms[a]['description'],to_definition=rooms[b]['short_definition'],to_complete_description=rooms[b]['description']))
write('candidate-connections.csv',candidates,list(candidates[0]))
write('candidate-source-evidence.csv',evidence,list(evidence[0]))
rejections=read(out/'rejected-or-blocked.tsv','\t')
blocked=collections.defaultdict(list);rejected=collections.defaultdict(list)
for e in rejections:
 for n in (int(e['from_pdd']),int(e['to_pdd'])):
  (blocked if e['status']=='bloqueado_por_grado' else rejected)[n].append(e['explanation_es'])
neighbours=collections.defaultdict(list)
for a,b in seen:neighbours[a].append(b);neighbours[b].append(a)
coverage=[];review=[]
for n,r in sorted(rooms.items()):
 row=dict(pdd=n,word=r['word'],degree_original=degree[n],candidate_additions=extra[n],degree_if_all_accepted=degree[n]+extra[n],candidate_neighbours=';'.join(map(str,sorted(neighbours[n]))),originally_uncovered='si' if n in zeros else 'no')
 coverage.append(row)
 if n in zeros:
  status='candidato_pendiente' if extra[n] else 'bloqueado_por_grado' if blocked[n] else 'sin_enlace_justificado'
  review.append(dict(row,short_definition=r['short_definition'],complete_description=r['description'],review_status=status,review_note_es=' | '.join(blocked[n]+rejected[n]) or ('Revisar el alcance preciso y las restricciones en candidate-connections.csv.' if extra[n] else 'No se retiene una pareja suficientemente cercana tras comparar esta entrada con las palabras y definiciones de las 396 salas. La ausencia de propuesta no demuestra que no pueda hallarse otra acepción válida.')))
write('coverage-per-room.csv',coverage,list(coverage[0]))
write('uncovered-room-review.csv',review,list(review[0]))
remaining=[e for e in review if e['degree_if_all_accepted']==0]
write('rooms-still-uncovered.csv',remaining,list(review[0]))
check_originals()
metrics=dict(original_rooms=396,original_connections=215,original_uncovered=138,candidate_connections=len(candidates),confidence_counts=dict(collections.Counter(e['confidence'] for e in candidates)),conditional_candidates=sum(e['requires_vocabulary_clarification']=='si' for e in candidates),newly_covered_if_all_accepted=len(zeros)-len(remaining),still_uncovered_if_all_accepted=len(remaining),hypothetical_total_connections=215+len(candidates),hypothetical_degree_histogram=dict(sorted(collections.Counter(degree[n]+extra[n] for n in rooms).items())),max_hypothetical_degree=max(degree[n]+extra[n] for n in rooms),candidate_pairs_joining_two_uncovered=sum(a in zeros and b in zeros for a,b in seen),original_files_unchanged=True)
assert sum(x['degree_if_all_accepted'] for x in coverage)==2*(215+len(candidates))
(out/'validation.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(metrics,ensure_ascii=False,indent=2))
