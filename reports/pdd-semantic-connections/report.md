# PDD semantic room connections audit

Read-only live snapshot: 2026-10-30T21:34:41Z.

## Findings

Fetched **396 rooms and 1101 connection rows**, using ordered 200-row GET pages with exact API counts. 1101 connections are enabled; 0 are disabled. These are rows visible to the existing browser publishable key, not proof of complete database contents or constraints. No database writes, gameplay changes, schema changes, imports, commits or deployments were performed. REST schema/constraints were not available; columns were inspected from actual returned rows.

Connections store `id`, `created_at`, `from_pdd`, `to_pdd`, `relationship`, `strength`, `reason`, `featured`, `enabled`, and `connection_type`. Endpoints refer to **rooms.pdd, not rooms.id**. All 1101 returned relationship values are null; connection_type supplies mixed category labels, not an enforced direction.

The runtime query requests enabled rows where from_pdd OR to_pdd equals the current PDD. It resolves the other endpoint as the destination. Thus one row is **bidirectional in gameplay**, regardless of endpoint order or type. Reverse rows are unnecessary. Duplicate helper definitions exist in StoryScript and story.js; the later standalone definition wins, with the same connection query. Functions are not doubled merely by being redefined.

## Connection-count summary

| Metric | Value |
|---|---:|
| Visible rooms | 396 |
| Published rooms | 396 |
| Connection rows | 1101 |
| Enabled connection rows | 1101 |
| Distinct unordered pairs | 1101 |
| Minimum unique enabled resolved neighbours | 0 |
| Median unique enabled resolved neighbours | 5 |
| Mean unique enabled resolved neighbours | 5.56 |
| Maximum unique enabled resolved neighbours | 52 |
| Rooms with zero enabled incident rows | 124 |
| Rooms with no usable visible semantic destinations | 124 |
| Rooms with >6 visible semantic destinations | 86 |
| Statistical degree outliers | 38 |
| Duplicate unordered pairs | 0 |
| Extra pair rows beyond one per pair | 0 |
| Pairs with multiple enabled rows | 0 |

Degree excludes unresolved endpoints and self-links, and deduplicates destinations. The statistical threshold is degree > 15 (Q1=0, Q3=6; observed-sample quartiles). Separately, >6 visible semantic doors is a practical crowding flag, not a claim of statistical abnormality. Visible counts model published destinations after chronological exclusion, not just raw degree. Stored row count and unique destination count must not be confused.

### Highest-degree rooms

| PDD | Word | Enabled rows | Unique neighbours | Visible semantic rows | Unique visible semantic doors |
|---|---|---:|---:|---:|---:|
| 335 | Todo lo que yo aprendía, lo aprovechaba para pintar por mi cuenta las cosas que me interesaban; eso es lo que podemos llamar, unida a la técnica, la iniciación a la personalidad. | 52 | 52 | 51 | 51 |
| 339 | Agosto, todo lo seca menos el mosto | 37 | 37 | 35 | 35 |
| 375 | Picaflor | 34 | 34 | 32 | 32 |
| 377 | Espantapájaros | 31 | 31 | 29 | 29 |
| 307 | El cuidado como forma de amor | 29 | 29 | 29 | 29 |
| 367 | el/la  final | 26 | 26 | 24 | 24 |
| 333 | Creo que pintaría de la misma forma en cualquier lugar del mundo, puesto que proviene de una manera particular de sentir. | 25 | 25 | 23 | 23 |
| 350 | Chapuzón | 24 | 24 | 23 | 23 |
| 370 | el/la frente | 24 | 24 | 23 | 23 |
| 247 | Leer fue siempre una forma de felicidad clandestina. | 23 | 23 | 23 | 23 |
| 317 | de amor | 23 | 23 | 23 | 23 |
| 349 | Surfear | 23 | 23 | 22 | 22 |
| 332 | El surrealismo ha contribuido al arte en la misma medida en que el *psicoanálisis ha contribuido a explorar el subconsciente | 22 | 22 | 21 | 21 |
| 340 | A las siete en agosto, sombra en rostr | 22 | 22 | 21 | 21 |
| 269 | Tener cara | 21 | 21 | 19 | 19 |

### Rooms with no semantic connections

