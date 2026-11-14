> **Migration applied and verified. Do not rerun it.** The user-supplied privileged verification confirms state `applied`, 215 enabled pairs, degree counts **138 / 115 / 114 / 29**, and complete private backups (1,101 before-images, 1,266 after-images, 165 inserted IDs). Execution time: **2026-10-31 21:11:58 UTC**. Evidence: `production-verification-results.json`. Earlier preparation/error-status sections below are historical and superseded by this result.

# Prepared PDD semantic replacement — DO NOT EXECUTE YET

This package prepares a transactional migration from **exactly** `../proposed-network.csv`. It does not include second-pass candidates. No Supabase write has been executed. Gameplay, vocabulary, artwork and the original proposals remain unchanged. No commit, push or deployment was performed.

**Production schema compatibility is confirmed for the supplied snapshots**, including the final DDL watcher and database CREATE privilege inspection. The local smallint guard correction has passed fixture tests. No remaining schema blocker was identified; see **`PRODUCTION-COMPATIBILITY-REVIEW.md`**. **Production execution is still NOT authorized.** Do not interpret the inspection results as approval to run the migration.

## Current production schema review

Before any write, use the new single-result **`00_inspect_production.sql`** and follow **`PRODUCTION-SCHEMA-REVIEW.md`** to return its complete JSON/CSV result. It adds live counts, backup drift, sequence/default privileges, rules/events and dependency inspection while preserving the original fingerprint algorithm. The initial results are now saved in `production-inspection-results.json`; the completed comparison is recorded in `PRODUCTION-COMPATIBILITY-REVIEW.md`. A matching fingerprint is not approval. The smaller `00_inspect_schema.sql` remains available as a catalog-only diagnostic.

## Inspected evidence

- Fresh read-only, ordered/paginated requests returned 396 rooms and 1,101 connection rows, with exact API counts. Connection rows match the original replacement report snapshot. These are browser-key-visible rows, not proof that administrator-visible rows are identical.
- Returned connection columns are `id`, `created_at`, `from_pdd`, `to_pdd`, `relationship`, `strength`, `reason`, `featured`, `enabled`, `connection_type`. No `status` field appeared. Actual PostgreSQL types/constraints require catalog inspection; JSON value types are not a schema definition.
- All fetched connections are enabled, have distinct unordered pairs, and have `relationship = null`, `featured = false`. Existing strengths are 1–3. Existing `connection_type` values include `Directa` and `Contraste`.
- `src/story.js:53` and the embedded StoryScript helper query `enabled=eq.true` and either `from_pdd` or `to_pdd`. There is no relationship/type/status filter. `getPublishedRooms` additionally filters `published=true`.
- `TestMystRoom` resolves the opposite endpoint using **rooms.pdd**, ranks featured/strength, excludes chronological overlaps and deduplicates destinations. It preserves a return door inside its four-semantic-door presentation budget. The migration does not alter any of that.
- Every room in this snapshot has a database `id` different from its `pdd`. Never substitute `rooms.id` for these endpoints. Some room_type values are null; this migration does not invent a discriminator or equate all rows in the table with PDD content.

## Exact changes if later authorized

| Operation | Rows |
|---|---:|
| Retain existing pair ID and endpoint orientation; replace semantic metadata | 50 |
| Set obsolete reviewed PDD rows to `enabled=false` | 1,051 |
| Insert new undirected pairs, once each | 165 |
| Final enabled PDD pairs | **215** |

Only the 1,101 explicit backup IDs can be updated. Their full before-state must match the export or the transaction aborts. The scope is the 396 explicitly enumerated vocabulary records, checked by PDD, database ID, word and publication state. Additional incident rows, including disabled or previously hidden ones, cause an abort rather than being silently overwritten or disabled. Rows outside the explicit backup/new IDs remain unchanged; unrelated enabled edges outside this vocabulary scope are allowed and preserved.

No DELETE or TRUNCATE is used. This is a **soft replacement of the enabled graph**, not a reduction of the table to 215 physical rows. Within the reviewed scope, the 1,051 old disabled rows plus 215 enabled rows remain: 1,266 physical rows. Unrelated rows are additional and remain untouched.

For the retained and inserted 215 pairs:

- `reason` receives the source Spanish `explanation_es` exactly, without prefixes or translation.
- `strength` receives the source value exactly.
- `relationship` receives the source `relationship_type` exactly.
- `connection_type` is the existing coarse label `Contraste` for `contraste*`/`antonimia*` source types, otherwise `Directa`. This mapping does not invent links or replace the precise type in `relationship`. It must be accepted by actual constraints before execution.
- `enabled=true`, `featured=false`; existing rows already all had featured false. New IDs and timestamps use existing database defaults; no ID is guessed or sequence reset.

