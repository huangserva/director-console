import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateManifest } from "../../../hyperframes-composer/scripts/manifest-rules.mjs";
import {
  applyTemplate,
  extractTemplate,
  manifestToPlan,
  planToManifest,
  validatePackagingPlan,
  validateTemplate,
} from "../../../packages/packaging-plan/src/index.mjs";
import {
  buildManifestFromScenePlan,
  buildScenePlan,
  buildTranscript,
  extractAudio,
  loadTermMap,
  makeCaptionsPayload,
  probe,
  runProductIntroWorkflow,
  runFunasr,
  runRouteAWorkflow,
  writeJson,
} from "../../../packages/pipeline/src/stages.mjs";
import {
  addCheckpoint,
  advance,
  approveCheckpoint,
  createProjectFromRecipe,
  loadProject,
  recipes,
  saveProject,
  setStageState,
} from "../../../packages/protocol/src/index.mjs";

const DEFAULT_BODY_LIMIT = 5 * 1024 * 1024;

// 15 min envelope for shelled-out children (compose/inspect/lint). Generous enough
// for a real inspect render, but a hung child eventually dies. Override via env.
const DEFAULT_CHILD_TIMEOUT_MS = 15 * 60 * 1000;

// Real pipeline stages, injected into defaultRouteBImporter so the atomic-publish /
// cleanup logic can be unit-tested with fakes without touching production behavior.
const REAL_STAGES = {
  probe,
  extractAudio,
  runFunasr,
  makeCaptionsPayload,
  buildTranscript,
  buildScenePlan,
  buildManifestFromScenePlan,
  loadTermMap,
};

function sanitizeJsonString(value) {
  return value
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function sanitizeJsonBody(value) {
  if (typeof value === "string") return sanitizeJsonString(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeJsonBody(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeJsonBody(entry)]));
  }
  return value;
}

function jsonResponse(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(sanitizeJsonBody(body), null, 2));
}

function textResponse(response, status, body, contentType) {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}

