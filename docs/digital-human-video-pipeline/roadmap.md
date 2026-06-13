# Roadmap

## Done

- Confirmed the local skill bundle exposes three concrete skills:
  - `script-first-video-pipeline`
  - `duix-heygem-lipsync`
  - `hyperframes-tech-talk-template`
- Clarified that the verified DUIX/HeyGem path is `source.mp4 + dub.wav`, not direct image plus audio generation.
- Selected a hybrid workspace MVP: guided defaults plus optional editable checkpoints.
- Chose an extensible architecture where video categories are workflow recipes and packaging presets, not hard-coded product boundaries.
- Drafted the full Video Packaging Console PRD.

## In Progress

- Review the PRD and convert approved scope into an implementation plan.

## Next

- Inventory active project paths, template commands, and available media inputs.
- Run a small end-to-end sample with one face video, one short script, one TTS master audio, one DUIX output, and one HyperFrames packaged render.
- Use digital-human product introduction as the first expansion proof case after the core architecture is stable.
- Start implementation planning from existing narrated video import, recipe schema, workflow run state, and Packaging Studio integration.

## Deferred

- Direct static image to talking-video support. This is outside the currently verified DUIX/HeyGem path unless a separate image-to-video step is added.
