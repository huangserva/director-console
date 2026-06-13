// Client for the M0 console-api (http://127.0.0.1:4099, reached through the Vite
// /api proxy). The contract below is CONFIRMED against the live API
// (apps/console-api/src/server.mjs); we read the real shapes directly.
//
//   GET  /manifests          -> 200 { manifests: string[] }      (names, no .json)
//   GET  /manifests/:name    -> 200 <Manifest>                   (the JSON, has scenes[])
//   PUT  /manifests/:name    -> 200 { ok: true, path }           body: Manifest
//                               422 { error, failures: string[] } when invalid
//   POST /compose/:name      -> 200|500 { ok, code, previewUrl, htmlPath,
//                                          output, stdout, stderr, logPath }
//   POST /lint   { name }    -> 200 { ok, failures: string[] }   (also POST /lint/:name)
//   POST /inspect { name }   -> 200 { ok, code, output, stdout, stderr, logPath, name }
//                               (manifest-scoped: API composes that manifest, then inspects;
//                                also accepts POST /inspect/:name)
//
// The only back-compat read kept is the bare-array fallback for /manifests.

export const API_BASE = "/api";

export interface Manifest {
  compositionId?: string;
  duration?: number;
  output?: string;
  scenes: Scene[];
  [key: string]: unknown;
}

