# PDD painting batch 02

Revalidated against the refreshed live inventory: 396 visible PDD records, 70 local paintings present, 326 missing. Selection explicitly excludes both the PDD numbers and Supabase record IDs from Batch 01, independently of whether its paintings are installed. The next ten remain PDD 32–41, so the existing prompt and manifest need no content changes.

Use `prompt.md` as a single ChatGPT image-generation prompt. The ten selected PDDs are 32–41, the next ten missing PDD rows in inventory order after excluding Batch 01. `manifest.json` maps positions to PDD numbers, Supabase row IDs, and filenames. Top row: PDD 32–36; bottom row: PDD 37–41. Source spelling, including “hacer treuque”, is preserved in metadata; no database proofreading or changes are included.

Keep the Batch 01 painterly medieval castle style, portrait 2:3 panels, and borderless 5×2 layout. Optionally attach Batch 01's composite as the style reference. The preferred overall canvas is 5000×3000 (5:3), giving 1000×1500 panels. Other exact 5:3 sizes are accepted when divisible into integer 2:3 tiles.

## Processed review outputs

The supplied `composite.png` is 1619×971. Its Batch 02-specific observed boundaries are recorded in `manifest.json`: columns 0, 325, 648, 973, 1297, 1619; rows 0, 486, 971. The unchanged splitter produced ten equal 320×480 portrait JPGs in `paintings/`, centered within each panel with a seam allowance, without resizing or stretching. Small edge areas are trimmed; resolution is limited by the composite.

Open `gallery.html` for the HTML contact sheet in manifest order. All ten JPG filenames, formats, dimensions, and subjects were checked individually. PDD 32–36 occupy the first row; PDD 37–41 occupy the second. No obvious neighbouring-scene bleed was observed. PDD 39 includes a decorative edge within the depicted tapestry, already present in the composite; this is not an added image border. PDD 36 conveys support but does not visibly establish the lost-keys accusation without the story text.

No output was installed in `images/`; originals, existing artwork, gameplay, Supabase, and Batch 01 remain unchanged.

After the composite is produced, save it as `composite.png` here and inspect the actual panel boundaries before running:

```sh
perl reports/pdd-batch-02/split-composite.pl reports/pdd-batch-02/composite.png
```

The splitter is a byte-identical copy of Batch 01's script and reads this batch's manifest. Review outputs go to `reports/pdd-batch-02/paintings/`; existing destinations are never overwritten. Requires only existing macOS sips and system Perl/JSON::PP.

Batch 01's crop_layout coordinates were deliberately not copied: they describe its particular generated composite. Batch 02 now has its own inspected crop_layout. For any replacement composite, inspect the new boundaries rather than assuming the same dimensions imply the same panel positions. The existing splitter supports that metadata and centered equal 2:3 crops without stretching.

Suggested visuals follow the inventory descriptions. “Estupefaciente” depicts the supplied alchemist-substance story rather than the separate sense “astonishing”. The Proeza tapestry uses a proposed visual example of an extraordinary rescue because its source description does not specify the deed. No story or gameplay is altered.
