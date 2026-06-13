# Director Console Pipeline

Stage modules for Director Console video workflows. This package is intentionally
independent from the M0 web/API shell and does not modify `hyperframes-composer`.

## CLI

```bash
cd packages/pipeline
npm run route-b:asr -- \
  --input /path/to/finished.mp4 \
  --workdir /tmp/director-route-b-memos \
  --captions /tmp/director-route-b-memos/captions.json \
  --transcript /tmp/director-route-b-memos/transcript.json
```

The CLI writes:

- `metadata.json` from `ffprobe`
- `audio/asr.wav` as 16 kHz mono PCM WAV from `ffmpeg`
- `asr/funasr.raw.json` from FunASR
- `captions.json` with composer-ready `{ start, end, text, asr_text }`
- `transcript.json` with full text, segments, and timeline
- `scene-plan.json` with grouped transcript windows and component candidates
- `manifest.json` with text-only `TitleCard`/`StepCard` scenes plus audio/captions

Environment:

- `FUNASR_PYTHON` or `ROUTE_B_FUNASR_PYTHON` overrides the Python interpreter.
- Default Python is `/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python`.
- `FFMPEG_PATH` and `FFPROBE_PATH` override the media tools.

Term fixes live in `src/term-map.json` and can be overridden with `--term-map`.

## Sample

```bash
npm run route-b:asr -- \
  --input /Users/huangzongning/development/paseo/creative/director-duix-hyperframes/hyperframes-composer/render/memos-v3-composed-final.mp4 \
  --workdir /tmp/director-route-b-memos
```

Use `--reuse-raw` to rebuild captions/transcript from an existing raw FunASR JSON
without rerunning the 31s ASR step.

Validate and compose the generated manifest:

```bash
cd ../../hyperframes-composer
npm run validate:manifest -- /tmp/director-route-b-memos/manifest.json
npm run compose -- /tmp/director-route-b-memos/manifest.json
```

## Route A Stage Functions

M3 adds production stage functions for the first half of
`digital-human-talking-head`:

- `runScriptStage({ workdir, topic, productInfo, approvedScript, targetDurationSeconds })`
  writes `script/script.txt` and returns structured chapters/terms. It has no
  external service dependency. Missing both `topic` and `approvedScript` returns
  `{ ok:false, reason:"invalid_input" }`.
- `runTtsStage({ workdir, scriptPath, script, voiceReference, speed, baseUrl })`
  guards `GET /health` on `COSYVOICE3_MASTER_API_BASE_URL` (default
  `http://127.0.0.1:4090`), then posts `{ text, speed }` to `/tts` and downloads
  `download_url` to `audio/master.wav`.
- `runLipSyncStage({ workdir, sourceVideoPath, dubAudioPath, jobId, baseUrl, containerJobDir })`
  guards `GET /easy/query?code=__director_probe__` on `DUIX_API_BASE_URL`
  (default `http://127.0.0.1:8383`), then submits `/easy/submit` and polls
  `/easy/query?code=<jobId>` until `data.status === 2` and `progress === 100`.

If CosyVoice3 or DUIX is unavailable, the stage returns a structured blocker
like `{ ok:false, blocked:true, reason:"service_unavailable", service }` and
does not submit downstream work.
