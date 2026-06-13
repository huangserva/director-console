# Director Console

Isolated build workspace for the **Director Packaging Console** — productizing the
verified digital-human video pipeline into an editable web application.

This is a **code-only copy** of `paseo/creative/director-duix-hyperframes`, created to
build the Console without touching the original production workspace or its assets.
No video/audio/render assets were copied (3GB+ of `first390-template-locked`,
`first120-template-duix`, backups, and render outputs were intentionally excluded).

## Layout

- `codex-skills/` — the three verified production skills (the pipeline stages):
  - `script-first-video-pipeline` — script + master-audio-first timing
  - `duix-heygem-lipsync` — `source.mp4 + dub.wav` → lip-sync layer
  - `hyperframes-tech-talk-template` — HyperFrames packaging/render template
- `hyperframes-composer/` — the working manifest-driven composition system
  (component catalog, registry, compose/lint/inspect/render scripts). This is the
  seed of the Console's packaging backend.
- `docs/digital-human-video-pipeline/` — the product plan (PRD, ADRs, roadmap).
- `production/` — text production assets (scripts/scene maps); media excluded.

## Reusing original heavy assets (optional)

The composer's `memos-v3` manifest references production media via a symlink that was
**not** copied. To run the existing sample against the original assets (read-only), add:

```bash
ln -s /Users/huangzongning/development/paseo/creative/director-duix-hyperframes/director-codex-hyperframes-video/first390-template-locked \
  hyperframes-composer/assets/external-first390
```

Otherwise, build M0 against a fresh minimal sample (no dependency on the original dir).

## Build direction

See `docs/digital-human-video-pipeline/` for the PRD and the M0→M5 roadmap.
M0 = wrap the already-working composer in a thin API + minimal web shell.
