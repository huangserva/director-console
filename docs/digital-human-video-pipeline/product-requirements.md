# Video Packaging Console PRD

## 1. Summary

Build a hybrid video packaging console that turns long Codex-operated video production workflows into a visible, reusable, and editable web application.

The product supports two usage styles:

- Default mode: user provides assets and accepts recommended workflow/settings.
- Custom mode: user reviews and edits checkpoints, packaging components, themes, timeline placement, and final render settings.

The verified digital-human talking-head workflow is the first proven recipe, but the product must not be limited to talking-head videos. Future video types should be added through recipes, theme packs, and component presets.

## 2. Product Positioning

Working name: Director Packaging Console.

Core promise: given video assets, audio, script requirements, or a face source video, the console can generate a packaged publishable video draft and let the user edit the packaging before final render.

Primary users:

- Creators/operators who want packaged short-form videos without manually running every command.
- Advanced operators who want stage-level control.
- Workflow builders who want to add recipes, components, and themes.

## 3. Goals

- Productize the verified digital-human pipeline into a web application.
- Support at least two MVP input routes:
  - face video plus topic/script -> TTS -> lip sync -> packaged video;
  - finished narrated video -> ASR -> packaged video.
- Make packaging editable through components, themes, and timeline controls.
- Persist intermediate artifacts so users can pause, inspect, replace, and rerun stages.
- Keep video categories extensible through recipes instead of hard-coded workflows.
- Use the existing `project / transcript / scenePlan / packagingPlan` model as the data backbone.

## 4. Non-Goals For MVP

- Full nonlinear video editing replacement.
- Verified direct static image to talking-video generation.
- Deep support for every video genre in the first release.
- Cloud collaboration, billing, permissions, or hosted rendering.
- Rebuilding TTS, ASR, DUIX/HeyGem, or HyperFrames engines.

## 5. Current Foundation

### Verified Skills

- `script-first-video-pipeline`: script-first and audio-first production rules.
- `duix-heygem-lipsync`: verified `source.mp4 + dub.wav -> lip-sync video` route.
- `hyperframes-tech-talk-template`: HyperFrames packaging/render constraints for the accepted dark tech template.

### Existing Repository Capabilities

- `apps/console-api`
  - Local HTTP server.
  - Lists registry and projects.
  - Reads project bundles.
  - Saves packaging plans.
  - Generates HyperFrames HTML.
  - Exposes lint, inspect, render, template save/apply endpoints.

- `apps/console-web`
  - React UI exists.
  - Loads project bundle and registry.
  - Edits packaging cards.
  - Saves packaging plans.
  - Calls generate/lint/inspect/render endpoints.

- `packages/protocol`
  - Validates project, transcript, scene plan, packaging plan, component card, style pack, motion token, and template schemas.
  - Needs recipe, asset, and workflow-run schemas.

- `packages/component-registry`
  - Contains component categories, components, presets, style packs, and motion tokens.
  - Renders card instances into HyperFrames clips.

- `packages/hyperframes-generator`
  - Generates HyperFrames HTML from project and packaging plan.
  - Includes generic and A-roll generation paths.

- `packages/pipeline`
  - Has local packaging CLI.
  - Can build project bundles from existing video/caption route.
  - Can render finished MP4 through CLI path.

- `director-packaging-console-ui/index.html`
  - Static reference for a richer Packaging Studio layout.
  - Strong reference for component library, canvas, inspector, and timeline.

## 6. Core Product Abstractions

### Project

Durable workspace for one video. It contains metadata, assets, recipe, workflow state, transcript, scene plan, packaging plan, outputs, logs, and validation results.

### Asset

Imported or generated media/text artifact, such as face video, narrated video, product media, script, TTS audio, DUIX output, ASR transcript, captions, or final render.

### Recipe

Configurable workflow definition for a video outcome. A recipe defines input requirements, optional inputs, stages, dependencies, default theme, recommended components, and validation gates.

### Stage

Executable or reviewable workflow step. Initial stage types:

- script;
- TTS;
- lip sync;
- ASR;
- scene planning;
- packaging generation;
- packaging editing;
- preview render;
- final render;
- validation.

### Checkpoint

Persisted boundary where the user can accept, edit, replace, rerun, or skip an output.

