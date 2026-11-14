# PDD artwork Batch 08

Managed review-only workflow. Never installs artwork.

Read manifest.json for frozen selection and vocabulary sources, prompt.md for the final generation prompt, state.json for progress. Run the Codex skill again to resume; do not manually mark complete.

Review outputs: paintings/ and gallery.html. The original composite.png is preserved. Exact grid positions and any inspected crop_layout are recorded in the manifest. No earlier crop coordinates are reused.

No gameplay, database or production artwork writes. See tools/artwork/README.md for the staged command interface.

## Batch 08 review outputs

Generated once using the built-in image tool and the complete prompt.md. Original composite: 1619×971, SHA-256 07b1b9f270cdac0042d039bf3ad45b5a20021bafb2575cf259da2b3129aaf580. Preserved unchanged. Ten equal 320×480 JPGs (exact portrait 2:3) are in paintings/, named pdd94.jpg through pdd103.jpg. First row: PDD 94–98; second row: PDD 99–103. Inspected coordinates are in crop-layout.json and manifest.json. Small centered trims; no stretching or upscaling.

Open gallery.html for the contact sheet. File count, filenames, hashes, dimensions and crop order passed verification, and all ten images were visually inspected. Notes: the warned apprentice remains mid-stride; the dancer has stylized fantasy footwear; abstract and idiomatic meanings rely partly on the accompanying room text. See review.json for details. Awaiting user approval; no artwork installed.
