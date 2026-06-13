# Director Packaging Console UI Review

## Source

Reviewed `director-packaging-console-ui/index.html`.

## Fit With Product Direction

The prototype is strongest as the packaging editor half of the hybrid workspace:

- left panel: component library, categories, style and plan navigation;
- center: preview canvas with selected packaging card;
- right panel: component properties, media binding, layout, typography, colors, graphics, animation, validation;
- bottom: multi-track timeline for video, audio, subtitles, and cards.

This maps well to the `project / transcript / scenePlan / packagingPlan` model already present in the codebase.

## Main Gap

The prototype starts inside editing mode. It does not yet show the guided default workflow that chooses a recipe from input assets.

The hybrid MVP needs an upstream project setup / workflow stage before this editor:

1. What assets do you have?
2. What output do you want?
3. Which recipe should run by default?
4. Which stages are required, optional, skipped, or already complete?
5. When the default draft is generated, enter the packaging editor for review and personalization.

## Recommended Architecture Interpretation

Keep this prototype as `Packaging Studio`, not as the whole application.

Proposed top-level product areas:

1. Project setup: input assets, output goal, recipe selection.
2. Workflow run: script, TTS, lip sync, ASR, scene planning, packaging plan generation.
3. Packaging Studio: component/theme/timeline editing.
4. Review and export: validation, preview render, final render.

## UI Risks

- The current navigation mixes workflow commands and editing tools in one top bar. This can confuse users who are still in the guided generation phase.
- Component categories are good, but they should be filtered by recipe and theme instead of being a flat universal list.
- The style appears optimized for a dark tech/product editor. Theme switching must visibly change components and preview, not only color tokens.
- The timeline is useful for advanced users, but default users need a simpler scene/checkpoint view before timeline-level editing.
- The static HTML is a good visual prototype but should be migrated into the existing `apps/console-web` app before functional implementation.

## Product Decision Implication

The next design step should define the handoff from guided workflow to Packaging Studio:

`Recipe draft -> scene plan -> packaging plan -> editable timeline/components -> render`.
