import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { advance, createProjectFromRecipe, setStageState } from "../../protocol/src/index.mjs";

const DEFAULT_FUNASR_PYTHON = "/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python";
const DEFAULT_COSYVOICE3_BASE_URL = "http://127.0.0.1:4090";
const DEFAULT_DUIX_BASE_URL = "http://127.0.0.1:8383";
const DEFAULT_COMPOSER_ROOT = path.resolve(import.meta.dirname, "../../../hyperframes-composer");

export function loadTermMap(filePath = new URL("./term-map.json", import.meta.url)) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyTermFixes(text, termMap = loadTermMap()) {
  let fixed = String(text || "").replace(/\s+/g, " ").trim();
  const entries = Object.entries(termMap).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    const asciiOnly = /^[\x00-\x7F]+$/.test(from);
    const pattern = new RegExp(escapeRegExp(from), asciiOnly ? "gi" : "g");
    fixed = fixed.replace(pattern, to);
  }
  return fixed.replace(/ ，/g, "，").replace(/ 。/g, "。").trim();
}

function roundSeconds(value) {
  return Number((Number(value) / 1000).toFixed(3));
}

export function normalizeFunasrSentences(raw) {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first) return [];
  if (Array.isArray(first.sentence_info) && first.sentence_info.length) {
    return first.sentence_info.map((sentence) => ({
      startMs: Number(sentence.start),
      endMs: Number(sentence.end),
      text: sentence.text || "",
    }));
  }
  if (Array.isArray(first.timestamp) && first.timestamp.length) {
    return first.timestamp.map((pair, index) => ({
      startMs: Number(pair[0]),
      endMs: Number(pair[1]),
      text: `word-${index + 1}`,
    }));
  }
  return [];
}

export function captionsFromFunasr(raw, { termMap = loadTermMap(), source = "funasr_sentence_with_term_fixes" } = {}) {
  return normalizeFunasrSentences(raw)
    .map((sentence) => {
      const asrText = sentence.text || "";
      return {
        start: roundSeconds(sentence.startMs),
        end: roundSeconds(sentence.endMs),
        text: applyTermFixes(asrText, termMap),
        source,
        asr_text: asrText,
      };
    })
    .filter((caption) => caption.text && caption.end > caption.start);
}

export function validateCaptions(captions) {
  const failures = [];
  let previousEnd = -Infinity;
  captions.forEach((caption, index) => {
    if (typeof caption.start !== "number" || typeof caption.end !== "number") failures.push(`caption ${index} start/end must be numbers`);
    if (!(caption.end > caption.start)) failures.push(`caption ${index} end must be greater than start`);
    if (caption.start < previousEnd) failures.push(`caption ${index} starts before previous end`);
    if (!caption.text) failures.push(`caption ${index} text is required`);
    previousEnd = Math.max(previousEnd, Number(caption.end));
  });
  return failures;
}

export function buildTranscript(captions, { language = "zh" } = {}) {
  const segments = captions.map((caption, index) => ({
    index,
    start: caption.start,
    end: caption.end,
    text: caption.text,
    asr_text: caption.asr_text,
  }));
  const start = segments.length ? segments[0].start : 0;
  const end = segments.length ? segments.at(-1).end : 0;
  return {
    language,
    text: segments.map((segment) => segment.text).join(""),
    segments,
    timeline: {
      start,
      end,
      duration: Number((end - start).toFixed(3)),
    },
  };
}

function textWeight(value = "") {
  return [...String(value)].reduce((total, char) => total + (char.charCodeAt(0) > 127 ? 2 : 1), 0);
}

function clipByWeight(value, maxWeight) {
  let output = "";
  let weight = 0;
  for (const char of String(value || "").replace(/\s+/g, " ").trim()) {
    const nextWeight = char.charCodeAt(0) > 127 ? 2 : 1;
    if (weight + nextWeight > maxWeight) break;
    output += char;
    weight += nextWeight;
  }
  return output.trim();
}

function stripPunctuation(value) {
  return String(value || "").replace(/[，。！？；;,.!?：:、]/g, " ").replace(/\s+/g, " ").trim();
}

function sceneTitleFromSegments(segments, fallback) {
  return clipByWeight(stripPunctuation(segments[0]?.text || fallback), 24) || fallback;
}

function compactItem(text, fallback) {
  return clipByWeight(stripPunctuation(text || fallback), 18) || fallback;
}

export function buildScenePlan({ transcript, targetWindowSeconds = 18, maxScenes = 12 } = {}) {
  const segments = transcript?.segments || [];
  if (!segments.length) throw new Error("transcript has no segments");

  const groups = [];
  let current = [];
  for (const segment of segments) {
    if (
      current.length > 0 &&
      (segment.end - current[0].start > targetWindowSeconds || groups.length + 1 >= maxScenes)
    ) {
      groups.push(current);
      current = [];
    }
    current.push(segment);
  }
  if (current.length) groups.push(current);

  return {
    version: 1,
    strategy: "text-only-catalog-components",
    source: {
      language: transcript.language || "zh",
      segments: segments.length,
      timeline: transcript.timeline,
    },
    scenes: groups.map((group, index) => {
      const start = Number(group[0].start.toFixed(3));
      const end = Number(group.at(-1).end.toFixed(3));
      const isOpening = index === 0;
      const component = isOpening ? "TitleCard" : "StepCard";
      return {
        id: `s${String(index + 1).padStart(3, "0")}`,
        start,
        end,
        duration: Number((end - start).toFixed(3)),
        intent: isOpening ? "opening_summary" : "transcript_step",
        componentCandidates: [component],
        segments: group.map((segment) => segment.index),
        summary: sceneTitleFromSegments(group, `场景 ${index + 1}`),
        text: group.map((segment) => segment.text).join(""),
      };
    }),
  };
}

