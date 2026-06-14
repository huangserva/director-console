import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

import { createApiServer, defaultRouteBImporter, getImportRoots, validateVideoPath } from "../src/server.mjs";
import { advance, createProjectFromRecipe, setStageState } from "../../../packages/protocol/src/index.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const composerRoot = path.join(repoRoot, "hyperframes-composer");
const manifestsDir = path.join(composerRoot, "manifests");
const testManifestName = `api-test-${process.pid}.json`;
const testManifestPath = path.join(manifestsDir, testManifestName);
const testRenderPath = path.join(composerRoot, "render", `${testManifestName.replace(/\.json$/, "")}.mp4`);
const testProjectDir = path.join(composerRoot, "projects", testManifestName.replace(/\.json$/, ""));
const routeBManifestName = `route-b-api-${process.pid}`;
const routeBManifestPath = path.join(manifestsDir, `${routeBManifestName}.json`);
const routeBProjectDir = path.join(composerRoot, "projects", routeBManifestName);
const m2ProjectName = `m2-project-${process.pid}`;
const m2ProjectDir = path.join(composerRoot, "projects", m2ProjectName);
const m2RunProjectName = `m2-run-project-${process.pid}`;
const m2RunProjectDir = path.join(composerRoot, "projects", m2RunProjectName);
const m2BlockedProjectName = `m2-blocked-project-${process.pid}`;
const m2BlockedProjectDir = path.join(composerRoot, "projects", m2BlockedProjectName);
const m2ConcurrentProjectName = `m2-concurrent-project-${process.pid}`;
const m2ConcurrentProjectDir = path.join(composerRoot, "projects", m2ConcurrentProjectName);
const routeAProjectName = `route-a-api-${process.pid}`;
const routeAManifestPath = path.join(manifestsDir, `${routeAProjectName}.json`);
const routeAProjectDir = path.join(composerRoot, "projects", routeAProjectName);
const routeABlockedProjectName = `route-a-blocked-${process.pid}`;
const routeABlockedManifestPath = path.join(manifestsDir, `${routeABlockedProjectName}.json`);
const routeABlockedProjectDir = path.join(composerRoot, "projects", routeABlockedProjectName);
const routeANonServiceBlockedName = `route-a-non-service-blocked-${process.pid}`;
const routeANonServiceBlockedProjectDir = path.join(composerRoot, "projects", routeANonServiceBlockedName);
const routeAFailedPublishName = `route-a-failed-publish-${process.pid}`;
const routeAFailedPublishManifestPath = path.join(manifestsDir, `${routeAFailedPublishName}.json`);
const routeAFailedPublishProjectDir = path.join(composerRoot, "projects", routeAFailedPublishName);
const productIntroProjectName = `product-intro-api-${process.pid}`;
const productIntroManifestPath = path.join(manifestsDir, `${productIntroProjectName}.json`);
const productIntroProjectDir = path.join(composerRoot, "projects", productIntroProjectName);
const productIntroBlockedProjectName = `product-intro-blocked-${process.pid}`;
const productIntroBlockedManifestPath = path.join(manifestsDir, `${productIntroBlockedProjectName}.json`);
const productIntroBlockedProjectDir = path.join(composerRoot, "projects", productIntroBlockedProjectName);
const productIntroNonServiceBlockedName = `product-intro-non-service-blocked-${process.pid}`;
const productIntroNonServiceBlockedProjectDir = path.join(composerRoot, "projects", productIntroNonServiceBlockedName);
const productIntroFailedPublishName = `product-intro-failed-publish-${process.pid}`;
const productIntroFailedPublishManifestPath = path.join(manifestsDir, `${productIntroFailedPublishName}.json`);
const productIntroFailedPublishProjectDir = path.join(composerRoot, "projects", productIntroFailedPublishName);
const packagingPlanProjectName = `packaging-plan-${process.pid}`;
const packagingPlanManifestPath = path.join(manifestsDir, `${packagingPlanProjectName}.json`);
const packagingPlanProjectDir = path.join(composerRoot, "projects", packagingPlanProjectName);
const mediaPreviewProjectName = `media-preview-${process.pid}`;
const mediaPreviewManifestPath = path.join(manifestsDir, `${mediaPreviewProjectName}.json`);
const mediaPreviewProjectDir = path.join(composerRoot, "projects", mediaPreviewProjectName);
const previewHtmlProjectName = `preview-html-${process.pid}`;
const previewHtmlManifestPath = path.join(manifestsDir, `${previewHtmlProjectName}.json`);
const previewHtmlProjectDir = path.join(composerRoot, "projects", previewHtmlProjectName);
const browserPreviewProjectName = `preview-browser-${process.pid}`;
const browserPreviewManifestPath = path.join(manifestsDir, `${browserPreviewProjectName}.json`);
const browserPreviewProjectDir = path.join(composerRoot, "projects", browserPreviewProjectName);
const templateId = `packaging-template-${process.pid}`;
const badTemplateId = `bad-template-${process.pid}`;
const templatesDir = path.join(repoRoot, "templates");
const applyTemplateProjectName = `apply-template-${process.pid}`;
const applyTemplateManifestPath = path.join(manifestsDir, `${applyTemplateProjectName}.json`);
const applyTemplateProjectDir = path.join(composerRoot, "projects", applyTemplateProjectName);
const recaptionProjectName = `recaption-${process.pid}`;
const recaptionManifestPath = path.join(manifestsDir, `${recaptionProjectName}.json`);
const recaptionProjectDir = path.join(composerRoot, "projects", recaptionProjectName);
const noAudioProjectName = `recaption-no-audio-${process.pid}`;
const noAudioManifestPath = path.join(manifestsDir, `${noAudioProjectName}.json`);
const noAudioProjectDir = path.join(composerRoot, "projects", noAudioProjectName);
const skillAdapterProjectName = `skill-adapter-${process.pid}`;
const skillAdapterManifestPath = path.join(manifestsDir, `${skillAdapterProjectName}.json`);
const skillAdapterProjectDir = path.join(composerRoot, "projects", skillAdapterProjectName);
const fromScriptProjectName = `from-script-${process.pid}`;
const fromScriptManifestPath = path.join(manifestsDir, `${fromScriptProjectName}.json`);
const fromScriptProjectDir = path.join(composerRoot, "projects", fromScriptProjectName);
const fromScriptLongProjectName = `from-script-long-${process.pid}`;
const fromScriptLongManifestPath = path.join(manifestsDir, `${fromScriptLongProjectName}.json`);
const fromScriptLongProjectDir = path.join(composerRoot, "projects", fromScriptLongProjectName);

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function titleCardManifest(overrides = {}) {
  return {
    compositionId: "api-test",
    duration: 2,
    output: `index-${process.pid}.html`,
    hyperframesEntry: `index-${process.pid}.html`,
    scenes: [
      {
        id: "s001-title",
        component: "TitleCard",
        scene_type: "title_card",
        start: 0,
        duration: 2,
        props: {
          cornerLeft: "TEST",
          cornerName: "Console",
          kicker: "M0",
          title: "API",
          subline: "Thin wrapper",
        },
      },
    ],
    ...overrides,
  };
}

function productIntroManifest(overrides = {}) {
  return titleCardManifest({
    compositionId: "product-intro-api",
    output: `projects/${productIntroProjectName}/index.html`,
    hyperframesEntry: `projects/${productIntroProjectName}/index.html`,
    scenes: [
      {
        id: "p001-product",
        component: "StepCard",
        scene_type: "step_card",
        start: 0,
        duration: 2,
        props: {
          kicker: "PRODUCT HIGHLIGHT",
          title: "Director Console",
          items: ["产品脚本", "数字人口播", "可编辑包装"],
        },
      },
      {
        id: "p002-cta",
        component: "SummaryCta",
        scene_type: "summary_cta",
        start: 2,
        duration: 2,
        finePieces: ["CleanArollOverlay"],
        props: {
          media: { presenter: `projects/${productIntroProjectName}/presenter.mp4` },
          chip: "CTA",
          title: "Director Console",
          subline: "立即生成产品介绍",
        },
      },
    ],
    ...overrides,
  });
}

async function writeSkillOutputFixture(root) {
  await fs.mkdir(path.join(root, "data"), { recursive: true });
  await fs.mkdir(path.join(root, "assets"), { recursive: true });
  await fs.mkdir(path.join(root, "production", "audio"), { recursive: true });
  await fs.writeFile(path.join(root, "assets", "source.mp4"), "source-video");
  await fs.writeFile(path.join(root, "assets", "screen-codex-prompt.jpg"), "screen");
  await fs.writeFile(path.join(root, "assets", "duix-prompt-pip.mp4"), "pip");
  await fs.writeFile(path.join(root, "production", "audio", "master.wav"), "audio");
  await fs.writeFile(
    path.join(root, "production", "audio", "captions.json"),
    JSON.stringify({ captions: [{ start: 0.1, end: 1.2, text: "字幕一" }] }, null, 2),
  );
  await fs.writeFile(
    path.join(root, "data", "scene-map-390.json"),
    JSON.stringify(
      {
        source: "assets/source.mp4",
        duration: 6,
        scenes: [
          { id: "s001", start: 0, end: 2, component: "TitleCard", scene_type: "title_card", title: "开场", asset_slot: "none" },
          {
            id: "s002",
            start: 2,
            end: 6,
            component: "ScreenWithPip",
            scene_type: "screen_demo_pip",
            title: "演示",
            asset_slot: "screen_prompt_plus_duix_pip",
          },
        ],
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(root, "data", "asset-manifest.json"),
    JSON.stringify(
      {
        assets: {
          screen_prompt_plus_duix_pip: {
            type: "screen_recording_with_duix_pip",
            path: "assets/missing.mp4",
            example_path: "assets/duix-prompt-pip.mp4",
          },
        },
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(root, "data", "audio-manifest.json"),
    JSON.stringify(
      {
        items: {
          master_audio: { path: "production/audio/master.wav" },
          caption_timeline: { path: "production/audio/captions.json" },
        },
      },
      null,
      2,
    ),
  );
}

function completeFakeWorkflowRun(name, inputs, recipeId = "digital-human-talking-head") {
  const created = createProjectFromRecipe(recipeId, inputs, { projectId: name, name, now: "2026-06-12T00:00:00.000Z" });
  let workflowRun = created.workflowRun;
  for (const stage of workflowRun.stages) {
    workflowRun = advance(workflowRun, { now: "2026-06-12T00:00:00.000Z" }).value;
    workflowRun = setStageState(workflowRun, stage.id, "running", { now: "2026-06-12T00:00:00.000Z" }).value;
    workflowRun = setStageState(workflowRun, stage.id, "succeeded", { now: "2026-06-12T00:00:00.000Z" }).value;
  }
  return { project: created.project, workflowRun };
}

function blockedFakeWorkflowRun(name, inputs, recipeId = "digital-human-talking-head") {
  const created = createProjectFromRecipe(recipeId, inputs, { projectId: name, name, now: "2026-06-12T00:00:00.000Z" });
  const scriptStageId = created.workflowRun.stages[0].id;
  let workflowRun = advance(created.workflowRun, { now: "2026-06-12T00:00:00.000Z" }).value;
  workflowRun = setStageState(workflowRun, scriptStageId, "running", { now: "2026-06-12T00:00:00.000Z" }).value;
  workflowRun = setStageState(workflowRun, scriptStageId, "succeeded", { now: "2026-06-12T00:00:00.000Z" }).value;
  workflowRun = advance(workflowRun, { now: "2026-06-12T00:00:00.000Z" }).value;
  workflowRun = setStageState(workflowRun, "tts", "running", { now: "2026-06-12T00:00:00.000Z" }).value;
  workflowRun = setStageState(workflowRun, "tts", "needs-review", { now: "2026-06-12T00:00:00.000Z" }).value;
  workflowRun.errors.push({ stageId: "tts", code: "SERVICE_UNAVAILABLE", message: "CosyVoice3 service is unavailable" });
  return { project: created.project, workflowRun };
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://${address.address}:${address.port}`;
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

async function rawRequest(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  return {
    status: response.status,
    headers: response.headers,
    text: await response.text(),
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` }));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function connectChromePage(chromePort) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const response = await fetch(`http://127.0.0.1:${chromePort}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("timed out waiting for Chrome debugging target");
}

async function probePreviewVideoInChrome(url) {
  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!fsSync.existsSync(chromePath)) return { skipped: "Google Chrome is not installed" };
  const chromePort = 9340;
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-chrome-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--autoplay-policy=no-user-gesture-required",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );
  try {
    const websocketUrl = await connectChromePage(chromePort);
    const websocket = new WebSocket(websocketUrl);
    await new Promise((resolve, reject) => {
      websocket.addEventListener("open", resolve, { once: true });
      websocket.addEventListener("error", reject, { once: true });
    });
    let nextId = 1;
    const pending = new Map();
    const requests = [];
    const eventWaiters = new Map();
    websocket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
      if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
      if (eventWaiters.has(message.method)) {
        for (const resolve of eventWaiters.get(message.method)) resolve(message.params);
        eventWaiters.delete(message.method);
      }
    });
    const send = (method, params = {}) => {
      const id = nextId;
      nextId += 1;
      websocket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    };
    const once = (method, timeoutMs = 15000) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), timeoutMs);
        const done = (params) => {
          clearTimeout(timer);
          resolve(params);
        };
        eventWaiters.set(method, [...(eventWaiters.get(method) || []), done]);
      });

    await send("Page.enable");
    await send("Network.enable");
    await send("Runtime.enable");
    const loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url });
    await loaded;
    const probe = (
      await send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression: `new Promise((resolve) => {
          const video = document.querySelector('#source-video-background-layer');
          const audio = document.querySelector('#audio');
          if (video) {
            video.muted = true;
            video.preload = 'auto';
            video.load();
            video.play().catch(() => {});
          }
          const started = Date.now();
          function tick() {
            if (video && video.readyState >= 2 && video.videoWidth > 0) {
              resolve({
                readyState: video.readyState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                currentSrc: video.currentSrc,
                audioSrc: audio ? audio.currentSrc : null,
              });
              return;
            }
            if (Date.now() - started > 15000) {
              resolve({
                timeout: true,
                readyState: video ? video.readyState : null,
                videoWidth: video ? video.videoWidth : null,
                currentSrc: video ? video.currentSrc : null,
                audioSrc: audio ? audio.currentSrc : null,
              });
              return;
            }
            setTimeout(tick, 200);
          }
          tick();
        })`,
      })
    ).result.value;
    websocket.close();
    return { probe, requests };
  } finally {
    chrome.kill("SIGTERM");
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

async function withHttpProbeServer(handler, fn) {
  const probe = http.createServer(handler);
  const baseUrl = await listen(probe);
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve) => probe.close(resolve));
  }
}