export interface Scene {
  id: string;
  component: string;
  scene_type?: string;
  start?: number;
  duration?: number;
  track?: number;
  finePieces?: string[];
  props?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ComposeResult {
  ok: boolean;
  code: number;
  previewUrl: string;
  htmlPath: string;
  output: string;
  stdout: string;
  stderr: string;
  logPath: string;
}

export interface LintResult {
  ok: boolean;
  failures: string[];
}

export interface InspectResult {
  ok: boolean;
  code: number;
  output: string;
  stdout: string;
  stderr: string;
  logPath: string;
  /** Manifest the inspect ran against (manifest-scoped API echoes it back). */
  name?: string;
}

// ---- M2: recipes, projects, workflow runs (confirmed contract) ----
//   GET  /recipes                                  -> { recipes: Recipe[] }
//   GET  /recipes/:id                              -> { recipe: Recipe }   (404 if missing)
//   POST /projects  { recipeId, name?, inputs? }   -> { ok, name, project, workflowRun }
//   GET  /projects/:name                           -> { ok, name, project, workflowRun }
//   POST /projects/:name/stages/:stageId           -> { ok, name, workflowRun }
//        body { action:"run"|"resume"|"advance" } | { status } | { action:"checkpoint", ... }
//        invalid transition -> { ok:false, failures: string[] }
//   POST /projects/:name/checkpoints/:cpId/approve -> { ok, name, workflowRun }

export interface RecipeInput {
  id: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface RecipeStage {
  id: string;
  type: string;
  name: string;
  dependsOn?: string[];
  outputs?: string[];
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  inputRequirements: RecipeInput[];
  optionalInputs?: RecipeInput[];
  stages: RecipeStage[];
  recommendedComponents: string[];
  defaultThemePackId?: string;
  validationGates?: string[];
}

export type StageStatus =
  | "not-started"
  | "ready"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "needs-review";

export interface StageRun {
  id: string;
  recipeStageId: string;
  status: StageStatus;
  /** Stage ids this stage depends on (carried by the protocol; recipe is authoritative). */
  dependsOn?: string[];
  startedAt?: string;
  updatedAt?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  logPath?: string;
}

export type CheckpointStatus = "open" | "approved" | "rejected" | "skipped";

export interface Checkpoint {
  id: string;
  stageId: string;
  status: CheckpointStatus;
  notes?: string;
}

export interface RunError {
  stageId?: string;
  message: string;
  code?: string;
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  recipeId: string;
  stages: StageRun[];
  currentStageId: string | null;
  checkpoints: Checkpoint[];
  errors: RunError[];
  startedAt: string;
  updatedAt: string;
}

/** Thrown when the API rejects a workflow mutation with validation failures. */
export class WorkflowTransitionError extends Error {
  failures: string[];
  constructor(message: string, failures: string[]) {
    super(message);
    this.name = "WorkflowTransitionError";
    this.failures = failures;
  }
}

/**
 * Route B import: a finished video → ASR (FunASR) → generated manifest → compose.
 * Synchronous long task (~30s+), so the UI shows an in-progress state while it runs.
 */
export interface RouteBImportResult {
  ok: boolean;
  /** Manifest name without `.json`, consistent with GET /manifests. */
  manifestName?: string;
  scenes?: number;
  logPath?: string;
  stderr?: string;
}

/** Thrown when the API rejects a manifest write with 422 + validation failures. */
export class ManifestValidationError extends Error {
  failures: string[];
  constructor(message: string, failures: string[]) {
    super(message);
    this.name = "ManifestValidationError";
    this.failures = failures;
  }
}

async function req(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function asJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function listManifests(): Promise<string[]> {
  const data = await asJson(await req("GET", "/manifests"));
  // Confirmed shape is { manifests: string[] }; bare array kept as the one compat read.
  const names: unknown[] = Array.isArray(data) ? data : (data.manifests ?? []);
  return names.map(String);
}

export async function getManifest(name: string): Promise<Manifest> {
  const manifest = await asJson(await req("GET", `/manifests/${encodeURIComponent(name)}`));
  if (!manifest || !Array.isArray(manifest.scenes)) {
    throw new Error("Manifest from API has no scenes[]");
  }
  return manifest as Manifest;
}

export async function saveManifest(name: string, manifest: Manifest): Promise<{ path?: string }> {
  const res = await req("PUT", `/manifests/${encodeURIComponent(name)}`, manifest);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (res.status === 422) {
    throw new ManifestValidationError(data.error ?? "manifest validation failed", data.failures ?? []);
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return { path: data.path };
}

export async function compose(name: string): Promise<ComposeResult> {
  // The API returns 200 on success and 500 on a failed compose, but both carry
  // the same body (ok/code/stderr/...). Read the body either way so the UI can
  // show stderr on failure instead of an opaque HTTP error.
  const res = await req("POST", `/compose/${encodeURIComponent(name)}`);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (data.ok === undefined && !res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return data as ComposeResult;
}

export async function lint(name: string): Promise<LintResult> {
  return asJson(await req("POST", "/lint", { name })) as Promise<LintResult>;
}

export async function inspect(name: string): Promise<InspectResult> {
  return asJson(await req("POST", "/inspect", { name })) as Promise<InspectResult>;
}

export async function listRecipes(): Promise<Recipe[]> {
  const data = await asJson(await req("GET", "/recipes"));
  return (Array.isArray(data) ? data : (data.recipes ?? [])) as Recipe[];
}

export async function getRecipe(id: string): Promise<Recipe> {
  const data = await asJson(await req("GET", `/recipes/${encodeURIComponent(id)}`));
  return (data.recipe ?? data) as Recipe;
}

export interface CreateProjectResult {
  name: string;
  workflowRun: WorkflowRun;
}

export async function createProject(recipeId: string, inputs: Record<string, unknown>, name?: string): Promise<CreateProjectResult> {
  const data = await asJson(await req("POST", "/projects", name ? { recipeId, name, inputs } : { recipeId, inputs }));
  return { name: data.name ?? data.project?.name ?? data.workflowRun?.projectId, workflowRun: data.workflowRun };
}

export interface ProjectView {
  name: string;
  project?: Record<string, unknown>;
  workflowRun: WorkflowRun | null;
}

export async function getProject(name: string): Promise<ProjectView> {
  const data = await asJson(await req("GET", `/projects/${encodeURIComponent(name)}`));
  return { name: data.name ?? name, project: data.project, workflowRun: data.workflowRun ?? null };
}

// Read body even on 4xx so we can surface { failures } from an illegal transition.
async function readWorkflowMutation(res: Response): Promise<WorkflowRun> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (res.status === 422 || data.ok === false) {
    throw new WorkflowTransitionError(
      data.error ?? "workflow transition rejected",
      Array.isArray(data.failures) ? data.failures : [],
    );
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  return data.workflowRun as WorkflowRun;
}

export async function runStage(
  projectName: string,
  stageId: string,
  body: Record<string, unknown> = { action: "run" },
): Promise<WorkflowRun> {
  return readWorkflowMutation(
    await req("POST", `/projects/${encodeURIComponent(projectName)}/stages/${encodeURIComponent(stageId)}`, body),
  );
}

export async function approveCheckpoint(projectName: string, checkpointId: string): Promise<WorkflowRun> {
  return readWorkflowMutation(
    await req(
      "POST",
      `/projects/${encodeURIComponent(projectName)}/checkpoints/${encodeURIComponent(checkpointId)}/approve`,
    ),
  );
}

/**
 * Route A (digital human): source video + (topic|approvedScript) → TTS → lip-sync →
 * ASR → manifest → compose. Synchronous long task (~30s+ when services are up).
 * Service unavailable is NOT an error: the API returns 200 with the affected stages
 * at needs-review and errors[].code === "SERVICE_UNAVAILABLE".
 */
export interface RouteARunInput {
  sourceVideoPath: string;
  topic?: string;
  approvedScript?: string;
  voiceReference?: string;
  name?: string;
}

export interface RouteARunResult {
  ok: boolean;
  name?: string;
  workflowRun?: WorkflowRun;
  /** Present only when services were up and a real manifest was produced. */
  manifestName?: string;
  logPath?: string;
  stderr?: string;
}

export async function runRouteA(input: RouteARunInput): Promise<RouteARunResult> {
  // Read body regardless of status: failure (4xx/500) carries stderr; success is 200.
  const res = await req("POST", "/route-a/run", input);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (data.ok === undefined && !res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return data as RouteARunResult;
}

/**
 * Product introduction (M5): mirrors Route A but with product fields. Same result
 * shape and same service-down semantics (200 + needs-review + SERVICE_UNAVAILABLE).
 */
export interface ProductIntroRunInput {
  sourceVideoPath: string;
  productName: string;
  productDescription: string;
  sellingPoints: string[];
  productMedia?: string[];
  offerCta?: string;
  voiceReference?: string;
  name?: string;
}

export async function runProductIntro(input: ProductIntroRunInput): Promise<RouteARunResult> {
  const res = await req("POST", "/product-intro/run", input);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (data.ok === undefined && !res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return data as RouteARunResult;
}

/**
 * v2-P2: read a project's packaging-plan (4 tracks + cards + segments).
 * The endpoint is owned by P1 (GET /projects/:name/packaging-plan). Until it
 * lands, this returns null on 404/501 so the UI can fall back to deriving a plan
 * client-side from the loaded manifest (manifestToPlan). This is the ONE place
 * the live-vs-derived contract is reconciled — callers just get a plan or null.
 *
 * The shape is intentionally `unknown`-ish here; the typed PackagingPlan lives in
 * lib/packaging-plan.ts. We return the raw body and let the caller type it.
 */
export async function getPackagingPlan(name: string): Promise<Record<string, unknown> | null> {
  const res = await req("GET", `/projects/${encodeURIComponent(name)}/packaging-plan`);
  if (res.status === 404 || res.status === 501) return null; // P1 not present yet, or no plan
  const text = await res.text();
  if (!res.ok) return null; // be tolerant: P2 falls back to client-derived plan
  const data = text ? JSON.parse(text) : {};
  // P1 may wrap as { plan } or return the plan directly.
  const plan = (data.plan ?? data) as Record<string, unknown>;
  return plan && typeof plan === "object" && (plan as any).tracks ? plan : null;
}

/**
 * v2-P3: persist an edited packaging-plan. PUT /projects/:name/packaging-plan
 * is owned by P1; the server projects the plan back to a manifest and saves it.
 *
 * Returns `{ saved: true }` on success. When the endpoint is absent (404/501 —
 * the running API predates P1), returns `{ saved: false }` so the caller falls
 * back to saving the equivalent manifest via PUT /manifests (same persisted
 * effect). A 422 throws ManifestValidationError so the existing Lint/banner path
 * shows `failures` — the ONE place plan-vs-manifest persistence is reconciled.
 */
export async function putPackagingPlan(name: string, plan: unknown): Promise<{ saved: boolean }> {
  // The server FORCES output/hyperframesEntry to projects/<name>/index.html and
  // rejects (422) any other value — yet its own GET surfaces the manifest's
  // output. Strip both before PUT so a GET→edit→PUT round-trip (and our
  // client-derived plan) always passes. The server re-derives them.
  const body =
    plan && typeof plan === "object"
      ? (() => {
          const { output, hyperframesEntry, ...rest } = plan as Record<string, unknown>;
          void output;
          void hyperframesEntry;
          return rest;
        })()
      : plan;
  const res = await req("PUT", `/projects/${encodeURIComponent(name)}/packaging-plan`, body);
  if (res.status === 404 || res.status === 501) return { saved: false };
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (res.status === 422) {
    throw new ManifestValidationError(data.error ?? "packaging plan validation failed", data.failures ?? []);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  return { saved: true };
}

// ── v2: real MP4 render ──
//   POST /projects/:name/render (alias POST /render/:name) — compose then render an MP4.
//   200 { ok:true, name, code:0, stage:'render', mp4Path, previewUrl, stdout, stderr, logPath }
//     previewUrl = /api/preview/render/<name>.mp4 (playable/downloadable through the Vite proxy).
//   failure { ok:false, stage:'compose'|'render', code, stderr, logPath } — surfaced, not faked.
//   Synchronous long task (~tens of seconds); the UI shows a spinner and blocks re-clicks.

export interface RenderResult {
  ok: boolean;
  name?: string;
  code?: number;
  stage?: string;
  mp4Path?: string;
  previewUrl?: string;
  stdout?: string;
  stderr?: string;
  logPath?: string;
}

/** Export options sent to the render endpoint (backend defaults when omitted). */
export interface RenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  quality?: "draft" | "standard" | "high";
}

export async function renderProject(name: string, options?: RenderOptions): Promise<RenderResult> {
  const body = options && Object.keys(options).length ? options : undefined;
  const res = await req("POST", `/projects/${encodeURIComponent(name)}/render`, body);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (data.ok === undefined && !res.ok) {
    return { ok: false, stage: "render", stderr: `${res.status} ${res.statusText}: ${text.slice(0, 300)}` };
  }
  return data as RenderResult;
}

/** Result of re-running ASR on a project's source media (字幕识别). */
export interface RecaptionResult {
  ok: boolean;
  name?: string;
  captionCount?: number;
  captionsPath?: string;
  stage?: string;
  stderr?: string;
  logPath?: string;
}

export async function recaptionProject(name: string): Promise<RecaptionResult> {
  const res = await req("POST", `/projects/${encodeURIComponent(name)}/recaption`);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (data.ok === undefined && !res.ok) {
    return { ok: false, stage: "recaption", stderr: `${res.status} ${res.statusText}: ${text.slice(0, 300)}` };
  }
  return data as RecaptionResult;
}

/**
 * Fetch a captions JSON via the static preview route ( /api/preview/<path> ),
 * so the 字幕识别 panel can list/edit cues. Returns the raw JSON (caller parses).
 */
export async function getCaptions(src: string): Promise<unknown> {
  const res = await req("GET", `/preview/${src.replace(/^\/+/, "")}`);
  if (!res.ok) throw new Error(`captions ${res.status} ${res.statusText}`);
  const text = await res.text();
  return text ? JSON.parse(text) : { captions: [] };
}

// ── v2 UX: server-backed file browser (replaces hand-typed absolute paths) ──
//   GET /fs/list?path=<dir abs> (omit = default start, e.g. HOME) ->
//     200 { ok:true, path, parent, entries:[{name,path,type:'dir'|'file',isVideo,size?}] }
//     4xx { ok:false, error }   (out of allowlist / not found)
// Reads the body on 4xx so the picker shows the error inline instead of crashing.

export interface FsListResult {
  ok: boolean;
  path?: string;
  parent?: string | null;
  entries?: { name: string; path: string; type: "dir" | "file"; isVideo?: boolean; size?: number }[];
  error?: string;
}

// Native OS file dialog (replaces the in-app browser modal).
//   POST /fs/choose-native { kind:'video'|'wav', multiple? } ->
//     { ok:true, path } | { ok:true, paths:[] } | { ok:false, canceled:true } | { ok:false, error }
export interface NativeChooseResult {
  ok: boolean;
  path?: string;
  paths?: string[];
  canceled?: boolean;
  error?: string;
}

export async function chooseNativeFile(kind: "video" | "wav", multiple = false): Promise<NativeChooseResult> {
  const res = await req("POST", "/fs/choose-native", { kind, multiple });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (data.ok === undefined && !res.ok) {
    return { ok: false, error: `${res.status} ${res.statusText}: ${text.slice(0, 200)}` };
  }
  return data as NativeChooseResult;
}

export async function listDir(path?: string): Promise<FsListResult> {
  const qs = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await req("GET", `/fs/list${qs}`);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (data.ok === undefined && !res.ok) {
    return { ok: false, error: `${res.status} ${res.statusText}: ${text.slice(0, 200)}` };
  }
  return data as FsListResult;
}

// ── v2-P5: template loop (save current plan as template / apply template) ──
//   POST /projects/:name/templates  {name?,id?,description?,overwrite?} -> {ok,templateId,template} | 409 | 422
//   GET  /templates                 -> {templates:[{id,name,description}]}
//   GET  /templates/:id             -> {template}
//   POST /projects/:name/apply-template {templateId,inputs?} -> {ok,name,manifestName} | 404 | 422
// All read the body on 4xx so the UI shows failures/conflict instead of an opaque error.

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
}

export interface SaveTemplateResult {
  ok: boolean;
  templateId?: string;
  /** 409: a template with this name/id already exists (offer overwrite). */
  conflict?: boolean;
  error?: string;
  failures?: string[];
}

export interface ApplyTemplateResult {
  ok: boolean;
  manifestName?: string;
  error?: string;
  failures?: string[];
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const data = await asJson(await req("GET", "/templates"));
  const list = Array.isArray(data) ? data : (data.templates ?? []);
  return list as TemplateSummary[];
}

export async function getTemplate(id: string): Promise<Record<string, unknown>> {
  const data = await asJson(await req("GET", `/templates/${encodeURIComponent(id)}`));
  return (data.template ?? data) as Record<string, unknown>;
}

export async function saveTemplate(
  projectName: string,
  body: { name?: string; id?: string; description?: string; overwrite?: boolean },
): Promise<SaveTemplateResult> {
  const res = await req("POST", `/projects/${encodeURIComponent(projectName)}/templates`, body);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (res.status === 409) return { ok: false, conflict: true, error: data.error ?? "template already exists" };
  if (res.status === 422) return { ok: false, error: data.error ?? "template validation failed", failures: data.failures ?? [] };
  if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}: ${text.slice(0, 300)}` };
  return { ok: true, templateId: data.templateId ?? data.template?.id };
}

export async function applyTemplate(projectName: string, templateId: string, inputs?: Record<string, unknown>): Promise<ApplyTemplateResult> {
  const res = await req("POST", `/projects/${encodeURIComponent(projectName)}/apply-template`, inputs ? { templateId, inputs } : { templateId });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (res.status === 422) return { ok: false, error: data.error ?? "apply-template validation failed", failures: data.failures ?? [] };
  if (!res.ok) return { ok: false, error: data.error ?? `${res.status} ${res.statusText}: ${text.slice(0, 300)}` };
  return { ok: true, manifestName: data.manifestName ?? data.name };
}

export async function importFromVideo(videoPath: string, name?: string): Promise<RouteBImportResult> {
  // Failure returns { ok:false, stderr, logPath } (status may be 200 or 500), so
  // read the body either way — only throw if there's no usable body at all.
  const body = name ? { videoPath, name } : { videoPath };
  const res = await req("POST", "/route-b/import", body);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (data.ok === undefined && !res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return data as RouteBImportResult;
}