### Packaging Plan

Editable visual plan consumed by HyperFrames generation. It contains video/audio/subtitle/card tracks, card instances, timing, content, media bindings, theme references, motion references, and validation state.

### Theme Pack

Reusable visual identity and motion layer. It should affect colors, typography, spacing, density, caption style, component presets, and motion tokens.

### Component

Reusable packaging block, such as title card, subtitle card, product card, demo callout, comparison card, PIP, proof card, CTA, transition, or brand element.

## 7. MVP Scope

### Route A: Face Video To Packaged Digital-Human Video

Input:

- face `source.mp4`;
- topic, outline, or full script;
- optional product information;
- selected voice/TTS provider;
- selected recipe/theme.

Default stages:

1. Generate or revise script.
2. Generate continuous master audio.
3. Prepare `dub.wav`.
4. Run DUIX/HeyGem lip sync.
5. Run ASR on final master audio.
6. Build transcript and scene plan.
7. Generate packaging plan.
8. Enter Packaging Studio.
9. Generate HyperFrames HTML.
10. Validate and render final MP4.

### Route B: Existing Narrated Video To Packaged Video

Input:

- finished video with audio.

Default stages:

1. Probe media metadata.
2. Run ASR or import transcript.
3. Build transcript and scene plan.
4. Generate packaging plan.
5. Enter Packaging Studio.
6. Generate HyperFrames HTML.
7. Validate and render final MP4.

### First Expansion Proof Case

Digital-human product introduction.

Input:

- face `source.mp4`;
- product name;
- product description;
- selling points;
- product media;
- optional offer/CTA.

Default packaging:

- opening promise;
- product highlight card;
- feature callouts;
- comparison/proof card;
- final CTA.

## 8. User Journeys

### Default Digital-Human Creation

1. User creates project.
2. User uploads face source video.
3. User selects a recipe or accepts recommendation.
4. User enters topic/product/script information.
5. System shows required workflow stages.
6. User runs default workflow.
7. System generates script, TTS, lip sync, ASR, scene plan, and packaging plan.
8. User previews draft.
9. User accepts defaults or opens editor.
10. System renders final MP4.

### Existing Video Packaging

1. User uploads finished narrated video.
2. System detects video/audio metadata.
3. System recommends ASR plus packaging.
4. User runs workflow.
5. System generates captions, scenes, and cards.
6. User adjusts packaging.
7. User renders final MP4.

### Advanced Packaging Customization

1. User opens Packaging Studio.
2. User selects a scene, subtitle, or card.
3. User edits content, timing, layout, media binding, colors, animation, and theme.
4. User inserts components from registry.
5. User saves packaging plan.
6. User validates and renders.

### Workflow Builder Adds Recipe

1. Builder defines input requirements.
2. Builder maps stages and dependencies.
3. Builder selects default components and theme.
4. Builder tests on sample project.
5. Recipe becomes selectable in project setup.

## 9. UX Requirements

Top-level product areas:

1. Project Dashboard
   - list projects;
   - create/import project;
   - show status and last output.

2. Project Setup Wizard
   - asset upload;
   - asset detection;
   - output goal;
   - recipe recommendation;
   - service readiness check;
   - run plan preview.

3. Workflow Run View
   - stage list;
   - stage status;
   - artifacts per stage;
   - retry/replace/skip where safe;
   - logs and errors;
   - checkpoint approval.

4. Packaging Studio
   - component library;
   - theme library;
   - preview canvas;
   - scene strip;
   - timeline tracks;
   - right-side inspector;
   - validation panel.

5. Review And Export
   - preview render;
   - validation summary;
   - final render settings;
   - output paths;
   - failure recovery.

Default mode should minimize choices. Custom mode should reveal stage controls and editor controls.

The static `director-packaging-console-ui/index.html` should be treated as a Packaging Studio reference, not the whole application.

## 10. Functional Requirements

### Project And Asset Management

- Create/open project.
- Import face video.
- Import finished narrated video.
- Import product media.
- Store generated assets under project directory.
- Record asset type, path, duration, dimensions, sample rate, stage provenance, and status.
- Do not store private credentials in project files.

### Recipe Selection