PDD 3 (Ronronear), PDD 5 (Obsequiar), PDD 7 (Dar por sentado), PDD 8 (Aullar), PDD 9 (Aficionado), PDD 10 (Susceptible), PDD 12 (Sintonizar), PDD 14 (Paradigma), PDD 15 (Entablar), PDD 22 (Jactarse), PDD 31 (tremendo), PDD 33 (fastidiar), PDD 34 (fastuoso/a), PDD 37 (a todo trapo), PDD 38 (estupefaciente), PDD 40 (vanguardia), PDD 46 (epojé), PDD 47 (patidifuso), PDD 48 (concatenar), PDD 53 (aterciopelado), PDD 60 (patrón), PDD 61 (Arrellanarse), PDD 66 (Los cabos sueltos), PDD 68 (Mandar todo a paseo), PDD 69 (Movida), PDD 73 (paradoja), PDD 77 (incentivo), PDD 86 (bola de estambre), PDD 88 (vendehumos), PDD 94 (Asombrar), PDD 95 (Más te vale), PDD 99 (Que me quiten lo bailado), PDD 102 (Estirar el chicle), PDD 105 (Eso es el colmo), PDD 109 (Algo grandioso), PDD 110 (Bucle), PDD 111 (toma falsa), PDD 116 (Ser de mecha corta), PDD 117 (Procurar), PDD 122 (disminuir y ampliar), PDD 124 (obedecer), PDD 135 (habitar), PDD 143 (Pasarse tres pueblos), PDD 144 (Meterse en berenjenales), PDD 146 (enérgica" y "energética), PDD 148 (FIGURATIVO vs FIGURADO), PDD 149 (Sutileza), PDD 150 (la letra con sangre entra), PDD 158 (liarse parda (pardo)), PDD 160 (vocación), PDD 162 (Prodigioso), PDD 163 (aunar), PDD 165 (dominguero), PDD 166 (Paralelo), PDD 169 (Peritaje), PDD 170 (Más hermosa que un gorrino), PDD 171 (duende), PDD 172 (rebosar), PDD 173 (meter la pata), PDD 177 (malgastar), PDD 178 (inabarcable), PDD 179 (abarcar), PDD 180 (crisol), PDD 181 (matasuegras), PDD 183 (aplastar), PDD 184 (Torbellino), PDD 185 (Pelagatos), PDD 186 (Concepción), PDD 188 (Encarnación), PDD 189 (Recogimiento), PDD 207 (No todo es color de rosa), PDD 234 (el nomeolvides), PDD 241 (Sea lo que sea” 🌿), PDD 243 (de todos modos), PDD 245 (a fin de cuentas/al fin y a cabo), PDD 256 (Raja), PDD 257 (Espinado), PDD 258 (Sincericidio), PDD 259 (Inmortal), PDD 271 (irrumpir), PDD 273 (desatar), PDD 275 (acariciar), PDD 276 (trémulo / trémula), PDD 278 (arrebatar / arrebato), PDD 282 (atisbo / atisbar), PDD 283 (plantear), PDD 287 (Ójala), PDD 288 (esencia), PDD 289 (quintaesencia), PDD 290 (cotidianidad), PDD 292 (holistico), PDD 293 (coherencia), PDD 295 (trascender), PDD 301 (armiño), PDD 305 (maja/majo), PDD 314 (organicismo), PDD 315 (Catenaria), PDD 318 (Dondequiera), PDD 320 (Carecer), PDD 336 (Hacer el agosto), PDD 344 (Desinhibirse), PDD 348 (Interminable), PDD 351 (Culebra), PDD 352 (Endurecer), PDD 357 (Cualidad / Calidad), PDD 363 (Infección / Infestación), PDD 380 (serendipia), PDD 383 (Resolana), PDD 385 (Albor), PDD 386 (TENER UNA CORAZONADA), PDD 387 (OLERSE ALGO / OLERSE LA TOSTADA), PDD 388 (IMPONDERABLE ), PDD 389 (TENER OLFATO PARA ALGO), PDD 390 (ATAR CABOS: cuando las piezas empiezan a encajar), PDD 391 (Sostener), PDD 392 (DISCURRIR), PDD 393 (Determinación), PDD 394 (Benevolencia), PDD 395 (verbalizar), PDD 396 (DISCERNIR), PDD 397 (TRASCENDER), PDD 398 (VISLUMBRAR / VISLUMBRE), PDD 399 (gestar/ gestarse), PDD 400 (TRANSMUTIR).

Rooms with no usable semantic door after publication and chronological filtering are listed in `rooms-without-semantic-doors.csv`. Chronological navigation remains separate, so zero semantic doors does not imply an unreachable room.

## Data-quality review

