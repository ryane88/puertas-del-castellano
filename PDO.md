# PDO · Palacio de Obras

Door 16 (shortcut **O**) opens the PDO catalog of shared-screen Spanish B1–B2 mysteries for 3–6 players. The picker lists published scenarios from Supabase. Pick a player count, read the cast and all six lines of each scene, then agree on an investigation route. Every player records one vote on the shared screen. A tie sends the group back to discussion and a new vote. **Empezar otra partida** returns to the scenario selector.

When the group starts, the Edge Function reads the published scenario premise and four image paths from `pdo_scenarios`, and the matching private definition from `pdo_scenario_rules`. OpenAI writes six characters, four scene openings, and two sentences per speaking turn in one request. The server chooses the solution separately, inserts the official clues, and adds a third sentence where needed. Both routes reach the same solution. The rules migration supplies definitions for **El manuscrito desaparecido**, **La campana que sonó dos veces**, and **El brindis de la tregua**. The picker respects the existing publication settings.

## Setup

- Use the same Supabase project and browser configuration as the castle. PDO reuses the PDT/PDQ service-role credential conventions, existing `OPENAI_API_KEY`, and existing `reserve_tavern_chat_request()` quota. PDO reserves one shared request per start. Run the scenario catalog migration if needed, then run `20261106000002_pdo_scenario_rules.sql` before deploying the new function. Game sessions travel in encrypted browser memory.
- Set `PDO_ALLOWED_ORIGINS` to the comma-separated browser origins allowed to use PDO. Include `http://localhost:8000` for local browser testing. Set `PDO_SESSION_KEY` to a server-only base64 string containing 32 random bytes. Generate it with `openssl rand -base64 32` and set it through Supabase secrets management. `PDO_OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`. Generation can take longer than a prewritten game.
- In the Supabase Dashboard, open the `pdo-mystery` function editor and replace its entire `index.ts` with `supabase/functions/pdo-mystery/index.ts`, then deploy. The file contains the full function. You can also deploy from the project root with `supabase functions deploy pdo-mystery`. Build from the repository root with `./tools/tweego/tweego -o index.html src` and serve the root over HTTP. The alphabetical door migration registers PDO at slot 16. Older catalogs can use the local fallback while that slot is empty.
- For a local Supabase stack, point `setup.supabase` in a local copy to the stack and serve the function with the same environment settings. Avoid committing local credentials.

## Add an obra

Create a catalog row and a matching `pdo_scenario_rules` row under the same slug. Start with the new catalog row unpublished. The rules are readable only by the service role through the API. The current engine uses six suspects, four scene slots, and two routes. Define two evidence groups with three and two distinct values. Their combinations identify the six characters. Use `{a}` and `{b}` for clue values. Route A reveals `{a}` first and route B reveals `{b}` first. The last clue completes the pair. Use `{name}` with both values in the reveal. Scene briefs go to the writer, so leave hidden facts out of those briefs. Test both routes and publish the catalog row when ready. The migration includes three examples.

## Tests

Run `node --test tools/tests/pdo-mystery.mjs` with Node 22.18 or newer. It exercises the real handler with mocked OpenAI and quota calls, covering the three seeded definitions, generated content and catalog images, all six culprits, 3–6 players, both routes, tampered and expired tokens, premature reveal, ties and rate limits.

In a served build, use **O** and **Entrar** to open PDO, choose a scenario and player count, and play to the reveal. Confirm that all scene lines show together, the cast shows player assignments and the script uses short character names, and the catalog images load on their respective routes. Start a second game to check that the cast and writing vary. Try a tied vote, vote again and restart. Verify that the wall still has 27 positions and that PDQ and PDT still open.

## Session boundaries

The browser holds an opaque, fixed-length AES-GCM token in passage memory. Only the Edge Function can issue or read it. The token contains the generated play, future scenes, fixed solution and current phase. It is roughly 75 KiB and goes back to the Edge Function on each action. The presenter can share the castle window over Zoom. Other players only need the shared screen. The function accepts a vote only with a valid voting-phase token and a complete ballot with a unique leader. It returns the motive and hiding place only at the reveal. Earlier scenes expose the public clues and cast, from which the group can deduce the solution.

The prototype uses a public shared screen. A token holder can replay earlier phases, submit a ballot programmatically after advancing, or share their token. Branch replays keep the original solution. Tokens expire two hours after the game starts. Deploying this version expires tokens from the old format. Leaving the passage or reloading starts a fresh session. The shared quota limits AI starts. The origin allowlist governs browser access and does not authenticate players.
