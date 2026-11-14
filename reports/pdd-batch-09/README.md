# PDD artwork Batch 09

Managed review-only workflow. Never installs artwork.

Read manifest.json for frozen selection and vocabulary sources, prompt.md for the final generation prompt, state.json for progress. Run the Codex skill again to resume; do not manually mark complete.

Review outputs: paintings/ and gallery.html. The original composite.png is preserved. Exact grid positions and any inspected crop_layout are recorded in the manifest. No earlier crop coordinates are reused.

No gameplay, database or production artwork writes. See tools/artwork/README.md for the staged command interface.

## Batch 09 review outputs

Generated once using the built-in image tool and prompt.md. Original composite: 1619×972, SHA-256 2e41bbaa2dcfe4f818e082793dab1917c615dcf5c6ec30fed51796964bacc836. Preserved unchanged. Ten 320×480 portrait JPGs in paintings/, named pdd104.jpg through pdd113.jpg. First row: 104–108; second: 109–113. Small centered trims with inspected boundaries in crop-layout.json and manifest.json; no resizing. Open gallery.html for the contact sheet.

All filenames, dimensions, hashes and crop positions passed validation; each crop was visually inspected. The loop is visually suggested, the failed take uses theatre rather than modern filming, and the bridge model has slightly ambiguous scale. See review.json for details. An incorrect initial height caused a safe split rejection; corrected metadata matches actual 972px height, and failed staging is preserved. No images installed. Awaiting user approval.