| Flag | Connection rows flagged | Meaning |
|---|---:|---|
| CHRONOLOGICAL_OVERLAP | 44 | Already a chronological neighbour and filtered in gameplay |
| DUPLICATE_UNORDERED_PAIR | 0 | Same pair stored more than once |
| GENERIC_REASON_REVIEW | 951 | Generic or broad shared-field reason; human review needed |
| INVALID_ENDPOINT_VALUE | 0 | Null, non-positive or malformed PDD endpoint |
| MISSING_REASON | 0 | No reviewer rationale |
| MULTIPLE_ENABLED_PAIR_ROWS | 0 | Can create repeated doors after runtime filtering |
| REVERSED_PAIR_ROWS | 0 | Both endpoint orientations stored |
| SELF_LOOP | 0 | Returns to same PDD |
| STRENGTH_ONE_REVIEW | 849 | Low-ranked strength; not automatically incorrect |
| UNPUBLISHED_ENDPOINT | 0 | Known unpublished room; hidden as a destination |
| UNRESOLVED_ENDPOINT | 0 | Endpoint absent from visible vocabulary; may be RLS-hidden, not proven dangling |

Flags overlap and count rows, not independent defects. Full endpoint words, reasons and IDs are in `connection-review.csv`. Duplicate groups must be reviewed together; no row has been selected for deletion. Strength 1 and shared-field reasons are review heuristics, not proof that a link is unhelpful. No lexical-similarity score alone establishes a useful educational relationship.

Most frequent reasons:

- 102 rows: Conexión semántica o contextual clara dentro de la colección.
- 88 rows: Comparten el campo water sea
- 84 rows: Comparten el campo nature growth
- 84 rows: Comparten el campo time year
- 81 rows: Comparten el campo emotion inner
- 68 rows: Comparten el campo social relation
- 67 rows: Comparten el campo food enjoy
- 66 rows: Comparten el campo body face
- 65 rows: Comparten el campo art story
- 55 rows: Comparten el campo compound playful

### Specific educational-quality examples

These are review candidates based on current words and short definitions, not automatic disable recommendations:

| Connection ID | PDD pair | Existing reason | Assessment |
|---|---|---|---|
| 74 | 85 (aleatorio/a) ↔ 335 (reflection on artistic learning and personal style) | Comparten el campo water sea | Neither current short definition establishes a water/sea relationship. Review the original context and metadata before retaining or disabling. |
| 95 | 316 (Amargo) ↔ 335 | Comparten el campo water sea | Bitter taste and artistic learning do not establish the stated shared field. A specific rationale is needed. |
| 30 | 226 (A río revuelto, ganancia de pescadores) ↔ 335 | Comparten el campo water sea | The idiom's current definition concerns gaining advantage during confusion; literal river vocabulary alone would not justify a semantic link to artistic learning. |
| 90 | 248 (reflection on love transforming us) ↔ 335 | Comparten el campo water sea | Personal transformation may support another contextual link, but not the existing water/sea explanation. Review the relation rather than assuming deletion is appropriate. |
| 38 | 334 (A veces escribo como si trazase un boceto) ↔ 335 | Comparten el campo art story | A plausible art/creative-process connection, showing why low strength or a shared-field reason alone is not grounds for removal. It is also a chronological neighbour, so currently adds no distinct semantic door. |

Possible causes include overly broad category assignment or reasons that no longer fit edited vocabulary. The snapshot does not establish which cause applies. Inspect both full descriptions and provenance before modifying anything. Long quotations in the `word` field also make keyword-only classification unreliable. Prioritize the 124 unconnected rooms (including recent PDDs 385–400) and the large hubs for editorial review; avoid creating another dense category clique.

## How semantic doors appear

1. TestMystRoom loads the current room, enabled incident connections, and published destination rooms.
2. Connections are ranked by featured descending, strength descending, then destination PDD ascending. No type, relationship or reason filtering is performed.
3. Previous/next published PDD rooms are calculated; the chronology wraps between PDD 1 and the latest. Semantic destinations equal to either chronological neighbour are removed.
4. A semantic return door matching enteredFromPdd is extracted and reinserted among the semantic doors. Only the first match is extracted; duplicate destinations can remain.
5. The forward chronological door appears first, followed by the first half of semantic doors, the semantic return door if present, the remaining semantic doors, then the backward chronological door. There is no cap, random sampling, or deduplication of semantic destinations.
6. Left/right rotates one wall at a time; each wall shows the destination painting and description. The word starts hidden until revealed. A counter counts all circular doors. Enter updates enteredFromPdd/currentPdd and calls Engine.play(TestMystRoom). Connection reasons and types are not displayed.

