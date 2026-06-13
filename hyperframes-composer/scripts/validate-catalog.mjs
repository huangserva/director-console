import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "components", "catalog.json");
const requiredCoarse = [
  "StatsHero",
  "TitleCard",
  "SplitTextPresenter",
  "ScreenWithPip",
  "HeroAroll",
  "StepCard",
  "ProofMontage",
  "SummaryCta",
];
const requiredFine = [
  "OpeningSourceVideo",
  "OpeningStatPunch",
  "OpeningBrowserFrame",
  "CourseSplitPanel",
  "QuestionMapPanel",
  "DefinitionPanel",
  "DefinitionFlowOverlay",
  "DefinitionCreatePanel",
  "DefinitionOneSentencePanel",
  "ScreenShell",
  "CircularPip",
  "StepPanel",
  "ScanLine",
  "CleanArollOverlay",
  "CaptionLine",
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!fs.existsSync(catalogPath)) {
  fail(`missing ${path.relative(root, catalogPath)}`);
  process.exit();
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const coarseIds = new Set((catalog.coarseSceneComponents || []).map((component) => component.id));
const fineIds = new Set((catalog.controlledFinePieces || []).map((component) => component.id));

for (const id of requiredCoarse) {
  if (!coarseIds.has(id)) fail(`missing coarse component ${id}`);
}

for (const id of requiredFine) {
  if (!fineIds.has(id)) fail(`missing controlled fine piece ${id}`);
}

for (const component of catalog.coarseSceneComponents || []) {
  if (!component.sceneTypes?.length) fail(`${component.id} missing sceneTypes`);
  if (!component.sourceRefs?.length) fail(`${component.id} missing sourceRefs`);
  if (!component.layer) fail(`${component.id} missing layer`);
}

for (const component of catalog.controlledFinePieces || []) {
  if (!component.parentComponents?.length) fail(`${component.id} missing parentComponents`);
  if (!component.sourceRefs?.length) fail(`${component.id} missing sourceRefs`);
  if (!component.lockedClasses?.length) fail(`${component.id} missing lockedClasses`);
}

if (!process.exitCode) {
  console.log("hyperframes-composer catalog validation passed");
}
