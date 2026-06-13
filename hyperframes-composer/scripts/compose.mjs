import fs from "node:fs";
import path from "node:path";
import { renderCompositionDocument } from "../blocks/composition-shell.mjs";
import { renderTimelineScript } from "../components/timelines.mjs";

const root = process.cwd();
const manifestPath = path.resolve(root, process.argv[2] || "manifests/memos-v3.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (manifest.audio?.captions) {
  const candidatePaths = [
    path.resolve(path.dirname(manifestPath), manifest.audio.captions),
    path.resolve(root, manifest.audio.captions),
  ];
  const captionsPath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!captionsPath) throw new Error(`captions file not found: ${manifest.audio.captions}`);
  manifest.captions = JSON.parse(fs.readFileSync(captionsPath, "utf8")).captions || [];
}

const outPath = path.resolve(root, manifest.output || process.env.HYPERFRAMES_COMPOSER_OUTPUT || "index.generated.html");
const html = renderCompositionDocument(manifest, { timelineScript: renderTimelineScript(manifest) });
fs.writeFileSync(outPath, html, "utf8");
const entryPath = manifest.hyperframesEntry ? path.resolve(root, manifest.hyperframesEntry) : null;
if (entryPath && entryPath !== outPath) {
  fs.writeFileSync(entryPath, html, "utf8");
}
const auditCopyPath = manifest.auditCopy ? path.resolve(root, manifest.auditCopy) : null;
if (auditCopyPath) {
  fs.mkdirSync(path.dirname(auditCopyPath), { recursive: true });
  fs.writeFileSync(auditCopyPath, html, "utf8");
}
console.log(`Wrote ${path.relative(root, outPath)}${entryPath ? ` and ${path.relative(root, entryPath)}` : ""} scenes=${manifest.scenes.length} duration=${manifest.duration}s`);
