# Console API

Thin HTTP wrapper around the accepted `hyperframes-composer`. It does not reimplement
composition, linting, or inspection; it shells out to the existing composer npm scripts.

## Start

```bash
cd apps/console-api
cp .env.example .env.local # optional
npm start
```

The API listens on `127.0.0.1:4099` by default (loopback only). Set `PORT` or
`CONSOLE_API_PORT` to change the port. It binds to all interfaces **only** when
`HOST` is set explicitly (e.g. `HOST=0.0.0.0`) — do that only behind a trusted
network, since `/route-b/import` runs local tools on a caller-supplied path. Local
service endpoints and credentials also belong in `.env.local`; do not commit them.

### Security env

- `HOST` — bind address. Default `127.0.0.1`. Set `0.0.0.0` to expose (trusted nets only).
- `ROUTE_B_IMPORT_ROOTS` — colon-separated absolute roots a Route B `videoPath` must
  resolve inside. Default: the user's home subtree (`$HOME`), which keeps the existing
  `~/development/...` demo paths working.
- `CONSOLE_API_CHILD_TIMEOUT_MS` — kill timeout for shelled-out `compose`/`inspect`/
  `lint` children. Default 15 min.

## Endpoints

- `GET /manifests` - list manifest names from `hyperframes-composer/manifests/*.json`
  without the `.json` suffix.
- `GET /manifests/:name` - read a manifest JSON file. `:name` may be `sample-text`
  or `sample-text.json`.
- `PUT /manifests/:name` - validate with `scripts/manifest-rules.mjs`, then save.
  Validation errors return `{ "error": "manifest validation failed", "failures": string[] }`.
- `POST /compose/:name` - run `npm run compose -- manifests/:name`, then return
  `{ ok, previewUrl, output, htmlPath, stdout, stderr, logPath }`. `previewUrl`
  points at the static preview route.
- `POST /projects/:name/render` or `POST /render/:name` - synchronously export a
  real MP4 for the named manifest/project. The API first runs compose for
  `manifests/:name.json`, then runs
  `npm run render -- --output render/:name.mp4` under `hyperframes-composer`.
  Body may be omitted or may include export settings:
  `{ "fps": 24|25|30|60, "quality": "draft"|"standard"|"high", "width": 1920, "height": 1080 }`.
  `fps` maps to HyperFrames `--fps`; `quality` maps to `--quality`. HyperFrames
  render v0.6.79 does **not** support arbitrary `--width`/`--height`, and the
  current composer shell is fixed at `1920x1080`; `width/height` are accepted
  only when they equal `1920x1080` and are not forwarded as render flags. Other
  resolutions return `422 { ok:false, failures:string[] }`. Omitted settings
  keep the composer defaults (`30fps`, `standard`, `1920x1080`).
  Success returns
  `{ ok:true, name, code, mp4Path, previewUrl, stdout, stderr, output, logPath, composeLogPath, stage:"render" }`.
  `mp4Path` is `hyperframes-composer/render/:name.mp4`; `previewUrl` uses the
  existing static preview route and is suitable for a video element. Render or
  compose failures return non-200 with
  `{ ok:false, name, code, mp4Path, stdout, stderr, output, logPath, composeLogPath, stage }`.
  Long renders are synchronous and use `CONSOLE_API_CHILD_TIMEOUT_MS`.
- `GET /api/preview/*` and `GET /preview/*` - statically serve files from
  `hyperframes-composer/` for iframe previews and relative media.
- `GET /fs/list?path=/absolute/dir` - list a local directory for file-picker UIs.
  If `path` is omitted, the API starts at the user's home directory (`$HOME` /
  `os.homedir()`). The directory is canonicalized with `realpath` and must resolve
  inside `ROUTE_B_IMPORT_ROOTS` (default: home subtree); protocol-style paths
  (`file://`, `http://`), null bytes, relative paths, missing paths, paths outside
  the allowlist, and non-directories are rejected with `4xx { ok:false, error }`.
  Dotfiles are hidden. Success returns:
  `{ ok:true, path, parent, entries:[{ name, path, type:"dir"|"file", isVideo, size? }] }`.
  `path` is the canonical directory path; entry `path` values are absolute
  filesystem paths under that directory. `parent` is the parent directory or
  `null` at filesystem root. Directories sort before
  files, then by name. `isVideo` is true for `.mp4`, `.mov`, `.webm`, `.mkv`, and
  `.m4v` files, case-insensitive.
