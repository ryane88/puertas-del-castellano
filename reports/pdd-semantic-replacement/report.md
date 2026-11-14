# Proposed replacement PDD semantic network

**Editorial proposal only — no database or gameplay changes.** Vocabulary and existing connections were fetched with read-only, paginated requests on 31 October 2026 (vocabulary fetch completed at approximately 15:28 UTC). This covers the 396 rooms and 1,101 connection rows visible to the existing browser key; it does not certify administrator-only records or constraints.

## Result and coverage

The proposed network contains **215 unique bidirectional pairs**. Each pair is stored once, with the lower PDD first. Both endpoints count toward the room's degree.

| Connections per room | Rooms |
|---|---:|
| 0 | 138 |
| 1 | 115 |
| 2 | 114 |
| 3 | 29 |
| More than 3 | 0 |
| Total | 396 |

258 rooms have a proposed connection; 143 have two or three. Mean degree is 1.09. The requested minimum of one and ideal of two **have not been achieved across the collection**. This conservative proposal leaves gaps rather than fill them with thematic links. Zero means no sufficiently close pair was retained in this proposal, not proof that no defensible relationship can ever be found. Further editorial work or vocabulary additions may close gaps; this is not an exhaustive search of every dictionary sense or a mathematically optimal graph.

Examples of strong pairs include proeza/hazaña (39–291), cordura/sensatez (27–285), dar por vencido/tirar la toalla (67–342), and the contrasting expensive/cheap expressions costar un ojo de la cara/chollo (137–270). Separate records with equivalent meanings, such as the two serendipia entries, are connected without merging or editing their records.

## Semantic policy

The room words and definitions were read across the collection; full descriptions were consulted for ambiguous senses and contextual examples. Connections were proposed on the basis of synonyms, antonyms, tightly related senses, nominal/verbal equivalents, and equivalent or explicitly contrasting pragmatic uses. Explanations in Spanish state the actual common meaning and delimit differences. A partial synonym is not advertised as interchangeable in every sentence.

Excluded as insufficient: a shared word inside unrelated idioms; common art, water, animal, body or season categories; shared scenery; an action's merely possible cause or consequence; and gender/grammar similarity without a semantic relation. For example, sharing *cara* does not connect costar un ojo de la cara to dar la cara, and sharing *flor* does not connect a flor de piel to flor y nata. Anatomical entries and isolated objects often remain unconnected under this policy.

Strength is an editorial proposal, **not a confidence probability or a database constraint**:

- **3:** direct or especially clear lexical/usage correspondence or opposition.
- **2:** narrower, qualified relationship requiring the specific sense or usage explained in the row.
- No strength-1 or broad-topic filler links are proposed.

Relationship types are descriptive review labels, not verified allowed values for `room_connections.connection_type` or `relationship`. CSV columns and labels must not be imported blindly.

## Selection and limits

`curated-candidates.tsv` contains 235 admissible candidate pairs. A deterministic selection favours pairs that connect isolated rooms, then endpoints below two neighbours, then strength, then lower current degree and PDD order. No endpoint can exceed three. A third connection is allowed only while serving an endpoint still below two. Twenty admissible alternatives remain in `admissible-alternatives.csv`; they are not extra edges in the replacement network. No randomization is used. This balancing heuristic does not guarantee the globally strongest or maximum-coverage solution, and degree preference never makes an inadmissible candidate admissible.

The proposal concerns the stored semantic graph. Current gameplay separately removes chronological overlaps before showing semantic doors. Consequently, stored degree is not necessarily visible semantic-door count. Chronological navigation remains available to zero-degree rooms. No navigation code was changed.

## Existing network review

All 1,101 existing rows have a disposition in `existing-connections-review.csv`:

| Proposed disposition | Existing rows |
|---|---:|
| Retain pair, review metadata against proposed explanation | 50 |
| Disable: no sufficiently narrow relationship justified in this proposal | 1,045 |
| Disable: admissible alternative omitted by sparse selection | 6 |
| Total | 1,101 |

The replacement includes **165 new pairs** and **50 existing pairs**. The **1,051 proposed disables** are in `existing-connections-proposed-for-disabling.csv`, preserving original connection IDs, endpoint orientation, type, strength, featured status and reason. No row is disabled now. Each omission includes endpoint-specific Spanish context; an omission is not proof that every possible sense of the pair is invalid. The 6 budget exclusions explicitly retain their semantic rationale.

Examples of rejected existing reasons include “Comparten cara,” “Comparten flor,” generic “Conexión semántica o contextual clara,” and broad shared-field reasons where the actual meanings do not establish a close relationship. Existing strength or featured status does not constitute semantic approval. Retaining an endpoint pair does not automatically endorse its existing reason, strength or type.

## Vocabulary issues requiring review

Words and source data have been preserved, including spelling and punctuation. Some entries need editorial clarification before any future import:

- PDD 367: the short definition mixes gender with purpose, while the description contrasts an ending with a tournament final. It remains unconnected here rather than relying on the inconsistent definition.
- PDD 376: regional “Hojaescampa” has an uncertain definition; the scene alone does not establish a reliable lexical equivalence.
- PDD 400: the word is stored as “TRANSMUTIR,” while its scene uses *transmutar*. Proposed edges use the supplied transformation meaning; verify the intended headword before approval.
- PDD 148: the figurativo/figurado distinction merits language review; its qualified connotation candidate is provisional, not a correction to the source.
- Multiword comparison rooms require sense-specific review. Connections to Aptitud/Actitud, Afecto/Efecto, or Compresión/Comprensión name the relevant half explicitly.

## Files and safe next step

- `proposed-network.csv`: the replacement proposal, words, review types, strengths and Spanish explanations; all rows marked unapproved.
- `connections-per-room.csv`: all 396 rooms, existing and proposed counts and proposed neighbours.
- `rooms-with-zero-connections.csv`: all 138 uncovered rooms.
- `rooms-exceeding-three.csv`: header only; no violations.
- `existing-connections-review.csv`: dispositions for all existing rows.
- `existing-connections-proposed-for-disabling.csv`: review-only disable recommendations.
- `curated-candidates.tsv` and `admissible-alternatives.csv`: editorial candidates and alternatives, separate from the final network.
- `vocabulary-snapshot.json` and `existing-connections-snapshot.json`: reproducible source data; no credentials.
- `build-proposal.py` and `validation.json`: offline generation and verification.

Review qualified strength-2 pairs and uncovered rooms first, then approve individual pairs and disable recommendations. No import script or executable SQL is provided. A future database change needs explicit authorization, verified schema mappings, a fresh comparison against existing rows, and rollback preparation. Keep the proposal separate from gameplay until that review is complete.

## Validation

Checked all endpoint IDs against the 396-room snapshot; unique canonical pairs; no self-links; maximum degree three; degree sum equals twice the 215 edges; complete per-room coverage; Spanish explanations and allowed proposed strengths; reconciliation of all 1,101 existing dispositions; and deterministic offline regeneration. Reports only: Tweego and browser gameplay testing are unnecessary because no game source changed. Nothing was committed, pushed or deployed.
