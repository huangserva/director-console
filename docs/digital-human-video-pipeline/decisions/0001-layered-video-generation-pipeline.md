# 0001: Layered Video Generation Pipeline

## Status

Accepted as planning direction.

## Decision

Use a layered production pipeline:

1. `script-first-video-pipeline` defines script, hook, narration structure, and master audio-first timing.
2. `duix-heygem-lipsync` generates digital-human mouth-sync video from a prepared face `source.mp4` plus driving `dub.wav`.
3. `hyperframes-tech-talk-template` packages the result into a publishable video with cards, layout, captions, motion, and final render validation.

## Consequences

- The master narration audio is the timing source of truth.
- DUIX/HeyGem output is treated as a visual mouth-sync layer, not the final video by itself.
- HyperFrames is responsible for the publishable wrapper and final composition.
- Static images need an additional image-to-video or prepared source-video step before the verified DUIX/HeyGem workflow.
