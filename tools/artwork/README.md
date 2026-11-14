# Reusable PDD artwork workflow

## Exact invocation in VS Code

Open this repository in VS Code and start a **new Codex conversation** so the repository-local skill is discovered. In the **Codex chat input**, type:

```text
$prepare-artwork-batch 06
```

This is a Codex skill invocation, **not a shell command**. It orchestrates the built-in imagegen tool and the local helpers end-to-end, stopping at review. If skill discovery has not refreshed, use this exact fallback in Codex chat:

```text
Read .agents/skills/prepare-artwork-batch/SKILL.md and run prepare-artwork-batch 06. Stop before installation.
```

No terminal-only command can call Codex's built-in image tool. This workflow deliberately does not switch to a paid API CLI or require OPENAI_API_KEY. It stops if built-in generation is unavailable. A new full invocation authorizes one composite; ambiguous interrupted generation is not automatically retried.

## What was reused

- tools/artwork_inventory.pl: existing read-only paginated REST inventory. The workflow checks rooms coverage and stops on incomplete reads.
- tools/artwork/split-composite.pl: byte-identical copy of Batch 05's tested Perl/sips splitter, copied into each new batch. Its BMP row cropping avoids sips cropOffset issues; its default output is local paintings/, not production images/.
- The same built-in image_gen integration as Batches 02–05. No new generator, dependencies, gameplay changes or API runner.
- Prompt design from actual word/short_definition/description, a single 5×2 composite, exact 2:3 portrait tiles, painterly Gothic medieval-fantasy style, and source-specific manually inspected crop boundaries.

## Files and states

Each managed batch contains manifest.json (frozen selection and vocabulary, later inspected crop layout), scenes.json, prompt.md, README.md, split-composite.pl, state.json, and eventually composite.png, paintings/, gallery.html, validation.json and review.json. A preparation.json receipt makes interrupted initial metadata creation resumable without reselection. Internal `.split-pending/` retains exact staged crop bytes and a receipt for safe resume; `.workflow.lock` prevents overlapping stages.

States: selected → prompt_ready → generating → composite_saved → split → validated_awaiting_visual_review → **review_ready**. blocked is incomplete. No state means installed or user-approved. Output hashes, the prompt hash and manifest hash are checked before reporting completion. Edited/missing artifacts invalidate successful status. Earlier batch assignments remain excluded even when not installed. New preparation refreshes the inventory; reruns never silently reselect an existing batch.

## Terminal helper stages (not the complete image-generation interface)

```sh
perl tools/artwork_batch.pl 06 prepare
# Codex writes scenes.json from the frozen vocabulary.
perl tools/artwork_batch.pl 06 plan
perl tools/artwork_batch.pl 06 begin-generation
# Codex invokes built-in image_gen once; do not run an API fallback.
perl tools/artwork_batch.pl 06 save-composite /absolute/path/to/generated.png
# Codex inspects the composite and writes crop-layout.json if needed.
perl tools/artwork_batch.pl 06 split
perl tools/artwork_batch.pl 06 validate
# Codex visually checks all ten crops and writes review.json.
perl tools/artwork_batch.pl 06 complete
perl tools/artwork_batch.pl 06 status
```

An incomplete `generating` state must be resolved by recovering the actual generated output, not another paid call. An incomplete split stage without a receipt must be inspected and preserved under a recovery filename before retrying. Existing review crops are accepted only when byte-identical to the staged receipt; otherwise stop. Do not remove them automatically. No install action exists. Paths are derived from the validated two-digit batch number and manifest filenames; production artwork is read only to check exclusion.

`review.json` requires matching composite, manifest and prompt hashes, every position 1–10, a true visual_review_passed value and an issues string. It is a visual-QC attestation by Codex, not a substitute for the user's approval. The helper can verify the attestation and dimensions, but cannot independently judge image meaning or generator availability.

Historical Batches 01–05 are deliberately not adopted or rewritten. The portable skill source is tools/artwork/skill/SKILL.md; its discovered repository copy is .agents/skills/prepare-artwork-batch/SKILL.md. Keep these copies synchronized when updating the skill.

## Testing without a paid image

```sh
perl tools/artwork/test-workflow.pl
```

Tests use an isolated temporary repository, mocked read-only REST responses/inventory and synthetic grayscale tiles. They must not call the image-generation tool, network, or modify real reports, images, earlier batches, or gameplay. Fixture images are test data, not replacement artwork. Tests exercise exclusions, invalid numbers, missing definitions/API failure, state gating, image adoption, cropping/order/dimensions, partial publication recovery, hash checks, gallery and visual-review gating. Production integration with built-in generation remains a real-run check, not proven by fixtures.

Validation on October 31, 2026: **53 fixture assertions passed**, including interrupted initial publication and partial crop publication, duplicate paid-call claims, missing/changed review artifacts, unavailable generation, and no production writes. Perl syntax checks passed. One-time Tweego compilation to a temporary output passed and was byte-identical to the existing index.html. No real Batch 06 was created and no image generation was invoked. The skill-creator quick_validate.py could not run because PyYAML is absent; frontmatter, required fields, folder/name match and the two skill copies were independently checked using Python's standard library. No dependencies were installed. The Codex skill picker/VS Code UI itself was not automated; the explicit-path invocation above is available if discovery needs a new conversation.
