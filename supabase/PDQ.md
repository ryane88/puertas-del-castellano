# PDQ — additional vocabulary pruebas

After completing a prueba, **Otra prueba con una palabra nueva** selects a random published `public.rooms` word not recorded in this browser's **Diario de diplomas**. It immediately starts the existing Don Quijote `discover` → `understand` → `use` script. Completing all three stages adds the usual diploma. The existing latest-word replay remains available separately.

Selection uses existing public REST access, loads the catalogue in ordered pages of 250 records, requires a valid PDD number, word and short definition, and excludes both completed PDD numbers and normalized word names (case and whitespace insensitive). Duplicate catalogue words are deduplicated before random selection. The just-completed word is excluded even when saving its diploma failed. Diary storage is browser-local; a different browser has its own completed-word list.

Selection starts only on the new button click. A failed catalogue/AI request or an exhausted catalogue leaves the completed lesson and diploma available. Buttons are disabled during requests, and leaving the passage cancels the request. Fresh history is sent to the unchanged `pdq-chat` Edge Function; no database migration, additional secrets, or deployment is required.

Changed sources: `src/story.js`, `src/passages/castle.twee`. Rebuild using the existing Tweego command. Reload the local castle fully to load the updated inline story code.

## Verification (2026-11-13)

One-time full Tweego build passed. `tools/tests/pdq-random-browser.mjs` verifies the compiled SugarCube castle in isolated Chromium with mocked Supabase/AI replies: number/name exclusions, second-page selection, database/AI failure preservation, double-click protection, fresh-stage requests, all three stages, diary persistence, passage reentry, catalogue exhaustion, and existing latest-word replay. It never changes the player's browser save or makes paid AI calls. A read-only live database check found 405 eligible published vocabulary records; live AI conversation behavior is unchanged and was not retested.

Run with Node and Playwright installed; optionally set `PDQ_PLAYWRIGHT_PATH`, `PDQ_CHROME_PATH`, and `PDQ_PROJECT_ROOT`. The browser test defaults to this project via its own location and system Chrome on macOS.