function titleCardScene(planScene, index) {
  return {
    id: planScene.id,
    component: "TitleCard",
    scene_type: "title_card",
    start: planScene.start,
    duration: planScene.duration,
    track: 10 + index * 10,
    props: {
      cornerLeft: "成片导入",
      cornerName: `场景 ${index + 1}`,
      kicker: "自动场景规划",
      title: clipByWeight(planScene.summary, 28) || `场景 ${index + 1}`,
      subline: clipByWeight(stripPunctuation(planScene.text), 44) || "字幕驱动",
    },
  };
}

function stepCardScene(planScene, index) {
  const snippets = planScene.text
    .split(/[。！？；;.!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const items = [0, 1, 2].map((itemIndex) => compactItem(snippets[itemIndex], ["提取重点", "生成场景", "挂载字幕"][itemIndex]));
  return {
    id: planScene.id,
    component: "StepCard",
    scene_type: "step_card",
    start: planScene.start,
    duration: planScene.duration,
    track: 10 + index * 10,
    finePieces: ["StepPanel"],
    props: {
      kicker: `场景 ${String(index + 1).padStart(2, "0")}`,
      title: clipByWeight(planScene.summary, 28) || `场景 ${index + 1}`,
      items,
    },
  };
}

export function buildManifestFromScenePlan({
  scenePlan,
  sourceVideo,
  audioSrc,
  captionsPath,
  output = "index.html",
  compositionId = "route-b-auto",
} = {}) {
  if (!scenePlan?.scenes?.length) throw new Error("scenePlan has no scenes");
  if (!audioSrc) throw new Error("audioSrc is required");
  if (!captionsPath) throw new Error("captionsPath is required");
  const duration = Number(Math.max(...scenePlan.scenes.map((scene) => scene.end)).toFixed(3));
  return {
    compositionId,
    duration,
    source: sourceVideo ? { video: sourceVideo } : undefined,
    output,
    hyperframesEntry: output,
    audio: {
      src: audioSrc,
      captions: captionsPath,
    },
    scenes: scenePlan.scenes.map((planScene, index) =>
      planScene.componentCandidates?.[0] === "TitleCard" ? titleCardScene(planScene, index) : stepCardScene(planScene, index),
    ),
  };
}

export function buildRouteAScenePlan({ transcript, targetWindowSeconds = 18, maxScenes = 6 } = {}) {
  const plan = buildScenePlan({ transcript, targetWindowSeconds, maxScenes });
  return {
    ...plan,
    strategy: "digital-human-presenter-catalog-components",
    scenes: plan.scenes.map((scene, index) => ({
      ...scene,
      intent: index === 0 ? "talking_head_hook_stat" : "talking_head_split_explain",
      componentCandidates: index === 0 ? ["StatsHero", "HeroAroll"] : ["SplitTextPresenter", "HeroAroll"],
    })),
  };
}

function splitCardsFromScene(planScene) {
  const snippets = planScene.text
    .split(/[。！？；;.!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  return [0, 1, 2].map((index) => ({
    icon: ["01", "02", "03"][index],
    label: compactItem(snippets[index], ["脚本", "声音", "成片"][index]),
  }));
}

function statsHeroScene(planScene, index, presenterVideoPath) {
  return {
    id: planScene.id,
    component: "StatsHero",
    scene_type: "hook_stat",
    start: planScene.start,
    duration: planScene.duration,
    track: 10 + index * 10,
    finePieces: ["OpeningSourceVideo", "OpeningStatPunch", "OpeningBrowserFrame"],
    props: {
      media: {
        presenter: presenterVideoPath,
      },
      stat: {
        cornerLeft: "数字人",
        label: "数字人口播",
        number: "01",
        unit: "流程",
        title: clipByWeight(planScene.summary, 24) || "数字人口播",
      },
      browser: {
        done: "就绪",
        icons: ["脚本", "配音", "口型", "字幕", "合成"],
      },
      titleBeat: {
        cornerLeft: "数字人",
        cornerName: `场景 ${index + 1}`,
        kicker: "数字人口播",
        title: clipByWeight(planScene.summary, 28) || "数字人口播",
        subline: clipByWeight(stripPunctuation(planScene.text), 44) || "脚本生成口播视频",
      },
    },
  };
}

function splitPresenterScene(planScene, index, presenterVideoPath) {
  return {
    id: planScene.id,
    component: "SplitTextPresenter",
    scene_type: "concept_split",
    start: planScene.start,
    duration: planScene.duration,
    track: 10 + index * 10,
    finePieces: ["CourseSplitPanel"],
    props: {
      variant: "course",
      cornerName: `场景 ${index + 1}`,
      chip: "数字人",
      kicker: "口播讲解",
      title: clipByWeight(planScene.summary, 28) || `场景 ${index + 1}`,
      cards: splitCardsFromScene(planScene),
      media: {
        presenter: presenterVideoPath,
      },
    },
  };
}

export function buildRouteAManifestFromScenePlan({
  scenePlan,
  audioSrc,
  captionsPath,
  presenterVideoPath,
  output = "index.html",
  compositionId = "route-a-digital-human",
} = {}) {
  if (!scenePlan?.scenes?.length) throw new Error("scenePlan has no scenes");
  if (!audioSrc) throw new Error("audioSrc is required");
  if (!captionsPath) throw new Error("captionsPath is required");
  if (!presenterVideoPath) throw new Error("presenterVideoPath is required");
  const duration = Number(Math.max(...scenePlan.scenes.map((scene) => scene.end)).toFixed(3));
  return {
    compositionId,
    duration,
    output,
    hyperframesEntry: output,
    audio: {
      src: audioSrc,
      captions: captionsPath,
    },
    scenes: scenePlan.scenes.map((planScene, index) =>
      index === 0 ? statsHeroScene(planScene, index, presenterVideoPath) : splitPresenterScene(planScene, index, presenterVideoPath),
    ),
  };
}

function normalizeSellingPoints(sellingPoints) {
  if (Array.isArray(sellingPoints)) return sellingPoints.map((item) => compactLine(item)).filter(Boolean);
  return String(sellingPoints || "")
    .split(/[，,、\n]/)
    .map((item) => compactLine(item))
    .filter(Boolean);
}

function normalizeProductInfo({
  productName,
  productDescription,
  sellingPoints,
  productMedia = [],
  offerCta,
} = {}) {
  return {
    productName: compactLine(productName),
    productDescription: compactLine(productDescription),
    sellingPoints: normalizeSellingPoints(sellingPoints),
    productMedia: Array.isArray(productMedia) ? productMedia : [],
    offerCta: compactLine(offerCta, "立即开始"),
  };
}

function productStatsHeroScene(planScene, index, presenterVideoPath, productInfo) {
  const productName = clipByWeight(productInfo.productName, 24) || "产品";
  return {
    id: planScene.id,
    component: "StatsHero",
    scene_type: "hook_stat",
    start: planScene.start,
    duration: planScene.duration,
    track: 10 + index * 10,
    finePieces: ["OpeningSourceVideo", "OpeningStatPunch", "OpeningBrowserFrame"],
    props: {
      media: { presenter: presenterVideoPath },
      stat: {
        cornerLeft: "产品介绍",
        label: productName,
        number: "01",
        unit: "承诺",
        title: clipByWeight(productInfo.productDescription || planScene.summary, 24) || "产品承诺",
      },
      browser: {
        done: "就绪",
        icons: ["承诺", "亮点", "证明", "行动"],
      },
      titleBeat: {
        cornerLeft: "产品介绍",
        cornerName: `场景 ${index + 1}`,
        kicker: "开场承诺",
        title: productName,
        subline: clipByWeight(productInfo.productDescription || stripPunctuation(planScene.text), 44) || "产品介绍",
      },
    },
  };
}

function productStepScene(planScene, index, productInfo, offset = 0) {
  const points = productInfo.sellingPoints.length ? productInfo.sellingPoints : ["快速理解", "自动生成", "可编辑复用"];
  const rotated = [0, 1, 2].map((itemIndex) => compactItem(points[(itemIndex + offset) % points.length], ["卖点一", "卖点二", "卖点三"][itemIndex]));
  return {
    id: planScene.id,
    component: "StepCard",
    scene_type: "step_card",
    start: planScene.start,
    duration: planScene.duration,
    track: 10 + index * 10,
    finePieces: ["StepPanel"],
    props: {
      kicker: index === 1 ? "产品亮点" : "卖点说明",
      title: clipByWeight(index === 1 ? productInfo.productName : planScene.summary, 28) || `场景 ${index + 1}`,
      items: rotated,
    },
  };
}

function productProofScene(planScene, index, productInfo, presenterVideoPath) {
  const mediaItems = productInfo.productMedia.length
    ? productInfo.productMedia
    : [{ src: presenterVideoPath, label: "产品证明" }];
  return {
    id: planScene.id,
    component: "ProofMontage",
    scene_type: "proof_montage",
    start: planScene.start,
    duration: planScene.duration,
    track: 10 + index * 10,
    props: {
      media: {
        items: mediaItems.slice(0, 3).map((item, itemIndex) => ({
          src: typeof item === "string" ? item : item.src,
          label: compactItem(typeof item === "string" ? `证明 ${itemIndex + 1}` : item.label, `证明 ${itemIndex + 1}`),
          start: planScene.start,
          duration: planScene.duration,
          mediaStart: typeof item === "string" ? 0 : item.mediaStart ?? 0,
        })),
      },
    },
  };
}

function productSummaryCtaScene(planScene, index, presenterVideoPath, productInfo) {
  return {
    id: planScene.id,
    component: "SummaryCta",
    scene_type: "summary_cta",
    start: planScene.start,
    duration: planScene.duration,
    track: 10 + index * 10,
    finePieces: ["CleanArollOverlay"],
    props: {
      media: { presenter: presenterVideoPath },
      chip: "行动号召",
      title: clipByWeight(productInfo.productName, 28) || "下一步",
      subline: clipByWeight(productInfo.offerCta, 44) || "立即开始",
    },
  };
}

function fiveProductScenes(scenePlan) {
  const scenes = scenePlan.scenes || [];
  if (scenes.length >= 5) return scenes.slice(0, 5);
  const start = scenes[0]?.start ?? 0;
  const end = scenes.at(-1)?.end ?? Math.max(start + 15, 15);
  const total = Math.max(5, end - start);
  return Array.from({ length: 5 }, (_, index) => {
    const existing = scenes[index] || scenes.at(-1) || {};
    const sceneStart = Number((start + (total / 5) * index).toFixed(3));
    const sceneEnd = Number((index === 4 ? end : start + (total / 5) * (index + 1)).toFixed(3));
    return {
      ...existing,
      id: existing.id || `p${String(index + 1).padStart(3, "0")}`,
      start: sceneStart,
      end: sceneEnd,
      duration: Number((sceneEnd - sceneStart).toFixed(3)),
      summary: existing.summary || ["开场承诺", "产品亮点", "卖点说明", "对比证明", "行动号召"][index],
      text: existing.text || ["开场承诺", "产品亮点", "卖点说明", "对比证明", "行动号召"][index],
    };
  });
}

export function buildProductIntroManifestFromScenePlan({
  scenePlan,
  audioSrc,
  captionsPath,
  presenterVideoPath,
  productInfo,
  output = "index.html",
  compositionId = "digital-human-product-introduction",
} = {}) {
  if (!scenePlan?.scenes?.length) throw new Error("scenePlan has no scenes");
  if (!audioSrc) throw new Error("audioSrc is required");
  if (!captionsPath) throw new Error("captionsPath is required");
  if (!presenterVideoPath) throw new Error("presenterVideoPath is required");
  const info = normalizeProductInfo(productInfo);
  const planScenes = fiveProductScenes(scenePlan);
  const duration = Number(Math.max(...planScenes.map((scene) => scene.end)).toFixed(3));
  const scenes = planScenes.map((planScene, index) => {
    if (index === 0) return productStatsHeroScene(planScene, index, presenterVideoPath, info);
    if (index === 3) return productProofScene(planScene, index, info, presenterVideoPath);
    if (index === 4) return productSummaryCtaScene(planScene, index, presenterVideoPath, info);
    return productStepScene(planScene, index, info, index - 1);
  });
  return {
    compositionId,
    duration,
    output,
    hyperframesEntry: output,
    audio: {
      src: audioSrc,
      captions: captionsPath,
    },
    scenes,
  };
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
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
      const result = { code, stdout, stderr, command, args };
      if (code === 0 || options.allowFailure) resolve(result);
      else reject(Object.assign(new Error(`${command} exited ${code}: ${stderr || stdout}`), result));
    });
  });
}

