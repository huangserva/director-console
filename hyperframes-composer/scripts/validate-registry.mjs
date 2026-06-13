import fs from "node:fs";
import path from "node:path";
import { registry, renderScene } from "../components/registry.mjs";

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, "components", "catalog.json"), "utf8"));
const css = fs.readFileSync(path.join(root, "components", "hyperframes-tech-talk.css"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "component-props.schema.json"), "utf8"));
const blockPath = path.join(root, "blocks", "composition-shell.mjs");

const failures = [];
function fail(message) {
  failures.push(message);
}

for (const component of catalog.coarseSceneComponents) {
  const entry = registry[component.id];
  if (!entry) {
    fail(`missing registry component ${component.id}`);
    continue;
  }
  for (const sceneType of component.sceneTypes) {
    if (!entry.sceneTypes.includes(sceneType)) fail(`${component.id} missing sceneType ${sceneType}`);
  }
if (!schema.$defs?.[component.id]) fail(`missing props schema for ${component.id}`);
}

if (!fs.existsSync(blockPath)) fail("missing registry block blocks/composition-shell.mjs");

for (const piece of catalog.controlledFinePieces) {
  for (const className of piece.lockedClasses) {
    if (!css.includes(`.${className}`)) fail(`CSS missing locked class .${className} for ${piece.id}`);
  }
}

const samples = {
  StatsHero: {
    id: "sample-stats",
    component: "StatsHero",
    scene_type: "hook_stat",
    start: 0,
    duration: 12,
    props: {
      media: { presenter: "sample.mp4" },
      stat: { cornerLeft: "SAMPLE", label: "COUNT", number: "7", unit: "场", title: "测试" },
      browser: { done: "Done", icons: ["AI"] },
      titleBeat: { title: "Sample" }
    }
  },
  TitleCard: { id: "sample-title", component: "TitleCard", scene_type: "title_card", start: 0, duration: 3, props: { title: "Sample" } },
  SplitTextPresenter: { id: "sample-split", component: "SplitTextPresenter", scene_type: "concept_split", start: 0, duration: 5, props: { variant: "course", chip: "CHIP", kicker: "KICKER", title: "标题", cards: [], media: { presenter: "sample.mp4" } } },
  ScreenWithPip: { id: "sample-screen", component: "ScreenWithPip", scene_type: "screen_demo_pip", start: 0, duration: 5, props: { label: "Screen", media: { screen: "screen.mp4", pip: "pip.mp4" } } },
  HeroAroll: { id: "sample-hero", component: "HeroAroll", scene_type: "aroll_emphasis", start: 0, duration: 5, props: { media: { presenter: "sample.mp4" } } },
  StepCard: { id: "sample-step", component: "StepCard", scene_type: "step_card", start: 0, duration: 5, props: { kicker: "STEP", title: "标题", items: ["一", "二", "三"] } },
  ProofMontage: { id: "sample-proof", component: "ProofMontage", scene_type: "proof_montage", start: 0, duration: 5, props: { media: { items: [{ src: "sample.mp4", label: "Proof" }] } } },
  SummaryCta: { id: "sample-cta", component: "SummaryCta", scene_type: "summary_cta", start: 0, duration: 5, props: { media: { presenter: "sample.mp4" }, chip: "CTA", title: "标题", subline: "副标题" } }
};

for (const [id, sample] of Object.entries(samples)) {
  try {
    const html = renderScene(sample);
    if (!html.includes(sample.id) && id !== "StatsHero") fail(`${id} sample render missing id`);
    if (html.includes("Unsupported")) fail(`${id} sample rendered unsupported marker`);
  } catch (error) {
    fail(`${id} sample render failed: ${error.message}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("hyperframes-composer registry validation passed");