Relevant source: src/story.js setup.getConnections/setup.getPublishedRooms; src/passages/castle.twee TestMystRoom (connection construction, ranking, chronological exclusion, return door, showWall, entry). Prototype TestCircularRoom/TestSupabase are separate passages and do not automatically execute with the main room.

## Recommended visible-door budget (proposal only)

Use **at most 4 unique semantic doors, including a valid semantic return door**, plus the existing 2 chronological doors: normally at most 6 walls. Reserve one semantic slot for return when needed, leaving 3 ranked choices. Without a semantic return, allow 4 ranked choices. First filter enabled/resolved/published targets and chronological overlaps, then collapse duplicate target PDDs, then select. Preserve current featured/strength/PDD ranking initially; add stable ID tie-breaking if needed. Keep selection stable for a room visit rather than shuffling on every render. Never hide the only return route or count a chronological return twice.

Keep the broader graph in the database: cap presentation, not stored degree. Many good thematic connections can be retained for future discovery. Review low-strength hubs and broad category imports before allowing featured links to consume every slot. Degree at both endpoints matters because gameplay is bidirectional. Only propose gameplay code after the count and budget policy are agreed; none is included here.

## Reviewed CSV import workflow (proposal only)

1. Export a dated, full authorized snapshot of rooms and room_connections plus actual schema/constraints through an authorized administrator. This public-key audit cannot certify uniqueness rules, foreign keys, permissions, or hidden rows. Preserve the before-state and IDs for rollback.
2. For each new PDD, read its word, short_definition and description in context. Propose a small set of useful synonyms, antonyms, idioms, usage/grammar links or specific narrative associations. Prefer 2–4 explainable initial neighbours; do not generate all-to-all edges from a broad tag. Distinguish same spelling from same sense. Suggestions are not approvals.
3. Prepare an offline review CSV using the provided header-only template. Review-only columns such as action, expected_old_values_json, rationale and reviewer are NOT database columns and must never be sent blindly to Supabase. Keep actual existing endpoint orientation for updates. For proposed new pairs use canonical min/max PDD ordering; no reverse companion row is needed. Do not guess generated IDs or timestamps.
4. Validate positive distinct endpoints against rooms.pdd, authorized publication state, existing pairs in either orientation, duplicate rows within the proposed CSV, conflicts with existing metadata, and the observed allowed types/strengths. Confirm actual schema permits each value; observed values do not prove formal constraints. Reject unknown action or column names, spreadsheet formula cells, missing rationale and unapproved rows.
5. Produce a dry-run diff: insert/update/disable/no-op counts; per-endpoint degree before/after; proposed visible doors under the agreed cap; affected return and chronological paths; collisions and rejected rows. Flag excessive featured choices, weak hub links and redundant chronological pairs for human review.
6. A human reviewer checks both vocabulary senses and both directions of travel, writes a specific rationale and explicitly approves individual rows. A separate explicit authorization is required before any database write; nothing in this report authorizes an import.
7. An authorized administrator imports only approved rows through a controlled importer/staging process. Use a strict mapping to verified real columns; update by existing connection ID with expected-old-value checks and abort on stale data. Inserts omit generated fields and recheck unordered-pair existence. Resolve conflicting actions before applying; use a transaction or a documented small-batch rollback plan. No service-role credential belongs in the game, CSV or repository.
8. Prefer disabling reviewed unwanted links to deleting them initially. Re-export, reconcile exact IDs/values and counts, check both affected rooms in browser including return/history, then refresh the audit. Re-running an approved batch should be a no-op, not another insert. Preserve audit evidence and a reviewed rollback CSV of original values.

The template intentionally has no proposal rows; it cannot accidentally request changes. Suggested review-only fields are not proposed schema additions.

## Deliverables and limits

- connections-per-room.csv: every visible vocabulary record, raw and usable counts, neighbour lists, outlier flags.
- rooms-without-semantic-doors.csv: rooms with no usable semantic destinations.
- connection-review.csv: every live connection with endpoint words, metadata and review flags.
- connection-change-review-template.csv: header-only proposed offline review format.

Checks: fetched API totals, unique row IDs, incidence sums, canonical-pair analysis and modeled display counts. No browser navigation or import was executed. Connection retrieval in gameplay is not paginated; a future single room exceeding the server row cap could silently lose links. The audit itself paginated past 1,000 rows. Live records could change between requests; this is not a transactional snapshot.
