# PDD artwork Batch 05

## Review ready — not installed

Generated with the built-in imagegen tool using prompt.md, then saved as composite.png (1619×971). Its SHA-256 is `c55d16539a4d772b5d9c359d7e1c72595fc08150c47296accf0bc7f6774493a8`. The original is preserved.

Observed column edges: 0, 324, 648, 972, 1295, 1619; row edges: 0, 486, 971. These Batch 05-specific boundaries are recorded in manifest.json. The unchanged existing splitter made centered **320×480** JPGs (exact 2:3) with a seam allowance, without resizing or upscaling. Small outer trims were necessary because the composite is not an exact divisible grid.

Open gallery.html for the HTML contact sheet. Top row: pdd64.jpg, pdd65.jpg, pdd66.jpg, pdd67.jpg, pdd68.jpg. Bottom row: pdd69.jpg, pdd70.jpg, pdd71.jpg, pdd72.jpg, pdd73.jpg. All files are in paintings/. Ten-file count, filenames, positions, JPEG formats and dimensions were checked; each crop was visually inspected with no obvious neighbouring-panel bleed.

Review issues: the paradox stairway suggests spatial contradiction but is not a formally verified impossible object; the jester's precise utterance and the investigator's loose ends require accompanying vocabulary text. The heraldic decorations and patterned fabrics are scene details, not added image frames; no obvious readable lettering was observed. Output resolution is limited by the source composite.

All ten castle target paths remain absent. No image has been installed. Approval pending.

Prepared October 31, 2026 (America/Toronto), from the refreshed inventory: 396 visible PDD rooms, 100 local PDD paintings present, 296 missing. Next ten missing PDDs after explicitly excluding PDDs and record IDs from Batches 01–04: **64–73**. Word, short definition and full description were read live from Supabase and preserved in manifest.json.

Top row: PDD 64 fervor; 65 por arte de birlibirloque; 66 Los cabos sueltos; 67 Darse por vencido; 68 Mandar todo a paseo. Bottom row: 69 Movida; 70 Irse de manos; 71 Sosiego; 72 decir algo a bocajarro; 73 paradoja. Expected filenames: images/pdd64.jpg through images/pdd73.jpg, all absent at selection time.

## Meaning adaptations

The giving-up image focuses on surrendering the attempt, matching the short definition; the description later has the blacksmith try again, which cannot be shown in one still. The paradox's written library sign is replaced with an impossible stair loop to honour the no-writing constraint while illustrating the definition. The jester's blunt statement is conveyed by expressions and the soup bowl, with accompanying room text needed for the exact utterance. No source vocabulary was edited.

## Workflow

The single generation prompt is prompt.md. Use the built-in imagegen tool, the successful method from earlier batches; no substituted or placeholder artwork on failure. Save the actual output as composite.png, preserving it thereafter. Requested layout: 5×2, portrait 2:3 tiles, overall 5:3, preferred 5000×3000. Inspect the actual delivered boundaries before splitting.

split-composite.pl is copied unchanged from Batch 04 and reads this batch's manifest. Default output is this folder's paintings/ review directory, never the castle images/ folder:

```sh
perl reports/pdd-batch-05/split-composite.pl reports/pdd-batch-05/composite.png
```

Requires existing macOS sips and system Perl/JSON::PP. No new dependencies. Existing output files and symlinks are refused. If required, add an observed crop_layout for this composite; no previous coordinates are reused blindly. Verify all filenames, JPEG dimensions, scene order and composite hash; create gallery.html for review. STOP BEFORE INSTALLATION. No gameplay, Supabase or previous-batch changes; no commit, push or deployment.
