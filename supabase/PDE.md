# Posibilidad de Escapar

PDE is the E door in the 27-door wall. The prototype opens on the first published mission and its first published scene. If more missions or scenes are published, the room shows selectors. Numbered hotspots and the list below the scene both open the same object dialogs.

## Apply and preview

1. In a local or disposable Supabase environment with the existing castle schema and browser roles, apply these files in order through the project's migration workflow. You can also run each file in the intended Supabase SQL Editor.
   - `migrations/20261109000000_pde_rooms.sql` creates the three tables and their publication policies.
   - `migrations/20261109000001_pde_seed.sql` adds *El secreto del alquimista*, its workshop, and the manuscript, test tube, and chest.
   - `migrations/20261109000002_pde_castle_door.sql` assigns PDE to slot 05 if it still contains the standard placeholder and PDE is not assigned elsewhere. Verify that `public.castle_doors` shows badge `PDE` and destination `PDE`. If slot 05 is occupied, review the catalog before changing it.
2. In a preview copy, configure `setup.supabase` in `src/story.js` with the test project URL and its public key. Build with `./tools/tweego/tweego -o index.html src` from the project root and serve that directory so `images/` is available.
3. Select door **05** or press **E**, choose **Entrar**, and open and close all three objects. Use **Volver al castillo** to return to the wall.

## Edit content

Keep slugs stable when renaming content. Rows sort by `sort_order`, then by slug. A scene and its objects are only visible when their ancestors are published. The browser roles have read-only access. Replaying the seed fills missing sample rows and preserves any existing edits or publication choices.

Set `image_path` to a bundled JPG, PNG, WebP, or AVIF under `images/`, using letters, digits, hyphens, and underscores in path segments. The workshop uses the existing castle archive art at `images/tavern-scenes/castle-archive.jpg`. A missing or empty path shows a styled background with the same hotspots. Hotspot coordinates are percentages from the left and top of the scene. Keep hotspots separated so their touch targets have room at phone widths. Object descriptions use plain text.

## The alchemist's lock

The published workshop uses its existing object slugs to open the three illustrated clue dialogs. The SugarCube puzzle lives in `src/pde-puzzle.js` and activates when all three objects are published. The illustrations are in `images/pde/`. The original PDE migrations and seed provide the published room and require no additional SQL for the puzzle. Players can inspect the objects in any order. Their word choices, attempted combination, and opened chest are stored in SugarCube saves.
