# PDD artwork Batch 06

Managed review-only workflow. Never installs artwork.

Read manifest.json for frozen selection and vocabulary sources, prompt.md for the final generation prompt, state.json for progress. Run the Codex skill again to resume; do not manually mark complete.

Review outputs: paintings/ and gallery.html. The original composite.png is preserved. Exact grid positions and any inspected crop_layout are recorded in the manifest. No earlier crop coordinates are reused.

No gameplay, database or production artwork writes. See tools/artwork/README.md for the staged command interface.

## Batch 06 result

Generated once with the built-in image tool. Original composite: 1619×971, SHA-256 bb991a34ab07756862eebbe82bec163224bc66bcb3f635130a94e672ee69ba61. Ten 304×456 JPGs are in paintings/; gallery.html is the contact sheet. Filenames pdd74.jpg through pdd83.jpg match manifest order and were individually inspected. Batch-specific crop boundaries are in crop-layout.json and manifest.json; small centered trims avoid seams without resizing.

**Visual QC blocked completion:** PDD 76 (lustro) shows only four stones, not five. PDD 82 includes flames stronger than the requested subtle smoke, and PDD 74 uses an early-modern-looking sighting telescope. Output dimensions, filenames and hashes passed. No automatic regeneration was attempted; no images installed. See review.json for the review record.
