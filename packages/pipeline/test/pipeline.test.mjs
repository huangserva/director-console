import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { validateManifest } from "../../../hyperframes-composer/scripts/manifest-rules.mjs";
import {
  applyTermFixes,
  buildRouteAManifestFromScenePlan,
  buildRouteAScenePlan,
  buildTranscript,
  buildManifestFromScenePlan,
  buildProductIntroManifestFromScenePlan,
  buildScenePlan,
  captionsFromFunasr,
  loadTermMap,
  normalizeFunasrSentences,
  runProductIntroWorkflow,
  runProductScriptStage,
  runRouteAWorkflow,
  runLipSyncStage,
  runScriptStage,
  runTtsStage,
  validateCaptions,
} from "../src/stages.mjs";

const baselinePath = "/Users/huangzongning/development/paseo/creative/.hive/research/2026-06-12-m1-captions-baseline.json";

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://${address.address}:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function readJson(request) {
  let body = "";
  request.setEncoding("utf8");
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

describe("Route B pipeline stages", () => {
  test("term-fix applies deterministic editable mappings", () => {
    const fixed = applyTermFixes("class code 和 cloud code 接到 open call，绘话里演示懒家在。", loadTermMap());

    assert.equal(fixed, "Claude Code 和 Claude Code 接到 OpenClaw，会话里演示懒加载。");
  });

  test("FunASR sentence_info timestamps are converted from milliseconds to seconds", () => {
    const captions = captionsFromFunasr([
      {
        sentence_info: [
          { start: 290, end: 2970, text: "class code 现在开始。" },
          { start: 3000, end: 4500, text: "open call 下一步。" },
        ],
      },
    ]);

    assert.deepEqual(captions, [
      {
        start: 0.29,
        end: 2.97,
        text: "Claude Code 现在开始。",
        source: "funasr_sentence_with_term_fixes",
        asr_text: "class code 现在开始。",
      },
      {
        start: 3,
        end: 4.5,
        text: "OpenClaw 下一步。",
        source: "funasr_sentence_with_term_fixes",
        asr_text: "open call 下一步。",
      },
    ]);
  });

  test("normalizes FunASR raw array/object shapes", () => {
    assert.deepEqual(
      normalizeFunasrSentences({
        sentence_info: [{ start: 1000, end: 2000, text: "hello" }],
      }),
      [{ startMs: 1000, endMs: 2000, text: "hello" }],
    );
    assert.deepEqual(
      normalizeFunasrSentences([
        {
          sentence_info: [{ start: 3000, end: 4000, text: "world" }],
        },
      ]),
      [{ startMs: 3000, endMs: 4000, text: "world" }],
    );
  });

  test("caption validation enforces monotonic non-overlapping seconds", () => {
    const valid = [
      { start: 0, end: 1, text: "a" },
      { start: 1, end: 2, text: "b" },
    ];
    assert.deepEqual(validateCaptions(valid), []);

    const invalid = [
      { start: 0, end: 1, text: "a" },
      { start: 0.9, end: 0.95, text: "b" },
    ];
    assert.match(validateCaptions(invalid).join("\n"), /caption 1 starts before previous end/);
  });

  test("transcript summarizes full text, segments, and timeline", () => {
    const transcript = buildTranscript([
      { start: 0, end: 1, text: "第一句。", asr_text: "第一句。" },
      { start: 1.5, end: 2, text: "第二句。", asr_text: "第二句。" },
    ]);

    assert.equal(transcript.text, "第一句。第二句。");
    assert.equal(transcript.segments.length, 2);
    assert.deepEqual(transcript.timeline, { start: 0, end: 2, duration: 2 });
  });

  test("baseline captions fixture keeps the expected composer-ready shape", () => {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

    assert.equal(baseline.captions.length, 78);
    assert.deepEqual(Object.keys(baseline.captions[0]).sort(), ["asr_text", "end", "source", "start", "text"].sort());
    assert.deepEqual(validateCaptions(baseline.captions), []);
    assert.equal(typeof baseline.captions[0].start, "number");
    assert.equal(typeof baseline.captions[0].end, "number");
  });

  test("scene-plan groups transcript segments into catalog-backed text scenes", () => {
    const transcript = buildTranscript([
      { start: 0, end: 3, text: "开场说明。", asr_text: "开场说明。" },
      { start: 4, end: 9, text: "第一段讲问题。", asr_text: "第一段讲问题。" },
      { start: 20, end: 25, text: "第二段讲解决。", asr_text: "第二段讲解决。" },
    ]);

    const scenePlan = buildScenePlan({ transcript, targetWindowSeconds: 12 });

    assert.equal(scenePlan.scenes.length, 2);
    assert.equal(scenePlan.scenes[0].id, "s001");
    assert.equal(scenePlan.scenes[0].componentCandidates[0], "TitleCard");
    assert.equal(scenePlan.scenes[1].componentCandidates[0], "StepCard");
    assert.equal(scenePlan.scenes[0].start, 0);
    assert.equal(scenePlan.scenes.at(-1).end, 25);
  });

  test("manifest generation mounts audio/captions and stays legal under composer rules", () => {
    const transcript = buildTranscript([
      { start: 0, end: 3, text: "开场说明。", asr_text: "开场说明。" },
      { start: 4, end: 9, text: "第一段讲问题。", asr_text: "第一段讲问题。" },
      { start: 20, end: 25, text: "第二段讲解决。", asr_text: "第二段讲解决。" },
    ]);
    const scenePlan = buildScenePlan({ transcript, targetWindowSeconds: 12 });
    const manifest = buildManifestFromScenePlan({
      scenePlan,
      sourceVideo: "/tmp/director-route-b-test/input.mp4",
      audioSrc: "/tmp/director-route-b-test/audio/asr.wav",
      captionsPath: "/tmp/director-route-b-test/captions.json",
      output: "/tmp/director-route-b-test/index.html",
    });

    assert.deepEqual(manifest.source, { video: "/tmp/director-route-b-test/input.mp4" });
    assert.equal(manifest.audio.src, "/tmp/director-route-b-test/audio/asr.wav");
    assert.equal(manifest.audio.captions, "/tmp/director-route-b-test/captions.json");
    assert.equal(manifest.output, "/tmp/director-route-b-test/index.html");
    assert.equal(manifest.scenes[0].component, "TitleCard");
    assert.equal(manifest.scenes[0].scene_type, "title_card");
    assert.equal(manifest.scenes[1].component, "StepCard");
    assert.equal(manifest.scenes[1].scene_type, "step_card");
    assert.equal(manifest.scenes[0].props.cornerLeft, "成片导入");
    assert.equal(manifest.scenes[0].props.cornerName, "场景 1");
    assert.equal(manifest.scenes[0].props.kicker, "自动场景规划");
    assert.equal(manifest.scenes[0].props.subline, "开场说明 第一段讲问题");
    assert.equal(manifest.scenes[1].props.kicker, "场景 02");

    const failures = validateManifest(manifest, {
      root: path.resolve(import.meta.dirname, "../../../hyperframes-composer"),
      manifestPath: "/tmp/director-route-b-test/manifest.json",
    });
    assert.deepEqual(failures, []);
  });
});