- `POST /lint` with `{ "name": "sample-text" }` or `POST /lint/:name` - validate
  that manifest with `scripts/manifest-rules.mjs` and return `{ ok, failures }`.
- `POST /inspect` with `{ "name": "sample-text" }` or `POST /inspect/:name` -
  first run `npm run compose -- manifests/:name`, then run `npm run inspect` so
  the result is scoped to the selected manifest. Returns
  `{ ok, name, output, stdout, stderr, code, logPath, composeLogPath, htmlPath, previewUrl }`.
- `GET /recipes` - list available workflow recipes as
  `{ recipes: [{ id, name, description, inputRequirements, stages, recommendedComponents }] }`.
- `GET /recipes/:id` - read a full recipe as `{ recipe }`; missing recipes return `404`.
- `GET /templates` - list saved packaging templates from
  `director-console/templates/*.json` as `{ templates: [{ id, name, description }] }`.
- `GET /templates/:id` - read a saved template as `{ template }`; missing templates return `404`.
- `POST /projects` with `{ "recipeId": "existing-narrated-video", "name": "optional-project-name", "inputs": {} }` -
  create `hyperframes-composer/projects/:name/project.json` and
  `workflow-run.json` from the recipe. Returns `{ ok, name, project, workflowRun }`.
- `GET /projects/:name` - load a persisted project/workflow run with
  `{ ok, name, project, workflowRun }`.
- `GET /projects/:name/packaging-plan` - load the v2 packaging-plan for a project.
  If `hyperframes-composer/projects/:name/packaging-plan.json` exists, returns it
  as `{ ok:true, name, source:"project", plan }`. If no plan has been persisted
  yet but `hyperframes-composer/manifests/:name.json` exists, returns a synthesized
  plan from `manifestToPlan(manifest)` as
  `{ ok:true, name, source:"manifest", plan }`, so legacy Route A/B projects can
  open in the v2 editor. If neither exists, returns `404`
  `{ ok:false, error }`.
- `PUT /projects/:name/packaging-plan` - save a v2 packaging-plan and compile it
  back to the composer manifest target. Body is the packaging-plan JSON. The API:
  validates with `validatePackagingPlan`, projects with `planToManifest`, validates
  the resulting manifest with `scripts/manifest-rules.mjs`, atomically publishes
  `hyperframes-composer/manifests/:name.json`, then persists
  `hyperframes-composer/projects/:name/packaging-plan.json`. Managed project output
  is fixed to `projects/:name/index.html`; if the body supplies `output` or
  `hyperframesEntry`, it must already equal that path, otherwise the API returns
  `422` and does not write. Success returns
  `{ ok:true, name, manifestName, path, planPath }`. Plan validation errors return
  `422 { error:"packaging plan validation failed", failures:string[] }`; manifest
  validation errors return `422 { error:"manifest validation failed", failures:string[] }`.
  If `tracks.subtitle[]` contains inline `cues:[{ start, end, text, ... }]`, the
  API atomically writes those cues to
  `hyperframes-composer/projects/:name/captions.json`, normalizes
  `plan.source.captions` / subtitle `src` to `projects/:name/captions.json`, and
  projects `manifest.audio.captions` to that same file so edited subtitle text is
  used by the next compose/render.
- `POST /projects/:name/templates` - save the current project plan as a reusable
  packaging template. The API loads `projects/:name/packaging-plan.json` when it
  exists, otherwise synthesizes a plan from `manifests/:name.json`, then calls
  `extractTemplate(plan)` and `validateTemplate(template)`. Body accepts
  `{ "name": "template-id-or-name", "description": "optional", "overwrite": false }`;
  the sanitized name becomes the template id. The template is stored at
  `director-console/templates/:templateId.json`. Success returns
  `{ ok:true, templateId, template }`; an existing template id returns
  `409 { ok:false, error }` unless `overwrite:true`; validation failures return
  `422 { error:"template validation failed", failures:string[] }`.
