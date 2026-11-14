# PDR Edge Warden

Status: deployed and active on 2026-11-11 in project piqrpkzahyjkoytdycdg.
The actual castle now uses `backend: 'edge'`. Real OpenAI opening, button play,
free-text interpretation/narration and reentry/resume passed in localhost:8000.
R / door 19 is registered; the other 26 catalog entries were verified unchanged.
Existing local-format saves resume with the preserved signing secret.
No GitHub Pages publish occurred.

The function is `supabase/functions/pdr-warden/index.ts`. It uses the existing
castle convention: guest access (`verify_jwt=false`), exact allowed origins,
server-side OpenAI key, and a distributed Postgres quota. PDR's separate quota
does not consume or change PDT/PDQ's budget. It allows 12 reserved model calls
per minute and 200 per rolling 24-hour period. A button/opening reserves one;
free text reserves two (intention and narration). Clarification or upstream
failure still consumes that reservation, conservatively bounding paid calls.

Origin checks are not user authentication. Like the other guest rooms, this
limits shared spending rather than promising per-player abuse prevention.

## Server configuration

Existing project: `piqrpkzahyjkoytdycdg`. Required server secrets:

* `OPENAI_API_KEY`: reuse the already-configured project secret; do not replace
  the key used by the other rooms.
* `PDR_SIGNING_SECRET`: same stable signing secret as the local Warden to keep
  existing browser saves usable. Never use the service-role key as this secret.
* `PDR_ALLOWED_ORIGINS`: comma-separated exact origins, initially
  `http://localhost:8000,http://127.0.0.1:8000,http://127.0.0.1:4319`. Add the
  verified GitHub Pages origin before hosted browser use, without a URL path.
* Optional `PDR_OPENAI_MODEL`: defaults to `OPENAI_MODEL`, then `gpt-5-nano`,
  matching the existing PDQ default. Responses structured outputs are required.

Supabase supplies `SUPABASE_URL` and server credentials. The handler supports
`SUPABASE_SECRET_KEYS.default`, otherwise `SUPABASE_SERVICE_ROLE_KEY`.
Keys, private adventure facts and prompt files never enter browser responses.
Only resolved events, original player input, recent visible exchanges and the
current public/revealed scene enter OpenAI.

## Initial installation record (already applied; do not rerun setup)

From the existing project folder, with an authenticated Supabase CLI:

```sh
supabase whoami
supabase db query --remote=piqrpkzahyjkoytdycdg --file supabase/PDR-setup.sql --yes
supabase db query --remote=piqrpkzahyjkoytdycdg --file supabase/PDR-security-check.sql --yes
supabase secrets set --remote=piqrpkzahyjkoytdycdg --env-file /ABSOLUTE/PRIVATE/PDR-SECRETS.env --yes
supabase functions deploy pdr-warden --remote=piqrpkzahyjkoytdycdg --use-api --no-verify-jwt --yes
node tools/activate-pdr-edge.mjs
```

The env-file path above is deliberately a placeholder. A private signing/origin
file is prepared outside the served castle in the companion task's ignored
`tmp/pdr-edge-integration/pdr-secrets.env`. It contains only PDR-owned settings,
and does not overwrite `OPENAI_API_KEY` or other rooms' secrets.

Run PDR-setup.sql ONCE. It installs protected static adventure tables, licensing
and the dedicated quota in one transaction. A CLI-created migration with the
same SQL is included for versioning. Do not also blindly run a global db push:
the existing project's migration history has not been reconciled here.
PDR-security-check.sql validates grants/RLS and rolls its quota probe back.
Run Supabase database advisors after applying the schema; review PDR findings.

The activation helper first makes ONE real AI opening request. If it fails,
it leaves the working local Warden selected. On success it changes only PDR's
backend setting and recompiles with the existing Tweego binary. It backs up
the source and generated story. `--check-only` performs the live smoke test
without changing files. This does not deploy GitHub Pages.

Register the actual R/19 catalog entry with the already-prepared
`supabase/PDR-door.sql` after the passage is ready. Do not insert PDR adventure
data into the vocabulary `rooms` table.

## State and failure behavior

SugarCube and browser-local storage retain dynamic state. HMAC signatures use
the existing save format and the same deterministic dice inputs. No campaign
state is written to Supabase. Resuming does not spend an OpenAI call. New
opening scenes, selected actions and free-text interpretations use OpenAI.
Only allowlisted actions reach the deterministic engine; the model cannot
patch HP, money, inventory or discoveries. Contact/amputation require explicit
UI confirmation. AI failure, refusal, malformed output, quota exhaustion or
timeout returns an error WITHOUT issuing new signed state. There is no silent
scripted fallback in Edge mode. The last valid save remains resumable.

Canonical resolved facts and risks remain visible alongside AI prose. JSON
validation controls structure, not factual quality of arbitrary language.
Free-text actions outside this small slice request clarification.

## Verification

Portable handler tests pass under Node 24 and Deno 2.9.8. Deno type-checks the
actual index.ts entrypoint. The full castle compiles with its existing Tweego.
Browser integration tests use mocked OpenAI/Supabase upstream responses; they
verify narration, text actions, state transitions, reentry/resume and failure
preservation. Live deployed model responses, browser gameplay and SQL access restrictions
were subsequently verified successfully. Public-role private RPC requests
were denied, license reads succeeded, and advisors reported no PDR findings.
All 25 automated tests pass. Native Deno type-checks/tests also pass.

License: ../PDR-CREDITS.md. Versioned Warden prompt: prompt.v2.md (v1 retained), CC BY-SA 4.0.

## Rollback for local development

To return only PDR to the earlier local Warden, set its backend in src/pdr.js
to 'local', rebuild with the existing Tweego compiler, and run the companion
preview-castle.mjs server on 4319. Retain PDR_SIGNING_SECRET. This does not
require dropping the private data or changing other rooms.

## Conversation, diary and form update — 2026-11-12

Deployed prompt/handler v2. Free text can ask questions or continue dialogue
as well as request supported actions. Narration receives the actual player
message; conversation receives recent visible exchanges. Ordinary dialogue
and clarification do not advance time or modify the fictional situation.
Dice and state effects remain server-controlled.

Each successful log entry records the player message and actual Guardiana
reply alongside canonical facts. Recent signed history is bounded to 12 entries
and 12KB. Resume preserves it without a paid call. Older fact-only entries
remain available; replies never stored in older versions cannot be recreated.

The PDR input explicitly uses dark text on light backgrounds in normal, focused
and disabled states, including WebKit text-fill and a light native color scheme.
Do not replace these with a generic .pdr input rule: the story format's
unfocused-control selectors have greater specificity. Errors appear beside
the form and failed requests preserve the draft and last valid save.

29 Node tests, 11 native Deno tests, native type-check and Tweego compile pass.
Regression: tools/tests/pdr-dialogue-browser.mjs (mock AI, actual compiled
castle). It checks repeated click/Enter submission, conversation/diary resume,
failed-call preservation and 4.5:1 contrast in all input states under dark mode.
Live OpenAI also passed the exact phrase “miramos aldredador” twice and a
contextual follow-up, with preserved diary replies after reentry.

No signing secret, database schema, other rooms or GitHub Pages deployment changed.
