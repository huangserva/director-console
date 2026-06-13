#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { runRouteAWorkflow } from "./stages.mjs";

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
  node src/route-a-cli.mjs --source-video <source.mp4> (--topic <topic> | --approved-script <text>) [--workdir <dir>]

Options:
  --source-video       Presenter source video for DUIX lip-sync.
  --topic              Topic used by the deterministic script stage.
  --approved-script    Pre-approved narration script; bypasses generated copy.
  --workdir            Working directory for all Route A artifacts.
  --composer-root      Hyperframes composer root. Defaults to ../../../hyperframes-composer.
  --tts-base-url       CosyVoice3 base URL. Defaults to COSYVOICE3_MASTER_API_BASE_URL or :4090.
  --duix-base-url      DUIX/HeyGem base URL. Defaults to DUIX_API_BASE_URL or :8383.
  --duix-job-id        Stable DUIX job id.
`);
}

async function main() {
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  loadEnvFile(path.join(repoRoot, ".env.local"));
  loadEnvFile(path.join(import.meta.dirname, "../.env.local"));

  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args["source-video"] || (!args.topic && !args["approved-script"])) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const result = await runRouteAWorkflow({
    workdir: args.workdir ? path.resolve(String(args.workdir)) : undefined,
    sourceVideoPath: path.resolve(String(args["source-video"])),
    topic: args.topic ? String(args.topic) : undefined,
    approvedScript: args["approved-script"] ? String(args["approved-script"]) : undefined,
    composerRoot: args["composer-root"] ? path.resolve(String(args["composer-root"])) : undefined,
    ttsBaseUrl: args["tts-base-url"] ? String(args["tts-base-url"]) : undefined,
    duixBaseUrl: args["duix-base-url"] ? String(args["duix-base-url"]) : undefined,
    duixJobId: args["duix-job-id"] ? String(args["duix-job-id"]) : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 2);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
