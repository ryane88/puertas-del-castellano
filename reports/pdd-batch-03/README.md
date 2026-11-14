# PDD artwork Batch 03

## Processed review outputs

The supplied `composite.png` (1619×971) was split using the unchanged existing script and Batch 03-specific observed boundaries in `manifest.json`: columns 0, 325, 651, 970, 1295, 1619; rows 0, 486, 971. A one-pixel seam allowance and centered cropping yield ten equal **316×474** JPGs (exact portrait 2:3) in `paintings/`. Open `gallery.html` for the HTML contact sheet in manifest order.

All ten filenames, JPEG formats, dimensions, and scene positions were verified; each individual crop was visually inspected. No obvious neighbouring-panel bleed was observed. Small edge trims were necessary because the composite is not exactly divisible into the requested grid; no resizing or upscaling was used. Mechanical causality in PDD 48 and suspended judgment in PDD 46 still depend partly on their accompanying descriptions, rather than being fully demonstrable in a static painting.

Original composite preserved, SHA-256: `dec3d8f78bf61993d3fd151de74cae5acb3fec0a41921840f96fca591ad06cfb`. No paintings installed or existing artwork overwritten. Approval is pending.

Selected from the refreshed live inventory: 396 visible rooms, 70 local PDD paintings present, 326 missing. All PDD numbers and Supabase record IDs in Batches 01 and 02 were excluded independently of installation status. Batch 02 has not been explicitly approved and was not installed during this task. Its review copies remain intact.

The next ten missing PDDs are **42, 43, 44, 45, 46, 47, 48, 50, 52, 53**. Top row: 42–46. Bottom row: 47, 48, 50, 52, 53. Manifest filenames use PDD numbers, not Supabase row IDs. Source spelling “conviviencia” is retained unchanged; no database proofreading is included.

The generation prompt is saved in `prompt.md`: ten independent medieval-fantasy scenes, five columns and two rows, portrait 2:3 panels, no borders, text, labels, or gutters. Preferred canvas: 5000×3000 (5:3), giving 1000×1500 tiles; the actual delivered composite and crops are documented above.

The splitter is copied unchanged from the existing workflow. It reads this folder's manifest and defaults to this folder's `paintings/` review directory:

```sh
perl reports/pdd-batch-03/split-composite.pl reports/pdd-batch-03/composite.png
```

Requires existing macOS sips and system Perl/JSON::PP. It refuses existing output files and symlinks, stages crops before publication, and does not install images. Originals remain unchanged. Inspect the actual composite before splitting. Previous batches' crop coordinates were not copied: if dimensions or panel spacing are imperfect, add an inspected `crop_layout` for this composite. The splitter supports centered equal 2:3 crops using observed boundaries, without stretching or upscaling.

Manifest selection, positions, words, record IDs and expected filenames were verified against the refreshed inventory. All ten expected castle paths were absent at preparation time. No gameplay, Supabase, prior batch files, or existing artwork was modified. No commit, push, or deployment.
