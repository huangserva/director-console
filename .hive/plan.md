# Director Console PM Plan

## Milestones

- M0 — Console API over hyperframes-composer: implemented in `apps/console-api`.
  - Endpoints: `GET /manifests`, `GET /manifests/:name`, `PUT /manifests/:name`,
    `POST /compose/:name`, `POST /lint`, `POST /inspect`.
  - Validation: `PUT /manifests/:name` calls `hyperframes-composer/scripts/manifest-rules.mjs`
    before writing files.
  - Script execution: compose/lint/inspect shell out to existing composer npm scripts and write
    per-run logs under `apps/console-api/logs/`.
  - Verification on 2026-06-12: `npm test`, `npm run lint`, real HTTP smoke for `/compose/:name`.
- M0 — Console API aligned to console-web contract: implemented in `apps/console-api`.
  - Manifest names are accepted with or without `.json`; `GET /manifests` returns suffixless names
    for the web dropdown.
  - `POST /compose/:name` returns `previewUrl` while preserving `htmlPath`; the API serves
    `hyperframes-composer/` files under `/api/preview/*` and `/preview/*` so iframe previews can
    load `index.html` and relative media.
  - `POST /lint` with `{ name }` and `POST /lint/:name` now run manifest validation through
    `scripts/manifest-rules.mjs` and return raw `failures: string[]`.
  - `POST /inspect` still wraps the HyperFrames inspect script and also exposes `output`.
  - Verification on 2026-06-12: `npm test`, `npm run lint`, real HTTP compose/preview/lint/inspect
    smoke against `manifests/sample-text.json`.
- M0 — Self-contained editable composer sample: implemented in
  `hyperframes-composer/manifests/sample-text.json`.
  - Purpose: M0 Web can load, edit, recompose, and preview a manifest without the missing
    `assets/external-first390` media symlink.
  - Components: `TitleCard`, `StepCard`, `TitleCard`; no presenter, screen, audio, or external media.
  - Editable text fields for Web shell: `props.cornerLeft`, `props.cornerName`, `props.kicker`,
    `props.title`, `props.subline`, and `StepCard` `props.items[]`.
  - Verification on 2026-06-12: `npm run validate:manifest -- manifests/sample-text.json`,
    `npm run compose -- manifests/sample-text.json`, `npm run lint`, `npm run inspect`.

## Current Composer Limits Observed

- The code-only copy does not include heavy media assets. Strict manifest validation can reject
  manifests that reference missing `assets/external-first390` media until the symlink is restored.
- After composing `manifests/sample-text.json`, lint/inspect complete successfully in the code-only
  copy: lint reports 0 errors and 6 inherited GSAP overlap warnings; inspect reports 0 layout issues.
- When `index.html` is composed from media-heavy `memos-v3`, lint/inspect can surface the existing
  composer/template findings; the API returns those results and log paths without masking composer
  output.

## M1 Route B Preflight Notes

- Default ASR resolved on 2026-06-12: use FunASR / Paraformer through
  `/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python`. Raw Paraformer ONNX model files
  exist under `~/.config/hive`, but they are not the default until a `sherpa_onnx`/ONNX wrapper is
  verified. Whisper.cpp small is the fallback.
- Composer captions contract: `manifest.audio.captions` points to a JSON file with a top-level
  `captions[]`; each item uses `start`/`end` in seconds plus `text`.
- M1 still needs Route B scripts for media import/probe, audio extraction, ASR wrapper, transcript
  generation, scene-plan generation, and scene-plan-to-manifest generation.
- Research: `.hive/research/2026-06-12-m1-route-b-asr-preflight.md`.
