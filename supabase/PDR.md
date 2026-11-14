# PDR — Puerta de los Roles

PDR is active in the existing castle at R / 19 of 27 and registered in the live
castle_doors catalog. It uses the deployed Supabase pdr-warden Edge Function
with the project's existing OpenAI configuration. Other room entries and
functions are unchanged. No GitHub Pages publish was performed.

Open http://localhost:8000/, reload the page, select R, and enter. The room
shows “Guardiana con IA”. You can choose an action or type a proposal. The
local Node Warden on port 4319 is no longer required for this room.

Two characters, inventory, HP, discoveries and resumable progress remain in
SugarCube and browser-local storage. The server validates signed state and
resolves dice. The original signing secret was preserved, and hosted resume
of an existing local-format save was verified. AI failure preserves the last
valid save instead of silently switching to scripted narration.

The actual source build remains:

    ./tools/tweego/tweego -o index.html src

Function setup, quota, server secrets, activation and rollback: PDR-edge.md.
PDR-setup.sql and the CLI-created migration are installation records already
applied remotely; do not rerun the setup. PDR-security-check.sql verifies
private access. PDR-door.sql registered only the formerly vacant door 19.

Tests installed in this project:

    node --test tools/tests/pdr-warden.test.mjs

Live tests passed for AI opening, button play, free-text interpretation,
return/reentry and saved-state recovery. The source still represents a small
Cairn 2e slice with explicitly documented custom backgrounds/adaptations.
License and changes: ../PDR-CREDITS.md.

The November 12 fix supports repeated free-text questions/actions and retains
the actual player/Guardiana exchanges in the diary. Reload the page fully to
load the updated client, then continue your existing expedition. Do not clear
browser storage. Earlier entries contain only what the old version recorded.
The text box remains light with dark text when unfocused, focused and disabled.
