# PDD artwork Batch 04

## Processed review outputs

The supplied 1619×971 composite was split with the unchanged existing script. Its observed boundaries are recorded in manifest.json: columns 0, 324, 648, 955, 1295, 1619; rows 0, 486, 971. Centered crops with a seam allowance produced ten equal **304×456** portrait JPGs (exact 2:3) in paintings/. Open gallery.html for the HTML contact sheet in manifest order.

Verified filenames: pdd54.jpg, pdd55.jpg, pdd56.jpg, pdd57.jpg, pdd58.jpg, pdd59.jpg, pdd60.jpg, pdd61.jpg, pdd62.jpg, pdd63.jpg. All ten files are JPEGs, match their manifest positions, and were individually visually inspected. No obvious neighbouring-panel bleed was observed. Uneven source panel widths required edge trimming; no stretching or upscaling was applied. The limited output resolution comes from the supplied composite.

Review notes: the gardener/knight confrontation and the cook's control of the key are clear, although their full story context still relies on the room descriptions. The dragon sketch is more recognisable and polished than a completely untidy garabato, but includes the intended ink blots and sketching scene. No image was altered to address these subjective details.

Original composite SHA-256, unchanged after processing: `7861f1c9d1206c39e130ee2f6739cf201703fb0a92613fd4a8b827172b73b20a`. Nothing installed into images/; existing artwork remains unchanged. Approval pending.

Prepared on October 31, 2026 (America/Toronto), after refreshing the live missing-artwork inventory. Selection: next ten PDD MISSING_LOCAL rows in inventory order, explicitly excluding both PDD numbers and Supabase record IDs in Batches 01–03, whether installed or not. Inventory: 396 visible PDD rooms, 90 local paintings present, 306 missing.

Each selected room's actual word, short_definition and description was read from Supabase via a read-only query; those source fields are preserved in manifest.json. No database text was changed, including the trailing comma in “a flor de piel,” and the source wording “Tener la/el sartén por el mango”. Scene details are proposed illustrations of those meanings, not changes to story content.

| Position | PDD | Word | Expected filename |
|---|---:|---|---|
| 1 | 54 | audacia | images/pdd54.jpg |
| 2 | 55 | atajo | images/pdd55.jpg |
| 3 | 56 | garabato | images/pdd56.jpg |
| 4 | 57 | Tener la/el sartén por el mango | images/pdd57.jpg |
| 5 | 58 | encarar | images/pdd58.jpg |
| 6 | 59 | concordia | images/pdd59.jpg |
| 7 | 60 | patrón | images/pdd60.jpg |
| 8 | 61 | Arrellanarse | images/pdd61.jpg |
| 9 | 62 | vulnerable | images/pdd62.jpg |
| 10 | 63 | a flor de piel, | images/pdd63.jpg |

The complete generation prompt remains in prompt.md: one 5-column × 2-row composite with portrait 2:3 tiles and overall 5:3 ratio. The preferred 5000×3000 size would give 1000×1500 tiles; actual delivered dimensions and processed outputs are documented above. Previous paintings serve as style references only.

The copied split-composite.pl is unchanged from Batch 03. It reads this batch's manifest and defaults to this batch's paintings/ review folder:

```sh
perl reports/pdd-batch-04/split-composite.pl reports/pdd-batch-04/composite.png
```

Requires existing macOS sips and system Perl/JSON::PP. Review destinations cannot be overwritten, and the source composite is preserved. It does not install paintings into images/. Once composite.png is supplied, inspect the actual panel boundaries before splitting. If the returned dimensions or panel positions are imperfect, add an observed crop_layout for this composite to the manifest; no previous batch's coordinates have been copied. The existing splitter can then make centered equal 2:3 crops without stretching or upscaling.

Validation: all ten filenames are absent from images/, all ten PDDs and record IDs are absent from earlier batch manifests, and manifest order and source fields match the freshly queried inventory and room data. Existing artwork, previous batches, gameplay and Supabase were not modified. No commit, push or deployment.