describe("console-api", () => {
  let server;
  let baseUrl;
  let logDir;
  let fixtureDir;
  let fixtureRoot;
  let fixtureVideo;
  let fixtureImage;
  let fixtureWav;
  let digitalHumansDir;
  let digitalHumanTargetDir;
  let digitalHumanVideo;
  let digitalHumanLink;
  let digitalHumanNeighborVideo;
  let unboundVideo;
  let providerConfigPath;
  let providerEnvPath;
  let originalIndexHtml;
  const scriptCalls = [];

  before(async () => {
    originalIndexHtml = await fs.readFile(path.join(composerRoot, "index.html"), "utf8");
    await fs.writeFile(testManifestPath, `${JSON.stringify(titleCardManifest(), null, 2)}\n`);
    logDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-logs-"));
    // A real allowed import root with a real (fake-content) video file, so
    // validateVideoPath (realpath + allowlist) passes for the happy-path tests.
    fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-import-"));
    fixtureRoot = await fs.realpath(fixtureDir);
    fixtureVideo = path.join(fixtureRoot, "finished.mp4");
    fixtureImage = path.join(fixtureRoot, "screen.png");
    fixtureWav = path.join(fixtureRoot, "voice.wav");
    await fs.writeFile(fixtureVideo, "fake video bytes");
    await fs.writeFile(fixtureImage, "fake image bytes");
    await fs.writeFile(fixtureWav, "fake wav bytes");
    await fs.mkdir(path.join(fixtureRoot, "Clips"));
    await fs.mkdir(path.join(fixtureRoot, "audio"));
    await fs.writeFile(path.join(fixtureRoot, "B.MOV"), "fake mov bytes");
    await fs.writeFile(path.join(fixtureRoot, "notes.txt"), "notes");
    await fs.writeFile(path.join(fixtureRoot, ".hidden.mp4"), "hidden");
    digitalHumansDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-digital-humans-"));
    digitalHumanTargetDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-digital-human-target-"));
    digitalHumanVideo = path.join(digitalHumanTargetDir, "duix-prompt-pip.mp4");
    digitalHumanNeighborVideo = path.join(digitalHumanTargetDir, "not-in-library.mp4");
    digitalHumanLink = path.join(digitalHumansDir, "duix-prompt-pip.mp4");
    await fs.writeFile(digitalHumanVideo, "fake digital human video");
    await fs.writeFile(digitalHumanNeighborVideo, "fake neighboring video");
    await fs.symlink(digitalHumanVideo, digitalHumanLink);
    unboundVideo = path.join(fixtureRoot, "unbound.mp4");
    await fs.writeFile(unboundVideo, "fake unbound media");
    providerConfigPath = path.join(fixtureRoot, "provider-config.json");
    providerEnvPath = path.join(fixtureRoot, ".env.local");
    server = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        digitalHumansRoot: digitalHumansDir,
        providerConfigPath,
        providerEnvPath,
        runScript: async ({ script, args }) => {
          scriptCalls.push({ script, args });
          if (script === "compose") {
            const manifestArg = args.at(-1);
            const manifest = JSON.parse(await fs.readFile(path.join(composerRoot, manifestArg), "utf8"));
            const htmlPath = path.join(composerRoot, manifest.output || `index-${process.pid}.html`);
            let captionHtml = "";
            if (manifest.audio?.captions) {
              const captionsPath = path.isAbsolute(manifest.audio.captions)
                ? manifest.audio.captions
                : path.join(composerRoot, manifest.audio.captions);
              const captions = JSON.parse(await fs.readFile(captionsPath, "utf8")).captions || [];
              captionHtml = captions.map((caption) => `<span>${caption.text}</span>`).join("");
            }
            await fs.mkdir(path.dirname(htmlPath), { recursive: true });
            await fs.writeFile(htmlPath, `<!doctype html><title>composed</title>${captionHtml}`);
          }
          if (script === "render") {
            const outputIndex = args.indexOf("--output");
            if (outputIndex >= 0 && args[outputIndex + 1]) {
              await fs.mkdir(path.dirname(path.join(composerRoot, args[outputIndex + 1])), { recursive: true });
              await fs.writeFile(path.join(composerRoot, args[outputIndex + 1]), "fake mp4 bytes");
            }
          }
          return {
            code: script === "lint" ? 1 : 0,
            stdout: `ran ${script} ${args.join(" ")}`,
            stderr: "",
          };
        },
        routeBImporter: async ({ videoPath, name, composerRoot, logDir }) => {
          const projectDir = path.join(composerRoot, "projects", name);
          await fs.mkdir(path.join(projectDir, "audio"), { recursive: true });
          await fs.writeFile(path.join(projectDir, "audio", "asr.wav"), "fake wav", "utf8");
          await fs.writeFile(
            path.join(projectDir, "captions.json"),
            JSON.stringify({ captions: [{ start: 0, end: 1, text: "caption", asr_text: "caption" }] }, null, 2),
            "utf8",
          );
          await fs.writeFile(path.join(projectDir, "transcript.json"), JSON.stringify({ text: "caption", segments: [] }), "utf8");
          await fs.writeFile(path.join(projectDir, "scene-plan.json"), JSON.stringify({ scenes: [{ id: "s001" }] }), "utf8");
          const manifest = titleCardManifest({
            compositionId: name,
            source: {
              video: videoPath,
            },
            output: `projects/${name}/index.html`,
            hyperframesEntry: `projects/${name}/index.html`,
            audio: {
              src: `projects/${name}/audio/asr.wav`,
              captions: `projects/${name}/captions.json`,
            },
          });
          await fs.writeFile(path.join(composerRoot, "manifests", `${name}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
          const logPath = path.join(logDir, `${name}.route-b.log`);
          await fs.writeFile(logPath, `video=${videoPath}\n`, "utf8");
          return { ok: true, manifestName: name, scenes: manifest.scenes.length, logPath };
        },
      }),
    );
    baseUrl = await listen(server);
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(testManifestPath, { force: true });
    await fs.rm(routeBManifestPath, { force: true });
    await fs.rm(routeBProjectDir, { recursive: true, force: true });
    await fs.rm(m2ProjectDir, { recursive: true, force: true });
    await fs.rm(m2RunProjectDir, { recursive: true, force: true });
    await fs.rm(m2BlockedProjectDir, { recursive: true, force: true });
    await fs.rm(m2ConcurrentProjectDir, { recursive: true, force: true });
    await fs.rm(routeAManifestPath, { force: true });
    await fs.rm(routeAProjectDir, { recursive: true, force: true });
    await fs.rm(routeABlockedManifestPath, { force: true });
    await fs.rm(routeABlockedProjectDir, { recursive: true, force: true });
    await fs.rm(routeANonServiceBlockedProjectDir, { recursive: true, force: true });
    await fs.rm(routeAFailedPublishManifestPath, { force: true });
    await fs.rm(routeAFailedPublishProjectDir, { recursive: true, force: true });
    await fs.rm(productIntroManifestPath, { force: true });
    await fs.rm(productIntroProjectDir, { recursive: true, force: true });
    await fs.rm(productIntroBlockedManifestPath, { force: true });
    await fs.rm(productIntroBlockedProjectDir, { recursive: true, force: true });
    await fs.rm(productIntroNonServiceBlockedProjectDir, { recursive: true, force: true });
    await fs.rm(productIntroFailedPublishManifestPath, { force: true });
    await fs.rm(productIntroFailedPublishProjectDir, { recursive: true, force: true });
    await fs.rm(packagingPlanManifestPath, { force: true });
    await fs.rm(packagingPlanProjectDir, { recursive: true, force: true });
    await fs.rm(mediaPreviewManifestPath, { force: true });
    await fs.rm(mediaPreviewProjectDir, { recursive: true, force: true });
    await fs.rm(previewHtmlManifestPath, { force: true });
    await fs.rm(previewHtmlProjectDir, { recursive: true, force: true });
    await fs.rm(browserPreviewManifestPath, { force: true });
    await fs.rm(browserPreviewProjectDir, { recursive: true, force: true });
    await fs.rm(path.join(templatesDir, `${templateId}.json`), { force: true });
    await fs.rm(path.join(templatesDir, `${badTemplateId}.json`), { force: true });
    await fs.rm(applyTemplateManifestPath, { force: true });
    await fs.rm(applyTemplateProjectDir, { recursive: true, force: true });
    await fs.rm(recaptionManifestPath, { force: true });
    await fs.rm(recaptionProjectDir, { recursive: true, force: true });
    await fs.rm(noAudioManifestPath, { force: true });
    await fs.rm(noAudioProjectDir, { recursive: true, force: true });
    await fs.rm(skillAdapterManifestPath, { force: true });
    await fs.rm(skillAdapterProjectDir, { recursive: true, force: true });
    await fs.rm(fromScriptManifestPath, { force: true });
    await fs.rm(fromScriptProjectDir, { recursive: true, force: true });
    await fs.rm(fromScriptLongManifestPath, { force: true });
    await fs.rm(fromScriptLongProjectDir, { recursive: true, force: true });
    await fs.rm(path.join(composerRoot, `index-${process.pid}.html`), { force: true });
    await fs.rm(testRenderPath, { force: true });
    await fs.rm(testProjectDir, { recursive: true, force: true });
    await fs.writeFile(path.join(composerRoot, "index.html"), originalIndexHtml, "utf8");
    await fs.rm(logDir, { recursive: true, force: true });
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.rm(digitalHumansDir, { recursive: true, force: true });
    await fs.rm(digitalHumanTargetDir, { recursive: true, force: true });
    // Clean any manifests/projects created by the security tests below.
    for (const extra of ["overwrite", "lock", "atomic-fail", "sentinel-test", "longname"]) {
      const slug = `${routeBManifestName}-${extra}`;
      await fs.rm(path.join(manifestsDir, `${slug}.json`), { force: true });
      await fs.rm(path.join(composerRoot, "projects", slug), { recursive: true, force: true });
    }
  });

  test("lists JSON manifests", async () => {
    const response = await request(baseUrl, "/manifests");

    assert.equal(response.status, 200);
    assert.ok(response.body.manifests.includes(testManifestName.replace(/\.json$/, "")));
    assert.ok(response.body.manifests.includes("memos-v3"));
  });

  test("lists an allowed local directory with directories first, video flags, and parent", async () => {
    const response = await request(baseUrl, `/fs/list?path=${encodeURIComponent(fixtureRoot)}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.path, fixtureRoot);
    assert.equal(response.body.parent, path.dirname(fixtureRoot));
    assert.deepEqual(
      response.body.entries.map((entry) => [entry.name, entry.type, entry.isVideo]),
      [
        ["audio", "dir", false],
        ["Clips", "dir", false],
        ["B.MOV", "file", true],
        ["finished.mp4", "file", true],
        ["notes.txt", "file", false],
        ["screen.png", "file", false],
        ["unbound.mp4", "file", true],
        ["voice.wav", "file", false],
      ],
    );
    assert.equal(response.body.entries.find((entry) => entry.name === "B.MOV").size, "fake mov bytes".length);
    assert.ok(response.body.entries.every((entry) => path.isAbsolute(entry.path)));
    assert.ok(!response.body.entries.some((entry) => entry.name.startsWith(".")));
  });

  test("lists HOME as the default fs starting directory when path is omitted", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        env: { HOME: fixtureRoot },
        runScript: async () => ({ code: 0, stdout: "", stderr: "" }),
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/fs/list");

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.path, fixtureRoot);
      assert.equal(response.body.parent, path.dirname(fixtureRoot));
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("rejects fs listing outside the allowlist and missing directories", async () => {
    const outside = await request(baseUrl, `/fs/list?path=${encodeURIComponent("/etc")}`);
    assert.equal(outside.status, 403);
    assert.equal(outside.body.ok, false);

    const missing = await request(baseUrl, `/fs/list?path=${encodeURIComponent(path.join(fixtureRoot, "missing"))}`);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.ok, false);

    const protocol = await request(baseUrl, `/fs/list?path=${encodeURIComponent("file:///etc")}`);
    assert.equal(protocol.status, 400);
    assert.equal(protocol.body.ok, false);

    const filePath = await request(baseUrl, `/fs/list?path=${encodeURIComponent(fixtureVideo)}`);
    assert.equal(filePath.status, 400);
    assert.equal(filePath.body.ok, false);
  });

  test("choose-native returns a single selected path from the native chooser", async () => {
    let captured;
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        nativeFileChooser: async (options) => {
          captured = options;
          return { ok: true, paths: [fixtureVideo] };
        },
        runScript: async () => ({ code: 0, stdout: "", stderr: "" }),
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/fs/choose-native", {
        method: "POST",
        body: JSON.stringify({ kind: "video", prompt: "Pick a clip" }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { ok: true, path: fixtureVideo });
      assert.deepEqual(captured, { kind: "video", multiple: false, prompt: "Pick a clip" });
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("choose-native returns multiple selected paths", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        nativeFileChooser: async () => ({ ok: true, paths: [fixtureVideo, fixtureWav] }),
        runScript: async () => ({ code: 0, stdout: "", stderr: "" }),
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/fs/choose-native", {
        method: "POST",
        body: JSON.stringify({ kind: "any", multiple: true }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { ok: true, paths: [fixtureVideo, fixtureWav] });
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("choose-native maps user cancellation without treating it as an error", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        nativeFileChooser: async () => ({ ok: false, canceled: true }),
        runScript: async () => ({ code: 0, stdout: "", stderr: "" }),
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/fs/choose-native", {
        method: "POST",
        body: JSON.stringify({ kind: "wav" }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { ok: false, canceled: true });
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("providers API redacts key values and persists non-secret config separately from .env.local", async () => {
    await fs.writeFile(providerEnvPath, "OPENAI_IMAGE_API_KEY=existing-secret\n", "utf8");
    await fs.writeFile(
      providerConfigPath,
      JSON.stringify(
        {
          image: {
            enabled: true,
            endpoint: "https://image.example.test/v1",
            apiKeyEnvVar: "OPENAI_IMAGE_API_KEY",
            extra: { model: "image-v1" },
          },
        },
        null,
        2,
      ),
    );

    const listed = await request(baseUrl, "/providers");
    assert.equal(listed.status, 200);
    const image = listed.body.providers.find((provider) => provider.id === "image");
    assert.equal(image.endpoint, "https://image.example.test/v1");
    assert.equal(image.apiKeyEnvVar, "OPENAI_IMAGE_API_KEY");
    assert.equal(image.isKeySet, true);
    assert.equal("apiKeyValue" in image, false);
    assert.equal(JSON.stringify(listed.body).includes("existing-secret"), false);

    const updated = await request(baseUrl, "/providers/image", {
      method: "PUT",
      body: JSON.stringify({
        enabled: true,
        endpoint: "https://image2.example.test/v1",
        apiKeyEnvVar: "OPENAI_IMAGE_API_KEY",
        apiKeyValue: "new-secret",
        proxy: "http://127.0.0.1:7890",
        extra: { model: "image-v2" },
      }),
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.provider.endpoint, "https://image2.example.test/v1");
    assert.equal(updated.body.provider.isKeySet, true);
    assert.equal(JSON.stringify(updated.body).includes("new-secret"), false);
    const persisted = JSON.parse(await fs.readFile(providerConfigPath, "utf8"));
    assert.equal(persisted.image.endpoint, "https://image2.example.test/v1");
    assert.equal(persisted.image.proxy, "http://127.0.0.1:7890");
    assert.equal(JSON.stringify(persisted).includes("new-secret"), false);
    assert.match(await fs.readFile(providerEnvPath, "utf8"), /OPENAI_IMAGE_API_KEY="?new-secret"?/);
  });

  test("providers API validates ids and endpoint shapes", async () => {
    const missing = await request(baseUrl, "/providers/not-a-provider", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(missing.status, 404);

    const invalidEndpoint = await request(baseUrl, "/providers/tts", {
      method: "PUT",
      body: JSON.stringify({ enabled: true, baseUrl: "file:///tmp/tts" }),
    });
    assert.equal(invalidEndpoint.status, 422);
    assert.match(invalidEndpoint.body.error, /baseUrl/);
  });

  test("providers API rejects dangerous secret env var names", async () => {
    await fs.writeFile(providerEnvPath, "", "utf8");
    const response = await request(baseUrl, "/providers/image", {
      method: "PUT",
      body: JSON.stringify({
        enabled: true,
        endpoint: "https://image.example.test/v1",
        apiKeyEnvVar: "PATH",
        apiKeyValue: "malicious",
      }),
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.ok, false);
    assert.match(response.body.error, /apiKeyEnvVar/);
    assert.equal((await fs.readFile(providerEnvPath, "utf8")).includes("malicious"), false);
    assert.equal((await fs.readFile(providerEnvPath, "utf8")).includes("PATH="), false);
  });

  test("provider health-check reports up, down, and unconfigured states without throwing", async () => {
    await withHttpProbeServer(
      (req, res) => {
        if (req.url === "/health") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        res.writeHead(404);
        res.end();
      },
      async (probeBaseUrl) => {
        const configured = await request(baseUrl, "/providers/tts", {
          method: "PUT",
          body: JSON.stringify({ enabled: true, baseUrl: probeBaseUrl }),
        });
        assert.equal(configured.status, 200);

        const up = await request(baseUrl, "/providers/tts/health-check", { method: "POST" });
        assert.equal(up.status, 200);
        assert.equal(up.body.ok, true);
        assert.equal(up.body.status, "up");
        assert.equal(typeof up.body.latencyMs, "number");
      },
    );

    const downConfig = await request(baseUrl, "/providers/duix", {
      method: "PUT",
      body: JSON.stringify({ enabled: true, baseUrl: "http://127.0.0.1:9" }),
    });
    assert.equal(downConfig.status, 200);
    const down = await request(baseUrl, "/providers/duix/health-check", { method: "POST" });
    assert.equal(down.status, 200);
    assert.equal(down.body.ok, false);
    assert.equal(down.body.status, "down");

    const unconfigured = await request(baseUrl, "/providers/video/health-check", { method: "POST" });
    assert.equal(unconfigured.status, 200);
    assert.equal(unconfigured.body.ok, false);
    assert.equal(unconfigured.body.status, "unconfigured");

    const invalid = await request(baseUrl, "/providers/nope/health-check", { method: "POST" });
    assert.equal(invalid.status, 404);
  });

  test("loads a manifest unchanged", async () => {
    const response = await request(baseUrl, `/manifests/${testManifestName.replace(/\.json$/, "")}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.compositionId, "api-test");
    assert.equal(response.body.scenes[0].props.title, "API");
  });

  test("saves a valid manifest after composer rule validation", async () => {
    const baseManifest = titleCardManifest();
    const nextManifest = titleCardManifest({
      scenes: [
        {
          ...baseManifest.scenes[0],
          props: { ...baseManifest.scenes[0].props, title: "Saved" },
        },
      ],
    });

    const response = await request(baseUrl, `/manifests/${testManifestName}`, {
      method: "PUT",
      body: JSON.stringify(nextManifest),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    const saved = JSON.parse(await fs.readFile(testManifestPath, "utf8"));
    assert.equal(saved.scenes[0].props.title, "Saved");
  });

  test("rejects an invalid manifest without overwriting the file", async () => {
    const beforeSave = await fs.readFile(testManifestPath, "utf8");
    const invalidManifest = titleCardManifest({
      scenes: [
        {
          ...titleCardManifest().scenes[0],
          component: "NotRegistered",
        },
      ],
    });

    const response = await request(baseUrl, `/manifests/${testManifestName}`, {
      method: "PUT",
      body: JSON.stringify(invalidManifest),
    });

    assert.equal(response.status, 422);
    assert.match(response.body.error, /manifest validation failed/);
    assert.match(response.body.failures.join("\n"), /unknown component NotRegistered/);
    assert.equal(await fs.readFile(testManifestPath, "utf8"), beforeSave);
  });

  test("rejects a valid component with illegal scene_type on save", async () => {
    const beforeSave = await fs.readFile(testManifestPath, "utf8");
    const invalidManifest = titleCardManifest({
      scenes: [
        {
          ...titleCardManifest().scenes[0],
          scene_type: "step_card",
        },
      ],
    });

    const response = await request(baseUrl, `/manifests/${testManifestName}`, {
      method: "PUT",
      body: JSON.stringify(invalidManifest),
    });

    assert.equal(response.status, 422);
    assert.match(response.body.failures.join("\n"), /scene_type step_card is not legal for TitleCard/);
    assert.equal(await fs.readFile(testManifestPath, "utf8"), beforeSave);
  });

  test("compose runs the existing npm script for the named manifest", async () => {
    const response = await request(baseUrl, `/compose/${testManifestName.replace(/\.json$/, "")}`, { method: "POST" });

    assert.equal(response.status, 200);
    assert.equal(response.body.htmlPath, path.join(composerRoot, `index-${process.pid}.html`));
    assert.equal(response.body.previewUrl, `/api/preview/index-${process.pid}.html`);
    assert.equal(response.body.output, "ran compose -- manifests/api-test-" + process.pid + ".json");
    assert.deepEqual(scriptCalls.at(-1), { script: "compose", args: ["--", `manifests/${testManifestName}`] });
    assert.ok(response.body.logPath.startsWith(logDir));
  });

  test("render composes the project manifest first, then runs the existing render script", async () => {
    const name = testManifestName.replace(/\.json$/, "");
    const response = await request(baseUrl, `/projects/${name}/render`, { method: "POST" });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.name, name);
    assert.equal(response.body.code, 0);
    assert.equal(response.body.mp4Path, path.join(composerRoot, "render", `${name}.mp4`));
    assert.equal(response.body.previewUrl, `/api/preview/render/${name}.mp4`);
    assert.match(response.body.stdout, /ran render -- --output render\//);
    assert.equal(response.body.stderr, "");
    assert.ok(response.body.logPath.startsWith(logDir));
    assert.ok(response.body.composeLogPath.startsWith(logDir));
    assert.deepEqual(scriptCalls.slice(-2), [
      { script: "compose", args: ["--", `manifests/${testManifestName}`] },
      { script: "render", args: ["--", "--output", `render/${name}.mp4`] },
    ]);
    assert.equal(await fs.readFile(response.body.mp4Path, "utf8"), "fake mp4 bytes");

    const history = await request(baseUrl, `/projects/${name}/history`);
    assert.equal(history.status, 200);
    assert.equal(history.body.entries[0].kind, "render");
    assert.equal(history.body.entries[0].artifacts.mp4Path, response.body.mp4Path);
    assert.equal(history.body.entries[0].validation.ok, true);
  });

  test("render reports render script failures without pretending success", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        runScript: async ({ script, args }) => {
          if (script === "compose") {
            const manifest = JSON.parse(await fs.readFile(path.join(composerRoot, args.at(-1)), "utf8"));
            const htmlPath = path.join(composerRoot, manifest.output || `index-${process.pid}.html`);
            await fs.mkdir(path.dirname(htmlPath), { recursive: true });
            await fs.writeFile(htmlPath, "<!doctype html><title>composed</title>");
          }
          return {
            code: script === "render" ? 1 : 0,
            stdout: `ran ${script} ${args.join(" ")}`,
            stderr: script === "render" ? "browser missing" : "",
          };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const name = testManifestName.replace(/\.json$/, "");
      const response = await request(url2, `/render/${name}`, { method: "POST" });

      assert.equal(response.status, 500);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.name, name);
      assert.equal(response.body.code, 1);
      assert.equal(response.body.mp4Path, path.join(composerRoot, "render", `${name}.mp4`));
      assert.equal(response.body.stderr, "browser missing");
      assert.ok(response.body.logPath.startsWith(logDir));
      assert.ok(response.body.composeLogPath.startsWith(logDir));
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("render responses sanitize child log control characters across the real JSON boundary", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        runScript: async ({ script, args }) => {
          if (script === "compose") {
            const manifest = JSON.parse(await fs.readFile(path.join(composerRoot, args.at(-1)), "utf8"));
            const htmlPath = path.join(composerRoot, manifest.output || `index-${process.pid}.html`);
            await fs.mkdir(path.dirname(htmlPath), { recursive: true });
            await fs.writeFile(htmlPath, "<!doctype html><title>composed</title>");
          }
          if (script === "render") {
            const outputIndex = args.indexOf("--output");
            if (outputIndex >= 0 && args[outputIndex + 1]) {
              await fs.mkdir(path.dirname(path.join(composerRoot, args[outputIndex + 1])), { recursive: true });
              await fs.writeFile(path.join(composerRoot, args[outputIndex + 1]), "fake mp4 bytes");
            }
          }
          return {
            code: 0,
            stdout: `\x1b[33mran ${script}\x1b[0m\nnext line\x00\x07`,
            stderr: "\x1b[31mwarn\x1b[0m\x00",
          };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const name = testManifestName.replace(/\.json$/, "");
      const response = await rawRequest(url2, `/render/${name}`, { method: "POST" });

      assert.equal(response.status, 200);
      const parsed = JSON.parse(response.text);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.stdout, "ran render\nnext line");
      assert.equal(parsed.stderr, "warn");
      assert.doesNotMatch(parsed.output, /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("render accepts export settings and maps them to hyperframes render flags", async () => {
    const name = testManifestName.replace(/\.json$/, "");
    const response = await request(baseUrl, `/projects/${name}/render`, {
      method: "POST",
      body: JSON.stringify({ fps: 60, quality: "high", width: 1920, height: 1080 }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.deepEqual(scriptCalls.slice(-2), [
      { script: "compose", args: ["--", `manifests/${testManifestName}`] },
      { script: "render", args: ["--", "--fps", "60", "--quality", "high", "--output", `render/${name}.mp4`] },
    ]);
  });

  test("render rejects unsupported export settings", async () => {
    const name = testManifestName.replace(/\.json$/, "");
    const response = await request(baseUrl, `/projects/${name}/render`, {
      method: "POST",
      body: JSON.stringify({ fps: 29, quality: "lossless", width: 111, height: 222 }),
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.ok, false);
    assert.match(response.body.failures.join("\n"), /fps must be one of/);
    assert.match(response.body.failures.join("\n"), /quality must be one of/);
    assert.match(response.body.failures.join("\n"), /resolution must be 1920x1080/);
  });

  test("render rejects 1280x720 because hyperframes render does not support that resolution preset", async () => {
    const name = testManifestName.replace(/\.json$/, "");
    const response = await request(baseUrl, `/projects/${name}/render`, {
      method: "POST",
      body: JSON.stringify({ fps: 30, quality: "draft", width: 1280, height: 720 }),
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.ok, false);
    assert.deepEqual(response.body.failures, ["resolution must be 1920x1080; hyperframes render v0.6.79 does not support 1280x720"]);
  });

  test("recaption reruns ASR from the project audio and updates captions, plan, and manifest", async () => {
    const audioRelative = `projects/${recaptionProjectName}/audio/source.wav`;
    const audioPath = path.join(composerRoot, audioRelative);
    await fs.mkdir(path.dirname(audioPath), { recursive: true });
    await fs.writeFile(audioPath, "fake wav");
    await fs.writeFile(
      recaptionManifestPath,
      `${JSON.stringify(
        titleCardManifest({
          compositionId: recaptionProjectName,
          output: `projects/${recaptionProjectName}/index.html`,
          hyperframesEntry: `projects/${recaptionProjectName}/index.html`,
          audio: { src: audioRelative },
        }),
        null,
        2,
      )}\n`,
    );

    const calls = [];
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        runScript: async () => ({ code: 0, stdout: "", stderr: "" }),
        recaptionDeps: {
          runFunasr: async (wavPath, rawOutputPath) => {
            calls.push({ wavPath, rawOutputPath });
            await fs.mkdir(path.dirname(rawOutputPath), { recursive: true });
            await fs.writeFile(
              rawOutputPath,
              JSON.stringify([{ sentence_info: [{ start: 0, end: 1250, text: "cloud code 自动生成" }] }]),
              "utf8",
            );
          },
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, `/projects/${recaptionProjectName}/recaption`, { method: "POST" });

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.name, recaptionProjectName);
      assert.equal(response.body.captionCount, 1);
      assert.equal(response.body.captionsPath, path.join(composerRoot, "projects", recaptionProjectName, "captions.json"));
      assert.equal(calls[0].wavPath, audioPath);

      const captionsPayload = JSON.parse(await fs.readFile(response.body.captionsPath, "utf8"));
      assert.deepEqual(captionsPayload.captions.map(({ start, end, text }) => ({ start, end, text })), [
        { start: 0, end: 1.25, text: "Claude Code 自动生成" },
      ]);

      const updatedManifest = JSON.parse(await fs.readFile(recaptionManifestPath, "utf8"));
      assert.equal(updatedManifest.audio.src, audioRelative);
      assert.equal(updatedManifest.audio.captions, `projects/${recaptionProjectName}/captions.json`);

      const persistedPlan = JSON.parse(await fs.readFile(path.join(recaptionProjectDir, "packaging-plan.json"), "utf8"));
      assert.equal(persistedPlan.source.audio, audioRelative);
      assert.equal(persistedPlan.source.captions, `projects/${recaptionProjectName}/captions.json`);
      assert.equal(persistedPlan.tracks.subtitle[0].src, `projects/${recaptionProjectName}/captions.json`);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("recaption reports missing project audio without running ASR", async () => {
    await fs.writeFile(
      noAudioManifestPath,
      `${JSON.stringify(
        titleCardManifest({
          compositionId: noAudioProjectName,
          output: `projects/${noAudioProjectName}/index.html`,
          hyperframesEntry: `projects/${noAudioProjectName}/index.html`,
        }),
        null,
        2,
      )}\n`,
    );
    let asrCalled = false;
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        runScript: async () => ({ code: 0, stdout: "", stderr: "" }),
        recaptionDeps: {
          runFunasr: async () => {
            asrCalled = true;
          },
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, `/projects/${noAudioProjectName}/recaption`, { method: "POST" });

      assert.equal(response.status, 422);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.stage, "resolve-audio");
      assert.match(response.body.stderr, /project has no audio source/);
      assert.equal(asrCalled, false);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("serves composed preview files from the composer directory", async () => {
    const htmlPath = path.join(composerRoot, `index-${process.pid}.html`);
    await fs.writeFile(htmlPath, "<!doctype html><title>preview</title>", "utf8");

    const response = await fetch(`${baseUrl}/api/preview/index-${process.pid}.html`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(await response.text(), "<!doctype html><title>preview</title>");
  });

  test("rejects preview path traversal and invalid encoded paths", async () => {
    const traversal = await request(baseUrl, "/api/preview/%2e%2e%2fREADME.md");
    const nullByte = await request(baseUrl, "/api/preview/%00");
    const malformed = await request(baseUrl, "/api/preview/%E0%A4%A");

    assert.equal(traversal.status, 403);
    assert.equal(nullByte.status, 400);
    assert.equal(malformed.status, 400);
  });

  test("lint validates the requested manifest and returns raw string failures", async () => {
    const valid = await request(baseUrl, "/lint", {
      method: "POST",
      body: JSON.stringify({ name: testManifestName.replace(/\.json$/, "") }),
    });

    assert.equal(valid.status, 200);
    assert.deepEqual(valid.body, { ok: true, failures: [] });
    assert.equal(scriptCalls.some((call) => call.script === "lint"), false);

    const invalidManifest = titleCardManifest({
      scenes: [
        {
          ...titleCardManifest().scenes[0],
          scene_type: "step_card",
        },
      ],
    });
    await fs.writeFile(testManifestPath, `${JSON.stringify(invalidManifest, null, 2)}\n`);

    const invalid = await request(baseUrl, `/lint/${testManifestName}`, { method: "POST" });

    assert.equal(invalid.status, 200);
    assert.equal(invalid.body.ok, false);
    assert.ok(Array.isArray(invalid.body.failures));
    assert.match(invalid.body.failures.join("\n"), /scene_type step_card is not legal for TitleCard/);

    await fs.writeFile(testManifestPath, `${JSON.stringify(titleCardManifest(), null, 2)}\n`);
  });

  test("inspect composes the requested manifest before running inspect", async () => {
    const inspect = await request(baseUrl, "/inspect", {
      method: "POST",
      body: JSON.stringify({ name: testManifestName.replace(/\.json$/, "") }),
    });

    assert.equal(inspect.status, 200);
    assert.equal(inspect.body.name, testManifestName.replace(/\.json$/, ""));
    assert.equal(inspect.body.output, "ran inspect ");
    assert.deepEqual(scriptCalls.slice(-2), [
      { script: "compose", args: ["--", `manifests/${testManifestName}`] },
      { script: "inspect", args: [] },
    ]);
    assert.ok((await fs.readdir(logDir)).some((name) => name.includes("inspect")));
  });

  test("inspect also accepts the manifest name in the path", async () => {
    const inspect = await request(baseUrl, `/inspect/${testManifestName}`, { method: "POST" });

    assert.equal(inspect.status, 200);
    assert.equal(inspect.body.name, testManifestName.replace(/\.json$/, ""));
    assert.deepEqual(scriptCalls.slice(-2), [
      { script: "compose", args: ["--", `manifests/${testManifestName}`] },
      { script: "inspect", args: [] },
    ]);
  });

  test("route-b import creates a managed project manifest and artifacts", async () => {
    const response = await request(baseUrl, "/route-b/import", {
      method: "POST",
      body: JSON.stringify({ videoPath: fixtureVideo, name: routeBManifestName }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      ok: true,
      manifestName: routeBManifestName,
      scenes: 1,
      logPath: path.join(logDir, `${routeBManifestName}.route-b.log`),
    });

    const manifest = JSON.parse(await fs.readFile(routeBManifestPath, "utf8"));
    assert.deepEqual(manifest.source, { video: fixtureVideo });
    assert.equal(manifest.audio.src, `projects/${routeBManifestName}/audio/asr.wav`);
    assert.equal(manifest.audio.captions, `projects/${routeBManifestName}/captions.json`);
    await fs.access(path.join(routeBProjectDir, "audio", "asr.wav"));
    await fs.access(path.join(routeBProjectDir, "captions.json"));
    const project = JSON.parse(await fs.readFile(path.join(routeBProjectDir, "project.json"), "utf8"));
    const workflowRun = JSON.parse(await fs.readFile(path.join(routeBProjectDir, "workflow-run.json"), "utf8"));
    assert.equal(project.id, routeBManifestName);
    assert.equal(project.recipeId, "existing-narrated-video");
    assert.equal(project.workflowRunId, workflowRun.id);
    assert.deepEqual(new Set(workflowRun.stages.map((stage) => stage.status)), new Set(["succeeded"]));
    assert.equal(typeof workflowRun.updatedAt, "string");

    const history = await request(baseUrl, `/projects/${routeBManifestName}/history`);
    assert.equal(history.status, 200);
    assert.equal(history.body.entries[0].kind, "import");
    assert.equal(history.body.entries[0].artifacts.manifestPath, routeBManifestPath);
    assert.equal(history.body.entries[0].validation.ok, true);

    const list = await request(baseUrl, "/manifests");
    assert.ok(list.body.manifests.includes(routeBManifestName));
  });

  test("route-a run persists workflow metadata and atomically publishes a successful manifest", async () => {
    const calls = [];
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        routeAWorkflow: async (options) => {
          calls.push(options);
          await fs.mkdir(options.workdir, { recursive: true });
          const manifestPath = path.join(options.workdir, "manifest.json");
          const htmlPath = path.join(options.workdir, "index.html");
          const manifest = titleCardManifest({
            compositionId: options.name,
            output: `projects/${options.name}/index.html`,
            hyperframesEntry: `projects/${options.name}/index.html`,
          });
          await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
          await fs.writeFile(htmlPath, "<!doctype html><title>route-a</title>");
          const { project, workflowRun } = completeFakeWorkflowRun(options.name, {
            sourceVideoPath: options.sourceVideoPath,
            topic: options.topic,
            voiceReference: options.voiceReference,
          });
          return { ok: true, project, workflowRun, outputs: { manifestPath, htmlPath, scenes: 1 } };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/route-a/run", {
        method: "POST",
        body: JSON.stringify({
          sourceVideoPath: fixtureVideo,
          topic: "数字人项目",
          voiceReference: { wavPath: "/tmp/ref.wav" },
          name: routeAProjectName,
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.name, routeAProjectName);
      assert.equal(response.body.manifestName, routeAProjectName);
      assert.equal(response.body.workflowRun.recipeId, "digital-human-talking-head");
      assert.deepEqual(new Set(response.body.workflowRun.stages.map((stage) => stage.status)), new Set(["succeeded"]));
      assert.equal(calls[0].sourceVideoPath, await fs.realpath(fixtureVideo));
      assert.equal(calls[0].workdir, routeAProjectDir);

      await fs.access(routeAManifestPath);
      const project = JSON.parse(await fs.readFile(path.join(routeAProjectDir, "project.json"), "utf8"));
      const workflowRun = JSON.parse(await fs.readFile(path.join(routeAProjectDir, "workflow-run.json"), "utf8"));
      assert.equal(project.recipeId, "digital-human-talking-head");
      assert.equal(workflowRun.id, response.body.workflowRun.id);
      const list = await request(baseUrl, "/manifests");
      assert.ok(list.body.manifests.includes(routeAProjectName));
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("route-a run persists needs-review when TTS is unavailable and does not publish a manifest", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        routeAWorkflow: async (options) => {
          const { project, workflowRun } = blockedFakeWorkflowRun(options.name, {
            sourceVideoPath: options.sourceVideoPath,
            topic: options.topic,
          });
          return {
            ok: false,
            blocked: true,
            stageId: "tts",
            project,
            workflowRun,
            result: { reason: "service_unavailable", service: "cosyvoice3" },
          };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/route-a/run", {
        method: "POST",
        body: JSON.stringify({ sourceVideoPath: fixtureVideo, topic: "服务未启动", name: routeABlockedProjectName }),
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.name, routeABlockedProjectName);
      assert.equal(response.body.manifestName, undefined);
      assert.equal(response.body.workflowRun.stages.find((stage) => stage.id === "tts").status, "needs-review");
      assert.equal(response.body.workflowRun.errors[0].code, "SERVICE_UNAVAILABLE");
      assert.equal(await fileExists(routeABlockedManifestPath), false);
      const persisted = JSON.parse(await fs.readFile(path.join(routeABlockedProjectDir, "workflow-run.json"), "utf8"));
      assert.equal(persisted.stages.find((stage) => stage.id === "tts").status, "needs-review");
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("route-a run does not treat non-service blocked results as successful needs-review", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        routeAWorkflow: async (options) => {
          await fs.mkdir(options.workdir, { recursive: true });
          await fs.writeFile(path.join(options.workdir, "partial.txt"), "partial");
          const { project, workflowRun } = blockedFakeWorkflowRun(options.name, {
            sourceVideoPath: options.sourceVideoPath,
            topic: options.topic,
          });
          return {
            ok: false,
            blocked: true,
            stageId: "tts",
            project,
            workflowRun,
            result: { reason: "invalid_input", failures: ["voice reference missing"] },
          };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/route-a/run", {
        method: "POST",
        body: JSON.stringify({ sourceVideoPath: fixtureVideo, topic: "非服务类阻塞", name: routeANonServiceBlockedName }),
      });

      assert.equal(response.status, 500);
      assert.equal(response.body.ok, false);
      assert.match(response.body.stderr, /blocked.*invalid_input/);
      assert.equal(await fileExists(routeANonServiceBlockedProjectDir), false);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("route-a run normalizes string voiceReference to an object before recording workflow inputs", async () => {
    const calls = [];
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        routeAWorkflow: async (options) => {
          calls.push(options);
          await fs.mkdir(options.workdir, { recursive: true });
          const { project, workflowRun } = blockedFakeWorkflowRun(options.name, {
            sourceVideoPath: options.sourceVideoPath,
            topic: options.topic,
            voiceReference: options.voiceReference,
          });
          return {
            ok: false,
            blocked: true,
            stageId: "tts",
            project,
            workflowRun,
            result: { reason: "service_unavailable", service: "cosyvoice3" },
          };
        },
      }),
    );
    const url2 = await listen(server2);
    const name = `route-a-voice-${process.pid}`;
    const projectDir = path.join(composerRoot, "projects", name);
    try {
      const response = await request(url2, "/route-a/run", {
        method: "POST",
        body: JSON.stringify({ sourceVideoPath: fixtureVideo, topic: "voice", voiceReference: "/tmp/ref.wav", name }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(calls[0].voiceReference, { wavPath: "/tmp/ref.wav" });
      const project = JSON.parse(await fs.readFile(path.join(projectDir, "project.json"), "utf8"));
      assert.deepEqual(project.inputs.voiceReference, { wavPath: "/tmp/ref.wav" });
    } finally {
      await new Promise((resolve) => server2.close(resolve));
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  test("route-a run cleans a newly-created project directory when manifest publication fails", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        routeAWorkflow: async (options) => {
          await fs.mkdir(options.workdir, { recursive: true });
          const manifestPath = path.join(options.workdir, "manifest.json");
          await fs.writeFile(manifestPath, JSON.stringify({ scenes: [] }), "utf8");
          const { project, workflowRun } = completeFakeWorkflowRun(options.name, {
            sourceVideoPath: options.sourceVideoPath,
            topic: options.topic,
          });
          return { ok: true, project, workflowRun, outputs: { manifestPath } };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/route-a/run", {
        method: "POST",
        body: JSON.stringify({ sourceVideoPath: fixtureVideo, topic: "publish fail", name: routeAFailedPublishName }),
      });

      assert.equal(response.status, 500);
      assert.equal(response.body.ok, false);
      assert.equal(await fileExists(routeAFailedPublishManifestPath), false);
      assert.equal(await fileExists(routeAFailedPublishProjectDir), false);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("route-a run reuses sourceVideoPath security validation", async () => {
    const invalidProtocol = await request(baseUrl, "/route-a/run", {
      method: "POST",
      body: JSON.stringify({ sourceVideoPath: "http://evil/x.mp4", topic: "x", name: "route-a-invalid" }),
    });
    const relative = await request(baseUrl, "/route-a/run", {
      method: "POST",
      body: JSON.stringify({ sourceVideoPath: "relative.mp4", topic: "x", name: "route-a-invalid" }),
    });
    const outside = await request(baseUrl, "/route-a/run", {
      method: "POST",
      body: JSON.stringify({ sourceVideoPath: "/etc/hosts", topic: "x", name: "route-a-invalid" }),
    });

    assert.equal(invalidProtocol.status, 400);
    assert.match(invalidProtocol.body.stderr, /not a URL\/protocol/);
    assert.equal(relative.status, 400);
    assert.match(relative.body.stderr, /absolute path/);
    assert.equal(outside.status, 403);
    assert.match(outside.body.stderr, /outside the allowed import roots/);
  });

  test("product-intro run persists workflow metadata and atomically publishes product manifest", async () => {
    const productMedia = path.join(fixtureRoot, "product-demo.mp4");
    await fs.writeFile(productMedia, "fake product media");
    const calls = [];
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        productIntroWorkflow: async (options) => {
          calls.push(options);
          await fs.mkdir(options.workdir, { recursive: true });
          const manifestPath = path.join(options.workdir, "manifest.json");
          const htmlPath = path.join(options.workdir, "index.html");
          await fs.writeFile(path.join(options.workdir, "presenter.mp4"), "fake presenter");
          const manifest = productIntroManifest({
            compositionId: options.name,
            output: `projects/${options.name}/index.html`,
            hyperframesEntry: `projects/${options.name}/index.html`,
            scenes: productIntroManifest().scenes.map((scene) => ({
              ...scene,
              props:
                scene.component === "SummaryCta"
                  ? { ...scene.props, media: { presenter: `projects/${options.name}/presenter.mp4` } }
                  : scene.props,
            })),
          });
          await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
          await fs.writeFile(htmlPath, "<!doctype html><title>product intro</title>");
          const { project, workflowRun } = completeFakeWorkflowRun(
            options.name,
            {
              sourceVideoPath: options.sourceVideoPath,
              productName: options.productName,
              productDescription: options.productDescription,
              sellingPoints: options.sellingPoints,
              productMedia: options.productMedia,
              offerCta: options.offerCta,
            },
            "digital-human-product-introduction",
          );
          return { ok: true, project, workflowRun, outputs: { manifestPath, htmlPath, scenes: manifest.scenes.length } };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/product-intro/run", {
        method: "POST",
        body: JSON.stringify({
          sourceVideoPath: fixtureVideo,
          productName: "Director Console",
          productDescription: "从成片到可编辑数字人产品介绍",
          sellingPoints: ["自动脚本", "DUIX 口播", "可编辑包装"],
          productMedia: [productMedia],
          offerCta: "立即生成产品介绍",
          voiceReference: "/tmp/product-ref.wav",
          name: productIntroProjectName,
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.name, productIntroProjectName);
      assert.equal(response.body.manifestName, productIntroProjectName);
      assert.equal(response.body.workflowRun.recipeId, "digital-human-product-introduction");
      assert.deepEqual(new Set(response.body.workflowRun.stages.map((stage) => stage.status)), new Set(["succeeded"]));
      assert.equal(calls[0].sourceVideoPath, await fs.realpath(fixtureVideo));
      assert.deepEqual(calls[0].productMedia, [await fs.realpath(productMedia)]);
      assert.deepEqual(calls[0].voiceReference, { wavPath: "/tmp/product-ref.wav" });
      assert.equal(calls[0].workdir, productIntroProjectDir);

      const manifest = JSON.parse(await fs.readFile(productIntroManifestPath, "utf8"));
      assert.ok(manifest.scenes.some((scene) => scene.component === "StepCard"));
      assert.ok(manifest.scenes.some((scene) => scene.component === "SummaryCta"));
      const project = JSON.parse(await fs.readFile(path.join(productIntroProjectDir, "project.json"), "utf8"));
      assert.equal(project.recipeId, "digital-human-product-introduction");
      const list = await request(baseUrl, "/manifests");
      assert.ok(list.body.manifests.includes(productIntroProjectName));
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("product-intro run persists needs-review when TTS is unavailable and does not publish a manifest", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        productIntroWorkflow: async (options) => {
          const { project, workflowRun } = blockedFakeWorkflowRun(
            options.name,
            {
              sourceVideoPath: options.sourceVideoPath,
              productName: options.productName,
              productDescription: options.productDescription,
              sellingPoints: options.sellingPoints,
            },
            "digital-human-product-introduction",
          );
          return {
            ok: false,
            blocked: true,
            stageId: "tts",
            project,
            workflowRun,
            result: { reason: "service_unavailable", service: "cosyvoice3" },
          };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/product-intro/run", {
        method: "POST",
        body: JSON.stringify({
          sourceVideoPath: fixtureVideo,
          productName: "Director Console",
          productDescription: "服务未启动时停在 needs-review",
          sellingPoints: ["可恢复"],
          name: productIntroBlockedProjectName,
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.name, productIntroBlockedProjectName);
      assert.equal(response.body.manifestName, undefined);
      assert.equal(response.body.workflowRun.stages.find((stage) => stage.id === "tts").status, "needs-review");
      assert.equal(response.body.workflowRun.errors[0].code, "SERVICE_UNAVAILABLE");
      assert.equal(await fileExists(productIntroBlockedManifestPath), false);
      const persisted = JSON.parse(await fs.readFile(path.join(productIntroBlockedProjectDir, "workflow-run.json"), "utf8"));
      assert.equal(persisted.stages.find((stage) => stage.id === "tts").status, "needs-review");
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("product-intro run does not treat non-service blocked results as successful needs-review", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        productIntroWorkflow: async (options) => {
          await fs.mkdir(options.workdir, { recursive: true });
          await fs.writeFile(path.join(options.workdir, "partial.txt"), "partial");
          const { project, workflowRun } = blockedFakeWorkflowRun(
            options.name,
            {
              sourceVideoPath: options.sourceVideoPath,
              productName: options.productName,
              productDescription: options.productDescription,
              sellingPoints: options.sellingPoints,
            },
            "digital-human-product-introduction",
          );
          return {
            ok: false,
            blocked: true,
            stageId: "tts",
            project,
            workflowRun,
            result: { reason: "invalid_input", failures: ["product script invalid"] },
          };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/product-intro/run", {
        method: "POST",
        body: JSON.stringify({
          sourceVideoPath: fixtureVideo,
          productName: "Director Console",
          productDescription: "非服务类阻塞",
          sellingPoints: ["可恢复"],
          name: productIntroNonServiceBlockedName,
        }),
      });

      assert.equal(response.status, 500);
      assert.equal(response.body.ok, false);
      assert.match(response.body.stderr, /blocked.*invalid_input/);
      assert.equal(await fileExists(productIntroNonServiceBlockedProjectDir), false);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("product-intro run cleans a newly-created project directory when manifest publication fails", async () => {
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        productIntroWorkflow: async (options) => {
          await fs.mkdir(options.workdir, { recursive: true });
          const manifestPath = path.join(options.workdir, "manifest.json");
          await fs.writeFile(manifestPath, JSON.stringify({ scenes: [] }), "utf8");
          const { project, workflowRun } = completeFakeWorkflowRun(
            options.name,
            {
              sourceVideoPath: options.sourceVideoPath,
              productName: options.productName,
              productDescription: options.productDescription,
              sellingPoints: options.sellingPoints,
            },
            "digital-human-product-introduction",
          );
          return { ok: true, project, workflowRun, outputs: { manifestPath } };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const response = await request(url2, "/product-intro/run", {
        method: "POST",
        body: JSON.stringify({
          sourceVideoPath: fixtureVideo,
          productName: "Director Console",
          productDescription: "publish fail",
          sellingPoints: ["失败清理"],
          name: productIntroFailedPublishName,
        }),
      });

      assert.equal(response.status, 500);
      assert.equal(response.body.ok, false);
      assert.equal(await fileExists(productIntroFailedPublishManifestPath), false);
      assert.equal(await fileExists(productIntroFailedPublishProjectDir), false);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("product-intro run reuses sourceVideoPath security validation", async () => {
    const invalidProtocol = await request(baseUrl, "/product-intro/run", {
      method: "POST",
      body: JSON.stringify({
        sourceVideoPath: "http://evil/x.mp4",
        productName: "P",
        productDescription: "D",
        sellingPoints: ["S"],
        name: "product-intro-invalid",
      }),
    });
    const outside = await request(baseUrl, "/product-intro/run", {
      method: "POST",
      body: JSON.stringify({
        sourceVideoPath: "/etc/hosts",
        productName: "P",
        productDescription: "D",
        sellingPoints: ["S"],
        name: "product-intro-invalid",
      }),
    });

    assert.equal(invalidProtocol.status, 400);
    assert.match(invalidProtocol.body.stderr, /not a URL\/protocol/);
    assert.equal(outside.status, 403);
    assert.match(outside.body.stderr, /outside the allowed import roots/);
  });

  test("product-intro run validates required product inputs", async () => {
    const missingName = await request(baseUrl, "/product-intro/run", {
      method: "POST",
      body: JSON.stringify({
        sourceVideoPath: fixtureVideo,
        productDescription: "D",
        sellingPoints: ["S"],
        name: "product-intro-missing-name",
      }),
    });
    const missingSellingPoints = await request(baseUrl, "/product-intro/run", {
      method: "POST",
      body: JSON.stringify({
        sourceVideoPath: fixtureVideo,
        productName: "P",
        productDescription: "D",
        sellingPoints: [],
        name: "product-intro-missing-points",
      }),
    });

    assert.equal(missingName.status, 400);
    assert.match(missingName.body.stderr, /productName is required/);
    assert.equal(missingSellingPoints.status, 400);
    assert.match(missingSellingPoints.body.stderr, /sellingPoints is required/);
  });

  test("generate from script creates an editable managed project without external media", async () => {
    const script = ["先说明为什么团队需要稳定的视频包装。", "再展示四轨编辑器如何把文字变成卡片。", "最后提醒用户可以继续绑定素材并重新渲染。"].join("\n");
    const response = await request(baseUrl, "/generate/from-script", {
      method: "POST",
      body: JSON.stringify({ script, name: fromScriptProjectName, title: "脚本生成测试" }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.name, fromScriptProjectName);
    assert.equal(response.body.manifestName, fromScriptProjectName);
    assert.ok(response.body.scenes > 0);

    const manifest = JSON.parse(await fs.readFile(fromScriptManifestPath, "utf8"));
    assert.equal(manifest.compositionId, fromScriptProjectName);
    assert.equal(manifest.source, undefined);
    assert.equal(manifest.audio, undefined);
    assert.ok(manifest.scenes.length > 0);
    assert.ok(manifest.scenes.every((scene) => ["TitleCard", "StepCard"].includes(scene.component)));

    const planResponse = await request(baseUrl, `/projects/${fromScriptProjectName}/packaging-plan`);
    assert.equal(planResponse.status, 200);
    assert.equal(planResponse.body.plan.tracks.video.length, 0);
    assert.equal(planResponse.body.plan.tracks.audio.length, 0);
    assert.equal(planResponse.body.plan.tracks.subtitle.length, 0);
    assert.ok(planResponse.body.plan.tracks.card.length > 0);

    const history = await request(baseUrl, `/projects/${fromScriptProjectName}/history`);
    assert.equal(history.status, 200);
    assert.equal(history.body.entries[0].kind, "generate");
    assert.equal(history.body.entries[0].params.title, "脚本生成测试");
    assert.equal(history.body.entries[0].validation.ok, true);
  });

  test("generate from script keeps long Chinese StepCard text within composer budgets", async () => {
    const longSentence = [
      "第一部分先铺垫业务背景并说明团队每天都需要快速完成视频包装和复盘",
      "第二部分继续解释四轨编辑器会把脚本变成可以拖拽修改的结构化卡片",
      "第三部分强调用户随后可以按需绑定画中画素材数字人视频和字幕文本",
      "第四部分收束到重新渲染和历史快照便于团队反复调整复现结果",
    ].join("，");
    const response = await request(baseUrl, "/generate/from-script", {
      method: "POST",
      body: JSON.stringify({
        script: `${longSentence}\n${longSentence}\n${longSentence}\n${longSentence}`,
        name: fromScriptLongProjectName,
        title: "长句预算测试",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.ok(response.body.scenes > 0);
    const manifest = JSON.parse(await fs.readFile(fromScriptLongManifestPath, "utf8"));
    assert.ok(manifest.scenes.some((scene) => scene.component === "StepCard"));
    assert.ok(manifest.scenes.every((scene) => ["TitleCard", "StepCard"].includes(scene.component)));
  });

  test("generate from script rejects empty and oversized scripts", async () => {
    const empty = await request(baseUrl, "/generate/from-script", {
      method: "POST",
      body: JSON.stringify({ script: "   " }),
    });
    assert.equal(empty.status, 400);
    assert.equal(empty.body.ok, false);

    const oversized = await request(baseUrl, "/generate/from-script", {
      method: "POST",
      body: JSON.stringify({ script: "字".repeat(20001), name: `${fromScriptProjectName}-too-long` }),
    });
    assert.equal(oversized.status, 413);
    assert.equal(oversized.body.ok, false);
  });

  test("generate from script rejects duplicate project names unless overwrite is explicit", async () => {
    const duplicate = await request(baseUrl, "/generate/from-script", {
      method: "POST",
      body: JSON.stringify({ script: "新的脚本内容", name: fromScriptProjectName }),
    });

    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.ok, false);
    assert.match(duplicate.body.error, /already exists/);
  });

  test("generate from script cleans partial publish when post-save artifact writes fail", async () => {
    const projectName = `${fromScriptProjectName}-post-write-fail`;
    const projectDir = path.join(composerRoot, "projects", projectName);
    const manifestPath = path.join(manifestsDir, `${projectName}.json`);
    try {
      await fs.mkdir(path.join(projectDir, "scene-plan.json"), { recursive: true });
      const response = await request(baseUrl, "/generate/from-script", {
        method: "POST",
        body: JSON.stringify({
          script: "先生成一个方案。\n再制造后置写入失败。",
          name: projectName,
          overwrite: true,
        }),
      });

      assert.equal(response.status, 500);
      assert.equal(response.body.ok, false);
      assert.equal(await fileExists(manifestPath), false);
      assert.equal(await fileExists(path.join(projectDir, "packaging-plan.json")), false);
      assert.equal(await fileExists(path.join(projectDir, "transcript.json")), false);
    } finally {
      await fs.rm(manifestPath, { force: true });
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  test("lists and loads protocol recipes", async () => {
    const list = await request(baseUrl, "/recipes");

    assert.equal(list.status, 200);
    assert.ok(list.body.recipes.some((recipe) => recipe.id === "existing-narrated-video"));
    const routeB = list.body.recipes.find((recipe) => recipe.id === "existing-narrated-video");
    assert.deepEqual(Object.keys(routeB).sort(), ["description", "id", "inputRequirements", "name", "recommendedComponents", "stages"].sort());

    const detail = await request(baseUrl, "/recipes/existing-narrated-video");
    assert.equal(detail.status, 200);
    assert.equal(detail.body.recipe.id, "existing-narrated-video");

    const missing = await request(baseUrl, "/recipes/nope");
    assert.equal(missing.status, 404);
  });

  test("creates, loads, mutates, and checkpoints workflow projects", async () => {
    const created = await request(baseUrl, "/projects", {
      method: "POST",
      body: JSON.stringify({
        recipeId: "existing-narrated-video",
        name: m2ProjectName,
        inputs: { videoPath: fixtureVideo },
      }),
    });

    assert.equal(created.status, 200);
    assert.equal(created.body.ok, true);
    assert.equal(created.body.name, m2ProjectName);
    assert.equal(created.body.project.name, m2ProjectName);
    assert.equal(created.body.workflowRun.recipeId, "existing-narrated-video");
    assert.equal(created.body.workflowRun.stages[0].status, "not-started");
    assert.equal(typeof created.body.workflowRun.startedAt, "string");
    await fs.access(path.join(m2ProjectDir, "project.json"));
    await fs.access(path.join(m2ProjectDir, "workflow-run.json"));

    const loaded = await request(baseUrl, `/projects/${m2ProjectName}`);
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.project.id, m2ProjectName);
    assert.equal(loaded.body.workflowRun.id, created.body.workflowRun.id);

    const advanced = await request(baseUrl, `/projects/${m2ProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ action: "advance" }),
    });
    assert.equal(advanced.status, 200);
    assert.equal(advanced.body.workflowRun.currentStageId, "probe");
    assert.equal(advanced.body.workflowRun.stages[0].status, "ready");

    const illegal = await request(baseUrl, `/projects/${m2ProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ status: "succeeded" }),
    });
    assert.equal(illegal.status, 422);
    assert.match(illegal.body.failures.join("\n"), /illegal stage transition ready -> succeeded/);

    const running = await request(baseUrl, `/projects/${m2ProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ status: "running" }),
    });
    assert.equal(running.status, 200);
    assert.equal(running.body.workflowRun.stages[0].status, "running");

    const withCheckpoint = await request(baseUrl, `/projects/${m2ProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ action: "checkpoint", checkpointId: "cp-probe" }),
    });
    assert.equal(withCheckpoint.status, 200);
    assert.equal(withCheckpoint.body.workflowRun.checkpoints[0].status, "open");

    const approved = await request(baseUrl, `/projects/${m2ProjectName}/checkpoints/cp-probe/approve`, { method: "POST" });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.workflowRun.checkpoints[0].status, "approved");
  });

  test("stage action run moves a stage into running across retry states", async () => {
    const created = await request(baseUrl, "/projects", {
      method: "POST",
      body: JSON.stringify({
        recipeId: "existing-narrated-video",
        name: m2RunProjectName,
        inputs: { videoPath: fixtureVideo },
      }),
    });
    assert.equal(created.status, 200);

    const fromNotStarted = await request(baseUrl, `/projects/${m2RunProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ action: "run" }),
    });
    assert.equal(fromNotStarted.status, 200);
    assert.equal(fromNotStarted.body.workflowRun.stages[0].status, "running");

    const alreadyRunning = await request(baseUrl, `/projects/${m2RunProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ action: "run" }),
    });
    assert.equal(alreadyRunning.status, 200);
    assert.equal(alreadyRunning.body.workflowRun.stages[0].status, "running");

    const succeeded = await request(baseUrl, `/projects/${m2RunProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ status: "succeeded" }),
    });
    assert.equal(succeeded.status, 200);
    assert.equal(succeeded.body.workflowRun.stages[0].status, "succeeded");

    const rerun = await request(baseUrl, `/projects/${m2RunProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ action: "run" }),
    });
    assert.equal(rerun.status, 200);
    assert.equal(rerun.body.workflowRun.stages[0].status, "running");
  });

  test("stage action run respects recipe dependencies", async () => {
    const created = await request(baseUrl, "/projects", {
      method: "POST",
      body: JSON.stringify({
        recipeId: "existing-narrated-video",
        name: m2BlockedProjectName,
        inputs: { videoPath: fixtureVideo },
      }),
    });
    assert.equal(created.status, 200);

    const blocked = await request(baseUrl, `/projects/${m2BlockedProjectName}/stages/asr`, {
      method: "POST",
      body: JSON.stringify({ action: "run" }),
    });
    assert.equal(blocked.status, 422);
    assert.deepEqual(blocked.body.failures, ['stage "asr" blocked: depends on probe (not succeeded)']);

    const unchanged = await request(baseUrl, `/projects/${m2BlockedProjectName}`);
    assert.equal(unchanged.body.workflowRun.stages.find((stage) => stage.id === "asr").status, "not-started");

    const runProbe = await request(baseUrl, `/projects/${m2BlockedProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ action: "run" }),
    });
    assert.equal(runProbe.status, 200);
    const succeedProbe = await request(baseUrl, `/projects/${m2BlockedProjectName}/stages/probe`, {
      method: "POST",
      body: JSON.stringify({ status: "succeeded" }),
    });
    assert.equal(succeedProbe.status, 200);

    const runAsr = await request(baseUrl, `/projects/${m2BlockedProjectName}/stages/asr`, {
      method: "POST",
      body: JSON.stringify({ action: "run" }),
    });
    assert.equal(runAsr.status, 200);
    assert.equal(runAsr.body.workflowRun.stages.find((stage) => stage.id === "asr").status, "running");
  });

  test("concurrent same-project mutations are serialized without losing updates", async () => {
    const created = await request(baseUrl, "/projects", {
      method: "POST",
      body: JSON.stringify({
        recipeId: "existing-narrated-video",
        name: m2ConcurrentProjectName,
        inputs: { videoPath: fixtureVideo },
      }),
    });
    assert.equal(created.status, 200);

    const checkpointIds = Array.from({ length: 8 }, (_, index) => `cp-${index}`);
    const results = await Promise.all(
      checkpointIds.map((checkpointId) =>
        request(baseUrl, `/projects/${m2ConcurrentProjectName}/stages/probe`, {
          method: "POST",
          body: JSON.stringify({ action: "checkpoint", checkpointId }),
        }),
      ),
    );

    assert.ok(results.every((result) => result.status === 200));
    const loaded = await request(baseUrl, `/projects/${m2ConcurrentProjectName}`);
    assert.deepEqual(
      loaded.body.workflowRun.checkpoints.map((checkpoint) => checkpoint.id).sort(),
      checkpointIds.sort(),
    );
  });

  test("gets a packaging plan synthesized from an existing manifest when no plan is persisted", async () => {
    const manifest = titleCardManifest({
      compositionId: packagingPlanProjectName,
      source: {
        video: fixtureVideo,
      },
      output: `projects/${packagingPlanProjectName}/index.html`,
      hyperframesEntry: `projects/${packagingPlanProjectName}/index.html`,
    });
    await fs.writeFile(packagingPlanManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.rm(path.join(packagingPlanProjectDir, "packaging-plan.json"), { force: true });

    const response = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`);

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.name, packagingPlanProjectName);
    assert.equal(response.body.plan.projectId, packagingPlanProjectName);
    assert.deepEqual(Object.keys(response.body.plan.tracks).sort(), ["audio", "card", "subtitle", "video"].sort());
    assert.equal(response.body.plan.source.video, fixtureVideo);
    assert.equal(response.body.plan.source.videoUrl, `/api/preview/source/${packagingPlanProjectName}`);
    assert.equal(response.body.plan.tracks.video[0].previewUrl, `/api/preview/source/${packagingPlanProjectName}`);
    assert.equal(response.body.plan.tracks.card.length, manifest.scenes.length);
    assert.equal(response.body.plan.tracks.card[0].engine.component, "TitleCard");
    assert.equal(response.body.source, "manifest");
  });

  test("streams project source video with HTTP Range support and path validation", async () => {
    const manifest = titleCardManifest({
      compositionId: packagingPlanProjectName,
      source: {
        video: fixtureVideo,
      },
      output: `projects/${packagingPlanProjectName}/index.html`,
      hyperframesEntry: `projects/${packagingPlanProjectName}/index.html`,
    });
    await fs.writeFile(packagingPlanManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.rm(path.join(packagingPlanProjectDir, "packaging-plan.json"), { force: true });

    const ranged = await rawRequest(baseUrl, `/preview/source/${packagingPlanProjectName}`, {
      headers: { range: "bytes=0-3" },
    });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get("content-type"), "video/mp4");
    assert.equal(ranged.headers.get("accept-ranges"), "bytes");
    assert.equal(ranged.headers.get("content-range"), "bytes 0-3/16");
    assert.equal(ranged.text, "fake");

    const full = await rawRequest(baseUrl, `/preview/source/${packagingPlanProjectName}`);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("content-type"), "video/mp4");
    assert.equal(full.text, "fake video bytes");

    const relativeName = `${packagingPlanProjectName}-relative-source`;
    const relativeProjectDir = path.join(composerRoot, "projects", relativeName);
    await fs.mkdir(path.join(relativeProjectDir, "media"), { recursive: true });
    await fs.writeFile(path.join(relativeProjectDir, "media", "source.mp4"), "managed source video");
    await fs.writeFile(
      path.join(manifestsDir, `${relativeName}.json`),
      `${JSON.stringify(
        titleCardManifest({
          compositionId: relativeName,
          source: { video: `projects/${relativeName}/media/source.mp4` },
          output: `projects/${relativeName}/index.html`,
          hyperframesEntry: `projects/${relativeName}/index.html`,
        }),
        null,
        2,
      )}\n`,
    );
    const relativeRanged = await rawRequest(baseUrl, `/preview/source/${relativeName}`, {
      headers: { range: "bytes=0-6" },
    });
    assert.equal(relativeRanged.status, 206);
    assert.equal(relativeRanged.headers.get("content-type"), "video/mp4");
    assert.equal(relativeRanged.headers.get("content-range"), "bytes 0-6/20");
    assert.equal(relativeRanged.text, "managed");

    const relativeTextName = `${packagingPlanProjectName}-relative-text-source`;
    const relativeTextProjectDir = path.join(composerRoot, "projects", relativeTextName);
    await fs.mkdir(path.join(relativeTextProjectDir, "media"), { recursive: true });
    await fs.writeFile(path.join(relativeTextProjectDir, "media", "source.txt"), "not a video");
    await fs.writeFile(
      path.join(manifestsDir, `${relativeTextName}.json`),
      `${JSON.stringify(
        titleCardManifest({
          compositionId: relativeTextName,
          source: { video: `projects/${relativeTextName}/media/source.txt` },
        }),
        null,
        2,
      )}\n`,
    );
    const relativeText = await request(baseUrl, `/preview/source/${relativeTextName}`);
    assert.equal(relativeText.status, 400);
    assert.match(relativeText.body.error, /unsupported source video type/);

    const relativeEscapeName = `${packagingPlanProjectName}-relative-escape`;
    await fs.writeFile(
      path.join(manifestsDir, `${relativeEscapeName}.json`),
      `${JSON.stringify(
        titleCardManifest({
          compositionId: relativeEscapeName,
          source: { video: `projects/${relativeEscapeName}/../${relativeName}/media/source.mp4` },
        }),
        null,
        2,
      )}\n`,
    );
    const relativeEscape = await request(baseUrl, `/preview/source/${relativeEscapeName}`);
    assert.equal(relativeEscape.status, 403);

    const noSourceName = `${packagingPlanProjectName}-no-source`;
    await fs.writeFile(path.join(manifestsDir, `${noSourceName}.json`), `${JSON.stringify(titleCardManifest({ compositionId: noSourceName }), null, 2)}\n`);
    const noSource = await request(baseUrl, `/preview/source/${noSourceName}`);
    assert.equal(noSource.status, 404);

    const outsideName = `${packagingPlanProjectName}-outside`;
    await fs.writeFile(
      path.join(manifestsDir, `${outsideName}.json`),
      `${JSON.stringify(titleCardManifest({ compositionId: outsideName, source: { video: "/etc/hosts" } }), null, 2)}\n`,
    );
    const outside = await request(baseUrl, `/preview/source/${outsideName}`);
    assert.equal(outside.status, 403);
    await fs.rm(path.join(manifestsDir, `${relativeName}.json`), { force: true });
    await fs.rm(relativeProjectDir, { recursive: true, force: true });
    await fs.rm(path.join(manifestsDir, `${relativeTextName}.json`), { force: true });
    await fs.rm(relativeTextProjectDir, { recursive: true, force: true });
    await fs.rm(path.join(manifestsDir, `${relativeEscapeName}.json`), { force: true });
    await fs.rm(path.join(manifestsDir, `${noSourceName}.json`), { force: true });
    await fs.rm(path.join(manifestsDir, `${outsideName}.json`), { force: true });
  });

  test("streams bound card media with HTTP Range support and path validation", async () => {
    const manifest = titleCardManifest({
      compositionId: mediaPreviewProjectName,
      output: `projects/${mediaPreviewProjectName}/index.html`,
      hyperframesEntry: `projects/${mediaPreviewProjectName}/index.html`,
      scenes: [
        {
          id: "pip-card",
          component: "ScreenWithPip",
          scene_type: "screen_demo_pip",
          start: 0,
          duration: 2,
          props: {
            label: "画中画",
            media: { screen: fixtureImage, pip: fixtureVideo },
          },
        },
      ],
    });
    await fs.writeFile(mediaPreviewManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const ranged = await rawRequest(baseUrl, `/api/preview/media?path=${encodeURIComponent(fixtureVideo)}`, {
      headers: { range: "bytes=0-3" },
    });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get("content-type"), "video/mp4");
    assert.equal(ranged.headers.get("accept-ranges"), "bytes");
    assert.equal(ranged.headers.get("content-range"), "bytes 0-3/16");
    assert.equal(ranged.text, "fake");

    const image = await rawRequest(baseUrl, `/api/preview/media?path=${encodeURIComponent(fixtureImage)}`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.equal(image.text, "fake image bytes");

    const symlinkedDigitalHuman = await rawRequest(baseUrl, `/api/preview/media?path=${encodeURIComponent(digitalHumanLink)}`, {
      headers: { range: "bytes=0-3" },
    });
    assert.equal(symlinkedDigitalHuman.status, 206);
    assert.equal(symlinkedDigitalHuman.headers.get("content-type"), "video/mp4");
    assert.equal(symlinkedDigitalHuman.headers.get("content-range"), "bytes 0-3/24");
    assert.equal(symlinkedDigitalHuman.text, "fake");

    const unbound = await request(baseUrl, `/api/preview/media?path=${encodeURIComponent(unboundVideo)}`);
    assert.equal(unbound.status, 403);
    assert.equal(unbound.body.ok, false);

    const digitalHumanNeighbor = await request(baseUrl, `/api/preview/media?path=${encodeURIComponent(digitalHumanNeighborVideo)}`);
    assert.equal(digitalHumanNeighbor.status, 403);
    assert.equal(digitalHumanNeighbor.body.ok, false);

    const outside = await request(baseUrl, `/api/preview/media?path=${encodeURIComponent("/etc/hosts")}`);
    assert.equal(outside.status, 403);
    assert.equal(outside.body.ok, false);

    const missing = await request(baseUrl, `/api/preview/media?path=${encodeURIComponent(path.join(fixtureRoot, "missing.mp4"))}`);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.ok, false);
  });

  test("lists digital human assets with serviceable media URLs", async () => {
    const response = await request(baseUrl, "/api/assets/digital-humans");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.deepEqual(response.body.assets, [
      {
        id: "duix-prompt-pip",
        name: "duix-prompt-pip.mp4",
        url: `/api/preview/media?path=${encodeURIComponent(digitalHumanLink)}`,
      },
    ]);
  });

  test("adds serviceable mediaUrls for bound card media in packaging-plan responses", async () => {
    const manifest = titleCardManifest({
      compositionId: mediaPreviewProjectName,
      output: `projects/${mediaPreviewProjectName}/index.html`,
      hyperframesEntry: `projects/${mediaPreviewProjectName}/index.html`,
      scenes: [
        {
          id: "pip-card",
          component: "ScreenWithPip",
          scene_type: "screen_demo_pip",
          start: 0,
          duration: 2,
          props: {
            label: "画中画",
            media: { screen: fixtureImage, pip: digitalHumanLink },
          },
        },
      ],
    });
    await fs.writeFile(mediaPreviewManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.rm(path.join(mediaPreviewProjectDir, "packaging-plan.json"), { force: true });

    const response = await request(baseUrl, `/projects/${mediaPreviewProjectName}/packaging-plan`);

    assert.equal(response.status, 200);
    const card = response.body.plan.tracks.card[0];
    assert.deepEqual(card.media, { screen: fixtureImage, pip: digitalHumanLink });
    assert.deepEqual(card.mediaUrls, {
      screen: `/api/preview/media?path=${encodeURIComponent(fixtureImage)}`,
      pip: `/api/preview/media?path=${encodeURIComponent(digitalHumanLink)}`,
    });
  });

  test("imports a structured skill output bundle as a console project", async () => {
    const skillOutputDir = path.join(fixtureRoot, "skill-output");
    await writeSkillOutputFixture(skillOutputDir);

    const response = await request(baseUrl, "/projects/from-skill-output", {
      method: "POST",
      body: JSON.stringify({ skillOutputPath: skillOutputDir, name: skillAdapterProjectName }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.name, skillAdapterProjectName);
    assert.equal(response.body.manifestName, skillAdapterProjectName);
    assert.equal(response.body.summary.scenes, 2);
    assert.equal(response.body.summary.cards, 2);
    assert.equal(response.body.summary.captions, 1);
    assert.equal(response.body.summary.mediaBindings.screen, 1);
    assert.equal(response.body.summary.mediaBindings.pip, 1);
    assert.equal(response.body.handoff.source.audio, `projects/${skillAdapterProjectName}/media/master.wav`);
    assert.equal(response.body.handoff.source.captions, `projects/${skillAdapterProjectName}/captions.json`);

    const savedPlan = JSON.parse(await fs.readFile(path.join(skillAdapterProjectDir, "packaging-plan.json"), "utf8"));
    const savedManifest = JSON.parse(await fs.readFile(skillAdapterManifestPath, "utf8"));
    assert.equal(savedPlan.source.video, `projects/${skillAdapterProjectName}/media/source.mp4`);
    assert.equal(savedPlan.source.audio, `projects/${skillAdapterProjectName}/media/master.wav`);
    assert.equal(savedPlan.tracks.video[0].src, `projects/${skillAdapterProjectName}/media/source.mp4`);
    assert.equal(savedPlan.tracks.audio[0].src, `projects/${skillAdapterProjectName}/media/master.wav`);
    assert.equal(savedManifest.source.video, `projects/${skillAdapterProjectName}/media/source.mp4`);
    assert.equal(savedManifest.audio.src, `projects/${skillAdapterProjectName}/media/master.wav`);
    assert.equal(savedPlan.tracks.card[1].media.screen, `projects/${skillAdapterProjectName}/media/screen-codex-prompt.jpg`);
    assert.equal(savedPlan.tracks.card[1].media.pip, `projects/${skillAdapterProjectName}/media/duix-prompt-pip.mp4`);
    assert.equal(savedManifest.scenes[1].props.media.screen, `projects/${skillAdapterProjectName}/media/screen-codex-prompt.jpg`);
    assert.equal(savedManifest.scenes[1].props.media.pip, `projects/${skillAdapterProjectName}/media/duix-prompt-pip.mp4`);
    assert.equal(await fileExists(path.join(skillAdapterProjectDir, "media", "source.mp4")), true);
    assert.equal(await fileExists(path.join(skillAdapterProjectDir, "media", "master.wav")), true);
    assert.equal(await fileExists(path.join(skillAdapterProjectDir, "media", "screen-codex-prompt.jpg")), true);
    assert.equal(await fileExists(path.join(skillAdapterProjectDir, "media", "duix-prompt-pip.mp4")), true);

    const loaded = await request(baseUrl, `/projects/${skillAdapterProjectName}/packaging-plan`);
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.plan.tracks.video.length, 1);
    assert.equal(loaded.body.plan.tracks.audio.length, 1);
    assert.equal(loaded.body.plan.tracks.subtitle[0].cues[0].text, "字幕一");
    assert.equal(loaded.body.plan.tracks.card.length, 2);
    assert.equal(loaded.body.plan.tracks.card[1].media.screen, `projects/${skillAdapterProjectName}/media/screen-codex-prompt.jpg`);
    assert.equal(
      loaded.body.plan.tracks.card[1].mediaUrls.screen,
      `/api/preview/projects/${skillAdapterProjectName}/media/screen-codex-prompt.jpg`,
    );

    const sourcePreview = await rawRequest(baseUrl, `/preview/source/${skillAdapterProjectName}`, {
      headers: { range: "bytes=0-5" },
    });
    assert.equal(sourcePreview.status, 206);
    assert.equal(sourcePreview.headers.get("content-type"), "video/mp4");
    assert.equal(sourcePreview.headers.get("content-range"), "bytes 0-5/12");
    assert.equal(sourcePreview.text, "source");

    const history = await request(baseUrl, `/projects/${skillAdapterProjectName}/history`);
    assert.equal(history.status, 200);
    assert.equal(history.body.entries[0].kind, "import");
    assert.equal(history.body.entries[0].planSnapshotRef, "snapshots/import-0001.json");
    const detail = await request(baseUrl, `/projects/${skillAdapterProjectName}/history/${history.body.entries[0].id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.plan.source.video, `projects/${skillAdapterProjectName}/media/source.mp4`);
  });

  test("rejects skill output directories outside the import allowlist", async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-skill-outside-"));
    try {
      await writeSkillOutputFixture(outsideDir);
      const response = await request(baseUrl, "/projects/from-skill-output", {
        method: "POST",
        body: JSON.stringify({ skillOutputPath: outsideDir, name: `${skillAdapterProjectName}-outside` }),
      });

      assert.equal(response.status, 403);
      assert.equal(response.body.ok, false);
      assert.match(response.body.error, /outside the allowed import roots/);
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  test("rejects skill audio paths that escape the import allowlist", async () => {
    const projectName = `${skillAdapterProjectName}-audio-escape`;
    const projectDir = path.join(composerRoot, "projects", projectName);
    const manifestPath = path.join(manifestsDir, `${projectName}.json`);
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-skill-secret-audio-"));
    try {
      const skillOutputDir = path.join(fixtureRoot, "skill-output-audio-escape");
      await writeSkillOutputFixture(skillOutputDir);
      const secretAudio = path.join(outsideDir, "secret.wav");
      await fs.writeFile(secretAudio, "ALLOWLIST_ESCAPE_SECRET_AUDIO");
      await fs.writeFile(
        path.join(skillOutputDir, "data", "audio-manifest.json"),
        JSON.stringify(
          {
            items: {
              master_audio: { path: path.relative(skillOutputDir, secretAudio) },
              caption_timeline: { path: "production/audio/captions.json" },
            },
          },
          null,
          2,
        ),
      );

      const response = await request(baseUrl, "/projects/from-skill-output", {
        method: "POST",
        body: JSON.stringify({ skillOutputPath: skillOutputDir, name: projectName }),
      });

      assert.equal(response.status, 403);
      assert.equal(response.body.ok, false);
      assert.match(response.body.error, /outside allowed import roots|outside the allowed import roots/);
      assert.equal(await fileExists(path.join(projectDir, "audio", "master.wav")), false);
      assert.equal(await fileExists(path.join(projectDir, "media", "secret.wav")), false);
    } finally {
      await fs.rm(manifestPath, { force: true });
      await fs.rm(projectDir, { recursive: true, force: true });
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  test("rejects skill caption timelines that escape the skill output root", async () => {
    const projectName = `${skillAdapterProjectName}-caption-escape`;
    const projectDir = path.join(composerRoot, "projects", projectName);
    const manifestPath = path.join(manifestsDir, `${projectName}.json`);
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-skill-secret-captions-"));
    try {
      const skillOutputDir = path.join(fixtureRoot, "skill-output-caption-escape");
      await writeSkillOutputFixture(skillOutputDir);
      const secretCaptions = path.join(outsideDir, "secret-captions.json");
      await fs.writeFile(secretCaptions, JSON.stringify({ captions: [{ start: 0, end: 1, text: "SECRET_CAPTION" }] }));
      await fs.writeFile(
        path.join(skillOutputDir, "data", "audio-manifest.json"),
        JSON.stringify(
          {
            items: {
              master_audio: { path: "production/audio/master.wav" },
              caption_timeline: { path: path.relative(skillOutputDir, secretCaptions) },
            },
          },
          null,
          2,
        ),
      );

      const response = await request(baseUrl, "/projects/from-skill-output", {
        method: "POST",
        body: JSON.stringify({ skillOutputPath: skillOutputDir, name: projectName }),
      });

      assert.notEqual(response.status, 200);
      assert.equal(response.body.ok, false);
      assert.match(response.body.error, /caption|outside/i);
      assert.equal(await fileExists(path.join(projectDir, "captions.json")), false);
    } finally {
      await fs.rm(manifestPath, { force: true });
      await fs.rm(projectDir, { recursive: true, force: true });
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  test("rejects skill media symlinks that resolve outside the import allowlist", async () => {
    const projectName = `${skillAdapterProjectName}-media-symlink`;
    const projectDir = path.join(composerRoot, "projects", projectName);
    const manifestPath = path.join(manifestsDir, `${projectName}.json`);
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-skill-secret-media-"));
    try {
      const skillOutputDir = path.join(fixtureRoot, "skill-output-media-symlink");
      await writeSkillOutputFixture(skillOutputDir);
      const secretVideo = path.join(outsideDir, "secret.mp4");
      await fs.writeFile(secretVideo, "SECRET_VIDEO");
      await fs.rm(path.join(skillOutputDir, "assets", "source.mp4"));
      await fs.symlink(secretVideo, path.join(skillOutputDir, "assets", "source.mp4"));

      const response = await request(baseUrl, "/projects/from-skill-output", {
        method: "POST",
        body: JSON.stringify({ skillOutputPath: skillOutputDir, name: projectName }),
      });

      assert.equal(response.status, 403);
      assert.equal(response.body.ok, false);
      assert.match(response.body.error, /outside allowed import roots|outside the allowed import roots/);
      assert.equal(await fileExists(path.join(projectDir, "media", "secret.mp4")), false);
    } finally {
      await fs.rm(manifestPath, { force: true });
      await fs.rm(projectDir, { recursive: true, force: true });
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  test("rejects skill imports when the target media directory is a symlink", async () => {
    const projectName = `${skillAdapterProjectName}-target-symlink`;
    const projectDir = path.join(composerRoot, "projects", projectName);
    const manifestPath = path.join(manifestsDir, `${projectName}.json`);
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-skill-target-media-"));
    try {
      const skillOutputDir = path.join(fixtureRoot, "skill-output-target-symlink");
      await writeSkillOutputFixture(skillOutputDir);
      await fs.mkdir(projectDir, { recursive: true });
      await fs.symlink(outsideDir, path.join(projectDir, "media"));

      const response = await request(baseUrl, "/projects/from-skill-output", {
        method: "POST",
        body: JSON.stringify({ skillOutputPath: skillOutputDir, name: projectName, overwrite: true }),
      });

      assert.notEqual(response.status, 200);
      assert.equal(response.body.ok, false);
      assert.match(response.body.error, /media directory|symlink|project/i);
      assert.deepEqual(await fs.readdir(outsideDir), []);
    } finally {
      await fs.rm(manifestPath, { force: true });
      await fs.rm(projectDir, { recursive: true, force: true });
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  test("rejects skill imports when the target project directory is a symlink", async () => {
    const projectName = `${skillAdapterProjectName}-project-symlink`;
    const projectDir = path.join(composerRoot, "projects", projectName);
    const manifestPath = path.join(manifestsDir, `${projectName}.json`);
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-skill-project-symlink-"));
    try {
      const skillOutputDir = path.join(fixtureRoot, "skill-output-project-symlink");
      await writeSkillOutputFixture(skillOutputDir);
      await fs.symlink(outsideDir, projectDir);

      const response = await request(baseUrl, "/projects/from-skill-output", {
        method: "POST",
        body: JSON.stringify({ skillOutputPath: skillOutputDir, name: projectName, overwrite: true }),
      });

      assert.notEqual(response.status, 200);
      assert.equal(response.body.ok, false);
      assert.match(response.body.error, /project directory|symlink|project root/i);
      assert.deepEqual(await fs.readdir(outsideDir), []);
    } finally {
      await fs.rm(manifestPath, { force: true });
      await fs.rm(projectDir, { recursive: true, force: true });
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  test("allocates localized media names without overwriting existing files", async () => {
    const projectName = `${skillAdapterProjectName}-collision`;
    const projectDir = path.join(composerRoot, "projects", projectName);
    const manifestPath = path.join(manifestsDir, `${projectName}.json`);
    try {
      const skillOutputDir = path.join(fixtureRoot, "skill-output-collision");
      await writeSkillOutputFixture(skillOutputDir);
      await fs.mkdir(path.join(projectDir, "media"), { recursive: true });
      await fs.writeFile(path.join(projectDir, "media", "source.mp4"), "existing-media");

      const response = await request(baseUrl, "/projects/from-skill-output", {
        method: "POST",
        body: JSON.stringify({ skillOutputPath: skillOutputDir, name: projectName, overwrite: true }),
      });

      assert.equal(response.status, 200);
      assert.equal(await fs.readFile(path.join(projectDir, "media", "source.mp4"), "utf8"), "existing-media");
      assert.equal(await fs.readFile(path.join(projectDir, "media", "source-2.mp4"), "utf8"), "source-video");
      const savedPlan = JSON.parse(await fs.readFile(path.join(projectDir, "packaging-plan.json"), "utf8"));
      assert.equal(savedPlan.source.video, `projects/${projectName}/media/source-2.mp4`);
    } finally {
      await fs.rm(manifestPath, { force: true });
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  test("rewrites composed preview html media sources to serviceable preview URLs", async () => {
    const manifest = titleCardManifest({
      compositionId: previewHtmlProjectName,
      source: {
        video: fixtureVideo,
      },
      audio: {
        src: `projects/${previewHtmlProjectName}/audio/asr.wav`,
      },
      scenes: [
        {
          id: "pip-card",
          component: "ScreenWithPip",
          scene_type: "screen_demo_pip",
          start: 0,
          duration: 2,
          props: {
            label: "画中画",
            media: {
              screen: fixtureImage,
              pip: digitalHumanLink,
            },
          },
        },
      ],
      output: `projects/${previewHtmlProjectName}/index.html`,
      hyperframesEntry: `projects/${previewHtmlProjectName}/index.html`,
    });
    await fs.mkdir(path.join(previewHtmlProjectDir, "audio"), { recursive: true });
    await fs.writeFile(path.join(previewHtmlProjectDir, "audio", "asr.wav"), "fake wav bytes");
    await fs.writeFile(previewHtmlManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.writeFile(
      path.join(previewHtmlProjectDir, "index.html"),
      [
        "<!doctype html>",
        '<div id="root">',
        `<video id="source-video-background-layer" muted src="${fixtureVideo}"></video>`,
        `<img id="v-pip-card-screen" src="${fixtureImage}">`,
        `<video id="v-pip-card-pip" muted src="${digitalHumanLink}"></video>`,
        `<audio id="audio" src="projects/${previewHtmlProjectName}/audio/asr.wav"></audio>`,
        "</div>",
      ].join(""),
      "utf8",
    );

    const response = await rawRequest(baseUrl, `/api/preview/projects/${previewHtmlProjectName}/index.html`);

    assert.equal(response.status, 200);
    assert.match(response.text, new RegExp(`id="source-video-background-layer"[^>]+src="/api/preview/source/${previewHtmlProjectName}"`));
    assert.match(response.text, new RegExp(`id="v-pip-card-screen"[^>]+src="/api/preview/media\\?path=${encodeURIComponent(fixtureImage).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.match(response.text, new RegExp(`id="v-pip-card-pip"[^>]+src="/api/preview/media\\?path=${encodeURIComponent(digitalHumanLink).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.match(response.text, new RegExp(`id="audio"[^>]+src="/api/preview/audio/${previewHtmlProjectName}"`));
    assert.doesNotMatch(response.text, new RegExp(`src="${fixtureVideo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.doesNotMatch(response.text, new RegExp(`src="${fixtureImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.doesNotMatch(response.text, new RegExp(`src="${digitalHumanLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.doesNotMatch(response.text, new RegExp(`src="projects/${previewHtmlProjectName}/audio/asr\\.wav"`));
  });

  test("streams project audio with HTTP Range support and composer-root path validation", async () => {
    await fs.mkdir(path.join(previewHtmlProjectDir, "audio"), { recursive: true });
    await fs.writeFile(path.join(previewHtmlProjectDir, "audio", "asr.wav"), "fake wav bytes");
    await fs.writeFile(
      previewHtmlManifestPath,
      `${JSON.stringify(
        titleCardManifest({
          compositionId: previewHtmlProjectName,
          audio: { src: `projects/${previewHtmlProjectName}/audio/asr.wav` },
        }),
        null,
        2,
      )}\n`,
    );

    const ranged = await rawRequest(baseUrl, `/api/preview/audio/${previewHtmlProjectName}`, {
      headers: { range: "bytes=0-3" },
    });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get("content-type"), "audio/wav");
    assert.equal(ranged.headers.get("accept-ranges"), "bytes");
    assert.equal(ranged.headers.get("content-range"), "bytes 0-3/14");
    assert.equal(ranged.text, "fake");

    const outsideName = `${previewHtmlProjectName}-outside-audio`;
    await fs.writeFile(
      path.join(manifestsDir, `${outsideName}.json`),
      `${JSON.stringify(titleCardManifest({ compositionId: outsideName, audio: { src: "/etc/hosts" } }), null, 2)}\n`,
    );
    const outside = await request(baseUrl, `/api/preview/audio/${outsideName}`);
    assert.equal(outside.status, 403);
    await fs.rm(path.join(manifestsDir, `${outsideName}.json`), { force: true });
  });

  test("loads rewritten preview video and audio URLs in a real browser when Chrome and ffmpeg are available", async (t) => {
    const probeVideo = path.join(fixtureRoot, "preview-probe.mp4");
    const ffmpeg = await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=160x90:rate=24",
      "-t",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      probeVideo,
    ]);
    if (ffmpeg.code !== 0) {
      t.skip(`ffmpeg unavailable for browser media fixture: ${ffmpeg.stderr}`);
      return;
    }
    await fs.mkdir(path.join(browserPreviewProjectDir, "audio"), { recursive: true });
    await fs.writeFile(path.join(browserPreviewProjectDir, "audio", "asr.wav"), "fake wav bytes");
    await fs.writeFile(
      browserPreviewManifestPath,
      `${JSON.stringify(
        titleCardManifest({
          compositionId: browserPreviewProjectName,
          source: { video: probeVideo },
          audio: { src: `projects/${browserPreviewProjectName}/audio/asr.wav` },
          output: `projects/${browserPreviewProjectName}/index.html`,
          hyperframesEntry: `projects/${browserPreviewProjectName}/index.html`,
        }),
        null,
        2,
      )}\n`,
    );
    await fs.writeFile(
      path.join(browserPreviewProjectDir, "index.html"),
      [
        "<!doctype html>",
        "<body>",
        `<video id="source-video-background-layer" muted playsinline src="${probeVideo}"></video>`,
        `<audio id="audio" src="projects/${browserPreviewProjectName}/audio/asr.wav"></audio>`,
        "</body>",
      ].join(""),
      "utf8",
    );

    const result = await probePreviewVideoInChrome(`${baseUrl}/api/preview/projects/${browserPreviewProjectName}/index.html`);
    if (result.skipped) {
      t.skip(result.skipped);
      return;
    }

    assert.equal(result.probe.timeout, undefined);
    assert.ok(result.probe.readyState >= 2);
    assert.ok(result.probe.videoWidth > 0);
    assert.equal(result.probe.currentSrc, `${baseUrl}/api/preview/source/${browserPreviewProjectName}`);
    assert.equal(result.probe.audioSrc, `${baseUrl}/api/preview/audio/${browserPreviewProjectName}`);
    assert.deepEqual(
      result.requests.filter((url) => url.includes("/private/") || url.includes("/Users/")),
      [],
    );
  });

  test("puts a valid packaging plan, persists it, and keeps the projected manifest composable", async () => {
    const getResponse = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`);
    assert.equal(getResponse.status, 200);
    const plan = getResponse.body.plan;
    plan.tracks.card[0].engine.props.title = "Plan Saved";
    plan.tracks.card[0].content.title = "Plan Saved";
    plan.tracks.card[0].layout = { safeArea: "title-safe", align: "center" };

    const putResponse = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`, {
      method: "PUT",
      body: JSON.stringify(plan),
    });

    assert.equal(putResponse.status, 200);
    assert.equal(putResponse.body.ok, true);
    assert.equal(putResponse.body.name, packagingPlanProjectName);
    assert.equal(putResponse.body.manifestName, packagingPlanProjectName);
    assert.equal(putResponse.body.path, packagingPlanManifestPath);
    assert.equal(putResponse.body.planPath, path.join(packagingPlanProjectDir, "packaging-plan.json"));

    const savedPlan = JSON.parse(await fs.readFile(path.join(packagingPlanProjectDir, "packaging-plan.json"), "utf8"));
    assert.equal(savedPlan.tracks.card[0].layout.safeArea, "title-safe");
    const savedManifest = JSON.parse(await fs.readFile(packagingPlanManifestPath, "utf8"));
    assert.equal(savedManifest.scenes[0].props.title, "Plan Saved");
    assert.equal(savedManifest.scenes[0].props.layout.safeArea, "title-safe");

    const compose = await request(baseUrl, `/compose/${packagingPlanProjectName}`, { method: "POST" });
    assert.equal(compose.status, 200);
    assert.equal(compose.body.ok, true);
    assert.deepEqual(scriptCalls.at(-1), { script: "compose", args: ["--", `manifests/${packagingPlanProjectName}.json`] });
  });

  test("puts packaging plan subtitle cues into the project captions file used by compose", async () => {
    const getResponse = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`);
    assert.equal(getResponse.status, 200);
    const plan = getResponse.body.plan;
    plan.source.audio = `projects/${packagingPlanProjectName}/audio.wav`;
    plan.source.captions = `projects/${packagingPlanProjectName}/captions.json`;
    plan.tracks.audio = [{ id: "audio-main", track: "audio", src: plan.source.audio, start: 0, duration: plan.duration }];
    plan.tracks.subtitle = [
      {
        id: "subtitle-main",
        track: "subtitle",
        src: plan.source.captions,
        start: 0,
        duration: plan.duration,
        cues: [{ start: 0, end: 1.2, text: "Claude Code edited" }],
      },
    ];

    await fs.mkdir(packagingPlanProjectDir, { recursive: true });
    await fs.writeFile(path.join(packagingPlanProjectDir, "audio.wav"), "fake wav");
    const putResponse = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`, {
      method: "PUT",
      body: JSON.stringify(plan),
    });

    assert.equal(putResponse.status, 200);
    const captionsPath = path.join(packagingPlanProjectDir, "captions.json");
    const captionsPayload = JSON.parse(await fs.readFile(captionsPath, "utf8"));
    assert.deepEqual(captionsPayload.captions, [{ start: 0, end: 1.2, text: "Claude Code edited" }]);

    const savedManifest = JSON.parse(await fs.readFile(packagingPlanManifestPath, "utf8"));
    assert.equal(savedManifest.audio.captions, `projects/${packagingPlanProjectName}/captions.json`);

    const compose = await request(baseUrl, `/compose/${packagingPlanProjectName}`, { method: "POST" });
    assert.equal(compose.status, 200);
    const html = await fs.readFile(path.join(composerRoot, "projects", packagingPlanProjectName, "index.html"), "utf8");
    assert.match(html, /Claude Code edited/);
  });

  test("rejects invalid packaging plans without overwriting the manifest or persisted plan", async () => {
    const beforeManifest = await fs.readFile(packagingPlanManifestPath, "utf8");
    const beforePlan = await fs.readFile(path.join(packagingPlanProjectDir, "packaging-plan.json"), "utf8");
    const invalid = JSON.parse(beforePlan);
    invalid.tracks.card[0].engine.component = "MissingComponent";

    const response = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`, {
      method: "PUT",
      body: JSON.stringify(invalid),
    });

    assert.equal(response.status, 422);
    assert.match(response.body.error, /packaging plan validation failed/);
    assert.match(response.body.failures.join("\n"), /MissingComponent is not in composer catalog/);
    assert.equal(await fs.readFile(packagingPlanManifestPath, "utf8"), beforeManifest);
    assert.equal(await fs.readFile(path.join(packagingPlanProjectDir, "packaging-plan.json"), "utf8"), beforePlan);
  });

  test("rejects packaging plans with output paths that escape the managed project output", async () => {
    const current = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`);
    const traversal = { ...current.body.plan, output: "../../outside.html", hyperframesEntry: `projects/${packagingPlanProjectName}/index.html` };
    const absolute = { ...current.body.plan, output: `projects/${packagingPlanProjectName}/index.html`, hyperframesEntry: "/tmp/outside.html" };

    const traversalResponse = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`, {
      method: "PUT",
      body: JSON.stringify(traversal),
    });
    const absoluteResponse = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`, {
      method: "PUT",
      body: JSON.stringify(absolute),
    });

    assert.equal(traversalResponse.status, 422);
    assert.match(traversalResponse.body.failures.join("\n"), /output must be projects\/packaging-plan-\d+\/index\.html/);
    assert.equal(absoluteResponse.status, 422);
    assert.match(absoluteResponse.body.failures.join("\n"), /hyperframesEntry must be projects\/packaging-plan-\d+\/index\.html/);
  });

  test("saves a reusable template from the current packaging plan and lists it", async () => {
    const currentPlan = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`);
    const response = await request(baseUrl, `/projects/${packagingPlanProjectName}/templates`, {
      method: "POST",
      body: JSON.stringify({ name: templateId, description: "Reusable P5 template" }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.templateId, templateId);
    assert.equal(response.body.template.name, templateId);
    assert.equal(response.body.template.description, "Reusable P5 template");
    assert.deepEqual(response.body.template.cardRules.map((rule) => rule.cardType), currentPlan.body.plan.tracks.card.map((card) => card.type));
    assert.doesNotMatch(JSON.stringify(response.body.template), /Plan Saved/);
    await fs.access(path.join(templatesDir, `${templateId}.json`));

    const list = await request(baseUrl, "/templates");
    assert.equal(list.status, 200);
    assert.ok(list.body.templates.some((template) => template.id === templateId && template.description === "Reusable P5 template"));

    const detail = await request(baseUrl, `/templates/${templateId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.template.id, templateId);

    const conflict = await request(baseUrl, `/projects/${packagingPlanProjectName}/templates`, {
      method: "POST",
      body: JSON.stringify({ name: templateId, description: "duplicate" }),
    });
    assert.equal(conflict.status, 409);
    assert.match(conflict.body.error, /already exists/);
  });

  test("applies a saved template to another project and keeps the generated manifest composable", async () => {
    const sourceManifest = titleCardManifest({
      compositionId: applyTemplateProjectName,
      output: `projects/${applyTemplateProjectName}/index.html`,
      hyperframesEntry: `projects/${applyTemplateProjectName}/index.html`,
    });
    await fs.writeFile(applyTemplateManifestPath, `${JSON.stringify(sourceManifest, null, 2)}\n`);

    const response = await request(baseUrl, `/projects/${applyTemplateProjectName}/apply-template`, {
      method: "POST",
      body: JSON.stringify({
        templateId,
        inputs: {
          duration: 3,
          output: `projects/${applyTemplateProjectName}/index.html`,
          hyperframesEntry: `projects/${applyTemplateProjectName}/index.html`,
          segments: [
            {
              id: "new-card-1",
              kind: "card-1",
              start: 0,
              duration: 3,
              content: {
                cornerLeft: "NEW",
                cornerName: "Template",
                kicker: "P5",
                title: "Applied",
                subline: "From template",
              },
            },
          ],
        },
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      ok: true,
      name: applyTemplateProjectName,
      manifestName: applyTemplateProjectName,
    });
    const savedPlan = JSON.parse(await fs.readFile(path.join(applyTemplateProjectDir, "packaging-plan.json"), "utf8"));
    assert.equal(savedPlan.templateRef.id, templateId);
    assert.equal(savedPlan.tracks.card[0].content.title, "Applied");
    const savedManifest = JSON.parse(await fs.readFile(applyTemplateManifestPath, "utf8"));
    assert.equal(savedManifest.scenes[0].props.title, "Applied");

    const compose = await request(baseUrl, `/compose/${applyTemplateProjectName}`, { method: "POST" });
    assert.equal(compose.status, 200);
    assert.equal(compose.body.ok, true);
    assert.deepEqual(scriptCalls.at(-1), { script: "compose", args: ["--", `manifests/${applyTemplateProjectName}.json`] });

    const history = await request(baseUrl, `/projects/${applyTemplateProjectName}/history`);
    assert.equal(history.status, 200);
    assert.equal(history.body.entries[0].kind, "apply-template");
    assert.equal(history.body.entries[0].params.templateId, templateId);
    assert.match(history.body.entries[0].planSnapshotRef, /^snapshots\/apply-template-\d{4}\.json$/);

    const detail = await request(baseUrl, `/projects/${applyTemplateProjectName}/history/${history.body.entries[0].id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.entry.id, history.body.entries[0].id);
    assert.equal(detail.body.plan.tracks.card[0].content.title, "Applied");
  });

  test("restores a packaging-plan history snapshot through manifest validation and records restore history", async () => {
    const current = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`);
    const originalPlan = current.body.plan;
    originalPlan.tracks.card[0].content.title = "恢复前";
    originalPlan.tracks.card[0].engine.props.title = "恢复前";
    const restoreId = "restore-source";
    await fs.mkdir(path.join(packagingPlanProjectDir, "snapshots"), { recursive: true });
    await fs.writeFile(path.join(packagingPlanProjectDir, "snapshots", `${restoreId}.json`), JSON.stringify(originalPlan, null, 2));
    await fs.writeFile(
      path.join(packagingPlanProjectDir, "history.json"),
      JSON.stringify(
        [
          {
            id: restoreId,
            ts: "2026-06-14T00:00:00.000Z",
            kind: "apply-template",
            params: {},
            planSnapshotRef: `snapshots/${restoreId}.json`,
            artifacts: {},
            validation: { ok: true },
            result: { ok: true },
          },
        ],
        null,
        2,
      ),
    );

    const changedPlan = { ...originalPlan, tracks: { ...originalPlan.tracks, card: [...originalPlan.tracks.card] } };
    changedPlan.tracks.card[0] = {
      ...changedPlan.tracks.card[0],
      content: { ...changedPlan.tracks.card[0].content, title: "恢复后临时修改" },
      engine: {
        ...changedPlan.tracks.card[0].engine,
        props: { ...changedPlan.tracks.card[0].engine.props, title: "恢复后临时修改" },
      },
    };
    const changedSave = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`, {
      method: "PUT",
      body: JSON.stringify(changedPlan),
    });
    assert.equal(changedSave.status, 200);

    const restored = await request(baseUrl, `/projects/${packagingPlanProjectName}/history/${restoreId}/restore`, { method: "POST" });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.ok, true);

    const manifest = JSON.parse(await fs.readFile(packagingPlanManifestPath, "utf8"));
    assert.equal(manifest.scenes[0].props.title, "恢复前");
    const afterHistory = await request(baseUrl, `/projects/${packagingPlanProjectName}/history`);
    assert.equal(afterHistory.body.entries[0].kind, "restore");
    assert.equal(afterHistory.body.entries[0].params.restoredEntryId, restoreId);
  });

  test("history returns 404 for missing ids and restore validation failures do not publish", async () => {
    const missing = await request(baseUrl, `/projects/${packagingPlanProjectName}/history/missing-entry`);
    assert.equal(missing.status, 404);

    const badId = "bad-snapshot";
    await fs.mkdir(path.join(packagingPlanProjectDir, "snapshots"), { recursive: true });
    await fs.writeFile(
      path.join(packagingPlanProjectDir, "snapshots", `${badId}.json`),
      JSON.stringify({ projectId: packagingPlanProjectName, tracks: { card: [] } }, null, 2),
    );
    await fs.writeFile(
      path.join(packagingPlanProjectDir, "history.json"),
      JSON.stringify(
        [
          {
            id: badId,
            ts: "2026-06-14T00:00:00.000Z",
            kind: "apply-template",
            params: {},
            planSnapshotRef: `snapshots/${badId}.json`,
            artifacts: {},
            validation: { ok: true },
            result: { ok: true },
          },
        ],
        null,
        2,
      ),
    );
    const before = await fs.readFile(packagingPlanManifestPath, "utf8");
    const response = await request(baseUrl, `/projects/${packagingPlanProjectName}/history/${badId}/restore`, { method: "POST" });
    assert.equal(response.status, 422);
    assert.match(response.body.error, /packaging plan validation failed/);
    assert.equal(await fs.readFile(packagingPlanManifestPath, "utf8"), before);
  });

  test("history rejects snapshot symlinks without publishing escaped plans", async () => {
    const current = await request(baseUrl, `/projects/${packagingPlanProjectName}/packaging-plan`);
    assert.equal(current.status, 200);
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "console-api-history-escape-"));
    const evilId = "evil-symlink";
    try {
      const escapedPlan = structuredClone(current.body.plan);
      escapedPlan.tracks.card[0].content.title = "逃逸计划";
      escapedPlan.tracks.card[0].engine.props.title = "逃逸计划";
      const escapedPlanPath = path.join(outsideDir, "valid-plan.json");
      await fs.writeFile(escapedPlanPath, JSON.stringify(escapedPlan, null, 2));
      await fs.mkdir(path.join(packagingPlanProjectDir, "snapshots"), { recursive: true });
      await fs.symlink(escapedPlanPath, path.join(packagingPlanProjectDir, "snapshots", `${evilId}.json`));
      await fs.writeFile(
        path.join(packagingPlanProjectDir, "history.json"),
        JSON.stringify(
          [
            {
              id: evilId,
              ts: "2026-06-14T00:00:00.000Z",
              kind: "apply-template",
              params: {},
              planSnapshotRef: `snapshots/${evilId}.json`,
              artifacts: {},
              validation: { ok: true },
              result: { ok: true },
            },
          ],
          null,
          2,
        ),
      );

      const before = await fs.readFile(packagingPlanManifestPath, "utf8");
      const detail = await request(baseUrl, `/projects/${packagingPlanProjectName}/history/${evilId}`);
      assert.notEqual(detail.status, 200);
      const restored = await request(baseUrl, `/projects/${packagingPlanProjectName}/history/${evilId}/restore`, { method: "POST" });
      assert.notEqual(restored.status, 200);
      assert.equal(await fs.readFile(packagingPlanManifestPath, "utf8"), before);
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
      await fs.rm(path.join(packagingPlanProjectDir, "snapshots", `${evilId}.json`), { force: true });
    }
  });

  test("apply-template returns 422 for invalid persisted templates", async () => {
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, `${badTemplateId}.json`),
      JSON.stringify({
        id: badTemplateId,
        name: "Bad",
        description: "Invalid",
        cardRules: [
          {
            cardType: "not-a-card",
            role: "card-1",
            segmentKind: "card-1",
            layoutStrategy: {},
            styleRef: "default",
            motionRef: "default",
            contentRules: {},
            mediaRequirements: [],
          },
        ],
        styleProfile: {},
        motionProfile: {},
      }, null, 2),
    );

    const response = await request(baseUrl, `/projects/${applyTemplateProjectName}/apply-template`, {
      method: "POST",
      body: JSON.stringify({ templateId: badTemplateId }),
    });

    assert.equal(response.status, 422);
    assert.match(response.body.error, /template validation failed/);
    assert.match(response.body.failures.join("\n"), /not-a-card is not supported/);
  });

  test("apply-template rejects output overrides that escape the managed project output", async () => {
    const traversal = await request(baseUrl, `/projects/${applyTemplateProjectName}/apply-template`, {
      method: "POST",
      body: JSON.stringify({ templateId, inputs: { output: "../../outside.html" } }),
    });
    const absolute = await request(baseUrl, `/projects/${applyTemplateProjectName}/apply-template`, {
      method: "POST",
      body: JSON.stringify({ templateId, inputs: { hyperframesEntry: "/tmp/outside.html" } }),
    });

    assert.equal(traversal.status, 422);
    assert.match(traversal.body.failures.join("\n"), /output must be projects\/apply-template-\d+\/index\.html/);
    assert.equal(absolute.status, 422);
    assert.match(absolute.body.failures.join("\n"), /hyperframesEntry must be projects\/apply-template-\d+\/index\.html/);
  });

  test("route-b import requires videoPath", async () => {
    const response = await request(baseUrl, "/route-b/import", {
      method: "POST",
      body: JSON.stringify({ name: routeBManifestName }),
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.ok, false);
    assert.match(response.body.stderr, /videoPath is required/);
  });

  test("route-b import reports importer failures with a log path", async () => {
    const failingServer = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        routeBImporter: async () => {
          throw new Error("asr failed");
        },
      }),
    );
    const failingBaseUrl = await listen(failingServer);
    try {
      const response = await request(failingBaseUrl, "/route-b/import", {
        method: "POST",
        body: JSON.stringify({ videoPath: fixtureVideo, name: `${routeBManifestName}-fail` }),
      });

      assert.equal(response.status, 500);
      assert.equal(response.body.ok, false);
      assert.match(response.body.stderr, /asr failed/);
      assert.ok(response.body.logPath.startsWith(logDir));
    } finally {
      await new Promise((resolve) => failingServer.close(resolve));
    }
  });

  test("validateVideoPath rejects non-string, relative, protocol and out-of-allowlist paths", async () => {
    const roots = [fixtureRoot];
    assert.equal((await validateVideoPath(undefined, roots)).status, 400);
    assert.equal((await validateVideoPath("", roots)).status, 400);
    assert.equal((await validateVideoPath(123, roots)).status, 400);
    assert.equal((await validateVideoPath("relative/video.mp4", roots)).status, 400);
    assert.equal((await validateVideoPath("http://evil/x.mp4", roots)).status, 400);
    assert.equal((await validateVideoPath("file:///etc/passwd", roots)).status, 400);
    assert.equal((await validateVideoPath("rtmp://host/live", roots)).status, 400);
    // absolute, exists, but outside the allowlist → 403
    const outside = await validateVideoPath("/etc/hosts", roots);
    assert.equal(outside.status, 403);
    // absolute + inside allowlist + exists → ok, returns canonical realPath
    const good = await validateVideoPath(fixtureVideo, roots);
    assert.equal(good.ok, true);
    assert.equal(good.realPath, await fs.realpath(fixtureVideo));
  });

  test("default import allowlist is the home subtree (demo paths under ~ stay valid)", () => {
    const roots = getImportRoots({ HOME: "/Users/demo" });
    assert.deepEqual(roots, ["/Users/demo"]);
    assert.deepEqual(getImportRoots({ ROUTE_B_IMPORT_ROOTS: "/a:/b" }), ["/a", "/b"]);
  });

  test("videoPath with shell metacharacters is passed as literal data, no shell runs", async () => {
    // Sentinel basename only (no slash — a slash would make a path, not a filename).
    const sentinelBase = `pwned-${process.pid}`;
    const sentinel = path.join(fixtureRoot, sentinelBase);
    await fs.rm(sentinel, { force: true });
    const danger = path.join(fixtureRoot, `evil ; touch ${sentinelBase} \`touch ${sentinelBase}\`\n.mp4`);
    await fs.writeFile(danger, "x");
    let received;
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        routeBImporter: async ({ videoPath, name }) => {
          received = videoPath;
          return { ok: true, manifestName: name, scenes: 1, logPath: "/tmp/x.log" };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const res = await request(url2, "/route-b/import", {
        method: "POST",
        body: JSON.stringify({ videoPath: danger, name: `${routeBManifestName}-sentinel-test` }),
      });
      assert.equal(res.status, 200);
      assert.equal(received, await fs.realpath(danger));
      assert.equal(await fileExists(sentinel), false);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
      await fs.rm(danger, { force: true });
    }
  });

  test("duplicate name returns 409 unless overwrite:true", async () => {
    const name = `${routeBManifestName}-overwrite`;
    await fs.writeFile(path.join(manifestsDir, `${name}.json`), `${JSON.stringify(titleCardManifest(), null, 2)}\n`);

    const conflict = await request(baseUrl, "/route-b/import", {
      method: "POST",
      body: JSON.stringify({ videoPath: fixtureVideo, name }),
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.ok, false);
    assert.match(conflict.body.stderr, /already exists/);

    const overwrite = await request(baseUrl, "/route-b/import", {
      method: "POST",
      body: JSON.stringify({ videoPath: fixtureVideo, name, overwrite: true }),
    });
    assert.equal(overwrite.status, 200);
    assert.equal(overwrite.body.manifestName, name);
  });

  test("empty/whitespace name is rejected, long name is truncated to a safe slug", async () => {
    const empty = await request(baseUrl, "/route-b/import", {
      method: "POST",
      body: JSON.stringify({ videoPath: fixtureVideo, name: "   " }),
    });
    assert.equal(empty.status, 400);
    assert.match(empty.body.stderr, /name is empty or invalid/);

    // A pure traversal name sanitizes to nothing → rejected.
    const pureTraversal = await request(baseUrl, "/route-b/import", {
      method: "POST",
      body: JSON.stringify({ videoPath: fixtureVideo, name: "../.." }),
    });
    assert.equal(pureTraversal.status, 400);

    // Path separators in a name are flattened to a safe slug, never escaping manifests/.
    const flattened = await request(baseUrl, "/route-b/import", {
      method: "POST",
      body: JSON.stringify({ videoPath: fixtureVideo, name: "sub/dir/escape" }),
    });
    assert.equal(flattened.status, 200);
    assert.ok(!flattened.body.manifestName.includes("/"));
    assert.ok(!flattened.body.manifestName.includes(".."));
    await fs.rm(path.join(manifestsDir, `${flattened.body.manifestName}.json`), { force: true });
    await fs.rm(path.join(composerRoot, "projects", flattened.body.manifestName), { recursive: true, force: true });

    const longName = `${routeBManifestName}-longname-${"x".repeat(200)}`;
    const long = await request(baseUrl, "/route-b/import", {
      method: "POST",
      body: JSON.stringify({ videoPath: fixtureVideo, name: longName }),
    });
    assert.equal(long.status, 200);
    assert.ok(long.body.manifestName.length <= 80);
    await fs.rm(path.join(manifestsDir, `${long.body.manifestName}.json`), { force: true });
    await fs.rm(path.join(composerRoot, "projects", long.body.manifestName), { recursive: true, force: true });
  });

  test("concurrent import of the same name is rejected with 409 (per-name lock)", async () => {
    const name = `${routeBManifestName}-lock`;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        routeBImporter: async ({ name: n }) => {
          await gate;
          return { ok: true, manifestName: n, scenes: 1, logPath: "/tmp/x.log" };
        },
      }),
    );
    const url2 = await listen(server2);
    try {
      const first = request(url2, "/route-b/import", {
        method: "POST",
        body: JSON.stringify({ videoPath: fixtureVideo, name }),
      });
      // Give the first request time to acquire the lock before the second arrives.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = await request(url2, "/route-b/import", {
        method: "POST",
        body: JSON.stringify({ videoPath: fixtureVideo, name }),
      });
      assert.equal(second.status, 409);
      assert.match(second.body.stderr, /already in progress/);
      release();
      const firstResult = await first;
      assert.equal(firstResult.status, 200);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });

  test("a failed import (compose !=0) leaves no manifest in GET /manifests and removes the project", async () => {
    const name = `${routeBManifestName}-atomic-fail`;
    const manifestPath = path.join(manifestsDir, `${name}.json`);
    const projectDir = path.join(composerRoot, "projects", name);
    const fakeDeps = {
      probe: async () => ({ audio: { codec: "aac" }, duration: 2 }),
      extractAudio: async () => {},
      runFunasr: async (_audio, rawPath) => {
        await fs.writeFile(rawPath, JSON.stringify({ sentences: [] }));
      },
      makeCaptionsPayload: async () => ({ captions: [{ start: 0, end: 1, text: "hi", asr_text: "hi" }] }),
      buildTranscript: () => ({ text: "hi", segments: [] }),
      buildScenePlan: () => ({ scenes: [{ id: "s001", end: 2, componentCandidates: ["TitleCard"] }] }),
      buildManifestFromScenePlan: ({ compositionId, output }) =>
        titleCardManifest({ compositionId, output, hyperframesEntry: output }),
      loadTermMap: () => ({}),
    };
    const server2 = http.createServer(
      createApiServer({
        composerRoot,
        logDir,
        importRoots: [fixtureRoot],
        // compose fails → importer must roll back.
        runScript: async ({ script }) => ({ code: script === "compose" ? 1 : 0, stdout: "", stderr: "compose boom" }),
        routeBImporter: (importArgs) => defaultRouteBImporter(importArgs, fakeDeps),
      }),
    );
    const url2 = await listen(server2);
    try {
      const res = await request(url2, "/route-b/import", {
        method: "POST",
        body: JSON.stringify({ videoPath: fixtureVideo, name }),
      });
      assert.equal(res.status, 500);
      assert.equal(res.body.ok, false);
      assert.match(res.body.stderr, /compose failed/);

      // No staged or published manifest, and the half-baked project dir is gone.
      assert.equal(await fileExists(manifestPath), false);
      assert.equal(await fileExists(projectDir), false);
      const stagedTmp = (await fs.readdir(manifestsDir)).filter((f) => f.includes(`${name}.importing`));
      assert.deepEqual(stagedTmp, []);
      const list = await request(baseUrl, "/manifests");
      assert.ok(!list.body.manifests.includes(name));
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });
});
