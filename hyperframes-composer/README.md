# HyperFrames Composer

Shared component library and manifest-driven assembly system for the DUIX/HyperFrames tech-talk video family.

The goal is to stop copying full `index.html` templates per video. A new video should be assembled from registered, accepted components plus a manifest that supplies timing, media, captions, and bounded display copy.

## Project Shape

- `components/catalog.json` is the component vocabulary and anti-drift source of truth.
- `components/registry.mjs` renders locked component DOM.
- `components/hyperframes-tech-talk.css` stores locked visual styles copied from accepted first120/memos-v3 structures.
- `components/timelines.mjs` stores component motion.
- `blocks/composition-shell.mjs` wraps scenes, master audio, and captions into a HyperFrames document.
- `manifests/*.json` are video plans: ordered scene layers with component names and props.
- `scripts/compose.mjs` reads a manifest and writes `index.html`.
- `scripts/manifest-rules.mjs` validates anti-drift rules before composition.
- `audit/frames/` stores reference/composed comparison frames.
- `render/` stores generated review videos.

## Relationship To Production Assets

This project owns the composer system, not the existing production video repo.

- `director-codex-hyperframes-video/first120-template-duix/` remains the accepted visual baseline.
- `director-codex-hyperframes-video/first390-template-locked/` remains the memos production asset store and reference render location.
- `hyperframes-composer/assets/external-first390` is a local ignored link to `../director-codex-hyperframes-video/first390-template-locked`.
- Composer manifests may reference existing master audio, captions, screen recordings, and DUIX result MP4s through that link.
- Composer must not rewrite accepted first120 files, first390 tracked files, or existing final renders.

## Environment

Copy `.env.example` to `.env.local` when a workflow needs production service endpoints:

```bash
cp .env.example .env.local
```

Expected local endpoint shape:

```bash
COSYVOICE3_MASTER_API_BASE_URL=http://127.0.0.1:4090
DUIX_API_BASE_URL=http://127.0.0.1:8383
```

The current composer/render path does not call TTS or DUIX. Those endpoints are documented for audio-first production workflows that run before manifest composition. The accepted memos-v3 manifest reuses already-produced audio, captions, screen videos, and DUIX MP4s.

## Quick Start

```bash
npm run validate:catalog
npm run validate:registry
npm run test:validator
npm run validate:manifest -- manifests/memos-v3.json
npm run compose -- manifests/memos-v3.json
npm run lint
npm run inspect -- --at 1,4,8,25,60,90,120,145,154
npm run render -- --output render/memos-v3-composed-silent.mp4
```

For final review, remux the rendered video with the continuous master audio:

```bash
ffmpeg -y \
  -i render/memos-v3-composed-silent.mp4 \
  -i assets/external-first390/production/audio/memos-master-v3.wav \
  -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 192k -shortest \
  render/memos-v3-composed-final.mp4
```

## Current Acceptance

`manifests/memos-v3.json` reproduces the accepted memos-v3 production video through the shared component library.

Verified output:

- `render/memos-v3-composed-final.mp4`
- 155.600s, 1920x1080, 30fps, AAC 44.1k mono
- `npm run lint`: 0 errors, 8 warnings
- `npm run inspect -- --at 1,4,8,25,60,90,120,145,154`: 0 layout issues
- manual frame comparison in `audit/frames/`: 0.5/2/6/10s face clear, 1/4/8/25/60/90/120/145/154s visually aligned with `director-codex-hyperframes-video/first390-template-locked/render/memos-v3-final.mp4`

Known non-blocking warnings:

- Existing DUIX/input MP4 files have sparse keyframe warnings during render.
- HyperFrames lint reports GSAP overlap warnings inherited from the accepted timing style.
- The generated `index.html` is larger than the HyperFrames preferred file-size threshold because the first usable milestone keeps a single entry file.

## Anti-Drift Rules

The composer is intentionally restrictive:

- Only registered components may be used.
- `scene_type` must match the component listed in `catalog.json`.
- Controlled fine pieces may only appear under their parent component.
- `ScreenWithPip` may have exactly one circular PIP.
- Opening and closing scenes must keep the presenter face clear.
- Display copy must fit the first120 text budgets.
- Captions are global locked `caption-line` clips and must stay visible in the rendered HTML.

The executable implementation lives in `scripts/manifest-rules.mjs`; the component vocabulary and rule intent live in `components/catalog.json`.

## Docs

- [Component Catalog](docs/component-catalog.md)
- [Manifest Guide](docs/manifest-guide.md)