export async function probe(inputPath, { ffprobe = process.env.FFPROBE_PATH || "ffprobe" } = {}) {
  const result = await runCommand(ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,duration:format=duration,size",
    "-of",
    "json",
    inputPath,
  ]);
  const raw = JSON.parse(result.stdout);
  const streams = raw.streams || [];
  const video = streams.find((stream) => stream.codec_type === "video") || null;
  const audio = streams.find((stream) => stream.codec_type === "audio") || null;
  return {
    input: inputPath,
    format: {
      duration: raw.format?.duration ? Number(raw.format.duration) : null,
      size: raw.format?.size ? Number(raw.format.size) : null,
    },
    video,
    audio,
    streams,
  };
}

export async function extractAudio(inputPath, outputPath, { ffmpeg = process.env.FFMPEG_PATH || "ffmpeg" } = {}) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await runCommand(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-map",
    "0:a:0",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
  return outputPath;
}

export async function runFunasr(wavPath, rawOutputPath, options = {}) {
  await fsp.mkdir(path.dirname(rawOutputPath), { recursive: true });
  const python = options.python || process.env.FUNASR_PYTHON || process.env.ROUTE_B_FUNASR_PYTHON || DEFAULT_FUNASR_PYTHON;
  const batchSize = String(options.batchSizeSeconds || process.env.FUNASR_BATCH_SIZE_S || 300);
  const script = `
from funasr import AutoModel
import json, sys
audio = sys.argv[1]
out = sys.argv[2]
batch_size_s = int(float(sys.argv[3]))
model = AutoModel(
    model="paraformer-zh",
    vad_model="fsmn-vad",
    punc_model="ct-punc",
    device="cpu",
    disable_update=True,
)
res = model.generate(
    input=audio,
    batch_size_s=batch_size_s,
    sentence_timestamp=True,
)
with open(out, "w", encoding="utf-8") as f:
    json.dump(res, f, ensure_ascii=False, indent=2)
`;
  await runCommand(python, ["-c", script, wavPath, rawOutputPath, batchSize], {
    env: options.env,
  });
  return rawOutputPath;
}