- `POST /projects/:name/apply-template` - apply a saved template to a project.
  Body is `{ "templateId": "id", "inputs": {} }`. The API loads and validates the
  template, then loads the current project plan/manifest to provide default
  `duration`, `source`, `segments`, `output`, and `hyperframesEntry`. `inputs`
  overrides those defaults before `applyTemplate(template, inputs)` runs. The
  generated plan is persisted through the same path as
  `PUT /projects/:name/packaging-plan`: plan validation, manifest projection,
  managed `projects/:name/index.html` output enforcement, composer manifest
  validation, atomic manifest publish, and plan save. Success
  returns `{ ok:true, name, manifestName }`; invalid templates or generated plans
  return `422 { error, failures:string[] }`.
- `POST /projects/:name/recaption` - rerun subtitle recognition for an existing
  project. The API loads `projects/:name/packaging-plan.json` when present, or
  synthesizes a plan from `manifests/:name.json`, then uses `plan.source.audio`
  (falling back to `manifest.audio.src`) as the audio input. It reuses the M1
  FunASR stage (`runFunasr` plus `makeCaptionsPayload`, including deterministic
  term fixes), writes `hyperframes-composer/projects/:name/captions.json`, updates
  the plan subtitle track and `manifest.audio.captions`, and persists through the
  same plan->manifest validation path as `PUT /projects/:name/packaging-plan`.
  Success returns `{ ok:true, name, captionCount, captionsPath }`. Missing audio
  or ASR/caption failures return non-200
  `{ ok:false, name, stage, stderr }` and do not pretend success.
- `POST /projects/:name/stages/:stageId` - mutate workflow state using the
  protocol state machine. Body accepts:
  - `{ "action": "run" }` - robustly make that stage `running`, including
    `not-started -> ready -> running`, `ready -> running`,
    `succeeded/failed -> ready -> running` for rerun/retry, and an idempotent
    no-op when already `running`. Recipe dependencies must already be
    `succeeded` or `skipped`; otherwise the endpoint returns `422`.
  - `{ "status": "running" }` - exact single-step transition; illegal protocol
    transitions still return `422`.
  - `{ "action": "advance" }` / `{ "action": "resume" }` - move the next
    dependency-ready stage to `ready`.
  - `{ "action": "checkpoint", "checkpointId": "cp-id", "notes": "" }`.
  Returns `{ ok, name, workflowRun }`; invalid transitions return
  `{ ok:false, failures:string[] }`.
- `POST /projects/:name/checkpoints/:checkpointId/approve` - approve a checkpoint
  and return `{ ok, name, workflowRun }`.
- `POST /route-b/import` with `{ "videoPath": "/absolute/finished.mp4", "name": "optional-project-name" }` -
  synchronously run Route B import (`probe -> extract-audio -> FunASR -> term-fix ->
  captions/transcript -> scene-plan -> manifest -> compose`). Generated project
  assets are stored under `hyperframes-composer/projects/:name/`, and the manifest
  is written to `hyperframes-composer/manifests/:name.json` so the existing editor
  can list and open it. On success it also writes M2 `project.json` and
  `workflow-run.json` with recipe `existing-narrated-video` and completed stages.
  Returns `{ ok, manifestName, scenes, logPath }`; failures return
  `{ ok: false, stderr, logPath }`.
  - `videoPath` is validated before any tool runs: must be a non-empty string, an
    absolute path with no `://` protocol, and resolve (via `realpath`) inside
    `ROUTE_B_IMPORT_ROOTS`. Bad input is rejected `4xx` with `{ ok:false, stderr }`
    and never reaches ffprobe/ffmpeg.
  - The manifest is staged under a temp name and only **atomically renamed** to
    `manifests/:name.json` after compose succeeds; a failed import is rolled back
    (temp manifest + freshly created project removed) so it never appears in
    `GET /manifests`.
  - An existing `:name` returns `409` unless the body sets `overwrite: true`.
    Concurrent imports of the same name also return `409` (per-name lock).