function readJsonBody(request, limit = DEFAULT_BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(Object.assign(new Error("request body too large"), { status: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(Object.assign(new Error("invalid JSON body"), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function safeManifestName(name) {
  let decoded;
  try {
    decoded = decodeURIComponent(name || "");
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }
  if (!decoded || decoded.includes("/") || decoded.includes("\\") || decoded === "." || decoded === "..") return null;
  return decoded.endsWith(".json") ? decoded : `${decoded}.json`;
}

async function readManifest(composerRoot, name) {
  return JSON.parse(await fs.readFile(path.join(composerRoot, "manifests", name), "utf8"));
}

function getPreviewUrl(filePath, { composerRoot, previewBasePath }) {
  const relative = path.relative(composerRoot, filePath).split(path.sep).map(encodeURIComponent).join("/");
  return `${previewBasePath}/${relative}`;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

const PREVIEW_MEDIA_CONTENT_TYPES = new Map([
  [".mp4", "video/mp4"],
  [".mov", "video/mp4"],
  [".m4v", "video/mp4"],
  [".webm", "video/webm"],
  [".mkv", "video/mp4"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
]);

const DIGITAL_HUMAN_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv"]);

function previewMediaContentType(filePath) {
  return PREVIEW_MEDIA_CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || null;
}

function htmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function previewProjectNameFromRelative(relative) {
  const parts = relative.split(/[\\/]+/);
  if (parts.length >= 3 && parts[0] === "projects" && parts.at(-1).endsWith(".html")) {
    return safeProjectNameFromPath(parts[1]);
  }
  return null;
}

function replaceElementSrcById(html, tagName, id, src) {
  const idPattern = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagPattern = new RegExp(`<${tagName}\\b(?=[^>]*\\bid=["']${idPattern}["'])[^>]*>`, "i");
  return html.replace(tagPattern, (tag) => {
    const safeSrc = htmlAttr(src);
    if (/\ssrc=(["'])[^"']*\1/i.test(tag)) {
      return tag.replace(/\ssrc=(["'])[^"']*\1/i, ` src="${safeSrc}"`);
    }
    return tag.replace(/>$/, ` src="${safeSrc}">`);
  });
}

function projectAudioPreviewUrl(projectName, { previewBasePath }) {
  return `${previewBasePath}/audio/${encodeURIComponent(projectName)}`;
}

function mediaPreviewUrl(mediaPath, { previewBasePath }) {
  return `${previewBasePath}/media?path=${encodeURIComponent(mediaPath)}`;
}

function cardMediaUrls(media = {}, { previewBasePath }) {
  const entries = Object.entries(media || {}).filter(([, value]) => typeof value === "string" && value.trim());
  if (!entries.length) return undefined;
  return Object.fromEntries(entries.map(([slot, value]) => [slot, mediaPreviewUrl(value, { previewBasePath })]));
}

function mediaBindingsFromManifest(manifest) {
  const values = new Set();
  for (const scene of manifest.scenes || []) {
    for (const value of Object.values(scene.props?.media || {})) {
      if (typeof value === "string" && value.trim()) values.add(value);
    }
  }
  return [...values];
}

function replaceSrcValue(html, fromSrc, toSrc) {
  const escaped = fromSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const safeSrc = htmlAttr(toSrc);
  return html.replace(new RegExp(`\\ssrc=(["'])${escaped}\\1`, "g"), ` src="${safeSrc}"`);
}

function rewritePreviewHtmlResources(html, { projectName, manifest, previewBasePath }) {
  let rewritten = html;
  if (manifest.source?.video) {
    rewritten = replaceElementSrcById(
      rewritten,
      "video",
      "source-video-background-layer",
      sourceVideoPreviewUrl(projectName, { previewBasePath }),
    );
  }
  if (manifest.audio?.src) {
    rewritten = replaceElementSrcById(rewritten, "audio", "audio", projectAudioPreviewUrl(projectName, { previewBasePath }));
  }
  for (const mediaPath of mediaBindingsFromManifest(manifest)) {
    rewritten = replaceSrcValue(rewritten, mediaPath, mediaPreviewUrl(mediaPath, { previewBasePath }));
  }
  return rewritten;
}

async function serveComposerFile({ composerRoot, previewPath, response, previewBasePath }) {
  let relative;
  try {
    relative = decodeURIComponent(previewPath.replace(/^\/+/, ""));
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }
  if (!relative || relative.includes("\0")) {
    jsonResponse(response, 400, { error: "invalid preview path" });
    return true;
  }
  const filePath = path.resolve(composerRoot, relative);
  const rootWithSeparator = composerRoot.endsWith(path.sep) ? composerRoot : `${composerRoot}${path.sep}`;
  if (filePath !== composerRoot && !filePath.startsWith(rootWithSeparator)) {
    jsonResponse(response, 403, { error: "preview path escapes composer root" });
    return true;
  }
  const contentType = getContentType(filePath);
  const body = await fs.readFile(filePath);
  const projectName = contentType.startsWith("text/html") ? previewProjectNameFromRelative(relative) : null;
  if (projectName) {
    const manifestPath = path.join(composerRoot, "manifests", `${projectName}.json`);
    if (await pathExists(manifestPath)) {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      const html = rewritePreviewHtmlResources(body.toString("utf8"), { projectName, manifest, previewBasePath });
      textResponse(response, 200, html, contentType);
      return true;
    }
  }
  textResponse(response, 200, body, contentType);
  return true;
}

function sourceVideoPreviewUrl(projectName, { previewBasePath }) {
  return `${previewBasePath}/source/${encodeURIComponent(projectName)}`;
}

function withSourceVideoPreviewUrl(plan, projectName, { previewBasePath }) {
  if (!plan?.source?.video) return withCardMediaPreviewUrls(plan, { previewBasePath });
  const previewUrl = sourceVideoPreviewUrl(projectName, { previewBasePath });
  return withCardMediaPreviewUrls({
    ...plan,
    source: {
      ...plan.source,
      videoUrl: previewUrl,
    },
    tracks: {
      ...plan.tracks,
      video: (plan.tracks?.video || []).map((track, index) => (index === 0 ? { ...track, previewUrl } : track)),
    },
  }, { previewBasePath });
}

function withCardMediaPreviewUrls(plan, { previewBasePath }) {
  return {
    ...plan,
    tracks: {
      ...plan.tracks,
      card: (plan.tracks?.card || []).map((card) => {
        const mediaUrls = cardMediaUrls(card.media, { previewBasePath });
        return mediaUrls ? { ...card, mediaUrls } : card;
      }),
    },
  };
}

function parseRangeHeader(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return { error: true };
  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);
  if (start === null && end === null) return { error: true };
  if (start === null) {
    const suffixLength = end;
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return { error: true };
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    if (!Number.isInteger(start) || start < 0) return { error: true };
    end = end === null ? size - 1 : end;
  }
  if (!Number.isInteger(end) || end < start || start >= size) return { error: true };
  return { start, end: Math.min(end, size - 1) };
}

async function serveProjectSourceVideo({ composerRoot, projectName, request, response, importRoots }) {
  const manifestName = `${projectName}.json`;
  const manifestPath = path.join(composerRoot, "manifests", manifestName);
  if (!(await pathExists(manifestPath))) {
    jsonResponse(response, 404, { ok: false, error: "manifest not found" });
    return true;
  }
  const manifest = await readManifest(composerRoot, manifestName);
  const sourceVideo = manifest.source?.video;
  if (!sourceVideo) {
    jsonResponse(response, 404, { ok: false, error: "source video not found" });
    return true;
  }
  const check = await validateVideoPath(sourceVideo, importRoots);
  if (!check.ok) {
    const status = check.status === 400 && check.stderr?.startsWith("videoPath not found:") ? 404 : check.status;
    jsonResponse(response, status, { ok: false, error: check.stderr });
    return true;
  }
  const stat = await fs.stat(check.realPath);
  if (!stat.isFile()) {
    jsonResponse(response, 400, { ok: false, error: "source video must be a file" });
    return true;
  }
  const range = parseRangeHeader(request.headers.range, stat.size);
  if (range?.error) {
    response.writeHead(416, { "content-range": `bytes */${stat.size}` });
    response.end();
    return true;
  }
  const commonHeaders = {
    "accept-ranges": "bytes",
    "content-type": "video/mp4",
  };
  if (range) {
    const length = range.end - range.start + 1;
    response.writeHead(206, {
      ...commonHeaders,
      "content-length": length,
      "content-range": `bytes ${range.start}-${range.end}/${stat.size}`,
    });
    fsSync.createReadStream(check.realPath, { start: range.start, end: range.end }).pipe(response);
    return true;
  }
  response.writeHead(200, {
    ...commonHeaders,
    "content-length": stat.size,
  });
  fsSync.createReadStream(check.realPath).pipe(response);
  return true;
}

async function servePreviewMedia({ mediaPath, request, response, importRoots, digitalHumansRoot }) {
  const check = await validateVideoPath(mediaPath, await mediaImportRoots(importRoots, digitalHumansRoot));
  if (!check.ok) {
    const status = check.status === 400 && check.stderr?.startsWith("videoPath not found:") ? 404 : check.status;
    jsonResponse(response, status, { ok: false, error: check.stderr });
    return true;
  }
  const contentType = previewMediaContentType(check.realPath);
  if (!contentType) {
    jsonResponse(response, 400, { ok: false, error: "unsupported preview media type" });
    return true;
  }
  const stat = await fs.stat(check.realPath);
  if (!stat.isFile()) {
    jsonResponse(response, 400, { ok: false, error: "media path must be a file" });
    return true;
  }
  const range = parseRangeHeader(request.headers.range, stat.size);
  if (range?.error) {
    response.writeHead(416, { "content-range": `bytes */${stat.size}` });
    response.end();
    return true;
  }
  const commonHeaders = {
    "accept-ranges": "bytes",
    "content-type": contentType,
  };
  if (range) {
    const length = range.end - range.start + 1;
    response.writeHead(206, {
      ...commonHeaders,
      "content-length": length,
      "content-range": `bytes ${range.start}-${range.end}/${stat.size}`,
    });
    fsSync.createReadStream(check.realPath, { start: range.start, end: range.end }).pipe(response);
    return true;
  }
  response.writeHead(200, {
    ...commonHeaders,
    "content-length": stat.size,
  });
  fsSync.createReadStream(check.realPath).pipe(response);
  return true;
}

async function serveProjectAudio({ composerRoot, projectName, request, response }) {
  const manifestName = `${projectName}.json`;
  const manifestPath = path.join(composerRoot, "manifests", manifestName);
  if (!(await pathExists(manifestPath))) {
    jsonResponse(response, 404, { ok: false, error: "manifest not found" });
    return true;
  }
  const manifest = await readManifest(composerRoot, manifestName);
  const audioSrc = manifest.audio?.src;
  if (!audioSrc) {
    jsonResponse(response, 404, { ok: false, error: "project audio not found" });
    return true;
  }

  const audioPath = resolveComposerPath(composerRoot, audioSrc);
  let realPath;
  let composerRealRoot;
  try {
    realPath = await fs.realpath(audioPath);
    composerRealRoot = await fs.realpath(composerRoot);
  } catch {
    jsonResponse(response, 404, { ok: false, error: "project audio not found" });
    return true;
  }
  if (!isWithin(realPath, composerRealRoot)) {
    jsonResponse(response, 403, { ok: false, error: "project audio is outside the composer root" });
    return true;
  }

  const stat = await fs.stat(realPath);
  if (!stat.isFile()) {
    jsonResponse(response, 400, { ok: false, error: "project audio must be a file" });
    return true;
  }
  const range = parseRangeHeader(request.headers.range, stat.size);
  if (range?.error) {
    response.writeHead(416, { "content-range": `bytes */${stat.size}` });
    response.end();
    return true;
  }
  const commonHeaders = {
    "accept-ranges": "bytes",
    "content-type": getContentType(realPath),
  };
  if (range) {
    const length = range.end - range.start + 1;
    response.writeHead(206, {
      ...commonHeaders,
      "content-length": length,
      "content-range": `bytes ${range.start}-${range.end}/${stat.size}`,
    });
    fsSync.createReadStream(realPath, { start: range.start, end: range.end }).pipe(response);
    return true;
  }
  response.writeHead(200, {
    ...commonHeaders,
    "content-length": stat.size,
  });
  fsSync.createReadStream(realPath).pipe(response);
  return true;
}

function npmScriptRunner({ composerRoot, env }) {
  const timeout = Number(env.CONSOLE_API_CHILD_TIMEOUT_MS) || DEFAULT_CHILD_TIMEOUT_MS;
  // No shell: argv is passed as an array, so values like a videoPath containing
  // spaces/`;`/backticks are inert data, never re-parsed by a shell.
  return ({ script, args = [] }) =>
    new Promise((resolve, reject) => {
      const child = spawn("npm", ["run", script, ...args], {
        cwd: composerRoot,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        timeout,
        killSignal: "SIGTERM",
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
}

async function writeScriptLog(logDir, script, result) {
  await fs.mkdir(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logDir, `${stamp}-${script}.log`);
  const content = [`exit=${result.code}`, "", "[stdout]", result.stdout || "", "", "[stderr]", result.stderr || ""].join("\n");
  await fs.writeFile(logPath, content, "utf8");
  return logPath;
}

async function runAndLog({ runScript, logDir, script, args }) {
  const result = await runScript({ script, args });
  const logPath = await writeScriptLog(logDir, script, result);
  return { ...result, logPath };
}

function publicManifestName(name) {
  return name.replace(/\.json$/, "");
}

function sanitizeProjectName(value) {
  return String(value || "")
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isoNow() {
  return new Date().toISOString();
}

function recipeSummary(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    inputRequirements: recipe.inputRequirements,
    stages: recipe.stages,
    recommendedComponents: recipe.recommendedComponents,
  };
}

function getRecipe(id) {
  return recipes.find((recipe) => recipe.id === id);
}

function templateSummary(template) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
  };
}

function projectDirForName(composerRoot, name) {
  return path.join(composerRoot, "projects", name);
}

function safeProjectNameFromPath(value) {
  let decoded;
  try {
    decoded = decodeURIComponent(value || "");
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }
  const sanitized = sanitizeProjectName(decoded);
  if (!sanitized || sanitized !== decoded) return null;
  return sanitized;
}

function syncProjectFromWorkflow(project, workflowRun, now = isoNow()) {
  return {
    ...project,
    stageState: Object.fromEntries(workflowRun.stages.map((stage) => [stage.id, { ...(project.stageState?.[stage.id] || {}), status: stage.status }])),
    updatedAt: now,
  };
}

async function saveWorkflowProject(projectDir, project, workflowRun, now = isoNow()) {
  await saveProject(projectDir, {
    project: syncProjectFromWorkflow(project, workflowRun, now),
    workflowRun: { ...workflowRun, updatedAt: workflowRun.updatedAt || now },
  });
}

function workflowFailureResponse(response, failures) {
  jsonResponse(response, 422, { ok: false, failures });
}

function dependencyFailures(workflowRun, stageId) {
  const recipe = getRecipe(workflowRun.recipeId);
  if (!recipe) return [`recipe "${workflowRun.recipeId}" was not found`];
  const recipeStage = recipe.stages.find((stage) => stage.id === stageId);
  if (!recipeStage) return [`stage "${stageId}" was not found in recipe "${recipe.id}"`];
  const stageById = new Map(workflowRun.stages.map((stage) => [stage.id, stage]));
  return (recipeStage.dependsOn || [])
    .filter((dependency) => !["succeeded", "skipped"].includes(stageById.get(dependency)?.status))
    .map((dependency) => `stage "${stageId}" blocked: depends on ${dependency} (not succeeded)`);
}

function completeWorkflowRun(workflowRun, now = isoNow()) {
  let value = workflowRun;
  for (let index = 0; index < workflowRun.stages.length; index += 1) {
    const ready = advance(value, { now });
    if (ready.failures.length) return ready;
    value = ready.value;
    const currentStageId = value.currentStageId;
    if (!currentStageId) break;
    const running = setStageState(value, currentStageId, "running", { now });
    if (running.failures.length) return running;
    const succeeded = setStageState(running.value, currentStageId, "succeeded", { now });
    if (succeeded.failures.length) return succeeded;
    value = succeeded.value;
  }
  return { value, failures: [] };
}

function runStage(workflowRun, stageId, now = isoNow()) {
  const stage = workflowRun.stages.find((item) => item.id === stageId);
  if (!stage) return { value: workflowRun, failures: [`stage "${stageId}" was not found`] };
  if (stage.status === "running") return { value: workflowRun, failures: [] };
  const blocked = dependencyFailures(workflowRun, stageId);
  if (blocked.length) return { value: workflowRun, failures: blocked };

  let value = workflowRun;
  if (["not-started", "succeeded", "failed", "skipped", "needs-review"].includes(stage.status)) {
    const ready = setStageState(value, stageId, "ready", { now });
    if (ready.failures.length) return ready;
    value = ready.value;
  }
  return setStageState(value, stageId, "running", { now });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

// Import roots allowlist. Default: the user's home subtree (keeps the existing
// ~/development/... demo paths working). Override with ROUTE_B_IMPORT_ROOTS
// (colon-separated absolute paths).
export function getImportRoots(env = {}) {
  const raw = env.ROUTE_B_IMPORT_ROOTS || env.HOME || os.homedir() || "";
  return raw
    .split(":")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isWithin(child, root) {
  if (child === root) return true;
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return child.startsWith(rootWithSep);
}

async function realImportRoots(importRoots = []) {
  const roots = [];
  for (const root of importRoots) {
    try {
      roots.push(await fs.realpath(root));
    } catch {
      // Skip a configured root that doesn't exist.
    }
  }
  return roots;
}

async function digitalHumanMediaRoots(digitalHumansRoot) {
  const roots = [];
  if (!digitalHumansRoot) return roots;
  try {
    roots.push(await fs.realpath(digitalHumansRoot));
  } catch {
    return roots;
  }
  let entries;
  try {
    entries = await fs.readdir(digitalHumansRoot, { withFileTypes: true });
  } catch {
    return roots;
  }
  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    const fullPath = path.join(digitalHumansRoot, entry.name);
    try {
      roots.push(await fs.realpath(fullPath));
    } catch {
      // Broken symlinks are ignored by the library list and preview allowlist.
    }
  }
  return [...new Set(roots)];
}

async function mediaImportRoots(importRoots = [], digitalHumansRoot) {
  return [...importRoots, ...(await digitalHumanMediaRoots(digitalHumansRoot))];
}

async function listDigitalHumanAssets({ digitalHumansRoot, previewBasePath }) {
  if (!(await pathExists(digitalHumansRoot))) return [];
  const entries = await fs.readdir(digitalHumansRoot, { withFileTypes: true });
  const assets = [];
  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!DIGITAL_HUMAN_VIDEO_EXTENSIONS.has(ext)) continue;
    const filePath = path.join(digitalHumansRoot, entry.name);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }
    assets.push({
      id: path.basename(entry.name, ext),
      name: entry.name,
      url: mediaPreviewUrl(filePath, { previewBasePath }),
    });
  }
  return assets.sort((a, b) => a.name.localeCompare(b.name));
}

// Boundary check for a Route B videoPath BEFORE it ever reaches ffprobe/ffmpeg.
// Returns { ok:true, realPath } or { ok:false, status, stderr }. All rejections
// are 4xx and never invoke any child process.
export async function validateVideoPath(videoPath, importRoots = []) {
  if (typeof videoPath !== "string" || videoPath.trim() === "") {
    return { ok: false, status: 400, stderr: "videoPath is required and must be a non-empty string" };
  }
  // Reject any URL/protocol form (http/ftp/rtmp/file://…) so ffmpeg can't be
  // pointed at a remote or non-file protocol.
  if (videoPath.includes("://")) {
    return { ok: false, status: 400, stderr: "videoPath must be a local filesystem path, not a URL/protocol" };
  }
  if (videoPath.includes("\0")) {
    return { ok: false, status: 400, stderr: "videoPath contains an invalid null byte" };
  }
  if (!path.isAbsolute(videoPath)) {
    return { ok: false, status: 400, stderr: "videoPath must be an absolute path" };
  }
  let realPath;
  try {
    realPath = await fs.realpath(videoPath);
  } catch {
    // Missing file (or unresolved symlink) — can't confirm it's inside the
    // allowlist, so refuse rather than hand it to ffprobe.
    return { ok: false, status: 400, stderr: `videoPath not found: ${videoPath}` };
  }
  const roots = await realImportRoots(importRoots);
  if (!roots.some((root) => isWithin(realPath, root))) {
    return { ok: false, status: 403, stderr: "videoPath is outside the allowed import roots" };
  }
  return { ok: true, realPath };
}

async function validateDirectoryPath(dirPath, importRoots = []) {
  if (typeof dirPath !== "string" || dirPath.trim() === "") {
    return { ok: false, status: 400, error: "path is required and must be a non-empty string" };
  }
  if (dirPath.includes("://")) {
    return { ok: false, status: 400, error: "path must be a local filesystem path, not a URL/protocol" };
  }
  if (dirPath.includes("\0")) {
    return { ok: false, status: 400, error: "path contains an invalid null byte" };
  }
  if (!path.isAbsolute(dirPath)) {
    return { ok: false, status: 400, error: "path must be an absolute path" };
  }

  let realPath;
  try {
    realPath = await fs.realpath(dirPath);
  } catch {
    return { ok: false, status: 404, error: `path not found: ${dirPath}` };
  }

  const roots = await realImportRoots(importRoots);
  if (!roots.some((root) => isWithin(realPath, root))) {
    return { ok: false, status: 403, error: "path is outside the allowed import roots" };
  }

  let stat;
  try {
    stat = await fs.stat(realPath);
  } catch {
    return { ok: false, status: 404, error: `path not found: ${dirPath}` };
  }
  if (!stat.isDirectory()) {
    return { ok: false, status: 400, error: "path must be a directory" };
  }

  return { ok: true, realPath };
}

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);
const NATIVE_FILE_KINDS = new Set(["video", "wav", "any"]);
const NATIVE_FILE_TYPES = {
  video: ["mp4", "mov", "m4v", "webm", "mkv"],
  wav: ["wav"],
  any: [],
};
const NATIVE_CHOOSE_TIMEOUT_MS = 5 * 60 * 1000;

async function listDirectory({ dirPath, importRoots }) {
  const check = await validateDirectoryPath(dirPath, importRoots);
  if (!check.ok) return check;

  const entries = await Promise.all(
    (await fs.readdir(check.realPath, { withFileTypes: true }))
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry) => {
        const entryPath = path.join(check.realPath, entry.name);
        const stat = await fs.stat(entryPath);
        const type = stat.isDirectory() ? "dir" : "file";
        return {
          name: entry.name,
          path: entryPath,
          type,
          isVideo: type === "file" && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
          ...(type === "file" ? { size: stat.size } : {}),
        };
      }),
  );
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    ok: true,
    path: check.realPath,
    parent: path.dirname(check.realPath) === check.realPath ? null : path.dirname(check.realPath),
    entries,
  };
}

function appleScriptString(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function appleScriptList(values) {
  return `{${values.map((value) => appleScriptString(value)).join(", ")}}`;
}

function defaultNativePrompt(kind) {
  if (kind === "wav") return "选择 WAV 文件";
  if (kind === "any") return "选择文件";
  return "选择视频文件";
}

function buildChooseFileScript({ kind, multiple, prompt }) {
  const typeClause = NATIVE_FILE_TYPES[kind].length ? ` of type ${appleScriptList(NATIVE_FILE_TYPES[kind])}` : "";
  const multipleClause = multiple ? " with multiple selections allowed" : "";
  const chooseCommand = `choose file with prompt ${appleScriptString(prompt)}${typeClause}${multipleClause}`;
  if (!multiple) return `POSIX path of (${chooseCommand})`;
  return [
    `set pickedFiles to ${chooseCommand}`,
    'set outputPaths to ""',
    "repeat with pickedFile in pickedFiles",
    "set outputPaths to outputPaths & POSIX path of pickedFile & linefeed",
    "end repeat",
    "return outputPaths",
  ].join("\n");
}

function isNativeChooseCanceled({ stderr = "", stdout = "" } = {}) {
  return /User canceled|-128|errAEEventNotHandled/i.test(`${stderr}\n${stdout}`);
}

function defaultNativeFileChooser({ env }) {
  return ({ kind, multiple, prompt }) =>
    new Promise((resolve, reject) => {
      const child = spawn("osascript", ["-e", buildChooseFileScript({ kind, multiple, prompt })], {
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: NATIVE_CHOOSE_TIMEOUT_MS,
        killSignal: "SIGTERM",
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            ok: true,
            paths: stdout
              .split(/\r?\n/)
              .map((entry) => entry.trim())
              .filter(Boolean),
          });
          return;
        }
        if (isNativeChooseCanceled({ stdout, stderr })) {
          resolve({ ok: false, canceled: true });
          return;
        }
        resolve({ ok: false, error: stderr.trim() || stdout.trim() || `osascript exited with code ${code}` });
      });
    });
}

function normalizeNativeChooseRequest(body = {}) {
  const kind = body.kind === undefined ? "video" : body.kind;
  if (!NATIVE_FILE_KINDS.has(kind)) {
    return { ok: false, status: 400, error: "kind must be one of video, wav, any" };
  }
  const multiple = body.multiple === true;
  const prompt = typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : defaultNativePrompt(kind);
  return { ok: true, kind, multiple, prompt };
}

async function validateChosenFiles(paths) {
  const validPaths = [];
  for (const selectedPath of paths) {
    if (typeof selectedPath !== "string" || selectedPath.trim() === "" || selectedPath.includes("\0")) {
      return { ok: false, status: 500, error: "native chooser returned an invalid path" };
    }
    if (!path.isAbsolute(selectedPath)) {
      return { ok: false, status: 500, error: "native chooser returned a non-absolute path" };
    }
    let stat;
    try {
      stat = await fs.stat(selectedPath);
    } catch {
      return { ok: false, status: 500, error: `selected file not found: ${selectedPath}` };
    }
    if (!stat.isFile()) {
      return { ok: false, status: 500, error: `selected path is not a file: ${selectedPath}` };
    }
    validPaths.push(selectedPath);
  }
  return { ok: true, paths: validPaths };
}

async function chooseNativeFile({ body, nativeFileChooser }) {
  const request = normalizeNativeChooseRequest(body);
  if (!request.ok) return request;

  const result = await nativeFileChooser({ kind: request.kind, multiple: request.multiple, prompt: request.prompt });
  if (result?.canceled) return { ok: false, canceled: true };
  if (!result?.ok) return { ok: false, status: 500, error: result?.error || "native file chooser failed" };

  const paths = Array.isArray(result.paths) ? result.paths : result.path ? [result.path] : [];
  const validated = await validateChosenFiles(paths);
  if (!validated.ok) return validated;
  if (request.multiple) return { ok: true, paths: validated.paths };
  if (!validated.paths.length) return { ok: false, status: 500, error: "native chooser returned no file" };
  return { ok: true, path: validated.paths[0] };
}

const PRODUCT_MEDIA_EXTENSIONS = new Set([".mp4", ".mov"]);

async function validateProductMediaPaths(productMedia, importRoots = []) {
  if (productMedia === undefined || productMedia === null) return { ok: true, paths: [] };
  if (!Array.isArray(productMedia)) {
    return { ok: false, status: 400, stderr: "productMedia must be an array of local media paths" };
  }
  const paths = [];
  for (const mediaPath of productMedia) {
    if (typeof mediaPath !== "string" || mediaPath.trim() === "") {
      return { ok: false, status: 400, stderr: "productMedia entries must be non-empty strings" };
    }
    const ext = path.extname(mediaPath).toLowerCase();
    if (!PRODUCT_MEDIA_EXTENSIONS.has(ext)) {
      return { ok: false, status: 400, stderr: "productMedia entries must be .mp4 or .mov files" };
    }
    const check = await validateVideoPath(mediaPath, importRoots);
    if (!check.ok) return check;
    paths.push(check.realPath);
  }
  return { ok: true, paths };
}

function normalizeRequiredText(value, fieldName) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, stderr: `${fieldName} is required` };
  return { ok: true, value: text };
}

function normalizeSellingPoints(value) {
  if (!Array.isArray(value)) return { ok: false, stderr: "sellingPoints is required and must be a non-empty string array" };
  const points = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  if (!points.length) return { ok: false, stderr: "sellingPoints is required and must be a non-empty string array" };
  return { ok: true, value: points };
}

function normalizeVoiceReference(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const wavPath = value.trim();
    return wavPath ? { wavPath } : undefined;
  }
  if (typeof value === "object" && !Array.isArray(value)) return value;
  return value;
}

function blockedReason(result) {
  return result?.reason || result?.result?.reason || "";
}

function blockedFailureMessage(result, fallback = "workflow blocked") {
  const failures = result?.failures || result?.result?.failures || [];
  const reason = blockedReason(result);
  const detail = [reason, failures.length ? failures.join("; ") : result?.result?.message || result?.message || ""].filter(Boolean).join(": ");
  return detail ? `${fallback}: ${detail}` : fallback;
}

const RENDER_FPS = new Set([24, 25, 30, 60]);
const RENDER_QUALITIES = new Set(["draft", "standard", "high"]);
const FIXED_RENDER_RESOLUTION = "1920x1080";

function validateRenderOptions(body = {}) {
  const failures = [];
  const options = {};
  if (body.fps !== undefined) {
    const fps = Number(body.fps);
    if (!Number.isInteger(fps) || !RENDER_FPS.has(fps)) failures.push("fps must be one of 24, 25, 30, 60");
    else options.fps = fps;
  }
  if (body.quality !== undefined) {
    if (typeof body.quality !== "string" || !RENDER_QUALITIES.has(body.quality)) failures.push("quality must be one of draft, standard, high");
    else options.quality = body.quality;
  }
  const widthSet = body.width !== undefined;
  const heightSet = body.height !== undefined;
  if (widthSet || heightSet) {
    const width = Number(body.width);
    const height = Number(body.height);
    const resolution = `${width}x${height}`;
    if (!Number.isInteger(width) || !Number.isInteger(height) || resolution !== FIXED_RENDER_RESOLUTION) {
      failures.push(`resolution must be ${FIXED_RENDER_RESOLUTION}; hyperframes render v0.6.79 does not support ${resolution}`);
    }
  }
  return { failures, options };
}

function ensureWorkflowResultIsPublishable(result, label) {
  if (result?.blocked && blockedReason(result) !== "service_unavailable") {
    throw new Error(blockedFailureMessage(result, `${label} blocked`));
  }
  if (!result?.ok && !result?.blocked) {
    const failures = result?.failures || [];
    throw new Error(failures.length ? `${label} failed:\n${failures.join("\n")}` : `${label} failed`);
  }
}

async function deriveProjectName(videoPath) {
  const base = sanitizeProjectName(path.basename(videoPath, path.extname(videoPath))) || "route-b";
  try {
    const stat = await fs.stat(videoPath);
    return `${base}-${Math.floor(stat.mtimeMs)}`;
  } catch {
    return base;
  }
}

async function composeManifest({ composerRoot, logDir, runScript, name }) {
  const manifest = await readManifest(composerRoot, name);
  const result = await runAndLog({ runScript, logDir, script: "compose", args: ["--", `manifests/${name}`] });
  const htmlPath = path.resolve(composerRoot, manifest.output || "index.generated.html");
  return { manifest, result, htmlPath };
}

function renderArgsForOptions(relativeMp4Path, options = {}) {
  const args = ["--"];
  if (options.fps !== undefined) args.push("--fps", String(options.fps));
  if (options.quality !== undefined) args.push("--quality", options.quality);
  args.push("--output", relativeMp4Path);
  return args;
}

async function renderManifest({ composerRoot, logDir, runScript, name, renderOptions = {} }) {
  const composed = await composeManifest({ composerRoot, logDir, runScript, name });
  const publicName = publicManifestName(name);
  const relativeMp4Path = path.join("render", `${publicName}.mp4`);
  const mp4Path = path.join(composerRoot, relativeMp4Path);
  if (composed.result.code !== 0) {
    return {
      composed,
      result: composed.result,
      mp4Path,
      renderSkipped: true,
    };
  }
  const renderEntryPath = path.join(composerRoot, "index.html");
  if (composed.htmlPath !== renderEntryPath) {
    await fs.copyFile(composed.htmlPath, renderEntryPath);
  }
  await fs.mkdir(path.dirname(mp4Path), { recursive: true });
  const result = await runAndLog({ runScript, logDir, script: "render", args: renderArgsForOptions(relativeMp4Path, renderOptions) });
  return { composed, result, mp4Path, renderSkipped: false };
}

function resolveComposerPath(composerRoot, value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(composerRoot, value);
}

function projectRelativePath(projectName, fileName) {
  return `projects/${projectName}/${fileName}`;
}

async function recaptionProject({ composerRoot, projectName, deps }) {
  const loadedPlan = await loadPackagingPlanForProject({ composerRoot, projectName });
  if (!loadedPlan.ok) return { ok: false, status: loadedPlan.status, stage: "load-project", stderr: loadedPlan.error };

  const manifest = await readManifest(composerRoot, `${projectName}.json`);
  const plan = loadedPlan.plan;
  const audioSrc = plan.source?.audio || plan.tracks?.audio?.[0]?.src || manifest.audio?.src;
  if (!audioSrc) return { ok: false, status: 422, stage: "resolve-audio", stderr: "project has no audio source" };

  const audioPath = resolveComposerPath(composerRoot, audioSrc);
  if (!(await pathExists(audioPath))) return { ok: false, status: 422, stage: "resolve-audio", stderr: `audio file not found: ${audioSrc}` };

  const captionsRef = plan.source?.captions || manifest.audio?.captions || projectRelativePath(projectName, "captions.json");
  const captionsPath = resolveComposerPath(composerRoot, captionsRef);
  const projectDir = projectDirForName(composerRoot, projectName);
  const rawAsrPath = path.join(projectDir, "funasr.raw.json");
  await fs.mkdir(projectDir, { recursive: true });

  try {
    await deps.runFunasr(audioPath, rawAsrPath);
  } catch (error) {
    return { ok: false, status: 500, stage: "asr", stderr: error.message || String(error) };
  }

  let captionsPayload;
  try {
    const rawAsr = JSON.parse(await fs.readFile(rawAsrPath, "utf8"));
    captionsPayload = await deps.makeCaptionsPayload({
      sourceVideo: plan.source?.video || manifest.source?.video,
      sourceAudio: audioSrc,
      rawAsrPath,
      rawAsr,
      termMap: deps.loadTermMap(),
    });
  } catch (error) {
    return { ok: false, status: 500, stage: "captions", stderr: error.message || String(error) };
  }

  await deps.writeJson(captionsPath, captionsPayload);
  const duration = plan.duration ?? manifest.duration ?? 0;
  const updatedPlan = {
    ...plan,
    source: { ...(plan.source || {}), audio: audioSrc, captions: captionsRef },
    tracks: {
      ...(plan.tracks || {}),
      audio: plan.tracks?.audio?.length
        ? plan.tracks.audio.map((track, index) => (index === 0 ? { ...track, src: audioSrc } : track))
        : [{ id: "audio-main", track: "audio", src: audioSrc, start: 0, duration }],
      subtitle: [{ id: "subtitle-main", track: "subtitle", src: captionsRef, start: 0, duration }],
    },
  };
  const saved = await savePackagingPlanForProject({ composerRoot, projectName, plan: updatedPlan });
  if (!saved.ok) return { ok: false, status: saved.status, stage: "save", stderr: saved.failures?.join("\n") || saved.error };

  return {
    ok: true,
    name: projectName,
    captionCount: captionsPayload.captions.length,
    captionsPath,
  };
}

async function writeRouteBLog(logDir, name, content) {
  await fs.mkdir(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logDir, `${stamp}-route-b-${name}.log`);
  await fs.writeFile(logPath, content, "utf8");
  return logPath;
}

async function writeRouteALog(logDir, name, content) {
  await fs.mkdir(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logDir, `${stamp}-route-a-${name}.log`);
  await fs.writeFile(logPath, content, "utf8");
  return logPath;
}

async function writeProductIntroLog(logDir, name, content) {
  await fs.mkdir(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logDir, `${stamp}-product-intro-${name}.log`);
  await fs.writeFile(logPath, content, "utf8");
  return logPath;
}

async function publishManifestAtomically({ composerRoot, manifestName, sourceManifestPath }) {
  const finalManifestPath = path.join(composerRoot, "manifests", `${manifestName}.json`);
  const tmpManifestPath = path.join(composerRoot, "manifests", `.${manifestName}.route-a-${process.pid}.json.tmp`);
  const manifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
  const failures = validateManifest(manifest, { root: composerRoot, manifestPath: finalManifestPath });
  if (failures.length) throw new Error(`generated route-a manifest failed validation:\n${failures.join("\n")}`);
  await writeJson(tmpManifestPath, manifest);
  await fs.rename(tmpManifestPath, finalManifestPath);
  return { finalManifestPath, manifest };
}

async function writeJsonAtomically(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`);
  await writeJson(tmpPath, value);
  await fs.rename(tmpPath, filePath);
}

async function loadPackagingPlanForProject({ composerRoot, projectName }) {
  const projectDir = projectDirForName(composerRoot, projectName);
  const planPath = path.join(projectDir, "packaging-plan.json");
  const manifestName = `${projectName}.json`;
  const manifestPath = path.join(composerRoot, "manifests", manifestName);
  if (await pathExists(planPath)) {
    return {
      ok: true,
      source: "project",
      plan: JSON.parse(await fs.readFile(planPath, "utf8")),
      planPath,
      manifestPath,
    };
  }
  if (!(await pathExists(manifestPath))) {
    return { ok: false, status: 404, error: "project packaging plan or manifest not found" };
  }
  const manifest = await readManifest(composerRoot, manifestName);
  return {
    ok: true,
    source: "manifest",
    plan: manifestToPlan(manifest, { projectId: projectName }),
    planPath,
    manifestPath,
  };
}

function managedProjectOutput(projectName) {
  return `projects/${projectName}/index.html`;
}

function managedOutputFailures(plan, projectName) {
  const expected = managedProjectOutput(projectName);
  const failures = [];
  if (plan.output !== undefined && plan.output !== null && plan.output !== expected) failures.push(`output must be ${expected}`);
  if (plan.hyperframesEntry !== undefined && plan.hyperframesEntry !== null && plan.hyperframesEntry !== expected) {
    failures.push(`hyperframesEntry must be ${expected}`);
  }
  return failures;
}

function normalizeCaptionCue(cue) {
  return {
    start: Number(cue.start),
    end: Number(cue.end),
    text: String(cue.text || ""),
    ...(cue.asr_text !== undefined ? { asr_text: cue.asr_text } : {}),
    ...(cue.source !== undefined ? { source: cue.source } : {}),
  };
}

function inlineSubtitleCues(plan) {
  for (const track of plan.tracks?.subtitle || []) {
    if (Array.isArray(track.cues) && track.cues.length) return track.cues.map(normalizeCaptionCue);
  }
  return null;
}

function planWithManagedCaptionCues(plan, projectName) {
  const cues = inlineSubtitleCues(plan);
  if (!cues) return { plan, cues: null, captionsRef: plan.source?.captions || plan.tracks?.subtitle?.[0]?.src || null };
  const captionsRef = `projects/${projectName}/captions.json`;
  const duration = plan.duration ?? 0;
  return {
    cues,
    captionsRef,
    plan: {
      ...plan,
      source: { ...(plan.source || {}), captions: captionsRef },
      tracks: {
        ...(plan.tracks || {}),
        subtitle: [
          {
            ...(plan.tracks?.subtitle?.[0] || {}),
            id: plan.tracks?.subtitle?.[0]?.id || "subtitle-main",
            track: "subtitle",
            src: captionsRef,
            start: plan.tracks?.subtitle?.[0]?.start ?? 0,
            duration: plan.tracks?.subtitle?.[0]?.duration ?? duration,
            cues,
          },
          ...(plan.tracks?.subtitle || []).slice(1),
        ],
      },
    },
  };
}

async function savePackagingPlanForProject({ composerRoot, projectName, plan }) {
  const projectDir = projectDirForName(composerRoot, projectName);
  const planPath = path.join(projectDir, "packaging-plan.json");
  const manifestPath = path.join(composerRoot, "manifests", `${projectName}.json`);
  const outputFailures = managedOutputFailures(plan, projectName);
  if (outputFailures.length) {
    return { ok: false, status: 422, error: "packaging plan validation failed", failures: outputFailures };
  }
  const output = managedProjectOutput(projectName);
  const captions = planWithManagedCaptionCues(plan, projectName);
  const normalizedPlan = { ...captions.plan, projectId: projectName, output, hyperframesEntry: output };
  const planValidation = validatePackagingPlan(normalizedPlan);
  if (planValidation.failures.length) {
    return { ok: false, status: 422, error: "packaging plan validation failed", failures: planValidation.failures };
  }

  let manifest;
  try {
    manifest = planToManifest(normalizedPlan);
  } catch (error) {
    return { ok: false, status: 422, error: "packaging plan validation failed", failures: [error.message || String(error)] };
  }

  const stagedManifestPath = path.join(projectDir, ".packaging-plan-manifest.json.tmp");
  await fs.mkdir(projectDir, { recursive: true });
  if (captions.cues) {
    await writeJsonAtomically(path.join(composerRoot, captions.captionsRef), { captions: captions.cues });
  }

  const failures = validateManifest(manifest, { root: composerRoot, manifestPath });
  if (failures.length) {
    return { ok: false, status: 422, error: "manifest validation failed", failures };
  }

  await writeJson(stagedManifestPath, manifest);
  try {
    const published = await publishManifestAtomically({
      composerRoot,
      manifestName: projectName,
      sourceManifestPath: stagedManifestPath,
    });
    await writeJsonAtomically(planPath, normalizedPlan);
    return {
      ok: true,
      name: projectName,
      manifestName: projectName,
      path: published.finalManifestPath,
      planPath,
      plan: normalizedPlan,
    };
  } finally {
    await fs.rm(stagedManifestPath, { force: true });
  }
}

export async function defaultRouteBImporter(
  { videoPath, name, composerRoot, logDir, env, runScript },
  deps = REAL_STAGES,
) {
  const manifestName = sanitizeProjectName(name) || (await deriveProjectName(videoPath));
  if (!manifestName) throw new Error("manifest name could not be derived");
  const projectDir = path.join(composerRoot, "projects", manifestName);
  const projectExisted = await pathExists(projectDir);
  const tmpRoot = env.ROUTE_B_TMP_DIR || os.tmpdir();
  const tmpDir = path.join(tmpRoot, `director-route-b-import-${manifestName}`);
  const rawAsrPath = path.join(tmpDir, "funasr.raw.json");
  const metadataPath = path.join(projectDir, "metadata.json");
  const audioPath = path.join(projectDir, "audio", "asr.wav");
  const captionsPath = path.join(projectDir, "captions.json");
  const transcriptPath = path.join(projectDir, "transcript.json");
  const scenePlanPath = path.join(projectDir, "scene-plan.json");
  const manifestPath = path.join(composerRoot, "manifests", `${manifestName}.json`);
  // Stage the manifest under a non-.json temp name (so GET /manifests never lists
  // an in-progress import), compose against it, and only atomically rename to the
  // real manifests/<name>.json once compose succeeds.
  const manifestTmpPath = path.join(composerRoot, "manifests", `.${manifestName}.importing-${process.pid}.json.tmp`);
  const logLines = [`videoPath=${videoPath}`, `manifestName=${manifestName}`, `projectDir=${projectDir}`, `tmpDir=${tmpDir}`];

  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, "audio"), { recursive: true });

    const metadata = await deps.probe(videoPath);
    if (!metadata.audio) throw new Error(`input has no audio stream: ${videoPath}`);
    await writeJson(metadataPath, metadata);
    logLines.push(`metadata=${metadataPath}`);

    await deps.extractAudio(videoPath, audioPath);
    logLines.push(`audio=${audioPath}`);

    await deps.runFunasr(audioPath, rawAsrPath);
    logLines.push(`rawAsr=${rawAsrPath}`);

    const rawAsr = JSON.parse(await fs.readFile(rawAsrPath, "utf8"));
    const captionsPayload = await deps.makeCaptionsPayload({
      sourceVideo: videoPath,
      sourceAudio: audioPath,
      rawAsrPath,
      rawAsr,
      termMap: deps.loadTermMap(),
    });
    await writeJson(captionsPath, captionsPayload);
    logLines.push(`captions=${captionsPath}`);

    const transcriptPayload = {
      source_video: videoPath,
      source_captions: captionsPath,
      ...deps.buildTranscript(captionsPayload.captions),
    };
    await writeJson(transcriptPath, transcriptPayload);
    logLines.push(`transcript=${transcriptPath}`);

    const scenePlan = deps.buildScenePlan({ transcript: transcriptPayload });
    await writeJson(scenePlanPath, scenePlan);
    logLines.push(`scenePlan=${scenePlanPath}`);

    const manifest = deps.buildManifestFromScenePlan({
      scenePlan,
      sourceVideo: videoPath,
      audioSrc: `projects/${manifestName}/audio/asr.wav`,
      captionsPath: `projects/${manifestName}/captions.json`,
      output: `projects/${manifestName}/index.html`,
      compositionId: manifestName,
    });
    const failures = validateManifest(manifest, { root: composerRoot, manifestPath });
    if (failures.length) throw new Error(`generated manifest failed validation:\n${failures.join("\n")}`);
    await writeJson(manifestTmpPath, manifest);
    logLines.push(`manifestTmp=${manifestTmpPath}`, `scenes=${manifest.scenes.length}`, `captions=${captionsPayload.captions.length}`);

    const relTmpManifest = path.relative(composerRoot, manifestTmpPath);
    const composeResult = await runAndLog({ runScript, logDir, script: "compose", args: ["--", relTmpManifest] });
    logLines.push(`composeCode=${composeResult.code}`, `composeLog=${composeResult.logPath}`);
    if (composeResult.code !== 0) throw new Error(`compose failed for ${manifestName}:\n${composeResult.stderr || composeResult.stdout}`);

    // Compose succeeded → publish atomically.
    await fs.rename(manifestTmpPath, manifestPath);
    logLines.push(`manifest=${manifestPath}`);
    await fs.rm(tmpDir, { recursive: true, force: true });

    const logPath = await writeRouteBLog(logDir, manifestName, `${logLines.join("\n")}\n`);
    return { ok: true, manifestName, scenes: manifest.scenes.length, logPath };
  } catch (error) {
    // Failed import must leave nothing behind: no staged manifest in manifests/,
    // and no half-baked project dir (only if we created it this run).
    await fs.rm(manifestTmpPath, { force: true });
    if (!projectExisted) await fs.rm(projectDir, { recursive: true, force: true });
    await fs.rm(tmpDir, { recursive: true, force: true });
    throw error;
  }
}

export function createApiServer(options = {}) {
  const composerRoot = options.composerRoot || path.resolve(import.meta.dirname, "../../../hyperframes-composer");
  const logDir = options.logDir || path.resolve(import.meta.dirname, "../logs");
  const env = options.env || {};
  const previewBasePath = options.previewBasePath || "/api/preview";
  const runScript = options.runScript || npmScriptRunner({ composerRoot, env });
  const nativeFileChooser = options.nativeFileChooser || defaultNativeFileChooser({ env });
  const routeBImporter = options.routeBImporter || defaultRouteBImporter;
  const routeAWorkflow = options.routeAWorkflow || runRouteAWorkflow;
  const productIntroWorkflow = options.productIntroWorkflow || runProductIntroWorkflow;
  const recaptionDeps = {
    runFunasr,
    makeCaptionsPayload,
    loadTermMap,
    writeJson,
    ...(options.recaptionDeps || {}),
  };
  const importRoots = options.importRoots || getImportRoots(env);
  const digitalHumansRoot = options.digitalHumansRoot || path.resolve(composerRoot, "..", "assets", "digital-humans");
  const templatesRoot = options.templatesRoot || path.resolve(import.meta.dirname, "../../../templates");
  // Per-name lock: reject a concurrent import of the same name so two runs can't
  // clobber each other's shared tmp/project dirs. (A real queue is deferred.)
  const importsInFlight = new Set();
  const projectLocks = new Map();

  async function withProjectLock(projectName, fn) {
    const previous = projectLocks.get(projectName) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    projectLocks.set(projectName, previous.then(() => current, () => current));
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (projectLocks.get(projectName) === current) projectLocks.delete(projectName);
    }
  }

  return async function consoleApi(request, response) {
    try {
      const url = new URL(request.url, "http://localhost");
      const parts = url.pathname.split("/").filter(Boolean);

      if (request.method === "GET" && url.pathname === "/fs/list") {
        const requestedPath = url.searchParams.has("path") ? url.searchParams.get("path") : env.HOME || os.homedir();
        const result = await listDirectory({ dirPath: requestedPath, importRoots });
        if (!result.ok) {
          jsonResponse(response, result.status, { ok: false, error: result.error });
          return;
        }
        jsonResponse(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/fs/choose-native") {
        const body = await readJsonBody(request);
        const result = await chooseNativeFile({ body, nativeFileChooser });
        if (result.ok || result.canceled) {
          jsonResponse(response, 200, result);
          return;
        }
        jsonResponse(response, result.status || 500, { ok: false, error: result.error || "native file chooser failed" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/manifests") {
        const files = await fs.readdir(path.join(composerRoot, "manifests"));
        jsonResponse(response, 200, { manifests: files.filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, "")).sort() });
        return;
      }

      if (request.method === "GET" && url.pathname === "/recipes") {
        jsonResponse(response, 200, { recipes: recipes.map(recipeSummary) });
        return;
      }

      if (request.method === "GET" && parts[0] === "recipes" && parts.length === 2) {
        const recipe = getRecipe(parts[1]);
        if (!recipe) {
          jsonResponse(response, 404, { error: "recipe not found" });
          return;
        }
        jsonResponse(response, 200, { recipe });
        return;
      }

      if (request.method === "GET" && url.pathname === "/templates") {
        await fs.mkdir(templatesRoot, { recursive: true });
        const files = (await fs.readdir(templatesRoot)).filter((file) => file.endsWith(".json")).sort();
        const templates = [];
        for (const file of files) {
          const template = JSON.parse(await fs.readFile(path.join(templatesRoot, file), "utf8"));
          templates.push(templateSummary(template));
        }
        jsonResponse(response, 200, { templates });
        return;
      }

      if (request.method === "GET" && parts[0] === "templates" && parts.length === 2) {
        const templateId = safeProjectNameFromPath(parts[1]);
        if (!templateId) {
          jsonResponse(response, 400, { error: "invalid template id" });
          return;
        }
        const templatePath = path.join(templatesRoot, `${templateId}.json`);
        if (!(await pathExists(templatePath))) {
          jsonResponse(response, 404, { error: "template not found" });
          return;
        }
        jsonResponse(response, 200, { template: JSON.parse(await fs.readFile(templatePath, "utf8")) });
        return;
      }

      if (
        request.method === "GET" &&
        ((parts[0] === "assets" && parts[1] === "digital-humans" && parts.length === 2) ||
          (parts[0] === "api" && parts[1] === "assets" && parts[2] === "digital-humans" && parts.length === 3))
      ) {
        const assets = await listDigitalHumanAssets({ digitalHumansRoot, previewBasePath });
        jsonResponse(response, 200, { ok: true, assets });
        return;
      }

      if (
        request.method === "GET" &&
        ((parts[0] === "preview" && parts[1] === "source" && parts.length === 3) ||
          (parts[0] === "api" && parts[1] === "preview" && parts[2] === "source" && parts.length === 4))
      ) {
        const projectName = safeProjectNameFromPath(parts[0] === "preview" ? parts[2] : parts[3]);
        if (!projectName) {
          jsonResponse(response, 400, { ok: false, error: "invalid project name" });
          return;
        }
        await serveProjectSourceVideo({ composerRoot, projectName, request, response, importRoots });
        return;
      }

      if (
        request.method === "GET" &&
        ((parts[0] === "preview" && parts[1] === "audio" && parts.length === 3) ||
          (parts[0] === "api" && parts[1] === "preview" && parts[2] === "audio" && parts.length === 4))
      ) {
        const projectName = safeProjectNameFromPath(parts[0] === "preview" ? parts[2] : parts[3]);
        if (!projectName) {
          jsonResponse(response, 400, { ok: false, error: "invalid project name" });
          return;
        }
        await serveProjectAudio({ composerRoot, projectName, request, response });
        return;
      }

      if (
        request.method === "GET" &&
        ((parts[0] === "preview" && parts[1] === "media" && parts.length === 2) ||
          (parts[0] === "api" && parts[1] === "preview" && parts[2] === "media" && parts.length === 3))
      ) {
        const mediaPath = url.searchParams.get("path");
        await servePreviewMedia({ mediaPath, request, response, importRoots, digitalHumansRoot });
        return;
      }

      if (request.method === "GET" && (parts[0] === "preview" || (parts[0] === "api" && parts[1] === "preview"))) {
        const previewPath = parts[0] === "preview" ? parts.slice(1).join("/") : parts.slice(2).join("/");
        await serveComposerFile({ composerRoot, previewPath, response, previewBasePath });
        return;
      }

      if (request.method === "POST" && url.pathname === "/projects") {
        const body = await readJsonBody(request);
        const recipeId = body.recipeId;
        const inputs = body.inputs || {};
        const name = sanitizeProjectName(body.name || inputs.name || inputs.projectName || recipeId);
        if (!recipeId || typeof recipeId !== "string") {
          jsonResponse(response, 400, { ok: false, failures: ["recipeId is required"] });
          return;
        }
        if (!name) {
          jsonResponse(response, 400, { ok: false, failures: ["project name is required"] });
          return;
        }
        await withProjectLock(name, async () => {
          const projectDir = projectDirForName(composerRoot, name);
          if (await pathExists(path.join(projectDir, "project.json"))) {
            jsonResponse(response, 409, { ok: false, failures: [`project "${name}" already exists`] });
            return;
          }
          const now = isoNow();
          const created = createProjectFromRecipe(recipeId, inputs, { projectId: name, name, now });
          if (created.failures.length) {
            workflowFailureResponse(response, created.failures);
            return;
          }
          await saveProject(projectDir, created);
          jsonResponse(response, 200, {
            ok: true,
            name,
            project: created.project,
            workflowRun: created.workflowRun,
          });
        });
        return;
      }

      if (parts[0] === "projects" && parts.length >= 2) {
        const projectName = safeProjectNameFromPath(parts[1]);
        if (!projectName) {
          jsonResponse(response, 400, { error: "invalid project name" });
          return;
        }
        const projectDir = projectDirForName(composerRoot, projectName);

        if (request.method === "POST" && parts.length === 3 && parts[2] === "render") {
          const body = await readJsonBody(request);
          const renderValidation = validateRenderOptions(body);
          if (renderValidation.failures.length) {
            jsonResponse(response, 422, { ok: false, failures: renderValidation.failures });
            return;
          }
          await withProjectLock(projectName, async () => {
            const name = safeManifestName(projectName);
            const rendered = await renderManifest({ composerRoot, logDir, runScript, name, renderOptions: renderValidation.options });
            const status = rendered.result.code === 0 ? 200 : 500;
            jsonResponse(response, status, {
              ok: rendered.result.code === 0,
              name: publicManifestName(name),
              code: rendered.result.code,
              mp4Path: rendered.mp4Path,
              ...(rendered.result.code === 0 ? { previewUrl: getPreviewUrl(rendered.mp4Path, { composerRoot, previewBasePath }) } : {}),
              stdout: rendered.result.stdout,
              stderr: rendered.result.stderr,
              output: rendered.result.stdout,
              logPath: rendered.result.logPath,
              composeLogPath: rendered.composed.result.logPath,
              stage: rendered.renderSkipped ? "compose" : "render",
            });
          });
          return;
        }

        if (request.method === "POST" && parts.length === 3 && parts[2] === "recaption") {
          await withProjectLock(projectName, async () => {
            const result = await recaptionProject({ composerRoot, projectName, deps: recaptionDeps });
            if (!result.ok) {
              jsonResponse(response, result.status || 500, {
                ok: false,
                name: projectName,
                stage: result.stage,
                stderr: result.stderr,
              });
              return;
            }
            jsonResponse(response, 200, result);
          });
          return;
        }

        if (request.method === "GET" && parts.length === 2) {
          const loaded = await loadProject(projectDir);
          if (loaded.failures.length) {
            workflowFailureResponse(response, loaded.failures);
            return;
          }
          jsonResponse(response, 200, {
            ok: true,
            name: projectName,
            project: loaded.project,
            workflowRun: loaded.workflowRun,
          });
          return;
        }

        if (parts.length === 3 && parts[2] === "packaging-plan") {
          const planPath = path.join(projectDir, "packaging-plan.json");
          const manifestName = `${projectName}.json`;
          const manifestPath = path.join(composerRoot, "manifests", manifestName);

          if (request.method === "GET") {
            const loadedPlan = await loadPackagingPlanForProject({ composerRoot, projectName });
            if (!loadedPlan.ok) {
              jsonResponse(response, loadedPlan.status, { ok: false, error: loadedPlan.error });
              return;
            }
            jsonResponse(response, 200, {
              ok: true,
              name: projectName,
              source: loadedPlan.source,
              plan: withSourceVideoPreviewUrl(loadedPlan.plan, projectName, { previewBasePath }),
            });
            return;
          }

          if (request.method === "PUT") {
            const body = await readJsonBody(request);
            await withProjectLock(projectName, async () => {
              const result = await savePackagingPlanForProject({ composerRoot, projectName, plan: body });
              if (!result.ok) {
                jsonResponse(response, result.status, { error: result.error, failures: result.failures });
                return;
              }
              jsonResponse(response, 200, {
                ok: true,
                name: projectName,
                manifestName: projectName,
                path: result.path,
                planPath: result.planPath,
              });
            });
            return;
          }
        }

        if (request.method === "POST" && parts.length === 3 && parts[2] === "templates") {
          const body = await readJsonBody(request);
          const loadedPlan = await loadPackagingPlanForProject({ composerRoot, projectName });
          if (!loadedPlan.ok) {
            jsonResponse(response, loadedPlan.status, { ok: false, error: loadedPlan.error });
            return;
          }
          const templateId = sanitizeProjectName(body.id || body.name || `${projectName}-${Date.now()}`);
          if (!templateId) {
            jsonResponse(response, 400, { ok: false, error: "template id is empty or invalid after sanitization" });
            return;
          }
          const template = extractTemplate(loadedPlan.plan, {
            id: templateId,
            name: body.name || templateId,
            description: body.description || "",
          });
          const validation = validateTemplate(template);
          if (validation.failures.length) {
            jsonResponse(response, 422, { error: "template validation failed", failures: validation.failures });
            return;
          }
          const templatePath = path.join(templatesRoot, `${templateId}.json`);
          if ((await pathExists(templatePath)) && body.overwrite !== true) {
            jsonResponse(response, 409, { ok: false, error: `template "${templateId}" already exists; pass overwrite:true to replace it` });
            return;
          }
          await writeJsonAtomically(templatePath, template);
          jsonResponse(response, 200, { ok: true, templateId, template });
          return;
        }

        if (request.method === "POST" && parts.length === 3 && parts[2] === "apply-template") {
          const body = await readJsonBody(request);
          const templateId = safeProjectNameFromPath(body.templateId);
          if (!templateId) {
            jsonResponse(response, 400, { ok: false, error: "templateId is required" });
            return;
          }
          const templatePath = path.join(templatesRoot, `${templateId}.json`);
          if (!(await pathExists(templatePath))) {
            jsonResponse(response, 404, { ok: false, error: "template not found" });
            return;
          }
          const template = JSON.parse(await fs.readFile(templatePath, "utf8"));
          const templateValidation = validateTemplate(template);
          if (templateValidation.failures.length) {
            jsonResponse(response, 422, { error: "template validation failed", failures: templateValidation.failures });
            return;
          }
          const loadedPlan = await loadPackagingPlanForProject({ composerRoot, projectName });
          if (!loadedPlan.ok) {
            jsonResponse(response, loadedPlan.status, { ok: false, error: loadedPlan.error });
            return;
          }
          const inputs = {
            projectId: projectName,
            duration: loadedPlan.plan.duration,
            source: loadedPlan.plan.source,
            segments: loadedPlan.plan.tracks.card.map((card, index) => ({
              id: card.id,
              kind: `card-${index + 1}`,
              start: card.timeline.start,
              duration: card.timeline.duration,
              content: card.content,
              media: card.media,
            })),
            output: loadedPlan.plan.output,
            hyperframesEntry: loadedPlan.plan.hyperframesEntry,
            ...(body.inputs || {}),
          };
          let plan;
          try {
            plan = applyTemplate(template, inputs);
          } catch (error) {
            jsonResponse(response, 422, { error: "template application failed", failures: [error.message || String(error)] });
            return;
          }
          await withProjectLock(projectName, async () => {
            const result = await savePackagingPlanForProject({ composerRoot, projectName, plan });
            if (!result.ok) {
              jsonResponse(response, result.status, { error: result.error, failures: result.failures });
              return;
            }
            jsonResponse(response, 200, {
              ok: true,
              name: projectName,
              manifestName: projectName,
            });
          });
          return;
        }

        if (request.method === "POST" && parts.length === 4 && parts[2] === "stages") {
          const stageId = parts[3];
          const body = await readJsonBody(request);
          await withProjectLock(projectName, async () => {
            const loaded = await loadProject(projectDir);
            if (loaded.failures.length) {
              workflowFailureResponse(response, loaded.failures);
              return;
            }
            if (!loaded.workflowRun) {
              workflowFailureResponse(response, ["workflow-run.json is missing"]);
              return;
            }
            const now = isoNow();
            let result;
            if (body.action === "advance" || body.action === "resume") {
              result = advance(loaded.workflowRun, { now });
            } else if (body.action === "checkpoint") {
              result = addCheckpoint(loaded.workflowRun, {
                id: body.checkpointId || `${stageId}-${Date.now()}`,
                stageId,
                notes: body.notes || "",
              }, { now });
            } else if (body.action === "run") {
              result = runStage(loaded.workflowRun, stageId, now);
            } else {
              const nextStatus = body.status || null;
              if (!nextStatus) {
                jsonResponse(response, 400, { ok: false, failures: ["status or action is required"] });
                return;
              }
              result = setStageState(loaded.workflowRun, stageId, nextStatus, { now });
            }
            if (result.failures.length) {
              workflowFailureResponse(response, result.failures);
              return;
            }
            await saveWorkflowProject(projectDir, loaded.project, result.value, now);
            jsonResponse(response, 200, {
              ok: true,
              name: projectName,
              workflowRun: result.value,
            });
          });
          return;
        }

        if (request.method === "POST" && parts.length === 5 && parts[2] === "checkpoints" && parts[4] === "approve") {
          await withProjectLock(projectName, async () => {
            const loaded = await loadProject(projectDir);
            if (loaded.failures.length) {
              workflowFailureResponse(response, loaded.failures);
              return;
            }
            if (!loaded.workflowRun) {
              workflowFailureResponse(response, ["workflow-run.json is missing"]);
              return;
            }
            const now = isoNow();
            const result = approveCheckpoint(loaded.workflowRun, parts[3], { now });
            if (result.failures.length) {
              workflowFailureResponse(response, result.failures);
              return;
            }
            await saveWorkflowProject(projectDir, loaded.project, result.value, now);
            jsonResponse(response, 200, {
              ok: true,
              name: projectName,
              workflowRun: result.value,
            });
          });
          return;
        }
      }

      if (parts[0] === "manifests" && parts.length === 2) {
        const name = safeManifestName(parts[1]);
        if (!name) {
          jsonResponse(response, 400, { error: "invalid manifest name" });
          return;
        }

        if (request.method === "GET") {
          jsonResponse(response, 200, await readManifest(composerRoot, name));
          return;
        }

        if (request.method === "PUT") {
          const manifest = await readJsonBody(request);
          const manifestPath = path.join(composerRoot, "manifests", name);
          const failures = validateManifest(manifest, { root: composerRoot, manifestPath });
          if (failures.length) {
            jsonResponse(response, 422, { error: "manifest validation failed", failures });
            return;
          }
          await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
          jsonResponse(response, 200, { ok: true, path: manifestPath });
          return;
        }
      }

      if (request.method === "POST" && parts[0] === "compose" && parts.length === 2) {
        const name = safeManifestName(parts[1]);
        if (!name) {
          jsonResponse(response, 400, { error: "invalid manifest name" });
          return;
        }
        const { result, htmlPath } = await composeManifest({ composerRoot, logDir, runScript, name });
        const status = result.code === 0 ? 200 : 500;
        jsonResponse(response, status, {
          ok: result.code === 0,
          name: publicManifestName(name),
          code: result.code,
          output: result.stdout,
          stdout: result.stdout,
          stderr: result.stderr,
          logPath: result.logPath,
          htmlPath,
          previewUrl: getPreviewUrl(htmlPath, { composerRoot, previewBasePath }),
        });
        return;
      }

      if (request.method === "POST" && parts[0] === "render" && parts.length === 2) {
        const name = safeManifestName(parts[1]);
        if (!name) {
          jsonResponse(response, 400, { error: "invalid manifest name" });
          return;
        }
        const body = await readJsonBody(request);
        const renderValidation = validateRenderOptions(body);
        if (renderValidation.failures.length) {
          jsonResponse(response, 422, { ok: false, failures: renderValidation.failures });
          return;
        }
        const projectName = publicManifestName(name);
        await withProjectLock(projectName, async () => {
          const rendered = await renderManifest({ composerRoot, logDir, runScript, name, renderOptions: renderValidation.options });
          const status = rendered.result.code === 0 ? 200 : 500;
          jsonResponse(response, status, {
            ok: rendered.result.code === 0,
            name: projectName,
            code: rendered.result.code,
            mp4Path: rendered.mp4Path,
            ...(rendered.result.code === 0 ? { previewUrl: getPreviewUrl(rendered.mp4Path, { composerRoot, previewBasePath }) } : {}),
            stdout: rendered.result.stdout,
            stderr: rendered.result.stderr,
            output: rendered.result.stdout,
            logPath: rendered.result.logPath,
            composeLogPath: rendered.composed.result.logPath,
            stage: rendered.renderSkipped ? "compose" : "render",
          });
        });
        return;
      }

      if (request.method === "POST" && (url.pathname === "/lint" || parts[0] === "lint")) {
        let body = {};
        if (request.headers["content-length"] !== "0" && !parts[1]) body = await readJsonBody(request);
        const name = safeManifestName(parts[1] || body.name);
        if (!name) {
          jsonResponse(response, 400, { error: "manifest name required", failures: ["manifest name required"] });
          return;
        }
        const manifestPath = path.join(composerRoot, "manifests", name);
        const manifest = await readManifest(composerRoot, name);
        const failures = validateManifest(manifest, { root: composerRoot, manifestPath });
        jsonResponse(response, 200, { ok: failures.length === 0, failures });
        return;
      }

      if (request.method === "POST" && (url.pathname === "/inspect" || parts[0] === "inspect")) {
        let body = {};
        if (request.headers["content-length"] !== "0" && !parts[1]) body = await readJsonBody(request);
        const name = safeManifestName(parts[1] || body.name);
        if (!name) {
          jsonResponse(response, 400, { error: "manifest name required" });
          return;
        }
        const composed = await composeManifest({ composerRoot, logDir, runScript, name });
        if (composed.result.code !== 0) {
          jsonResponse(response, 500, {
            ok: false,
            name: publicManifestName(name),
            code: composed.result.code,
            output: composed.result.stdout,
            stdout: composed.result.stdout,
            stderr: composed.result.stderr,
            logPath: composed.result.logPath,
            htmlPath: composed.htmlPath,
            previewUrl: getPreviewUrl(composed.htmlPath, { composerRoot, previewBasePath }),
          });
          return;
        }
        const result = await runAndLog({ runScript, logDir, script: "inspect", args: [] });
        jsonResponse(response, 200, {
          ok: result.code === 0,
          name: publicManifestName(name),
          code: result.code,
          output: result.stdout,
          stdout: result.stdout,
          stderr: result.stderr,
          logPath: result.logPath,
          composeLogPath: composed.result.logPath,
          htmlPath: composed.htmlPath,
          previewUrl: getPreviewUrl(composed.htmlPath, { composerRoot, previewBasePath }),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/route-a/run") {
        const body = await readJsonBody(request);

        const check = await validateVideoPath(body.sourceVideoPath, importRoots);
        if (!check.ok) {
          jsonResponse(response, check.status, { ok: false, stderr: check.stderr });
          return;
        }
        const sourceVideoPath = check.realPath;

        const topic = typeof body.topic === "string" ? body.topic.trim() : "";
        const approvedScript = typeof body.approvedScript === "string" ? body.approvedScript.trim() : "";
        if (!topic && !approvedScript) {
          jsonResponse(response, 400, { ok: false, stderr: "topic or approvedScript is required" });
          return;
        }
        if (body.name !== undefined && !sanitizeProjectName(body.name)) {
          jsonResponse(response, 400, { ok: false, stderr: "name is empty or invalid after sanitization" });
          return;
        }

        const name = sanitizeProjectName(body.name) || (await deriveProjectName(sourceVideoPath));
        if (!name) {
          jsonResponse(response, 400, { ok: false, stderr: "project name could not be derived" });
          return;
        }

        const finalManifestPath = path.join(composerRoot, "manifests", `${name}.json`);
        if (body.overwrite !== true && (await pathExists(finalManifestPath))) {
          jsonResponse(response, 409, {
            ok: false,
            stderr: `manifest "${name}" already exists; pass overwrite:true to replace it`,
          });
          return;
        }

        await withProjectLock(name, async () => {
          const projectDir = projectDirForName(composerRoot, name);
          const projectExisted = await pathExists(projectDir);
          const voiceReference = normalizeVoiceReference(body.voiceReference);
          const inputs = {
            sourceVideoPath,
            topic: topic || undefined,
            approvedScript: approvedScript || undefined,
            voiceReference,
          };
          const now = isoNow();
          const logLines = [`sourceVideoPath=${sourceVideoPath}`, `name=${name}`, `projectDir=${projectDir}`];
          try {
            const result = await routeAWorkflow({
              projectId: name,
              name,
              workdir: projectDir,
              sourceVideoPath,
              topic: topic || undefined,
              approvedScript: approvedScript || undefined,
              voiceReference,
              composerRoot,
              ttsBaseUrl: env.COSYVOICE3_MASTER_API_BASE_URL,
              duixBaseUrl: env.DUIX_API_BASE_URL,
            });
            ensureWorkflowResultIsPublishable(result, "route-a workflow");
            const created = result.project
              ? { project: result.project, workflowRun: result.workflowRun, failures: [] }
              : createProjectFromRecipe("digital-human-talking-head", inputs, { projectId: name, name, now });
            if (created.failures.length) {
              throw new Error(`route-a project metadata failed:\n${created.failures.join("\n")}`);
            }
            const workflowRun = result.workflowRun || created.workflowRun;
            await saveWorkflowProject(projectDir, created.project, workflowRun, now);

            let manifestName;
            if (result.ok && result.outputs?.manifestPath) {
              const published = await publishManifestAtomically({
                composerRoot,
                manifestName: name,
                sourceManifestPath: result.outputs.manifestPath,
              });
              manifestName = name;
              logLines.push(`manifest=${published.finalManifestPath}`, `scenes=${published.manifest.scenes.length}`);
            } else if (result.blocked) {
              logLines.push(`blockedStage=${result.stageId || "unknown"}`);
            }
            const logPath = await writeRouteALog(logDir, name, `${logLines.join("\n")}\n`);
            jsonResponse(response, 200, {
              ok: true,
              name,
              workflowRun,
              ...(manifestName ? { manifestName } : {}),
              logPath,
            });
          } catch (error) {
            await fs.rm(path.join(composerRoot, "manifests", `.${name}.route-a-${process.pid}.json.tmp`), { force: true });
            if (!projectExisted) await fs.rm(projectDir, { recursive: true, force: true });
            const logPath = await writeRouteALog(logDir, name, error.stack || error.message || String(error));
            jsonResponse(response, 500, {
              ok: false,
              stderr: error.message || String(error),
              logPath,
            });
          }
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/product-intro/run") {
        const body = await readJsonBody(request);

        const check = await validateVideoPath(body.sourceVideoPath, importRoots);
        if (!check.ok) {
          jsonResponse(response, check.status, { ok: false, stderr: check.stderr });
          return;
        }
        const sourceVideoPath = check.realPath;

        const productName = normalizeRequiredText(body.productName, "productName");
        if (!productName.ok) {
          jsonResponse(response, 400, { ok: false, stderr: productName.stderr });
          return;
        }
        const productDescription = normalizeRequiredText(body.productDescription, "productDescription");
        if (!productDescription.ok) {
          jsonResponse(response, 400, { ok: false, stderr: productDescription.stderr });
          return;
        }
        const sellingPoints = normalizeSellingPoints(body.sellingPoints);
        if (!sellingPoints.ok) {
          jsonResponse(response, 400, { ok: false, stderr: sellingPoints.stderr });
          return;
        }
        const productMedia = await validateProductMediaPaths(body.productMedia, importRoots);
        if (!productMedia.ok) {
          jsonResponse(response, productMedia.status, { ok: false, stderr: productMedia.stderr });
          return;
        }
        if (body.name !== undefined && !sanitizeProjectName(body.name)) {
          jsonResponse(response, 400, { ok: false, stderr: "name is empty or invalid after sanitization" });
          return;
        }

        const name = sanitizeProjectName(body.name) || (await deriveProjectName(sourceVideoPath));
        if (!name) {
          jsonResponse(response, 400, { ok: false, stderr: "project name could not be derived" });
          return;
        }

        const finalManifestPath = path.join(composerRoot, "manifests", `${name}.json`);
        if (body.overwrite !== true && (await pathExists(finalManifestPath))) {
          jsonResponse(response, 409, {
            ok: false,
            stderr: `manifest "${name}" already exists; pass overwrite:true to replace it`,
          });
          return;
        }

        await withProjectLock(name, async () => {
          const projectDir = projectDirForName(composerRoot, name);
          const projectExisted = await pathExists(projectDir);
          const voiceReference = normalizeVoiceReference(body.voiceReference);
          const inputs = {
            sourceVideoPath,
            productName: productName.value,
            productDescription: productDescription.value,
            sellingPoints: sellingPoints.value,
            productMedia: productMedia.paths,
            offerCta: typeof body.offerCta === "string" ? body.offerCta.trim() : undefined,
            voiceReference,
          };
          const now = isoNow();
          const logLines = [`sourceVideoPath=${sourceVideoPath}`, `name=${name}`, `projectDir=${projectDir}`];
          try {
            const result = await productIntroWorkflow({
              projectId: name,
              name,
              workdir: projectDir,
              sourceVideoPath,
              productName: productName.value,
              productDescription: productDescription.value,
              sellingPoints: sellingPoints.value,
              productMedia: productMedia.paths,
              offerCta: inputs.offerCta,
              voiceReference,
              composerRoot,
              ttsBaseUrl: env.COSYVOICE3_MASTER_API_BASE_URL,
              duixBaseUrl: env.DUIX_API_BASE_URL,
            });
            ensureWorkflowResultIsPublishable(result, "product-intro workflow");
            const created = result.project
              ? { project: result.project, workflowRun: result.workflowRun, failures: [] }
              : createProjectFromRecipe("digital-human-product-introduction", inputs, { projectId: name, name, now });
            if (created.failures.length) {
              throw new Error(`product-intro project metadata failed:\n${created.failures.join("\n")}`);
            }
            const workflowRun = result.workflowRun || created.workflowRun;
            await saveWorkflowProject(projectDir, created.project, workflowRun, now);

            let manifestName;
            if (result.ok && result.outputs?.manifestPath) {
              const published = await publishManifestAtomically({
                composerRoot,
                manifestName: name,
                sourceManifestPath: result.outputs.manifestPath,
              });
              manifestName = name;
              logLines.push(`manifest=${published.finalManifestPath}`, `scenes=${published.manifest.scenes.length}`);
            } else if (result.blocked) {
              logLines.push(`blockedStage=${result.stageId || "unknown"}`);
            }
            const logPath = await writeProductIntroLog(logDir, name, `${logLines.join("\n")}\n`);
            jsonResponse(response, 200, {
              ok: true,
              name,
              workflowRun,
              ...(manifestName ? { manifestName } : {}),
              logPath,
            });
          } catch (error) {
            await fs.rm(path.join(composerRoot, "manifests", `.${name}.route-a-${process.pid}.json.tmp`), { force: true });
            if (!projectExisted) await fs.rm(projectDir, { recursive: true, force: true });
            const logPath = await writeProductIntroLog(logDir, name, error.stack || error.message || String(error));
            jsonResponse(response, 500, {
              ok: false,
              stderr: error.message || String(error),
              logPath,
            });
          }
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/route-b/import") {
        const body = await readJsonBody(request);

        // Boundary check before anything touches ffprobe/ffmpeg.
        const check = await validateVideoPath(body.videoPath, importRoots);
        if (!check.ok) {
          jsonResponse(response, check.status, { ok: false, stderr: check.stderr });
          return;
        }
        const videoPath = check.realPath;

        if (body.name !== undefined && !sanitizeProjectName(body.name)) {
          jsonResponse(response, 400, { ok: false, stderr: "name is empty or invalid after sanitization" });
          return;
        }
        const manifestName = sanitizeProjectName(body.name) || (await deriveProjectName(videoPath));
        if (!manifestName) {
          jsonResponse(response, 400, { ok: false, stderr: "manifest name could not be derived" });
          return;
        }

        const finalManifestPath = path.join(composerRoot, "manifests", `${manifestName}.json`);
        if (body.overwrite !== true && (await pathExists(finalManifestPath))) {
          jsonResponse(response, 409, {
            ok: false,
            stderr: `manifest "${manifestName}" already exists; pass overwrite:true to replace it`,
          });
          return;
        }
        if (importsInFlight.has(manifestName)) {
          jsonResponse(response, 409, { ok: false, stderr: `an import for "${manifestName}" is already in progress` });
          return;
        }

        importsInFlight.add(manifestName);
        try {
          await withProjectLock(manifestName, async () => {
            const result = await routeBImporter({
              videoPath,
              name: manifestName,
              composerRoot,
              logDir,
              env,
              runScript,
            });
            const now = isoNow();
            const created = createProjectFromRecipe("existing-narrated-video", { videoPath, manifestName }, { projectId: result.manifestName, name: result.manifestName, now });
            if (created.failures.length) {
              throw new Error(`route-b project metadata failed:\n${created.failures.join("\n")}`);
            }
            const completed = completeWorkflowRun(created.workflowRun, now);
            if (completed.failures.length) {
              throw new Error(`route-b workflow-run failed:\n${completed.failures.join("\n")}`);
            }
            await saveWorkflowProject(projectDirForName(composerRoot, result.manifestName), created.project, completed.value, now);
            jsonResponse(response, 200, {
              ok: true,
              manifestName: result.manifestName,
              scenes: result.scenes,
              logPath: result.logPath,
            });
          });
        } catch (error) {
          const logPath = await writeRouteBLog(logDir, manifestName || "unknown", error.stack || error.message || String(error));
          jsonResponse(response, 500, {
            ok: false,
            stderr: error.message || String(error),
            logPath,
          });
        } finally {
          importsInFlight.delete(manifestName);
        }
        return;
      }

      jsonResponse(response, 404, { error: "not found" });
    } catch (error) {
      if (error.code === "ENOENT") {
        jsonResponse(response, 404, { error: "not found" });
        return;
      }
      jsonResponse(response, error.status || 500, { error: error.message || "internal server error" });
    }
  };
}

export function loadEnvFiles(files) {
  const env = {};
  for (const file of files) {
    try {
      const content = fsSync.readFileSync(file, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
        if (!match) continue;
        env[match[1]] = match[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return env;
}
