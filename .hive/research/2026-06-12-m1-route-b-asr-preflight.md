# M1 Route B ASR preflight and execution spec

Date: 2026-06-12
Dispatch: `cef8801b-0fac-46dc-8373-2f579934edaf`
Scope: research only; no production code changed and no render run.

## Question

For M1 Route B, the console must turn one finished narrated MP4 into ASR captions, a transcript/scene plan, a composer manifest, and then a HyperFrames render. This preflight answers PRD Open Question #1: which local ASR route should be the default, and how does its output connect to `hyperframes-composer` `audio.captions`?

## Local ASR inventory

### Present model files under `~/.config/hive`

| Path | Contents | Size | Runnable today |
| --- | --- | ---: | --- |
| `~/.config/hive/paraformer-models` | `model.int8.onnx`, `tokens.txt` | 78 MB | Not directly runnable in the current default Python; no `sherpa_onnx` module/CLI found. |
| `~/.config/hive/streaming-paraformer` | encoder/decoder ONNX + int8 variants, tokens, sample WAVs | 1.0 GB | Model files are present; no `sherpa_onnx` runtime found. Useful as model inventory, not current M1 default. |
| `~/.config/hive/whisper-models` | `ggml-small.bin` | 465 MB | Runnable via `/opt/homebrew/bin/whisper-cli`. |

### Installed runtimes

- Default `python3`: no `mlx_whisper`, `whisper`, `funasr`, `modelscope`, `torchaudio`, `soundfile`, or `onnxruntime`.
- Homebrew CLI:
  - `ffmpeg` and `ffprobe` are installed.
  - `whisper-cli` is installed from `whisper-cpp`.
- Conda env:
  - `/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python`
  - has `funasr 1.3.9`, `modelscope 1.20.0`, `torch 2.3.1`, `torchaudio 2.3.1`, `soundfile 0.12.1`, `onnxruntime 1.18.0`.
  - no `sherpa_onnx`.
- ModelScope cache now contains the FunASR route models:
  - `~/.cache/modelscope/hub/iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch`
  - `~/.cache/modelscope/hub/iic/speech_fsmn_vad_zh-cn-16k-common-pytorch`
  - `~/.cache/modelscope/hub/iic/punc_ct-transformer_cn-en-common-vocab471067-large`

## Smoke results

### Whisper.cpp fallback

Command shape:

```bash
whisper-cli \
  -m ~/.config/hive/whisper-models/ggml-small.bin \
  -l zh \
  -oj \
  -of /tmp/director-asr-smoke/whisper-small-0 \
  ~/.config/hive/streaming-paraformer/test_wavs/0.wav
```

Result: exit 0. Output JSON has:

```json
{
  "transcription": [
    {
      "timestamps": { "from": "00:00:00,000", "to": "00:00:03,000" },
      "offsets": { "from": 0, "to": 3000 },
      "text": "昨天是 Monday"
    }
  ]
}
```

Timestamps are millisecond offsets. On the mixed Chinese/English sample, output was usable but coarse and split into broad 3 second segments.

### FunASR / Paraformer route

Command shape used for smoke:

```bash
/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python /tmp/director-funasr-smoke.py
```

The script instantiated:

```python
from funasr import AutoModel

model = AutoModel(
    model="paraformer-zh",
    vad_model="fsmn-vad",
    punc_model="ct-punc",
    device="cpu",
    disable_update=True,
)
res = model.generate(input=wav, batch_size_s=60, sentence_timestamp=True)
```

Result: exit 0. Output has one item with keys `key`, `text`, `timestamp`, `sentence_info`.

Relevant shape:

```json
{
  "text": "昨天是monday today is礼拜二the day after tomorrow是星期三。",
  "timestamp": [[630, 870], [870, 1110]],
  "sentence_info": [
    {
      "text": "昨天是 monday today is 礼拜二 the day after tomorrow 是星期三。",
      "start": 630,
      "end": 9775,
      "timestamp": [[630, 870], [870, 1110]]
    }
  ]
}
```

Raw FunASR units are milliseconds. Composer captions must convert `start`/`end` to seconds.

## Existing production ASR workflow

The canonical workflow is documented in:

`codex-skills/hyperframes-tech-talk-template/references/duix-cosyvoice-asr-workflow.md`

It says final audio is the source of truth. For narration changes, run ASR on the final master audio and rebuild subtitle timing from ASR timestamps. The old documented command uses `mlx_whisper` and `whisper-large-v3-turbo`, but this machine does not currently have `mlx_whisper` installed.

The production tree also contains a working FunASR converter:

`/Users/huangzongning/development/paseo/creative/director-duix-hyperframes/director-codex-hyperframes-video/first390-template-locked/scripts/funasr_transcribe.mjs`

Important behavior from that script:

- Chooses FunASR Python from `FUNASR_PYTHON`, `/Users/serva/miniconda3/envs/cosyvoice/bin/python`, then `/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python`.
- Runs `AutoModel(model="paraformer-zh", vad_model="fsmn-vad", punc_model="ct-punc", device="cpu", disable_update=True)`.
- Uses `sentence_timestamp=True`.
- Normalizes raw `sentence_info` from milliseconds to seconds:
  - `start: Number(s.start) / 1000`
  - `end: Number(s.end) / 1000`
- Writes composer-ready captions JSON.

## Composer `audio.captions` contract

The manifest shape is:

```json
{
  "audio": {
    "src": "assets/path/to/master.wav",
    "captions": "assets/path/to/captions.json"
  }
}
```

`hyperframes-composer/scripts/compose.mjs` resolves `manifest.audio.captions`, parses the file, and uses `payload.captions || []`.

The captions file must contain a top-level array:

```json
{
  "source_audio": "production/audio/memos-master-v3.wav",
  "source_script": "production/full-script.txt",
  "timing_source": "production/audio/funasr.raw.json",
  "caption_text_policy": "FunASR sentence timestamps and recognized text with term fixes",
  "stats": {
    "funasr_sentences": 61,
    "captions": 61
  },
  "captions": [
    {
      "start": 0.32,
      "end": 2.98,
      "text": "现在很多 AI 已经很会识别模式，",
      "source": "funasr_sentence_with_term_fixes",
      "asr_text": "现在很多 AI 已经很会识别模式，"
    }
  ]
}
```

`start` and `end` are seconds. `text` is required for rendering; `source` and `asr_text` are useful audit fields.

`hyperframes-composer/components/html.mjs` turns each caption into:

```html
<div id="cap-N" class="clip caption-line"
  data-start="START_SECONDS"
  data-duration="END_MINUS_START_SECONDS">
  <span>TEXT</span>
</div>
```

## M1 default ASR conclusion

Default for M1 Chinese Route B: FunASR / Paraformer through the `cosyvoice` conda environment.

Reason:

- It is runnable locally on this machine today.
- It is the route already used by production `first390-template-locked/scripts/funasr_transcribe.mjs`.
- It produces `sentence_info` with millisecond timestamps, punctuation, and Chinese-oriented text; the existing production converter already maps it to composer-ready seconds.
- It matches `.hive/plan.md` and `docs/PLAN.md` intent better than raw ONNX model files, because the ONNX Paraformer directories are present but lack a runnable wrapper/runtime.

Fallback: Whisper.cpp small with `whisper-cli -m ~/.config/hive/whisper-models/ggml-small.bin -l zh -oj`. Use only when FunASR env/model loading fails, and add a converter from `transcription[].offsets` milliseconds to composer captions seconds.

Not default:

- `mlx_whisper`: documented in old ASR workflow but not installed here.
- raw `~/.config/hive/paraformer-models` / `streaming-paraformer`: model files exist but no `sherpa_onnx` runtime/CLI is installed.

## Proposed M1 Route B execution spec

Input: one finished MP4 containing an audio stream.

Minimum viable sample input:

- Best local sample for M1 development: `/Users/huangzongning/development/paseo/creative/director-duix-hyperframes/hyperframes-composer/render/memos-v3-composed-final.mp4`
  - 1920x1080, 30 fps, 155.6 s, has AAC audio.
  - Already corresponds to an accepted composer manifest and caption set, so it is useful for regression comparison.
- Additional shorter vertical sample if needed: `/Users/huangzongning/development/paseo/creative/director-duix-hyperframes/production/aether/deliverables/eventA-post1-clip1.mp4`
  - 1080x2432, 25 fps, 37.6 s, has AAC audio.

### Stage 1. Probe metadata

Existing tool: `ffprobe`.

Command:

```bash
ffprobe -v error \
  -show_entries stream=index,codec_type,codec_name,width,height,r_frame_rate,duration:format=duration,size \
  -of json input.mp4 > metadata.json
```

M1 should store `metadata.json` as a project artifact and fail early if no audio stream exists.

Missing in repo: no Route B project importer wrapper yet.

### Stage 2. Extract ASR audio

Existing tool: `ffmpeg`.

Command:

```bash
ffmpeg -y -hide_banner -loglevel error \
  -i input.mp4 \
  -map 0:a:0 \
  -ac 1 -ar 16000 \
  project/audio/asr.wav
```

