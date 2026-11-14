# PDD artwork Batch 07

Managed review-only workflow. Never installs artwork.

Read manifest.json for frozen selection and vocabulary sources, prompt.md for the final generation prompt, state.json for progress. Run the Codex skill again to resume; do not manually mark complete.

Review outputs: paintings/ and gallery.html. The original composite.png is preserved. Exact grid positions and any inspected crop_layout are recorded in the manifest. No earlier crop coordinates are reused.

No gameplay, database or production artwork writes. See tools/artwork/README.md for the staged command interface.

## Batch 07 review outputs

Generated once using the built-in image tool and the complete prompt.md. Source composite: 1619×971, SHA-256 5575cec3dc75432f3ea723f77580118dc48cea69d7de17ef857ca065f65fa94e. Preserved unchanged. Inspected crop coordinates are recorded in crop-layout.json and manifest.json. Ten equal 320×480 portrait JPGs (exact 2:3) are in paintings/, named pdd84.jpg through pdd93.jpg. Top row PDD 84–88; bottom row PDD 89–93. Small centered trims, no resizing or upscaling.

Open gallery.html for the contact sheet. File count, manifest identities, JPEG dimensions, hashes, crop order and all ten subjects were reviewed. PDD 91 needs accompanying text for its exact linguistic ambiguity; dice pips and the framed mirror are in-scene props rather than text or outer borders. See review.json for limitations. Ready for user review, never installed automatically.