Expected **stored enabled graph** degree distribution:

| Degree | Rooms |
|---|---:|
| 0 | 138 |
| 1 | 115 |
| 2 | 114 |
| 3 | 29 |

Both endpoints count. Gameplay can show fewer semantic doors because it excludes chronological overlaps and unpublished destinations; those display rules are unchanged. These counts concern the explicit 396-room scope, not unrelated or future vocabulary.

## Files

1. `00_inspect_schema.sql` — read-only catalog export and schema fingerprint. Includes actual column definitions/defaults/identity, constraints in both FK directions, indexes, user triggers/functions, policies and RLS flags.
2. `01_export_affected_rows.sql` — privileged read-only JSON export of every incident connection, enabled or disabled. Save the result independently before any future apply.
3. `02_replace_connections.sql` — explicit transaction, locks, drift checks, private durable before/after backup, scoped updates/inserts, immediate constraint checks and final assertions before commit.
4. `03_verify.sql` — read-only post-apply assertions, active count and degree histogram. Reads the private journal; no temporary/persistent DDL or data writes.
5. `04_rollback.sql` — conflict-checked transactional logical rollback.
6. `existing-rows-backup.json` / `.csv` — current read-only export of the 1,101 visible affected rows. JSON preserves nulls; CSV is for human review and is not an import/rollback format.
7. `rooms-reference.json`, `source-manifest.json`, `schema-inspection.json` — source reference, exact source checksum/counts and evidence of the unavailable REST schema.
8. `validate_package.py`, `validation-results.json` — offline source, degree, pair, embedded SQL and optional PostgreSQL syntax checks.
9. `test_local_postgres.py`, `local-postgres-test-results.json` — isolated real PostgreSQL integration tests and results.

## Execution steps — future authorized administrator only

**Do not run the replacement as part of reviewing this package.** Preparation and local tests do not authorize production execution.

1. In the Supabase SQL Editor, using the intended privileged database role, run **only `00_inspect_production.sql`**. Return the complete `inspection_json` result as described in `PRODUCTION-SCHEMA-REVIEW.md`; its schema details, fingerprint and session metadata must be reviewed before continuing. Inspect the actual constraints, index predicates, RLS and trigger functions; do not merely copy the checksum. Verify the nullable text/varchar `relationship` accepts every proposed source label, strengths 2/3 are valid, `Directa`/`Contraste` are valid, the ID/timestamp defaults work, and any endpoint FKs target `rooms.pdd`. Check that `rooms.pdd` resolves each selected PDD exactly once. Admin-only data, partitions/views, unknown fields (including status), unexpected FKs or user triggers require a revised/reviewed package. The scripts abort on these incompatible structures; no constraint or trigger is disabled. Review any database-wide DDL event triggers and role defaults as well; the fixture cannot certify them.
2. Run **`01_export_affected_rows.sql`** and save the entire JSON result to a protected backup location with the date. Compare its complete rows and IDs with `existing-rows-backup.json`. A privileged export may reveal extra rows the browser cannot see. If anything differs, stop and refresh/review the scope; never bypass the snapshot checks. The migration also captures a transactionally consistent durable backup under its locks, but an external export provides independent recovery evidence.
3. Test the package against a disposable clone/staging database with the **actual reviewed schema**, policies, defaults and data. Local fixture success below is useful but does not substitute for this production-schema check. Confirm that retaining disabled history is acceptable to any administrative reports that do not filter enabled.
4. Obtain explicit authorization for the production replacement. Only then execute `02_replace_connections.sql` **in full as one transaction**, with this line prepended in the same SQL Editor submission, replacing the value with the reviewed fingerprint:

   ```sql
   SET pdd_migration.approved_schema_md5 = 'REPLACE_WITH_REVIEWED_32_CHARACTER_SCHEMA_MD5';
   ```

   A literal placeholder or stale fingerprint aborts. Do not execute highlighted fragments or remove guards. The scripts use locks with a 10-second acquisition timeout, UTC timestamps and `row_security=off`: that setting does not grant RLS bypass; a role unable to read the full scope will error rather than silently work from a filtered subset. Use a maintenance window if writes are active. Any error aborts the transaction; issue `ROLLBACK;` if the client leaves an aborted transaction open. Never continue piecemeal. If using psql instead of the SQL Editor, use `-X -v ON_ERROR_STOP=1`, with credentials supplied through a secure external mechanism; no connection string is included here.