Rationale: FunASR/Paraformer route is Chinese 16 kHz oriented. Keep the original MP4 as video source and use extracted WAV as ASR source.

Missing in repo: no Route B audio-extract stage script yet.

### Stage 3. Run ASR to raw JSON and composer captions

Existing reusable reference: production `first390-template-locked/scripts/funasr_transcribe.mjs`.

M1 should create a local script based on that reference, for example:

`hyperframes-composer/scripts/asr-funasr-captions.mjs`

Command shape:

```bash
FUNASR_PYTHON=/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python \
node hyperframes-composer/scripts/asr-funasr-captions.mjs \
  project/audio/asr.wav \
  project/transcript/source-script-optional.txt \
  project/asr/funasr.raw.json \
  project/asr/captions.json
```

For Route B, `source_script` may be omitted or set to `null`; the captions can use recognized text with term fixes until a display-text policy is added.

Output consumed by composer:

```json
"audio": {
  "src": "assets/<project>/audio/asr.wav",
  "captions": "assets/<project>/asr/captions.json"
}
```

Missing in repo: local ASR wrapper does not exist in `director-console`; only the production reference exists in the read-only source tree.

### Stage 4. Build transcript

Input: `captions.json` and/or `funasr.raw.json`.

Expected M1 transcript artifact:

```json
{
  "language": "zh",
  "segments": [
    { "start": 0.32, "end": 2.98, "text": "..." }
  ],
  "text": "..."
}
```

Existing tool: none found in `director-console`.

M1 needs a new deterministic converter:

`scripts/route-b/build-transcript-from-captions.mjs`

### Stage 5. Generate scene plan from transcript

Inputs:

- transcript segments
- metadata duration/aspect ratio
- selected recipe/theme
- optional operator prompt

Output should map time ranges to scene intent and composer component candidates:

```json
{
  "scenes": [
    {
      "id": "s001",
      "start": 0.0,
      "duration": 12.0,
      "scene_type": "hook_stat",
      "summary": "...",
      "captionRange": [0, 4]
    }
  ]
}
```

Existing tool: none found. Docs mention `scenePlan`, but no generator script exists.

M1 needs a new scene planner. Minimum viable version can be deterministic segmentation by duration/punctuation with LLM-assisted titles optional later.

### Stage 6. Generate composer manifest

Inputs:

- metadata
- captions path
- scene plan
- original video or extracted screen/presenter media strategy
- component catalog

Existing tools:

- `hyperframes-composer/components/catalog.json`
- `hyperframes-composer/scripts/validate-manifest.mjs`
- `hyperframes-composer/scripts/compose.mjs`
- M0 API can load/save/compose/lint/inspect manifests once one exists.

Missing in repo: no script converts a Route B scene plan into `hyperframes-composer/manifests/*.json`.

M1 needs:

`scripts/route-b/generate-manifest-from-scene-plan.mjs`

Minimum viable manifest can use a conservative default component mix and the original MP4/audio as media, but it must satisfy existing manifest validation and component required props.

### Stage 7. Compose and render

Existing scripts:

```bash
cd hyperframes-composer
npm run validate:manifest -- manifests/<route-b>.json
npm run compose -- manifests/<route-b>.json
npm run lint
npm run inspect -- --at <key-times>
npm run render -- --output render/<route-b>-silent.mp4
```

Final audio should be remuxed from the intended audio track, not trusted from browser-rendered audio. For Route B, that could be the original MP4 audio or extracted master audio, depending on product choice.

This dispatch did not run compose/render.

## Minimal M1 inputs still needed

Required:

- One selected finished MP4 sample with permission to use in the M1 working copy.
- Decision whether M1 should preserve original video as a background/source media track, or use only audio/transcript to create a fresh packaged visual layer.
- A recipe/theme default for Route B, probably the existing dark tech-talk component set.

Available candidate inputs:

- `memos-v3-composed-final.mp4` from the production composer render: best for regression because manifest/captions already exist.
- `aether-150-final.mp4`: another 1920x1080 finished production sample with audio.
- `eventA-post1-clip1.mp4`: short vertical sample with audio; useful for aspect-ratio handling but not a direct fit for the 1920x1080 HyperFrames template.

## PM impact

- `.hive/plan.md` and `docs/PLAN.md` should say the default ASR is FunASR/Paraformer via the `cosyvoice` env, not only generic “local Paraformer under `~/.config/hive`”.
- PRD Open Question #1 can be marked resolved with the same answer.
- A draft ADR records the ASR default choice.
