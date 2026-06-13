# 0003: Extensible Video Type Architecture

## Status

Accepted as product architecture direction.

## Decision

Do not hard-code the product around specific video categories such as talking-head, course, software explainer, product intro, or promotional video.

Instead, model video categories as configurable recipes made from reusable primitives:

1. Input capabilities: face video, finished narrated video, screen recording, product media, images, existing subtitles, existing script, brand assets.
2. Workflow stages: script, TTS, lip sync, ASR, scene planning, packaging plan generation, preview render, final render.
3. Packaging components: subtitles, title cards, product cards, step cards, callouts, PIP, comparison blocks, proof blocks, CTA, transitions.
4. Theme packs: visual tokens, typography, motion tokens, density, caption style, component presets.

Digital-human talking-head is one recipe. Digital-human product introduction is the first planned expansion proof case, not a separate architecture.

## Consequences

- The UI should ask what assets the user has and what outcome they want, then pick a default recipe.
- Advanced users can override the recipe, replace stages, and edit the packaging plan.
- A new video type should usually be added by creating a recipe, theme, or component preset, not by adding a one-off pipeline.
- The existing `project / transcript / scenePlan / packagingPlan` model can remain the center, but it should be extended with recipe metadata and richer source capability metadata.

## Initial Recipe Examples

### Digital Human Talking-Head

Input: face `source.mp4`, topic or script.

Default stages: script -> TTS -> DUIX/HeyGem lip sync -> ASR captions -> scene plan -> packaging -> render.

### Existing Narrated Video

Input: finished video with audio.

Default stages: ASR captions -> scene plan -> packaging -> render.

### Digital Human Product Introduction

Input: face `source.mp4`, product name, product media, selling points.

Default stages: product script -> TTS -> DUIX/HeyGem lip sync -> product scene plan -> product cards/callouts -> packaging -> render.