5. Run **`03_verify.sql`**. It must report 215 and the four degree rows above. Exact pair, type, strength and Spanish-reason assertions must also pass. Check representative bidirectional rooms, a zero-degree room and chronological navigation in the browser after an authorized production execution. No browser/gameplay testing was performed during preparation.
6. Preserve the private `pdd_semantic_215_backup_20261031` schema and external export. The private schema holds original rows, generated IDs, after-images, scope, proposal and execution state. PUBLIC/anon/authenticated access is revoked; default role/security behavior still requires the actual-schema review in step 1. Do not expose this schema through the API or drop its tables during verification.

## Rollback steps and exact limits

When rollback is explicitly authorized, inspect schema again with `00_inspect_schema.sql`. Prepend the reviewed setting above to **the complete `04_rollback.sql`**, in the same submission. The rollback also requires the schema fingerprint to equal the applied fingerprint and all affected current rows to equal the saved after-images. Later edits, deletions or extra incident connections cause an abort, preserving those changes for review.

Rollback restores all 1,101 original rows' metadata/enabled values and verifies their complete row JSON matches the durable before-images. It **disables the 165 inserted IDs rather than deleting them**. Those disabled rows and the backup schema remain for audit and to preserve downstream foreign-key references. Thus rollback restores the original enabled network and original records, not the original physical row count. A repeated rollback fails without changing data. Reapplying this same migration also fails safely; a later replacement needs a newly reviewed package, not manual deletion of the journal.

Constraints remain enabled throughout apply and rollback. An exception causes transaction rollback of table data and private backup DDL. PostgreSQL sequence increments are not transactional: failed inserts can leave ID gaps. No sequence is rewound, because that could conflict with concurrent/unrelated records. External side effects of unreviewed custom/database-wide triggers are not covered; incompatible user table triggers are rejected and database-wide DDL triggers must be inspected before authorization.

## Local validation performed

Actual PostgreSQL **16.2** was run on disposable fixtures under a temporary directory, using only a Unix socket with TCP listening disabled. It used the exported 396 rooms/1,101 connections plus unrelated fixture records. The fixture supplies representative FKs to rooms.pdd, a unique undirected-pair index, enabled RLS policy, check constraints and inbound references. It is **not claimed to be the real Supabase schema**.

Passed: apply; read-only verification; exact expected histogram; Spanish explanations/types/strengths; logical rollback; unrelated-record preservation; preservation of an inbound reference to an inserted ID; repeated apply/rollback rejection; stale snapshot; extra disabled incident row; missing/stale schema approval; mid-transaction constraint failure with data and backup-DDL rollback; duplicate pair; unknown status column; rollback conflict; endpoint degree overflow; and wrong rooms.id FK mapping. PostgreSQL SQL and PL/pgSQL syntax were also parsed using pglast 7.22. Test dependencies/runtime were downloaded to `/tmp`, with no project dependency or build-system changes.

Offline validation from the VS Code terminal:

```sh
python3 reports/pdd-semantic-replacement/sql-migration/validate_package.py
```

To rerun integration tests with a locally available PostgreSQL binary directory (the test always creates its own disposable cluster and never accepts a remote database URL):

```sh
python3 reports/pdd-semantic-replacement/sql-migration/test_local_postgres.py --bin-dir /absolute/path/to/postgresql/bin
```

No Tweego compilation is needed: only migration/report artifacts were created and game source was untouched.

## Production evidence received

See `PRODUCTION-COMPATIBILITY-REVIEW.md` for the actual schema comparison, smallint correction, matching-schema fixture test and completed event-trigger/privilege review. The original preparation notes above distinguish what was known from browser data from what the returned privileged inspection subsequently confirmed.

## Execution approval received

The user explicitly approved execution. No further approval is needed for the reviewed migration. Earlier “not authorized” statements above record the prior review stage and are superseded by this approval.

This Codex session has no authenticated Supabase database connector or database credentials and cannot use the browser's dashboard session. No production write has been made by Codex. Run **`05_execute_approved.sql` in full** in the authenticated Supabase SQL Editor; it contains the verified fingerprint and the unchanged guarded migration transaction. If it reports an error, stop and return the complete error rather than rerunning fragments or bypassing guards.

After success, run **`03_verify.sql`** and return the results: enabled count **215** and degree histogram **0:138, 1:115, 2:114, 3:29**. Execution is not recorded as completed until results are supplied. The schema/row drift guards still apply, and the original external backup files remain available. No commit, push or deployment is authorized.
