# Artwork inventory

Generated 2026-11-02T23:46:38Z (UTC).

## Coverage

- poemas: 7 rows visible to the browser publishable key (API count: 7)
- rooms: 397 rows visible to the browser publishable key (API count: 397)
- solo_prompts: 51 rows visible to the browser publishable key (API count: 51)

Only records returned by the existing browser publishable key are observable. RLS may hide other records; no claim is made about inaccessible or unpublished rows. Published flags are included when returned. Requests use ordered pagination and API counts; this is not a transactionally frozen snapshot.

## Record statuses

- PDB: LOCAL_PRESENT=31; MISSING_LOCAL=15; NO_IMAGE_ASSIGNED=5
- PDC: LOCAL_PRESENT=7
- PDD: LOCAL_PRESENT=397

## Interpretation

- PDD: use pdd for filenames, not rooms.id. rooms.image is metadata ignored by current gameplay; an external metadata URL does not replace the required local painting. LOCAL_PRESENT only verifies filename existence, not image quality or decoding.
- PDC: filenames derive from numeric id % 7, not publication date. Multiple poem records can share one missing file: generate at most one landscape per missing slot after review. Date-named pYYYYMMDD.jpg assets are not referenced by the current loader. Suggested per-record prompts are alternatives for a shared slot, not independent generation jobs.
- PDB: use the actual image column verbatim after the current images/ prefix. Record identity is (prompt_id, visit). NO_IMAGE_ASSIGNED is intentional scene hiding, not a missing file. EXTERNAL_REFERENCE_UNSUPPORTED distinguishes an external reference from a missing painting; it flags the loader's incompatible prefix, without downloading remote images. Published is blank because solo_prompts has no verified publication field.
- Case-only mismatches must be fixed or reviewed before generating replacements because GitHub Pages paths are case-sensitive. No remote artwork URL is probed.
- Local legacy passages are separately identified and must not be mistaken for verified database records.
- Prompts follow inspected references: square illuminated gold/blue/red PDD paintings; portrait sunlit PDC fantasy landscapes with room for text; portrait atmospheric PDB Gothic interiors. PDB prompts request visual environments, never player journal answers. Prompts are suggestions only, not executable instructions or permission to generate assets.
- Shared scene assets are listed in shared-artwork-inventory.csv and have no database record IDs. Existing descriptive staircase source images may be candidates for reuse; missing runtime filenames do not prove new art is necessary.

## Missing shared filenames


## Other local image files

These files are not mapped by the audited runtime rules or fetched records. They may be archives, source art, or assets for inaccessible records; this is not a deletion list.

- images/PDABC.png
- images/castle-door-module-v1.png
- images/castle-home_old.png
- images/castle_home_continuous.png
- images/myst-chamber-01.png
- images/myst-chamber-transparent8old.png
- images/myst-chamber-transparent9old.png
- images/p20261027.jpg
- images/p20261028.jpg
- images/pdd-animation12.webp
- images/pdd-animation711.webp
- images/pdd384.jpg
- images/poema-0.png
- images/poema-7.jpg

## Access warnings

None.

## Re-run

`perl tools/artwork_inventory.pl` reads live REST data and writes only these three reports. `perl tools/artwork_inventory.pl --offline` uses local legacy passages and shared assets, marks API coverage unavailable, and replaces the reports. No images, database writes, game sources, build artifacts, or credentials are written. Requires system Perl (JSON::PP) and curl; no added dependencies.
