# PDD painting batch 01

Prepared from the first ten `PDD` / `MISSING_LOCAL` rows of `reports/artwork-inventory.csv`, preserving report order. Filenames use the PDD number, not the Supabase row ID. Source word spelling is retained in the manifest (including “El prejucio”).

## Actual composite and review outputs

The supplied `composite.png` is 1619×971 (ratio 1.66735, about 0.041% wider than 5:3). The original strict splitter rejected it. Its visible panel widths also vary, so the manifest now records observed column edges at 0, 332, 662, 986, 1298, 1619 and row edges at 0, 484, 971. For this exact input size, the splitter uses centered equal 310×465 crops within those cells with a one-pixel seam allowance. Other exact 5:3 inputs retain the original equal-grid behaviour.

All ten output JPEGs are in `paintings/`; open `gallery.html` to review them in manifest order. The crops have exact portrait 2:3 proportions, with no stretching or upscaling. They trim approximately 4.5–10.9% of each original cell's area to achieve common proportions and avoid neighbouring panels. Original composite and castle artwork remain unchanged. Output resolution is limited by the supplied composite.

| Position | Row | Column | PDD | Supabase row ID | Expected filename |
|---|---|---|---|---|---|
| 1 | 1 | 1 | 20 | 22 | images/pdd20.jpg |
| 2 | 1 | 2 | 22 | 24 | images/pdd22.jpg |
| 3 | 1 | 3 | 23 | 25 | images/pdd23.jpg |
| 4 | 1 | 4 | 24 | 26 | images/pdd24.jpg |
| 5 | 1 | 5 | 25 | 27 | images/pdd25.jpg |
| 6 | 2 | 1 | 26 | 28 | images/pdd26.jpg |
| 7 | 2 | 2 | 27 | 29 | images/pdd27.jpg |
| 8 | 2 | 3 | 28 | 30 | images/pdd28.jpg |
| 9 | 2 | 4 | 30 | 32 | images/pdd30.jpg |
| 10 | 2 | 5 | 31 | 33 | images/pdd31.jpg |

Use the complete contents of `prompt.md` as one ChatGPT image-generation prompt. Optionally attach `images/pdd397.jpg` as a style reference: the prompt explicitly removes its frame and lettering. The batch overrides the inventory's square/bordered suggestion with the requested portrait, borderless treatment.

Future composites should be **5:3**, ideally **5000×3000**; each panel is **1000×1500**. Other exact sizes work, for example 2500×1500 yielding 500×750 panels. Apart from the explicitly recorded crop layout above, the splitter rejects mismatched dimensions. Check that panel boundaries align before splitting: pixel dimensions cannot prove that an AI respected the grid.

After generating and saving the composite, run from the project root:

```sh
perl reports/pdd-batch-01/split-composite.pl /absolute/path/to/composite.png
```

Outputs go to `reports/pdd-batch-01/paintings/` for review, with basenames matching the expected `images/` files. An optional second argument selects another output directory. Requires existing macOS `sips` and system Perl/JSON::PP; no dependency installation. The script checks dimensions, validates the manifest, stages all crops, and refuses existing destination files or symlinks. If a destination appears during final publication, it stops without overwriting it; already published files may remain.

Review all ten paintings before any separate installation into `images/`. Existing artwork and the original composite are never overwritten. The current castle uses `object-fit: cover` in some painting views, so portrait artwork may be cropped by the existing UI; no gameplay or CSS changes are included in this batch.