describe("Route A pipeline stages", () => {
  test("Route A manifest defaults use Chinese display copy", () => {
    const transcript = buildTranscript([
      { start: 0, end: 3, text: "数字人口播开场。", asr_text: "数字人口播开场。" },
      { start: 4, end: 9, text: "解释核心流程。", asr_text: "解释核心流程。" },
    ]);
    const manifest = buildRouteAManifestFromScenePlan({
      scenePlan: buildRouteAScenePlan({ transcript, targetWindowSeconds: 4 }),
      audioSrc: "/tmp/route-a/master.wav",
      captionsPath: "/tmp/route-a/captions.json",
      presenterVideoPath: "/tmp/route-a/presenter.mp4",
    });

    assert.equal(manifest.scenes[0].props.stat.cornerLeft, "数字人");
    assert.equal(manifest.scenes[0].props.stat.label, "数字人口播");
    assert.equal(manifest.scenes[0].props.stat.unit, "流程");
    assert.equal(manifest.scenes[0].props.browser.done, "就绪");
    assert.deepEqual(manifest.scenes[0].props.browser.icons, ["脚本", "配音", "口型", "字幕", "合成"]);
    assert.equal(manifest.scenes[0].props.titleBeat.cornerLeft, "数字人");
    assert.equal(manifest.scenes[0].props.titleBeat.cornerName, "场景 1");
    assert.equal(manifest.scenes[0].props.titleBeat.kicker, "数字人口播");
    assert.equal(manifest.scenes[1].props.chip, "数字人");
    assert.equal(manifest.scenes[1].props.kicker, "口播讲解");
  });

  test("script stage writes deterministic script structure and rejects missing input", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "route-a-script-"));

    const missing = await runScriptStage({ workdir });
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, "invalid_input");

    const generated = await runScriptStage({
      workdir,
      topic: "AI 编程助手",
      productInfo: { name: "Director Console", audience: "创作者", promise: "自动生成口播视频", proofPoints: ["ASR", "可编辑"] },
    });

    assert.equal(generated.ok, true);
    assert.equal(generated.stageId, "script");
    assert.equal(generated.outputs.script.language, "zh");
    assert.match(generated.outputs.script.text, /AI 编程助手/);
    assert.ok(generated.outputs.script.chapters.length >= 2);
    assert.equal(await fsp.readFile(generated.outputs.scriptPath, "utf8"), generated.outputs.script.text);

    const approved = await runScriptStage({ workdir, approvedScript: "这是已经批准的脚本。" });
    assert.equal(approved.outputs.script.text, "这是已经批准的脚本。");
  });

  test("tts stage posts expected body and downloads master wav from stub service", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "route-a-tts-"));
    const requests = [];
    const stub = await listen(async (request, response) => {
      requests.push({ method: request.method, url: request.url });
      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }
      if (request.method === "POST" && request.url === "/tts") {
        requests.at(-1).body = await readJson(request);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ download_url: `${stub.baseUrl}/download/master.wav`, request_id: "tts-1" }));
        return;
      }
      if (request.method === "GET" && request.url === "/download/master.wav") {
        response.writeHead(200, { "content-type": "audio/wav" });
        response.end("fake wav");
        return;
      }
      response.writeHead(404);
      response.end();
    });

    try {
      const result = await runTtsStage({
        workdir,
        script: "你好，Director Console。",
        voiceReference: { wavPath: "/tmp/ref.wav" },
        speed: 1.15,
        baseUrl: stub.baseUrl,
        guardTimeoutMs: 500,
        requestTimeoutMs: 500,
      });

      assert.equal(result.ok, true);
      assert.equal(result.stageId, "tts");
      assert.equal(result.outputs.provider, "cosyvoice3-master-api");
      assert.equal(await fsp.readFile(result.outputs.audioPath, "utf8"), "fake wav");
      assert.deepEqual(requests.find((item) => item.url === "/tts").body, {
        text: "你好，Director Console。",
        speed: 1.15,
      });
    } finally {
      await stub.close();
    }
  });

  test("tts guard returns blocked when service is unavailable and does not throw", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "route-a-tts-down-"));
    const result = await runTtsStage({
      workdir,
      script: "服务不可用时不炸流水线。",
      baseUrl: "http://127.0.0.1:9",
      guardTimeoutMs: 50,
    });

    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.reason, "service_unavailable");
    assert.equal(result.service, "cosyvoice3");
  });

  test("lip-sync stage submits expected DUIX body and polls until completion", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "route-a-duix-"));
    const jobId = "m3_test_job";
    const resultPath = path.join(workdir, "duix", jobId, `${jobId}-r.mp4`);
    const requests = [];
    let queryCount = 0;
    const stub = await listen(async (request, response) => {
      requests.push({ method: request.method, url: request.url });
      if (request.method === "GET" && request.url?.startsWith("/easy/query")) {
        queryCount += 1;
        if (request.url.includes(jobId) && queryCount >= 3) {
          await fsp.mkdir(path.dirname(resultPath), { recursive: true });
          await fsp.writeFile(resultPath, "fake mp4");
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ data: { status: 2, progress: 100 } }));
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: { status: 1, progress: 50 } }));
        return;
      }
      if (request.method === "POST" && request.url === "/easy/submit") {
        requests.at(-1).body = await readJson(request);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ success: true, data: { code: jobId } }));
        return;
      }
      response.writeHead(404);
      response.end();
    });

    try {
      const result = await runLipSyncStage({
        workdir,
        sourceVideoPath: "/host/source.mp4",
        dubAudioPath: path.join(workdir, "audio", "duix-dub-44100-mono.wav"),
        jobId,
        baseUrl: stub.baseUrl,
        containerJobDir: `/code/data/jobs/${jobId}`,
        guardTimeoutMs: 500,
        requestTimeoutMs: 500,
        pollIntervalMs: 1,
        timeoutMs: 1000,
      });

      assert.equal(result.ok, true);
      assert.equal(result.outputs.presenterVideoPath, resultPath);
      assert.deepEqual(requests.find((item) => item.url === "/easy/submit").body, {
        code: jobId,
        video_url: `/code/data/jobs/${jobId}/source.mp4`,
        audio_url: `/code/data/jobs/${jobId}/dub.wav`,
        watermark_switch: 0,
        digital_auth: 0,
        chaofen: 0,
        pn: 1,
      });
      assert.ok(requests.filter((item) => item.url?.startsWith("/easy/query")).length >= 3);
    } finally {
      await stub.close();
    }
  });

  test("lip-sync guard returns blocked and never submits when DUIX is unavailable", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "route-a-duix-down-"));
    const result = await runLipSyncStage({
      workdir,
      sourceVideoPath: "/host/source.mp4",
      dubAudioPath: path.join(workdir, "audio", "duix-dub-44100-mono.wav"),
      jobId: "m3_down",
      baseUrl: "http://127.0.0.1:9",
      guardTimeoutMs: 50,
      pollIntervalMs: 1,
      timeoutMs: 50,
    });

    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.reason, "service_unavailable");
    assert.equal(result.service, "duix-heygem");
  });

  test("Route A workflow packages stubbed TTS and DUIX outputs into a valid composed manifest", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "route-a-workflow-up-"));
    const composerRoot = path.resolve(import.meta.dirname, "../../../hyperframes-composer");
    const jobId = "m3_route_a_up";
    const presenterPath = path.join(workdir, "duix", jobId, `${jobId}-r.mp4`);
    const requests = [];
    const stub = await listen(async (request, response) => {
      requests.push({ method: request.method, url: request.url });
      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }
      if (request.method === "POST" && request.url === "/tts") {
        requests.at(-1).body = await readJson(request);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ download_url: `${stub.baseUrl}/download/master.wav`, request_id: "tts-route-a" }));
        return;
      }
      if (request.method === "GET" && request.url === "/download/master.wav") {
        response.writeHead(200, { "content-type": "audio/wav" });
        response.end("fake master wav");
        return;
      }
      if (request.method === "GET" && request.url?.startsWith("/easy/query")) {
        if (request.url.includes(jobId)) {
          await fsp.mkdir(path.dirname(presenterPath), { recursive: true });
          await fsp.writeFile(presenterPath, "fake presenter mp4");
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ data: { status: 2, progress: 100 } }));
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: { status: 0, progress: 0 } }));
        return;
      }
      if (request.method === "POST" && request.url === "/easy/submit") {
        requests.at(-1).body = await readJson(request);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ success: true, data: { code: jobId } }));
        return;
      }
      response.writeHead(404);
      response.end();
    });

    try {
      const result = await runRouteAWorkflow({
        workdir,
        composerRoot,
        sourceVideoPath: "/host/source.mp4",
        topic: "数字人工作流",
        productInfo: { name: "Director Console", audience: "创作者", promise: "从脚本自动出片" },
        ttsBaseUrl: stub.baseUrl,
        duixBaseUrl: stub.baseUrl,
        duixJobId: jobId,
        guardTimeoutMs: 500,
        requestTimeoutMs: 500,
        pollIntervalMs: 1,
        duixTimeoutMs: 1000,
      }, {
        prepareDubAudio: async ({ outputPath }) => {
          await fsp.mkdir(path.dirname(outputPath), { recursive: true });
          await fsp.writeFile(outputPath, "fake dub wav");
          return outputPath;
        },
        runFunasr: async (_audioPath, rawOutputPath) => {
          await fsp.mkdir(path.dirname(rawOutputPath), { recursive: true });
          await fsp.writeFile(
            rawOutputPath,
            JSON.stringify([
              {
                sentence_info: [
                  { start: 0, end: 3200, text: "数字人工作流让脚本声音和口型自动串联。" },
                  { start: 22000, end: 26000, text: "第二段验证主持人画面进入可编辑场景。" },
                ],
              },
            ]),
          );
          return rawOutputPath;
        },
      });

      assert.equal(result.ok, true);
      assert.equal(result.workflowRun.stages.find((stage) => stage.id === "compose").status, "succeeded");
      assert.ok(fs.existsSync(result.outputs.manifestPath));
      assert.ok(fs.existsSync(result.outputs.htmlPath));

      const manifest = JSON.parse(await fsp.readFile(result.outputs.manifestPath, "utf8"));
      assert.equal(manifest.audio.src, result.outputs.masterAudioPath);
      assert.equal(manifest.audio.captions, result.outputs.captionsPath);
      assert.equal(manifest.scenes[0].props.media.presenter, presenterPath);
      assert.equal(manifest.scenes[1].props.media.presenter, presenterPath);
      assert.deepEqual(validateManifest(manifest, { root: composerRoot, manifestPath: result.outputs.manifestPath }), []);
      assert.equal(requests.some((item) => item.url === "/easy/submit"), true);
    } finally {
      await stub.close();
    }
  });

  test("Route A workflow stops at tts needs-review when TTS service is unavailable", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "route-a-workflow-tts-down-"));
    let duixCalled = false;

    const result = await runRouteAWorkflow({
      workdir,
      sourceVideoPath: "/host/source.mp4",
      topic: "服务降级",
      ttsBaseUrl: "http://127.0.0.1:9",
      guardTimeoutMs: 50,
    }, {
      runLipSyncStage: async () => {
        duixCalled = true;
        return { ok: true };
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.stageId, "tts");
    assert.equal(result.workflowRun.stages.find((stage) => stage.id === "tts").status, "needs-review");
    assert.equal(result.workflowRun.errors[0].code, "SERVICE_UNAVAILABLE");
    assert.equal(duixCalled, false);
    assert.equal(fs.existsSync(path.join(workdir, "manifest.json")), false);
  });

  test("Route A workflow stops at lip-sync needs-review when DUIX service is unavailable", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "route-a-workflow-duix-down-"));
    const stub = await listen(async (request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }
      if (request.method === "POST" && request.url === "/tts") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ download_url: `${stub.baseUrl}/download/master.wav` }));
        return;
      }
      if (request.method === "GET" && request.url === "/download/master.wav") {
        response.writeHead(200, { "content-type": "audio/wav" });
        response.end("fake master wav");
        return;
      }
      response.writeHead(404);
      response.end();
    });

    try {
      const result = await runRouteAWorkflow({
        workdir,
        sourceVideoPath: "/host/source.mp4",
        topic: "DUIX 降级",
        ttsBaseUrl: stub.baseUrl,
        duixBaseUrl: "http://127.0.0.1:9",
        guardTimeoutMs: 50,
      }, {
        prepareDubAudio: async ({ outputPath }) => {
          await fsp.mkdir(path.dirname(outputPath), { recursive: true });
          await fsp.writeFile(outputPath, "fake dub wav");
          return outputPath;
        },
      });

      assert.equal(result.ok, false);
      assert.equal(result.blocked, true);
      assert.equal(result.stageId, "lip-sync");
      assert.equal(result.workflowRun.stages.find((stage) => stage.id === "lip-sync").status, "needs-review");
      assert.equal(result.workflowRun.errors[0].code, "SERVICE_UNAVAILABLE");
      assert.equal(fs.existsSync(path.join(workdir, "manifest.json")), false);
    } finally {
      await stub.close();
    }
  });

  test("product script stage writes deterministic product introduction structure", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "product-script-"));
    const missing = await runProductScriptStage({ workdir });
    assert.equal(missing.ok, false);
    assert.match(missing.failures.join("\n"), /productName is required/);

    const result = await runProductScriptStage({
      workdir,
      productName: "Director Console",
      productDescription: "把数字人视频生产变成可编辑工作流",
      sellingPoints: ["脚本到出片", "可编辑包装", "服务不可用可恢复"],
      offerCta: "今天就生成第一条产品介绍视频",
    });

    assert.equal(result.ok, true);
    assert.equal(result.stageId, "product-script");
    assert.match(result.outputs.script.text, /Director Console/);
    assert.deepEqual(
      result.outputs.script.chapters.map((chapter) => chapter.intent),
      ["opening-promise", "product-highlight", "feature-callouts", "comparison-proof", "final-cta"],
    );
    assert.equal(await fsp.readFile(result.outputs.scriptPath, "utf8"), result.outputs.script.text);
  });

  test("product intro manifest maps product scenes to product-oriented components", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "product-manifest-"));
    const composerRoot = path.resolve(import.meta.dirname, "../../../hyperframes-composer");
    const presenterPath = path.join(workdir, "presenter.mp4");
    const productMediaPath = path.join(workdir, "product-demo.mp4");
    const audioPath = path.join(workdir, "master.wav");
    const captionsPath = path.join(workdir, "captions.json");
    await fsp.writeFile(presenterPath, "fake presenter");
    await fsp.writeFile(productMediaPath, "fake product media");
    await fsp.writeFile(audioPath, "fake audio");
    await fsp.writeFile(captionsPath, JSON.stringify({ captions: [] }));
    const transcript = buildTranscript([
      { start: 0, end: 3, text: "开场承诺。", asr_text: "开场承诺。" },
      { start: 4, end: 8, text: "产品亮点。", asr_text: "产品亮点。" },
      { start: 20, end: 24, text: "功能卖点。", asr_text: "功能卖点。" },
      { start: 40, end: 44, text: "对比证明。", asr_text: "对比证明。" },
      { start: 60, end: 64, text: "行动号召。", asr_text: "行动号召。" },
    ]);

    const manifest = buildProductIntroManifestFromScenePlan({
      scenePlan: { scenes: buildScenePlan({ transcript, targetWindowSeconds: 8, maxScenes: 5 }).scenes },
      audioSrc: audioPath,
      captionsPath,
      presenterVideoPath: presenterPath,
      productInfo: {
        productName: "Director Console",
        productDescription: "可编辑数字人产品视频",
        sellingPoints: ["脚本到出片", "可编辑包装", "可恢复"],
        productMedia: [{ src: productMediaPath, label: "产品界面" }],
        offerCta: "立即生成",
      },
      output: path.join(workdir, "index.html"),
    });

    assert.deepEqual(manifest.scenes.map((scene) => scene.component), ["StatsHero", "StepCard", "StepCard", "ProofMontage", "SummaryCta"]);
    assert.equal(manifest.scenes[0].props.media.presenter, presenterPath);
    assert.equal(manifest.scenes[0].props.stat.cornerLeft, "产品介绍");
    assert.equal(manifest.scenes[0].props.stat.unit, "承诺");
    assert.equal(manifest.scenes[0].props.browser.done, "就绪");
    assert.deepEqual(manifest.scenes[0].props.browser.icons, ["承诺", "亮点", "证明", "行动"]);
    assert.equal(manifest.scenes[0].props.titleBeat.cornerLeft, "产品介绍");
    assert.equal(manifest.scenes[0].props.titleBeat.cornerName, "场景 1");
    assert.equal(manifest.scenes[0].props.titleBeat.kicker, "开场承诺");
    assert.equal(manifest.scenes[1].props.kicker, "产品亮点");
    assert.equal(manifest.scenes[2].props.kicker, "卖点说明");
    assert.equal(manifest.scenes[3].props.media.items[0].src, productMediaPath);
    assert.equal(manifest.scenes[4].props.media.presenter, presenterPath);
    assert.equal(manifest.scenes[4].props.chip, "行动号召");
    assert.deepEqual(validateManifest(manifest, { root: composerRoot, manifestPath: path.join(workdir, "manifest.json") }), []);
  });

  test("product intro workflow composes a legal manifest and preserves product CTA", async () => {
    const workdir = await fsp.mkdtemp(path.join(os.tmpdir(), "product-workflow-up-"));
    const composerRoot = path.resolve(import.meta.dirname, "../../../hyperframes-composer");
    const jobId = "m5_product_up";
    const presenterPath = path.join(workdir, "duix", jobId, `${jobId}-r.mp4`);
    const productMediaPath = path.join(workdir, "product-demo.mp4");
    await fsp.writeFile(productMediaPath, "fake product media");
    const stub = await listen(async (request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }
      if (request.method === "POST" && request.url === "/tts") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ download_url: `${stub.baseUrl}/download/master.wav`, request_id: "tts-product" }));
        return;
      }
      if (request.method === "GET" && request.url === "/download/master.wav") {
        response.writeHead(200, { "content-type": "audio/wav" });
        response.end("fake master wav");
        return;
      }
      if (request.method === "GET" && request.url?.startsWith("/easy/query")) {
        if (request.url.includes(jobId)) {
          await fsp.mkdir(path.dirname(presenterPath), { recursive: true });
          await fsp.writeFile(presenterPath, "fake presenter mp4");
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ data: { status: 2, progress: 100 } }));
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: { status: 0, progress: 0 } }));
        return;
      }
      if (request.method === "POST" && request.url === "/easy/submit") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ success: true, data: { code: jobId } }));
        return;
      }
      response.writeHead(404);
      response.end();
    });

    try {
      const result = await runProductIntroWorkflow({
        workdir,
        composerRoot,
        sourceVideoPath: "/host/source.mp4",
        productName: "Director Console",
        productDescription: "把数字人视频生产变成可编辑工作流",
        sellingPoints: ["脚本到出片", "可编辑包装", "服务不可用可恢复"],
        productMedia: [{ src: productMediaPath, label: "产品界面" }],
        offerCta: "立即生成第一条产品介绍视频",
        ttsBaseUrl: stub.baseUrl,
        duixBaseUrl: stub.baseUrl,
        duixJobId: jobId,
        guardTimeoutMs: 500,
        requestTimeoutMs: 500,
        pollIntervalMs: 1,
        duixTimeoutMs: 1000,
      }, {
        prepareDubAudio: async ({ outputPath }) => {
          await fsp.mkdir(path.dirname(outputPath), { recursive: true });
          await fsp.writeFile(outputPath, "fake dub wav");
          return outputPath;
        },
        runFunasr: async (_audioPath, rawOutputPath) => {
          await fsp.mkdir(path.dirname(rawOutputPath), { recursive: true });
          await fsp.writeFile(
            rawOutputPath,
            JSON.stringify([
              {
                sentence_info: [
                  { start: 0, end: 3000, text: "Director Console 帮你承诺更快出片。" },
                  { start: 4000, end: 8000, text: "产品亮点是把脚本声音和画面放到工作流。" },
                  { start: 20000, end: 24000, text: "三个卖点是脚本到出片可编辑包装和可恢复。" },
                  { start: 40000, end: 44000, text: "对比手工流程它有清晰证明和状态记录。" },
                  { start: 60000, end: 64000, text: "现在就生成第一条产品介绍视频。" },
                ],
              },
            ]),
          );
          return rawOutputPath;
        },
      });

      assert.equal(result.ok, true);
      const manifest = JSON.parse(await fsp.readFile(result.outputs.manifestPath, "utf8"));
      assert.deepEqual(manifest.scenes.map((scene) => scene.component), ["StatsHero", "StepCard", "StepCard", "ProofMontage", "SummaryCta"]);
      assert.match(manifest.scenes.at(-1).props.subline, /立即生成/);
      assert.equal(manifest.scenes[3].props.media.items[0].src, productMediaPath);
      assert.ok(fs.existsSync(result.outputs.htmlPath));
      assert.deepEqual(validateManifest(manifest, { root: composerRoot, manifestPath: result.outputs.manifestPath }), []);
    } finally {
      await stub.close();
    }
  });

  test("product intro workflow stops at needs-review when external services are unavailable", async () => {
    const ttsWorkdir = await fsp.mkdtemp(path.join(os.tmpdir(), "product-workflow-tts-down-"));
    const ttsDown = await runProductIntroWorkflow({
      workdir: ttsWorkdir,
      sourceVideoPath: "/host/source.mp4",
      productName: "Director Console",
      productDescription: "可编辑工作流",
      sellingPoints: ["脚本到出片"],
      ttsBaseUrl: "http://127.0.0.1:9",
      guardTimeoutMs: 50,
    });
    assert.equal(ttsDown.ok, false);
    assert.equal(ttsDown.stageId, "tts");
    assert.equal(ttsDown.workflowRun.stages.find((stage) => stage.id === "tts").status, "needs-review");
    assert.equal(fs.existsSync(path.join(ttsWorkdir, "manifest.json")), false);

    const duixWorkdir = await fsp.mkdtemp(path.join(os.tmpdir(), "product-workflow-duix-down-"));
    const stub = await listen(async (request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }
      if (request.method === "POST" && request.url === "/tts") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ download_url: `${stub.baseUrl}/download/master.wav` }));
        return;
      }
      if (request.method === "GET" && request.url === "/download/master.wav") {
        response.writeHead(200, { "content-type": "audio/wav" });
        response.end("fake master wav");
        return;
      }
      response.writeHead(404);
      response.end();
    });

    try {
      const duixDown = await runProductIntroWorkflow({
        workdir: duixWorkdir,
        sourceVideoPath: "/host/source.mp4",
        productName: "Director Console",
        productDescription: "可编辑工作流",
        sellingPoints: ["脚本到出片"],
        ttsBaseUrl: stub.baseUrl,
        duixBaseUrl: "http://127.0.0.1:9",
        guardTimeoutMs: 50,
      }, {
        prepareDubAudio: async ({ outputPath }) => {
          await fsp.mkdir(path.dirname(outputPath), { recursive: true });
          await fsp.writeFile(outputPath, "fake dub wav");
          return outputPath;
        },
      });
      assert.equal(duixDown.ok, false);
      assert.equal(duixDown.stageId, "lip-sync");
      assert.equal(duixDown.workflowRun.stages.find((stage) => stage.id === "lip-sync").status, "needs-review");
      assert.equal(fs.existsSync(path.join(duixWorkdir, "manifest.json")), false);
    } finally {
      await stub.close();
    }
  });
});
