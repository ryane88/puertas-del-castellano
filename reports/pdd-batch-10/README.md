# PDD artwork Batch 10

Managed review-only workflow. Never installs artwork.

Read manifest.json for frozen selection and vocabulary sources, prompt.md for the final generation prompt, state.json for progress. Run the Codex skill again to resume; do not manually mark complete.

Review outputs: paintings/ and gallery.html. The original composite.png is preserved. Exact grid positions and any inspected crop_layout are recorded in the manifest. No earlier crop coordinates are reused.

No gameplay, database or production artwork writes. See tools/artwork/README.md for the staged command interface.

## Batch 10 review outputs

Generated once with the built-in image tool using prompt.md. Original composite: 1619×971, SHA-256 2394b11800275cec55feb7d6395fe364fb0ece2ab1ec202b18cff7121b4f09ef. Preserved unchanged. Ten 314×471 portrait JPGs (exact 2:3) are in paintings/: pdd114.jpg, pdd115.jpg, pdd116.jpg, pdd118.jpg, pdd119.jpg, pdd120.jpg, pdd121.jpg, pdd122.jpg, pdd123.jpg, pdd124.jpg. PDD 117 was excluded because its existing artwork is present.

Open gallery.html for the contact sheet. File count, identities, dimensions, hashes and crop order passed validation; all ten crops were visually inspected. Uneven column widths required small centered trims recorded in crop-layout.json and manifest.json, without resizing or upscaling. Abstract narrative concepts depend partly on accompanying room text; see review.json. No artwork installed. Awaiting user approval.
