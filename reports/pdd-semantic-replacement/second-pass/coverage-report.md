# Second-pass semantic review — separate candidates

**Nothing has been merged.** The original 215-pair proposal and every original report file remain byte-for-byte unchanged, verified by SHA-256 hashes. These files are proposals for review, not database import instructions.

## Findings

Reviewed the complete descriptions of all **138 originally uncovered rooms**, comparing their words and meanings against the **full 396-room vocabulary collection**, including rooms without existing connections. Definitions provided the collection-wide comparison; complete descriptions of prospective partners were inspected to confirm senses and usage. Existing connections were not the search boundary. The review uses the saved 31 October 2026 vocabulary/connection snapshot, not a newly fetched live database.

**20 candidate pairs:** 4 high-confidence and 16 medium-confidence. All pairs include at least one originally uncovered room. Each has a precise Spanish explanation, confidence rationale, original endpoint degrees and hypothetical degrees if the entire candidate set were accepted. No low-confidence filler is proposed.

| Coverage metric | Original | If all 20 were approved |
|---|---:|---:|
| Total pairs | 215 | 235 |
| Rooms with 0 neighbours | 138 | 112 |
| Rooms with 1 neighbour | 115 | 134 |
| Rooms with 2 neighbours | 114 | 114 |
| Rooms with 3 neighbours | 29 | 36 |
| Rooms exceeding 3 | 0 | 0 |

That is **26 newly covered rooms**, conditionally. The four high-confidence pairs alone would cover five additional rooms and leave 133 uncovered. Two medium-confidence pairs require vocabulary clarification; accepting the other 18 would cover 23 additional rooms and leave 115 uncovered. These are simulations, not changes to the original proposal or the castle.

Six pairs connect two originally uncovered rooms. Thirteen of the twenty pairs use a partner with zero or one original connection; seven use a partner with two because that is the closer defensible match. No candidate uses an already saturated partner. All additions were counted together, at both endpoints, so this is not twenty independent checks that could overbook a room when combined.

## Confidence and semantic boundaries

- **Alta:** the definitions and complete scenes directly establish a specific lexical or usage contrast/correspondence. This does not mean full synonymy or a statistical certainty.
- **Media:** a defensible comparison applies to a restricted sense, component or pragmatic use. The Spanish explanation identifies what differs and where substitution fails. Human approval is particularly important.
- Strength is separate from confidence: strength 3 marks the clearest relationship; strength 2 marks qualified/partial relationships. Neither is a verified database enum or permission to import.

The high-confidence comparisons are:

| PDD pair | Precise relationship |
|---|---|
| 4–184 | Gentle wind versus forceful rotating wind, restricted to literal wind; not absolute antonyms. |
| 5–41 | Gift without required return versus reciprocal barter. Both can involve no money. |
| 6–7 | Appreciating received support versus treating it as automatic and failing to value it. |
| 91–284 | Connotative/ironic distance shown through quotation marks; both scenes explicitly illustrate a critical reading of *valiente*. |

Qualified candidates include gradual versus abrupt entry (21–271), distinct discourse functions of *de todos modos* and *al fin y al cabo* (243–245), and a narrow opening made by partial opening versus fracture (251–256). They are deliberately labelled partial comparisons, not interchangeable synonyms. Full justifications and caveats are in the CSV.

Some candidates reconsider first-pass omissions in light of a closer reading. For example, 217–325 is proposed because the first complete description explicitly places books above material treasure and the second places knowledge above money. Merely mentioning libraries would not justify it. Likewise 338–339 compares two assertions of extreme heat, not every expression mentioning August; *hacer el agosto* remains outside that comparison. These are editorial judgments to review, not newly discovered database facts.

## Required clarification and blocked alternatives