- `POST /route-a/run` with
  `{ "sourceVideoPath": "/absolute/presenter-source.mp4", "topic": "optional topic", "approvedScript": "optional approved script", "voiceReference": "/optional/ref.wav", "name": "optional-project-name" }` -
  synchronously run Route A (`script -> TTS -> DUIX lip-sync -> ASR -> scene-plan ->
  manifest -> compose`) through `packages/pipeline::runRouteAWorkflow`.
  `topic` or `approvedScript` is required. Generated project metadata is stored in
  `hyperframes-composer/projects/:name/project.json` and `workflow-run.json`.
  When the run reaches manifest packaging successfully, the manifest is
  validated and atomically published to `hyperframes-composer/manifests/:name.json`.
  Returns `{ ok:true, name, workflowRun, manifestName?, logPath }`.
  - `sourceVideoPath` reuses the same `validateVideoPath` security boundary as
    `/route-b/import`: local absolute path only, no `://` protocols, no null byte,
    and `realpath` must resolve inside `ROUTE_B_IMPORT_ROOTS`.
  - TTS/DUIX service unavailability is **not** an HTTP error. The endpoint returns
    `200` with `{ ok:true, name, workflowRun, logPath }`; the blocked stage is
    persisted as `needs-review`, and `workflowRun.errors[]` includes
    `{ code:"SERVICE_UNAVAILABLE", stageId, message }`. No manifest is published
    in this case.
  - Other blocked/failed workflow results are treated as real failures and return
    non-200 `{ ok:false, stderr, logPath }` rather than being folded into the
    service-down needs-review path.
  - `voiceReference` accepts either a string path or `{ "wavPath": "/path.wav" }`;
    the API normalizes strings to `{ wavPath }`. In the current M3/M5 scope it is
    recorded in project/workflow metadata only; TTS passthrough becomes effective
    when the real CosyVoice integration consumes the voice reference.
  - True input errors return `4xx` with `{ ok:false, stderr }`; unexpected system
    failures return `5xx` with `{ ok:false, stderr, logPath }`.
- `POST /product-intro/run` with
  `{ "sourceVideoPath": "/absolute/presenter-source.mp4", "productName": "Product", "productDescription": "Short description", "sellingPoints": ["point"], "productMedia": ["/absolute/demo.mp4"], "offerCta": "optional CTA", "voiceReference": "/optional/ref.wav", "name": "optional-project-name", "overwrite": false }` -
  synchronously run the product-introduction Route A variant through
  `packages/pipeline::runProductIntroWorkflow` using recipe
  `digital-human-product-introduction`. Required product inputs are
  `productName`, `productDescription`, and a non-empty string-array
  `sellingPoints`. `productMedia` is optional; when present each entry must be a
  local `.mp4` or `.mov` path that passes the same `validateVideoPath`
  allowlist/realpath boundary as `sourceVideoPath`.
  Generated project metadata is stored in
  `hyperframes-composer/projects/:name/project.json` and `workflow-run.json`.
  When packaging succeeds, the manifest is validated and atomically published to
  `hyperframes-composer/manifests/:name.json`.
  Returns `{ ok:true, name, workflowRun, manifestName, logPath }` on successful
  packaging. If TTS/DUIX is unavailable, returns
  `{ ok:true, name, workflowRun, logPath }` with the blocked stage persisted as
  `needs-review`, `workflowRun.errors[]` containing
  `{ code:"SERVICE_UNAVAILABLE", stageId, message }`, and no manifest published.
  Other blocked/failed workflow results return non-200 `{ ok:false, stderr, logPath }`.
  `voiceReference` accepts either a string path or `{ "wavPath": "/path.wav" }`;
  strings are normalized to `{ wavPath }` and currently recorded only, matching
  Route A.
  Input/security errors return `4xx` with `{ ok:false, stderr }`; unexpected
  system failures return `5xx` with `{ ok:false, stderr, logPath }`.
  Existing names return `409` unless `overwrite:true` is supplied.

Script stdout/stderr is returned in the JSON response and written under
`apps/console-api/logs/`. Manifest lint does not shell out; it returns the
composer validator's `string[]` failures directly.
