# Production schema inspection — return results before any write

**Update: production schema and follow-up event-trigger results have been received and reviewed. Compatibility is confirmed for those snapshots; execution remains unauthorized.** See `PRODUCTION-COMPATIBILITY-REVIEW.md` for the final comparison. The collection instructions and original checklist below are retained as historical reference; no further inspection is currently required. The final review supersedes their original pending labels.

## Run this one script

1. Open `00_inspect_production.sql` in VS Code and copy its **entire contents**.
2. Open the correct Supabase project in your browser, then **SQL Editor → New query**. Use your authenticated dashboard session and the intended privileged SQL Editor role. No API key, password or connection string is needed in the script.
3. Paste and run the complete script. Do not run `02_replace_connections.sql`, `04_rollback.sql`, or set `pdd_migration.approved_schema_md5`.
4. Expect one result row with a single column called **`inspection_json`**. The script runs in an enforced read-only, repeatable-read transaction. It creates no tables/functions, performs no updates, and never calls `nextval` or `setval`.
5. Download that result as CSV and attach the file in this conversation. Alternatively, save the downloaded CSV as `reports/pdd-semantic-replacement/sql-migration/production-inspection-results.csv` and tell me it is saved. If you copy the cell instead, copy its **complete JSON value** into `production-inspection-results.json` in the same folder, or paste the complete JSON here. Do not send only the fingerprint or screenshots of a partial/truncated cell.

If the SQL Editor truncates displayed text, use its result export/download rather than copying the shortened display. The returned JSON includes schema and counts, not complete vocabulary/connection rows. Trigger/event-trigger bodies and dependent view/rule definitions are omitted; their names/hashes identify anything needing further review. No credentials are requested. If you notice credentials embedded in a custom default/policy definition, redact those literal values before sharing and indicate what was redacted.

If the query errors (permissions, missing tables, timeout, etc.), return the **complete error text**, including the SQLSTATE/line when provided. Do not change permissions, tables, policies or guards to make it run. The existing `00_inspect_schema.sql` remains a smaller catalog-only diagnostic if we need a follow-up query.

## What the report checks

- The `public.rooms` and `public.room_connections` relation kinds, plus matching relation names in other schemas.
- Every actual column, PostgreSQL type, length, nullability, enum labels, default, generated/identity settings and domain constraints.
- Primary/unique/check/FK constraints, validation/deferred settings, FK targets and incoming references.
- Index definitions, partial predicates and validity.
- User table triggers, rewrite rules, database-wide DDL event triggers and dependent views/catalog objects. Bodies omitted from the report must be inspected separately if relevant; their absence from the shared report is not approval.
- RLS and forced-RLS flags, policies, table/schema privileges for the current role and available application roles, and applicable default privileges.
- Owned sequence configuration/visible current value without advancing it.
- Exact total/scope row counts; enabled true/false/null/non-boolean values; status/type/relationship/strength/featured distributions.
- Invalid/self/unresolved endpoints, duplicate unordered pairs, publication/identity drift and extra incident rows, including disabled rows.
- Comparison with the complete 1,101-row saved backup; changed IDs and field names are reported, not overwritten. Exact JSON timestamp-format differences may need normalization before deciding whether data really changed.
- The precise proposed relationship labels and maximum text lengths, so varchar/check/enum constraints can be evaluated against all 215 original rows.

The fingerprint uses the **same calculation as the prepared migration**. Its raw trigger bodies are hashed but omitted from the shared result. Supplemental checks (for example DDL event triggers, rules and dependencies) extend beyond that fingerprint; they still require review. Catalog dependencies cannot prove absence of dynamic SQL or external consumers.

## Comparison to perform after you return results

| Area | Prepared migration assumption | Current production conclusion |
|---|---|---|
| Relations | Two ordinary tables in `public`; no view/partition adaptation | Pending |
| Columns | Exactly the ten documented connection columns; boolean enabled/featured; integer/bigint endpoints/IDs/strength; text/varchar metadata | Pending |
| Endpoint identity | Connections use `rooms.pdd`, never `rooms.id`; selected PDDs resolve exactly once | Pending |
| Vocabulary scope | All 396 saved IDs/PDDs/words/publication states still match | Pending |
| Existing rows | 1,101 explicit saved rows, no extra incident rows, no before-state drift | Pending |
| Filtering | Only `enabled=true` incident rows drive semantic queries; destinations require `published=true`; no extra status filter | Application code inspected; actual types/RLS pending |
| New values | Every source relationship label, complete Spanish reason, strengths 2/3 and Directa/Contraste accepted by actual types/checks | Pending |
| Defaults/uniqueness | IDs and timestamps generated by existing defaults; no sequence collision or unordered-pair conflict | Pending |
| Dependencies | Current guard rejects user table triggers and unexpected FKs; rules/events/views must be reviewed | Pending |
| Access | Intended role can inspect full data and perform the later authorized operations without weakening RLS | Pending |
| Backup namespace | `pdd_semantic_215_backup_20261031` does not already exist | Pending |
| Proposed graph | 215 pairs; degree histogram 0:138, 1:115, 2:114, 3:29 | Verified locally from source; not applied |

The dashboard SQL role is not the application's anon/authenticated request role. Its row counts establish a privileged view only when the returned role/RLS metadata supports that interpretation; they do not alone prove browser access. The script sets `row_security=off` to error on insufficient RLS bypass instead of silently treating filtered results as a complete backup.

I will use the results to identify exact mismatches, update only the local SQL/README/tests as necessary, rerun appropriate local tests against a fixture matching the returned schema, and report whether compatibility is confirmed. I will not execute the migration during that review.

## Preparation test

The new inspection was tested on disposable PostgreSQL 16.2 fixtures: one JSON result, read-only repeatable-read transaction, matching existing migration fingerprint, expected counts, drift detection, RLS/constraint/dependency/sequence reporting, and omitted trigger bodies. Connection data and sequence values were unchanged by inspection. Results: `production-inspection-local-tests.json`. No production query or migration was executed for this preparation.