- Detect available input capabilities.
- Recommend compatible recipes.
- Show missing requirements.
- Allow default recipe selection.
- Allow advanced override.

### Workflow Orchestration

Stage states:

- not started;
- ready;
- running;
- succeeded;
- failed;
- skipped;
- needs review.

Workflow must persist stage inputs, outputs, logs, and errors. Users must be able to rerun from selected checkpoints.

### Script

- Generate script from topic/product info.
- Allow edit before TTS.
- Store script version.
- Track approved script used for audio.

### TTS

- Generate continuous master audio.
- Store provider, voice, speed, prompt reference, and output file.
- Treat master audio as timing source.
- Require listening checkpoint when voice is uncertain.

### Lip Sync

- Use verified DUIX/HeyGem route: `source.mp4 + dub.wav`.
- Convert driving audio to service-required format.
- Submit and poll jobs.
- Treat output as visual layer.
- Do not use DUIX clip audio as final master audio unless explicitly configured.

### ASR

- Run ASR on final master audio or finished video audio.
- Store transcript and segment timings.
- Rebuild captions after audio changes.
- Prevent stale captions after TTS reruns.

### Scene Planning

- Build scene plan from transcript, timing, and recipe.
- Recommend components based on scene intent.
- Later versions may support manual scene split/merge/rename.

### Packaging Generation And Editing

- Generate packaging plan from scene plan, recipe, components, and theme.
- Select card.
- Edit content, layout, timing, typography, colors, graphics, animation.
- Insert component.
- Save packaging plan.
- Save current plan as reusable template.
- Apply stored template.

### HyperFrames Generation

- Generate `output/index.html`.
- Support generic and A-roll render paths.
- Keep generated HTML deterministic from project data.

### Validation And Render

- Validate project, transcript, scene plan, and packaging plan.
- Surface warnings separately from blockers.
- Run lint/inspect/render where configured.
- Store logs and output paths.

## 11. Data Model Requirements

Preserve existing core files:

- `project.json`;
- `transcript.json`;
- `scene-plan.json`;
- `packaging-plan.json`.

Add or model new durable files:

- `assets.json`;
- `workflow-run.json`;
- recipe reference or `recipe.json`;
- `stage-logs/`;
- `output/`.

Project metadata should grow to include:

- `recipeId`;
- `workflowRunId`;
- `sourceCapabilities`;
- `assets`;
- `stageState`;
- `outputs`.

Recipe schema should include:

- `id`;
- `name`;
- `description`;
- `inputRequirements`;
- `optionalInputs`;
- `stages`;
- `defaultThemePackId`;
- `recommendedComponents`;
- `validationGates`.

Asset schema should include:

- `id`;
- `type`;
- `path`;
- `media`;
- `createdByStageId`;
- `provenance`;
- `status`.

Workflow run schema should include:

- `id`;
- `projectId`;
- `recipeId`;
- `stages`;
- `currentStageId`;
- `checkpoints`;
- `errors`;
- `startedAt`;
- `updatedAt`.

## 12. Technical Architecture

### Frontend

Base: `apps/console-web`.

Needed pages:

- project dashboard;
- setup wizard;
- workflow run;
- packaging studio;
- review/export.

Frontend should load and save through API, not only local component state.

### Backend

Base: `apps/console-api`.

Needed API groups:

- projects;
- assets;
- recipes;
- workflow runs;
- stage actions;
- registry;
- packaging plans;
- templates;
- renders.

MVP can start with local synchronous commands plus persisted status. Long-running tasks should later move behind a task queue or worker model.

### Packages

- `protocol`: add recipe, asset, workflow-run schemas.
- `component-registry`: expand component metadata, theme packs, presets, and recipe compatibility.
- `pipeline`: add stage runners and artifact management.
- `hyperframes-generator`: support richer themes, components, subtitles, media bindings, and render validation.

## 13. Integrations

### TTS

Supported by configuration, not hard-coded credentials.

Initial options may include local CosyVoice, remote CosyVoice3 API, VoxCPM, or future providers.

### DUIX/HeyGem

Use verified offline lip-sync route.

Rules:

- input is `source.mp4 + dub.wav`;
- completion must check actual job completion status;
- credentials and host details must stay outside project data.

### ASR

Use available local or service ASR route.

Rules:

