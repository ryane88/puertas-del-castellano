# Puentes de Principiante

PDP starts on Yo, offers 20 present-tense verbs, and has ten endings per verb in the initial seed. Bridge rank is an editorial estimate of usefulness for Canadian beginners. French and English lead the language choices, and Canada and Quebec lead the places to live.

## Apply and preview locally

1. Use a disposable Supabase project or a local database with the castle's existing base schema, including `public.castle_doors` and the Supabase browser roles. Apply these migrations in order using the project's normal migration workflow or a PostgreSQL client connected to that local database.
   - `20261108000002_pdp_islands.sql` creates the island and bridge tables with read-only public access to published content.
   - `20261108000003_pdp_seed.sql` adds Yo, the verbs, the complements, and their ranked bridges.
   - `20261108000004_pdp_castle_door.sql` claims the vacant P door at position 17. It skips the assignment if that slot is occupied or a PDP door already exists. Check the door catalog for `destination_passage = 'PDP'` after applying. If you need a different slot, assign the PDP badge and passage to an agreed vacant door.
2. In a preview copy, point `setup.supabase` in `src/story.js` to the test Supabase URL and its public key. Compile from the project root with `./tools/tweego/tweego -o index.html src`. Serve the project root so the existing castle art loads.
3. Select the PDP door or press **P** to select it, then choose **Entrar**. Try *Yo soy canadiense*, *Yo hablo francés*, *Yo hablo inglés*, and *Yo vivo en Quebec*. Turn both ways, cross the bridge, go back to try a different ending, and restart at Yo.

## Edit the routes

Edit `pdp_bridges.sort_order` to reorder choices from an island. Lower values appear first. Ranks are unique per source, with slots 1–20 from Yo and 1–10 from each verb. In a transaction, use `SET CONSTRAINTS public.pdp_bridges_source_rank_key DEFERRED;` before swapping two occupied ranks.

Edit the island's `label` to change its displayed text and the words it contributes to the sentence. A shared complement has one label across all incoming bridges. Check every sentence that uses it, or create a new complement and link it only to the intended verb. Keep stable slugs when changing labels. Use `published = false` to withdraw an island or bridge. A verb appears at Yo when it has a published route through to level 3.

Replaying the seed fills missing entries in free rank slots and preserves existing labels, ranks, and publication choices. Keep a retired route unpublished if it should stay retired after a replay. Unpublished bridges still reserve their rank slot.

## Roll back

- To hide PDP while keeping edits, unpublish the `yo` island and remove the PDP assignment from the door catalog.
- To remove PDP data and schema, export any edited rows first and review `supabase/rollback/pdp.sql`. Run it manually against the intended database. It restores position 17 only if it still matches the seeded PDP door, then drops the two PDP tables and their data. If you moved or edited the door, revert that catalog entry separately.
- For a source rollback, revert the PDP shortcut lines in `src/story.js` and `src/passages/castle.twee`, remove `src/pdp.js`, `src/pdp.css`, and `src/passages/pdp.twee`, and rebuild. If the migrations were already recorded in a shared environment, coordinate rollback as a new migration so migration history stays intact.
