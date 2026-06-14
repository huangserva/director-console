# Director Console PM Plan

## Milestones

- v3-5 — Deterministic script-to-editable-project backend: implemented in `apps/console-api`.
  - Endpoint: `POST /generate/from-script`.
  - Input: existing plain script text only; no LLM expansion, image/video generation, TTS, or DUIX calls.
  - Pipeline: deterministic script segmentation → `buildScenePlan` → text-only manifest → `manifestToPlan`
    → `savePackagingPlanForProject`.
  - Output: managed editable project with `TitleCard`/`StepCard` cards only; video/audio/subtitle tracks stay empty
    for user binding in the editor.
  - History: records `kind:"generate"` with a full plan snapshot.
  - Robustness on 2026-06-14: script segmentation now secondarily splits long Chinese punctuation runs and clamps text by
    composer `TEXT_BUDGETS`, so generated `StepCard` items stay within manifest text budgets.
  - Security hardening on 2026-06-14: generation cleans partial manifest/plan publishes if post-save artifact writes fail.
- v3-3 — Task history and packaging-plan snapshots backend: implemented in `apps/console-api`.
  - Endpoints: `GET /projects/:name/history`, `GET /projects/:name/history/:id`,
    `POST /projects/:name/history/:id/restore`.
  - Storage: append-only `projects/<name>/history.json` plus full plan snapshots under
    `projects/<name>/snapshots/<entryId>.json`; both runtime artifact paths are gitignored.
  - Hooks: `from-skill-output`, `route-b/import`, `route-a/run`, `product-intro/run`,
    `apply-template`, `recaption`, and both render endpoints append entries when a managed project
    exists.
  - Restore: publishes through the existing `savePackagingPlanForProject` path so
    `planToManifest` and manifest validation gate rollback.
  - Security hardening on 2026-06-14: history snapshot reads/writes reject symlinked snapshot dirs/files and require
    realpath confinement under the managed project snapshot directory.
- v3-1 — Provider configuration center backend: implemented in `apps/console-api`.
  - Endpoints: `GET /providers`, `PUT /providers/:id`, `POST /providers/:id/health-check`.
  - Providers: `tts`, `asr`, `duix`, `image`, `video`, `proxy`.
  - Persistence: non-secret provider config goes to gitignored `provider-config.json`; secret values go to
    gitignored `.env.local` and are redacted from API responses.
  - Security hardening on 2026-06-14: provider secret env var names reject dangerous process/env names; health checks are
    loopback-only unless explicitly enabled for remote hosts.
  - Verification on 2026-06-14: `apps/console-api` `npm run test` and `npm run lint`.
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