- captions derive from final audio;
- rerun ASR after audio changes.

### HyperFrames

Use HyperFrames for composition and render.

Rules:

- generated HTML should reflect packaging plan;
- lint/inspect/render logs should be stored;
- final render must use intended master audio.

## 14. Milestones

### Milestone 0: Stabilize Existing Packaging Editor

- React console loads projects.
- User can edit cards.
- User can save packaging plan.
- User can generate HyperFrames HTML.
- Existing tests pass.

### Milestone 1: Existing Narrated Video Route

- Create/import project from finished video.
- Probe media metadata.
- Import or generate transcript.
- Create scene plan and packaging plan.
- Edit packaging.
- Render output.

This is the fastest route to proving the web application shell before adding TTS/DUIX complexity.

### Milestone 2: Recipe Model And Guided Workflow

- Recipe schema exists.
- Setup wizard recommends recipe.
- Workflow run state persists.
- Stages are visible and rerunnable.

### Milestone 3: Digital-Human Talking-Head Route

- Face source video plus topic/script route works.
- TTS master audio created.
- DUIX/HeyGem output imported.
- ASR captions generated.
- Packaging plan created.
- Render output produced.

### Milestone 4: Packaging Studio Expansion

- UI moves toward static reference.
- Theme library exists.
- Component insertion/editing is broader.
- Timeline editing works for cards/subtitles.

### Milestone 5: Digital-Human Product Introduction Recipe

- Product info and media inputs.
- Product script generation.
- Product-oriented scene plan.
- Product cards and theme defaults.
- Usable final sample.

## 15. Acceptance Criteria

### MVP

- User can create or open a project.
- User can produce a packaging plan from source media.
- User can edit at least one packaging card in UI.
- User can save packaging plan.
- User can generate HyperFrames HTML.
- User can see validation/lint/inspect/render output or a clear disabled-state explanation.
- Intermediate artifacts are stored in the project directory.

### Digital-Human Route

- Face source video is stored.
- Script checkpoint exists.
- Master audio checkpoint exists.
- DUIX/HeyGem output checkpoint exists.
- ASR transcript checkpoint exists.
- Packaging plan uses generated transcript and media.
- Final render uses continuous master audio.

### Extensibility

- Adding a recipe does not require rewriting core UI.
- Adding a theme does not require changing workflow stages.
- Adding a component does not require changing setup logic.
- Project data remains valid through protocol validators.

## 16. Risks And Mitigations

- Scope expands into full video editor.
  - Mitigation: keep MVP focused on packaging overlays, subtitles, themes, scene cards, and render flow.

- Recipes become hard-coded pipelines.
  - Mitigation: model recipes as data and keep stage runners generic.

- Long-running tasks break UI.
  - Mitigation: persist workflow stage state, logs, and outputs; support retry from checkpoints.

- Captions drift after audio changes.
  - Mitigation: make master audio the timing source and invalidate ASR/caption outputs after audio changes.

- Theme library becomes cosmetic only.
  - Mitigation: themes must affect presets, typography, captions, motion, layout density, and component defaults.

- Credentials leak into project files.
  - Mitigation: keep service endpoints and credentials in environment/config outside project artifacts.

## 17. Open Questions

- Resolved 2026-06-12: default local ASR for M1 Route B is FunASR / Paraformer via
  `/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python`; Whisper.cpp small is
  fallback. See `.hive/research/2026-06-12-m1-route-b-asr-preflight.md` and
  `.hive/decisions/draft-2026-06-12-default-route-b-asr.md`.
- Which TTS provider should be default for first UI-integrated digital-human route?
- Should workflow execution start synchronous with persisted logs, or should a task queue be added immediately?
- What is the minimum acceptable preview: generated HTML preview, frame extraction, or MP4 preview?
- Should user-created recipes/themes live under global `templates/`, project files, or both?

## 18. Recommended Build Order

1. Stabilize existing packaging editor.
2. Implement existing narrated video import route.
3. Add recipe schema and setup wizard.
4. Add workflow run state and checkpoints.
5. Expand Packaging Studio toward the static reference.
6. Integrate digital-human talking-head route.
7. Add digital-human product introduction recipe.

This order proves the web application and packaging model before integrating the longest TTS/DUIX chain.