- **112–367:** compare climax with narrative ending only. PDD 367's description supports that sense, but its short definition incorrectly mixes gender with purpose. This row is conditional on clarifying the vocabulary; no source correction was made.
- **114–400:** restrict to profound inner transformation, illustrated by learning from failure. PDD 400's stored lemma is *TRANSMUTIR* while its description uses *transmutar*. Verify the intended headword before approval. A character arc is not synonymous with every transformation.
- **21–399, 249–92 and 344–24:** plausible restricted comparisons, but the partner already has three original neighbours. They appear only in the rejected/blocked log, never in the candidate CSV. No original edge is removed to create room. Alternative permitted candidates are separately justified rather than assumed equivalent.
- **151–253:** withheld. *Lonchafinista* is defined as extreme saving, but its scene concerns finishing others' leftovers. Choosing whichever sense creates a link would be unreliable.
- **280–376:** withheld. The regional *Hojaescampa* description suggests rain stopping, while the definition is uncertain. It is not treated as a synonym of drizzle.

## Why 112 rooms remain uncovered

A room was not linked merely because its scene contained a shared object, action, weather event or emotion. Examples of explicit exclusions:

- *Paradoja/coherencia*: a meaningful paradox can be coherent; they are not an antonym pair.
- *Amargo/chuparse los dedos*: bitter food can be delicious.
- *Toma falsa/meter la pata*: an error can cause a failed take; that alone does not establish semantic equivalence.
- *Quemarse las pestañas/vigilia*: night is incidental to intensive study, which can occur in daylight.
- *Luciérnaga/albor*, bird species, anatomical structures and unrelated artistic tools: shared categories or scene details do not supply close meanings.
- *Nomeolvides/recordar*: a flower's symbolism is not equivalent to a memory verb.

`uncovered-room-review.csv` preserves all 138 complete source descriptions and records which receive candidates and which remain without a justified link. `rejected-or-blocked.tsv` records 37 particularly relevant comparisons, including capacity blocks and ambiguity holds; it is not an exhaustive listing of every possible pair. This review does not prove the remaining rooms can never be connected under another documented sense. It does show that the minimum-one target has not been met without relaxing the requested criterion.

## Existing links and eventual review

Three candidates already exist in the saved Supabase snapshot: **91–284 (connection 226), 217–325 (954), and 338–339 (40)**. Their IDs are recorded in `existing_connection_ids`. The other seventeen would be new pairs relative to that snapshot. These three were omitted by the original replacement proposal; approving them later would require reconciling its disable recommendations. Do not insert duplicate pairs or execute the old disable CSV unchanged after a future merge. No original disable recommendations have been edited here.

Review each row's Spanish explanation and confidence restrictions before accepting it. Resolve the two conditional vocabulary rows first or leave them unapproved. A later authorized merge must recheck degrees collectively, duplicate pairs in both orientations, and consistency with disable recommendations. No merging, importing, source corrections, SQL or gameplay changes are included in this work.

## Deliverables and checks

- `candidate-connections.csv`: 20 review-only candidate edges, words, relationship, strength, confidence and Spanish justifications.
- `candidate-source-evidence.csv`: complete descriptions and definitions of both endpoints for every candidate.
- `uncovered-room-review.csv`: every original uncovered room, complete description, review notes and conditional coverage.
- `rooms-still-uncovered.csv`: the remaining 112 if all candidates were accepted.
- `coverage-per-room.csv`: all 396 rooms and hypothetical degrees.
- `editorial-candidates.tsv`: human-curated input; `rejected-or-blocked.tsv`: exclusions and holds.
- `build-review.py`, `validation.json`, `original-file-hashes.json`: reproducible offline validation and preservation checks.

Validation: 396 valid IDs, exactly 138 original zero-degree rooms, unique candidate pairs, no self-links or overlap with the original proposal, at least one original zero-degree endpoint per candidate, collective degree limit at both endpoints, incidence totals, complete 138-room review coverage and unchanged original hashes. No paid generation, live database write, game-source edit, commit, push or deployment occurred. Tweego was not run because this work changes reports only.