export async function writeJson(filePath, payload) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

async function writeText(filePath, content) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, "utf8");
  return filePath;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function serviceBlocked({ stageId, service, baseUrl, probe, timeoutMs, message }) {
  return {
    ok: false,
    stageId,
    blocked: true,
    reason: "service_unavailable",
    service,
    message,
    diagnostics: {
      baseUrl,
      probe,
      timeoutMs,
    },
  };
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = options.timeoutMs || 2000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

function compactLine(value = "", fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

export async function runScriptStage({ workdir, topic, productInfo = {}, approvedScript, targetDurationSeconds = 45 } = {}) {
  if (!compactLine(topic) && !compactLine(approvedScript)) {
    return {
      ok: false,
      stageId: "script",
      reason: "invalid_input",
      failures: ["topic or approvedScript is required"],
    };
  }
  const text = compactLine(approvedScript) ||
    [
      `今天我们用 ${compactLine(topic, "这个主题")} 做一个清晰的数字人口播。`,
      productInfo.name ? `${productInfo.name} 面向${compactLine(productInfo.audience, "目标用户")}，核心承诺是${compactLine(productInfo.promise, "降低制作成本")}。` : "",
      Array.isArray(productInfo.proofPoints) && productInfo.proofPoints.length ? `关键证据包括：${productInfo.proofPoints.join("、")}。` : "接下来用三个步骤说明价值、流程和结果。",
      "最后，把脚本、声音、口型和可编辑画面串成一个可复用工作流。",
    ]
      .filter(Boolean)
      .join("");

  const targetDir = workdir || (await ensureWorkdir());
  const scriptPath = path.join(targetDir, "script", "script.txt");
  const chapters = [
    {
      id: "c001",
      title: "Hook",
      intent: "hook",
      text: text.slice(0, Math.ceil(text.length / 2)),
      displayHints: [compactLine(topic || productInfo.name || "开场")],
      targetDurationSeconds: Math.round(targetDurationSeconds / 2),
    },
    {
      id: "c002",
      title: "Value",
      intent: "explain",
      text: text.slice(Math.ceil(text.length / 2)),
      displayHints: ["流程", "结果"],
      targetDurationSeconds: Math.max(1, Math.round(targetDurationSeconds / 2)),
    },
  ].filter((chapter) => chapter.text);
  const script = {
    language: "zh",
    text,
    chapters,
    terms: [
      { written: "Claude Code", spoken: "Claude Code" },
      { written: "Director Console", spoken: "Director Console" },
    ],
  };
  await writeText(scriptPath, text);
  return {
    ok: true,
    stageId: "script",
    outputs: {
      scriptPath,
      script,
    },
    artifacts: [scriptPath],
    diagnostics: {
      source: approvedScript ? "approvedScript" : "deterministic_stub",
    },
  };
}

export async function runProductScriptStage({
  workdir,
  productName,
  productDescription,
  sellingPoints,
  productMedia = [],
  offerCta,
  targetDurationSeconds = 60,
} = {}) {
  const info = normalizeProductInfo({ productName, productDescription, sellingPoints, productMedia, offerCta });
  const failures = [];
  if (!info.productName) failures.push("productName is required");
  if (!info.productDescription) failures.push("productDescription is required");
  if (!info.sellingPoints.length) failures.push("sellingPoints is required");
  if (failures.length) return { ok: false, stageId: "product-script", reason: "invalid_input", failures };

  const [firstPoint = "更快完成", secondPoint = "更易编辑", thirdPoint = "更稳交付"] = info.sellingPoints;
  const chapters = [
    {
      id: "p001",
      title: "开场承诺",
      intent: "opening-promise",
      text: `${info.productName} 帮你把${info.productDescription}变成可交付结果。`,
      displayHints: [info.productName, "承诺"],
      targetDurationSeconds: Math.round(targetDurationSeconds * 0.2),
    },
    {
      id: "p002",
      title: "产品亮点",
      intent: "product-highlight",
      text: `它的核心亮点是${firstPoint}，让用户先看到直接价值。`,
      displayHints: [firstPoint],
      targetDurationSeconds: Math.round(targetDurationSeconds * 0.2),
    },
    {
      id: "p003",
      title: "卖点说明",
      intent: "feature-callouts",
      text: `再看三个卖点：${info.sellingPoints.join("、")}。`,
      displayHints: info.sellingPoints.slice(0, 3),
      targetDurationSeconds: Math.round(targetDurationSeconds * 0.25),
    },
    {
      id: "p004",
      title: "对比证明",
      intent: "comparison-proof",
      text: `对比手工流程，${info.productName} 用${secondPoint}和${thirdPoint}证明它更适合持续生产。`,
      displayHints: ["对比", "证明"],
      targetDurationSeconds: Math.round(targetDurationSeconds * 0.2),
    },
    {
      id: "p005",
      title: "行动号召",
      intent: "final-cta",
      text: `${info.offerCta}。`,
      displayHints: ["行动号召"],
      targetDurationSeconds: Math.max(1, Math.round(targetDurationSeconds * 0.15)),
    },
  ];
  const text = chapters.map((chapter) => chapter.text).join("");
  const targetDir = workdir || (await ensureWorkdir());
  const scriptPath = path.join(targetDir, "script", "product-script.txt");
  const script = {
    language: "zh",
    text,
    product: info,
    chapters,
    terms: [{ written: info.productName, spoken: info.productName }],
  };
  await writeText(scriptPath, text);
  return {
    ok: true,
    stageId: "product-script",
    outputs: {
      scriptPath,
      script,
    },
    artifacts: [scriptPath],
    diagnostics: {
      source: "deterministic_product_intro_stub",
    },
  };
}

export async function runTtsStage({
  workdir,
  scriptPath,
  script,
  voiceReference,
  speed = 1,
  baseUrl = process.env.COSYVOICE3_MASTER_API_BASE_URL || DEFAULT_COSYVOICE3_BASE_URL,
  guardTimeoutMs = 2000,
  requestTimeoutMs = 60000,
} = {}) {
  const text = compactLine(script || (scriptPath ? await fsp.readFile(scriptPath, "utf8") : ""));
  if (!text) {
    return { ok: false, stageId: "tts", reason: "invalid_input", failures: ["script text is required"] };
  }
  const base = normalizeBaseUrl(baseUrl);
  try {
    await fetchJson(`${base}/health`, { timeoutMs: guardTimeoutMs });
  } catch {
    return serviceBlocked({
      stageId: "tts",
      service: "cosyvoice3",
      baseUrl: base,
      probe: "GET /health",
      timeoutMs: guardTimeoutMs,
      message: `CosyVoice3 service is unavailable at ${base}; start TTS before running this stage.`,
    });
  }

  const targetDir = workdir || (await ensureWorkdir());
  const audioPath = path.join(targetDir, "audio", "master.wav");
  const ttsMetaPath = path.join(targetDir, "audio", "cosyvoice3.meta.json");
  const meta = await fetchJson(`${base}/tts`, {
    method: "POST",
    timeoutMs: requestTimeoutMs,
    body: JSON.stringify({ text, speed }),
  });
  if (!meta.download_url) throw new Error("CosyVoice3 response missing download_url");
  const download = await fetchWithTimeout(meta.download_url, { timeoutMs: requestTimeoutMs });
  if (!download.ok) throw new Error(`HTTP ${download.status} downloading ${meta.download_url}`);
  await fsp.mkdir(path.dirname(audioPath), { recursive: true });
  await fsp.writeFile(audioPath, Buffer.from(await download.arrayBuffer()));
  await writeJson(ttsMetaPath, {
    ...meta,
    baseUrl: base,
    voiceReference,
  });
  return {
    ok: true,
    stageId: "tts",
    outputs: {
      audioPath,
      ttsMetaPath,
      provider: "cosyvoice3-master-api",
      sampleRate: 24000,
      channels: 1,
      sourceTextHash: sha256(text),
    },
    artifacts: [audioPath, ttsMetaPath],
    diagnostics: {
      baseUrl: base,
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLipSyncStage({
  workdir,
  sourceVideoPath,
  dubAudioPath,
  jobId,
  baseUrl = process.env.DUIX_API_BASE_URL || DEFAULT_DUIX_BASE_URL,
  containerJobDir,
  guardTimeoutMs = 2000,
  requestTimeoutMs = 60000,
  pollIntervalMs = 15000,
  timeoutMs = 3600000,
} = {}) {
  if (!sourceVideoPath) return { ok: false, stageId: "lip-sync", reason: "invalid_input", failures: ["sourceVideoPath is required"] };
  if (!dubAudioPath) return { ok: false, stageId: "lip-sync", reason: "invalid_input", failures: ["dubAudioPath is required"] };
  const id = jobId || `m3_${Date.now()}`;
  const base = normalizeBaseUrl(baseUrl);
  try {
    await fetchJson(`${base}/easy/query?code=__director_probe__`, { timeoutMs: guardTimeoutMs });
  } catch {
    return serviceBlocked({
      stageId: "lip-sync",
      service: "duix-heygem",
      baseUrl: base,
      probe: "GET /easy/query?code=__director_probe__",
      timeoutMs: guardTimeoutMs,
      message: `DUIX/HeyGem gen-video is unavailable at ${base}; start gen-video or configure DUIX_HOST before running this stage.`,
    });
  }

  const targetDir = workdir || (await ensureWorkdir());
  const duixDir = path.join(targetDir, "duix", id);
  const presenterVideoPath = path.join(duixDir, `${id}-r.mp4`);
  const jobDir = containerJobDir || `/code/data/jobs/${id}`;
  const payload = {
    code: id,
    video_url: `${jobDir}/source.mp4`,
    audio_url: `${jobDir}/dub.wav`,
    watermark_switch: 0,
    digital_auth: 0,
    chaofen: 0,
    pn: 1,
  };
  await fsp.mkdir(duixDir, { recursive: true });
  const submitPayloadPath = path.join(duixDir, "submit.json");
  const queryLogPath = path.join(duixDir, "query.log.jsonl");
  await writeJson(submitPayloadPath, payload);
  await fetchJson(`${base}/easy/submit`, {
    method: "POST",
    timeoutMs: requestTimeoutMs,
    body: JSON.stringify(payload),
  });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const query = await fetchJson(`${base}/easy/query?code=${encodeURIComponent(id)}`, { timeoutMs: requestTimeoutMs });
    await fsp.appendFile(queryLogPath, `${JSON.stringify(query)}\n`, "utf8");
    const data = query.data || {};
    const progress = data.progress ?? query.progress;
    if (data.status === 2 && progress === 100) {
      await fsp.access(presenterVideoPath);
      return {
        ok: true,
        stageId: "lip-sync",
        outputs: {
          presenterVideoPath,
          duixJob: {
            jobId: id,
            baseUrl: base,
            submitPayloadPath,
            queryLogPath,
          },
        },
        artifacts: [presenterVideoPath, submitPayloadPath, queryLogPath],
        diagnostics: {
          sourceVideoPath,
          dubAudioPath,
        },
      };
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`timed out waiting for DUIX job ${id}`);
}

export async function ensureWorkdir(workdir) {
  if (workdir) {
    await fsp.mkdir(workdir, { recursive: true });
    return workdir;
  }
  return fsp.mkdtemp(path.join(os.tmpdir(), "director-route-b-"));
}

export async function makeCaptionsPayload({ sourceVideo, sourceAudio, rawAsrPath, rawAsr, termMap }) {
  const captions = captionsFromFunasr(rawAsr, { termMap });
  const failures = validateCaptions(captions);
  if (failures.length) throw new Error(`invalid captions:\n${failures.join("\n")}`);
  return {
    source_video: sourceVideo,
    source_audio: sourceAudio,
    timing_source: rawAsrPath,
    asr_model: "FunASR AutoModel paraformer-zh + fsmn-vad + ct-punc, sentence_timestamp=True",
    timestamp_units: "seconds; converted from FunASR sentence_info millisecond start/end divided by 1000",
    caption_text_policy: "FunASR sentence timestamps with deterministic term fixes; raw text retained in asr_text",
    stats: {
      funasr_sentences: normalizeFunasrSentences(rawAsr).length,
      captions: captions.length,
    },
    captions,
  };
}

export async function prepareDuixDubAudio(inputPath, outputPath, { ffmpeg = process.env.FFMPEG_PATH || "ffmpeg" } = {}) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await runCommand(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "44100",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
  return outputPath;
}

async function runComposerManifest(manifestPath, { composerRoot = DEFAULT_COMPOSER_ROOT } = {}) {
  const validate = await runCommand("npm", ["run", "validate:manifest", "--", manifestPath], { cwd: composerRoot });
  const compose = await runCommand("npm", ["run", "compose", "--", manifestPath], { cwd: composerRoot });
  return { validate, compose };
}

function appendWorkflowError(workflowRun, { stageId, code, message }) {
  return {
    ...workflowRun,
    errors: [
      ...(workflowRun.errors || []),
      {
        stageId,
        code,
        message,
      },
    ],
  };
}

function patchWorkflowStage(workflowRun, stageId, patch) {
  return {
    ...workflowRun,
    stages: workflowRun.stages.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage)),
  };
}

function failIfWorkflowInvalid(result) {
  if (result.failures?.length) throw new Error(result.failures.join("\n"));
  return result.value;
}

function makeWorkflowDriver(initialWorkflowRun, { now = () => new Date().toISOString() } = {}) {
  let workflowRun = initialWorkflowRun;
  return {
    get value() {
      return workflowRun;
    },
    begin(stageId) {
      const stage = workflowRun.stages.find((item) => item.id === stageId);
      if (!stage) throw new Error(`stage "${stageId}" was not found`);
      if (stage.status === "not-started") workflowRun = failIfWorkflowInvalid(advance(workflowRun, { now: now() }));
      workflowRun = failIfWorkflowInvalid(setStageState(workflowRun, stageId, "running", { now: now() }));
      return workflowRun;
    },
    succeed(stageId, outputs = {}) {
      workflowRun = failIfWorkflowInvalid(setStageState(workflowRun, stageId, "succeeded", { now: now() }));
      workflowRun = patchWorkflowStage(workflowRun, stageId, { outputs });
      return workflowRun;
    },
    needsReview(stageId, blockedResult) {
      workflowRun = failIfWorkflowInvalid(setStageState(workflowRun, stageId, "needs-review", { now: now() }));
      workflowRun = patchWorkflowStage(workflowRun, stageId, {
        errors: [
          {
            code: "SERVICE_UNAVAILABLE",
            message: blockedResult.message,
            service: blockedResult.service,
          },
        ],
      });
      workflowRun = appendWorkflowError(workflowRun, {
        stageId,
        code: "SERVICE_UNAVAILABLE",
        message: blockedResult.message,
      });
      return workflowRun;
    },
    fail(stageId, failures = []) {
      workflowRun = failIfWorkflowInvalid(setStageState(workflowRun, stageId, "failed", { now: now() }));
      workflowRun = patchWorkflowStage(workflowRun, stageId, {
        errors: failures.map((message) => ({ code: "STAGE_FAILED", message })),
      });
      return workflowRun;
    },
  };
}

async function runDigitalHumanWorkflow(
  {
    workdir,
    projectId = "route-a-project",
    name = projectId,
    recipeId = "digital-human-talking-head",
    scriptStageId = "script",
    topic,
    productInfo = {},
    approvedScript,
    sourceVideoPath,
    voiceReference,
    ttsBaseUrl = process.env.COSYVOICE3_MASTER_API_BASE_URL || DEFAULT_COSYVOICE3_BASE_URL,
    duixBaseUrl = process.env.DUIX_API_BASE_URL || DEFAULT_DUIX_BASE_URL,
    duixJobId,
    containerJobDir,
    composerRoot = DEFAULT_COMPOSER_ROOT,
    guardTimeoutMs = 2000,
    requestTimeoutMs = 60000,
    pollIntervalMs = 15000,
    duixTimeoutMs = 3600000,
    termMap = loadTermMap(),
    now = () => new Date().toISOString(),
    scriptStageInput = {},
    scriptStageRunner = runScriptStage,
    scenePlanBuilder = buildRouteAScenePlan,
    manifestBuilder = buildRouteAManifestFromScenePlan,
  } = {},
  deps = {},
) {
  const targetDir = await ensureWorkdir(workdir);
  const created = createProjectFromRecipe(
    recipeId,
    { topic, productInfo, approvedScript, sourceVideoPath, voiceReference, ...scriptStageInput },
    { projectId, name, now: now() },
  );
  if (created.failures?.length) return { ok: false, failures: created.failures };
  const workflow = makeWorkflowDriver(created.workflowRun, { now });

  workflow.begin(scriptStageId);
  const scriptResult = await (deps.runScriptStage || scriptStageRunner)({
    workdir: targetDir,
    topic,
    productInfo,
    approvedScript,
    ...scriptStageInput,
  });
  if (!scriptResult.ok) {
    const failures = scriptResult.failures || [scriptResult.reason];
    workflow.fail(scriptStageId, failures);
    return { ok: false, stageId: scriptStageId, failures, workflowRun: workflow.value };
  }
  workflow.succeed(scriptStageId, scriptResult.outputs);

  workflow.begin("tts");
  const ttsResult = await (deps.runTtsStage || runTtsStage)({
    workdir: targetDir,
    script: scriptResult.outputs.script.text,
    voiceReference,
    baseUrl: ttsBaseUrl,
    guardTimeoutMs,
    requestTimeoutMs,
  });
  if (ttsResult.blocked) {
    workflow.needsReview("tts", ttsResult);
    return { ok: false, blocked: true, stageId: "tts", result: ttsResult, workflowRun: workflow.value };
  }
  if (!ttsResult.ok) {
    const failures = ttsResult.failures || [ttsResult.reason];
    workflow.fail("tts", failures);
    return { ok: false, stageId: "tts", failures, workflowRun: workflow.value };
  }
  workflow.succeed("tts", ttsResult.outputs);

  const dubAudioPath = path.join(targetDir, "audio", "duix-dub-44100-mono.wav");
  await (deps.prepareDubAudio || (({ inputPath, outputPath }) => prepareDuixDubAudio(inputPath, outputPath)))({
    inputPath: ttsResult.outputs.audioPath,
    outputPath: dubAudioPath,
  });

  workflow.begin("lip-sync");
  const lipSyncResult = await (deps.runLipSyncStage || runLipSyncStage)({
    workdir: targetDir,
    sourceVideoPath,
    dubAudioPath,
    jobId: duixJobId,
    baseUrl: duixBaseUrl,
    containerJobDir,
    guardTimeoutMs,
    requestTimeoutMs,
    pollIntervalMs,
    timeoutMs: duixTimeoutMs,
  });
  if (lipSyncResult.blocked) {
    workflow.needsReview("lip-sync", lipSyncResult);
    return { ok: false, blocked: true, stageId: "lip-sync", result: lipSyncResult, workflowRun: workflow.value };
  }
  if (!lipSyncResult.ok) {
    const failures = lipSyncResult.failures || [lipSyncResult.reason];
    workflow.fail("lip-sync", failures);
    return { ok: false, stageId: "lip-sync", failures, workflowRun: workflow.value };
  }
  workflow.succeed("lip-sync", { ...lipSyncResult.outputs, dubAudioPath });

  workflow.begin("asr");
  const rawAsrPath = path.join(targetDir, "asr", "funasr.raw.json");
  await (deps.runFunasr || runFunasr)(ttsResult.outputs.audioPath, rawAsrPath);
  const rawAsr = JSON.parse(await fsp.readFile(rawAsrPath, "utf8"));
  const captionsPath = path.join(targetDir, "captions.json");
  const captionsPayload = await makeCaptionsPayload({
    sourceVideo: lipSyncResult.outputs.presenterVideoPath,
    sourceAudio: ttsResult.outputs.audioPath,
    rawAsrPath,
    rawAsr,
    termMap,
  });
  await writeJson(captionsPath, captionsPayload);
  workflow.succeed("asr", { rawAsrPath, captionsPath, captions: captionsPayload.captions.length });

  workflow.begin("scene-plan");
  const transcript = buildTranscript(captionsPayload.captions);
  const transcriptPath = path.join(targetDir, "transcript.json");
  const transcriptPayload = {
    source_video: lipSyncResult.outputs.presenterVideoPath,
    source_captions: captionsPath,
    ...transcript,
  };
  await writeJson(transcriptPath, transcriptPayload);
  const scenePlan = scenePlanBuilder({ transcript: transcriptPayload, productInfo: scriptResult.outputs.script.product || productInfo });
  const scenePlanPath = path.join(targetDir, "scene-plan.json");
  await writeJson(scenePlanPath, scenePlan);
  workflow.succeed("scene-plan", { transcriptPath, scenePlanPath, scenes: scenePlan.scenes.length });

  workflow.begin("packaging");
  const manifestPath = path.join(targetDir, "manifest.json");
  const htmlPath = path.join(targetDir, "index.html");
  const manifest = manifestBuilder({
    scenePlan,
    audioSrc: ttsResult.outputs.audioPath,
    captionsPath,
    presenterVideoPath: lipSyncResult.outputs.presenterVideoPath,
    productInfo: scriptResult.outputs.script.product || productInfo,
    output: htmlPath,
  });
  await writeJson(manifestPath, manifest);
  workflow.succeed("packaging", { manifestPath, presenterVideoPath: lipSyncResult.outputs.presenterVideoPath });

  workflow.begin("compose");
  await (deps.composeManifest || runComposerManifest)(manifestPath, { composerRoot });
  workflow.succeed("compose", { htmlPath });

  return {
    ok: true,
    project: created.project,
    workflowRun: workflow.value,
    outputs: {
      workdir: targetDir,
      scriptPath: scriptResult.outputs.scriptPath,
      masterAudioPath: ttsResult.outputs.audioPath,
      dubAudioPath,
      presenterVideoPath: lipSyncResult.outputs.presenterVideoPath,
      rawAsrPath,
      captionsPath,
      transcriptPath,
      scenePlanPath,
      manifestPath,
      htmlPath,
      scenes: scenePlan.scenes.length,
      captions: captionsPayload.captions.length,
    },
  };
}

export async function runRouteAWorkflow(options = {}, deps = {}) {
  return runDigitalHumanWorkflow(options, deps);
}

export async function runProductIntroWorkflow(options = {}, deps = {}) {
  const productInfo = normalizeProductInfo(options);
  return runDigitalHumanWorkflow(
    {
      ...options,
      projectId: options.projectId || "product-intro-project",
      recipeId: "digital-human-product-introduction",
      scriptStageId: "product-script",
      productInfo,
      scriptStageInput: productInfo,
      scriptStageRunner: runProductScriptStage,
      scenePlanBuilder: ({ transcript }) => buildScenePlan({ transcript, targetWindowSeconds: 8, maxScenes: 5 }),
      manifestBuilder: buildProductIntroManifestFromScenePlan,
    },
    deps,
  );
}
