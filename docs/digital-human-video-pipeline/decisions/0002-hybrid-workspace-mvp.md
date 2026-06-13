# 0002: Hybrid Workspace MVP

## Status

Accepted as product direction.

## Decision

The frontend product should use a hybrid workspace model:

1. Provide a default guided workflow for users who want automatic results with minimal choices.
2. Expose editable checkpoints for users who want control over script, audio, subtitles, lip-sync assets, packaging components, themes, and final render review.
3. Treat the verified digital-human口播 pipeline as one workflow preset, not the whole product.

## Consequences

- The UI needs both a guided mode and an editing mode.
- Pipeline stages must persist intermediate artifacts so users can review or replace them.
- Packaging must be represented as editable data: component choices, timing, text, theme tokens, motion presets, and render settings.
- The first version should avoid covering every video genre deeply. It should support a small set of input routes and prove the editable packaging model first.
