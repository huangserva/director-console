#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import {
  buildTranscript,
  buildManifestFromScenePlan,
  buildScenePlan,
  ensureWorkdir,
  extractAudio,
  loadTermMap,
  makeCaptionsPayload,
  probe,
  runFunasr,
  writeJson,
} from "./stages.mjs";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}

function printUsage() {
  console.error(`Usage:
  node src/cli.mjs --input <video.mp4> [--workdir <dir>] [--captions <captions.json>] [--transcript <transcript.json>]

Options:
  --input       Finished MP4 with an audio stream.
  --workdir     Working directory for metadata, extracted WAV, and raw ASR JSON. Defaults to /tmp/director-route-b-*.
  --audio       Extracted WAV path. Defaults to <workdir>/audio/asr.wav.
  --raw-asr     Raw FunASR JSON path. Defaults to <workdir>/asr/funasr.raw.json.
  --captions    Composer-ready captions output. Defaults to <workdir>/captions.json.
  --transcript  Transcript output. Defaults to <workdir>/transcript.json.
  --scene-plan  Scene-plan output. Defaults to <workdir>/scene-plan.json.
  --manifest    Composer manifest output. Defaults to <workdir>/manifest.json.
  --html        Composer HTML output path embedded in the manifest. Defaults to <workdir>/index.html.
  --term-map    Editable term-map JSON. Defaults to src/term-map.json.
  --reuse-raw   Reuse --raw-asr if it exists; still writes captions/transcript.
`);
}

async function main() {
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  loadEnvFile(path.join(repoRoot, ".env.local"));
  loadEnvFile(path.join(import.meta.dirname, "../.env.local"));

  const args = parseArgs(process.argv.slice(2));
  if (!args.input || args.help) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const input = path.resolve(String(args.input));
  const workdir = await ensureWorkdir(args.workdir ? path.resolve(String(args.workdir)) : undefined);
  const metadataPath = path.resolve(String(args.metadata || path.join(workdir, "metadata.json")));
  const audioPath = path.resolve(String(args.audio || path.join(workdir, "audio", "asr.wav")));
  const rawAsrPath = path.resolve(String(args["raw-asr"] || path.join(workdir, "asr", "funasr.raw.json")));
  const captionsPath = path.resolve(String(args.captions || path.join(workdir, "captions.json")));
  const transcriptPath = path.resolve(String(args.transcript || path.join(workdir, "transcript.json")));
  const scenePlanPath = path.resolve(String(args["scene-plan"] || path.join(workdir, "scene-plan.json")));
  const manifestPath = path.resolve(String(args.manifest || path.join(workdir, "manifest.json")));
  const htmlPath = path.resolve(String(args.html || path.join(workdir, "index.html")));
  const termMapPath = args["term-map"] ? path.resolve(String(args["term-map"])) : undefined;

  const metadata = await probe(input);
  if (!metadata.audio) throw new Error(`input has no audio stream: ${input}`);
  await writeJson(metadataPath, metadata);

  await extractAudio(input, audioPath);

  if (!args["reuse-raw"] || !fs.existsSync(rawAsrPath)) {
    await runFunasr(audioPath, rawAsrPath);
  }

  const rawAsr = JSON.parse(await fsp.readFile(rawAsrPath, "utf8"));
  const captionsPayload = await makeCaptionsPayload({
    sourceVideo: input,
    sourceAudio: audioPath,
    rawAsrPath,
    rawAsr,
    termMap: loadTermMap(termMapPath),
  });
  await writeJson(captionsPath, captionsPayload);

  const transcript = buildTranscript(captionsPayload.captions);
  const transcriptPayload = {
    source_video: input,
    source_captions: captionsPath,
    ...transcript,
  };
  await writeJson(transcriptPath, transcriptPayload);

  const scenePlan = buildScenePlan({ transcript: transcriptPayload });
  await writeJson(scenePlanPath, scenePlan);

  const manifest = buildManifestFromScenePlan({
    scenePlan,
    sourceVideo: input,
    audioSrc: audioPath,
    captionsPath,
    output: htmlPath,
  });
  await writeJson(manifestPath, manifest);

  console.log(
    JSON.stringify(
      {
        ok: true,
        workdir,
        metadataPath,
        audioPath,
        rawAsrPath,
        captionsPath,
        transcriptPath,
        scenePlanPath,
        manifestPath,
        htmlPath,
        captions: captionsPayload.captions.length,
        scenes: scenePlan.scenes.length,
        duration: metadata.format.duration,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
