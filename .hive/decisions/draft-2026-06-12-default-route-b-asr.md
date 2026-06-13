# Draft ADR: Default local ASR for M1 Route B

Date: 2026-06-12
Status: Draft

## Context

M1 Route B imports a finished narrated MP4 and needs local ASR to produce captions and transcript timing for `hyperframes-composer`. The PRD left the default ASR implementation open.

Local inventory found:

- `~/.config/hive/paraformer-models` and `~/.config/hive/streaming-paraformer` contain ONNX model files, but no `sherpa_onnx` runtime/CLI is installed.
- `~/.config/hive/whisper-models/ggml-small.bin` is runnable with Homebrew `whisper-cli`.
- The `cosyvoice` conda env has FunASR, ModelScope, torch, torchaudio, soundfile, and onnxruntime.
- Existing production code already uses FunASR/Paraformer in `first390-template-locked/scripts/funasr_transcribe.mjs`.

## Decision

Use FunASR / Paraformer through `/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python` as the default local ASR route for M1 Route B.

Use Whisper.cpp small as a fallback when FunASR fails to load or run.

Do not use raw ONNX Paraformer directories as the default until a checked-in or documented `sherpa_onnx`/ONNX wrapper exists.

## Consequences

- Route B captions should be generated from FunASR `sentence_info` timestamps, converting milliseconds to seconds for composer captions.
- M1 needs a local wrapper derived from the production `funasr_transcribe.mjs`, because the current copy only has the production reference in the read-only source tree.
- Whisper fallback needs a small converter from `transcription[].offsets.from/to` milliseconds to composer captions.
- If a future team wants lower-level ONNX Paraformer, the next step is to add and verify a runtime wrapper rather than assuming model files are enough.
