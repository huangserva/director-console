# Manifest Guide

A manifest describes a video as ordered HyperFrames scene layers. The composer turns it into `index.html`; render-time code does not invent layouts.

## Audio-First Production Flow

The composer starts after the production media exists.

1. Finalize narration script.
2. Generate the continuous master audio with the configured TTS service, normally via `.env.local` `COSYVOICE3_MASTER_API_BASE_URL=http://127.0.0.1:4090`.
3. Run ASR on that exact master audio and produce caption JSON.
4. Produce DUIX/lip-sync result videos and any screen recordings. If DUIX is needed, use `.env.local` `DUIX_API_BASE_URL` for the actual local service.
5. Write the manifest using the master audio, captions, screen media, and DUIX result MP4s.
6. Compose, validate, render, remux, and frame-check.

Do not change narration audio or captions to fit a layout. Shorten only display props such as `chip`, `kicker`, `title`, `subline`, and card labels.

## Minimal Shape

```json
{
  "version": "2026-06-10",
  "compositionId": "main",
  "duration": 155.6,
  "output": "index.html",
  "hyperframesEntry": "index.html",
  "auditCopy": "audit/index-memos-v3-composed.html",
  "audio": {
    "src": "assets/external-first390/production/audio/memos-master-v3.wav",
    "captions": "assets/external-first390/production/audio/captions-memos-v3.json"
  },
  "scenes": []
}
```

## Scene Layer Shape

```json
{
  "id": "s002-screen",
  "scene": "s002",
  "scene_type": "screen_demo_pip",
  "component": "ScreenWithPip",
  "start": 18.88,
  "duration": 28.48,
  "finePieces": ["ScreenShell", "CircularPip", "ScanLine"],
  "props": {
    "label": "Feishu login blocked",
    "media": {
      "screen": "assets/external-first390/assets/screen-fitted/s002.mp4",
      "pip": "assets/external-first390/production/duix-results/hf390_screen_cc_feishu_fail_plus_duix_pip_v3-r.mp4"
    }
  }
}
```

Rules:

- `id` must be unique.
- `scene_type` must be legal for `component`.
- `start + duration` must stay inside the composition duration.
- `finePieces` must be allowed by the parent component.
- Media paths are resolved relative to the manifest directory first, then the composer root.
- Paths may point through the ignored `assets/external-first390` link when reusing production assets from `director-codex-hyperframes-video/first390-template-locked`.

## Anti-Drift Validation

`npm run validate:manifest -- manifests/<video>.json` enforces the rules from `components/catalog.json` and `scripts/manifest-rules.mjs`:

- component exists in the registry;
- `scene_type` is legal for the chosen coarse component;
- controlled fine pieces only appear under allowed parent components;
- required props are present;
- display text stays within first120 budgets;
- `ScreenWithPip` has exactly one circular PIP;
- opening and closing scenes do not use large opaque center cards over the face;
- referenced media files exist.

## Building A New Video

1. Finish the script, master audio, ASR captions, DUIX slices, and screen media outside the composer.
2. Put or link media under `assets/`; keep large external project assets ignored if they are not owned by this repo.
3. Choose scene components from `components/catalog.json`.
4. Write display props within the text budgets.
5. Run:

```bash
npm run validate:manifest -- manifests/<video>.json
npm run compose -- manifests/<video>.json
npm run lint
npm run inspect -- --at <key-times>
npm run render -- --output render/<video>-silent.mp4
```

6. Remux with the continuous master audio:

```bash
ffmpeg -y \
  -i render/<video>-silent.mp4 \
  -i assets/<path-to-master-audio>.wav \
  -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 192k -shortest \
  render/<video>-final.mp4
```

7. Extract reference and composed frames into `audit/frames/`, then view them before accepting.

## Review Checklist

- `npm run test:validator` passes.
- Manifest validation passes.
- HyperFrames lint has 0 errors.
- HyperFrames inspect has 0 layout issues at scene boundaries and high-risk beats.
- Opening and closing presenter face is clear.
- `ScreenWithPip` has exactly one circular PIP.
- Split layouts do not overflow and use the accepted left-panel/right-presenter hierarchy.
- Captions are visible `caption-line` clips at the bottom of the frame.
- Final audio is remuxed from the continuous master track, not trusted from browser-rendered audio.
