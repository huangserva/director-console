import { validateManifest } from "./manifest-rules.mjs";

const base = {
  compositionId: "test",
  duration: 10,
  scenes: [
    {
      id: "s001",
      component: "StatsHero",
      scene_type: "hook_stat",
      start: 0,
      duration: 10,
      finePieces: ["OpeningSourceVideo"],
      parts: { stat: { duration: 2 } },
      props: {
        media: { presenter: "sample.mp4" },
        stat: { label: "COUNT", number: "7", unit: "场", title: "测试" },
        browser: {},
        titleBeat: { title: "Test" }
      }
    }
  ]
};

const cases = [
  ["unknown component", { ...base, scenes: [{ ...base.scenes[0], component: "MadeUp" }] }],
  ["illegal scene_type", { ...base, scenes: [{ ...base.scenes[0], scene_type: "screen_demo_pip" }] }],
  ["illegal fine piece parent", { ...base, scenes: [{ ...base.scenes[0], finePieces: ["CircularPip"] }] }],
  ["face obstruction", { ...base, scenes: [{ ...base.scenes[0], props: { ...base.scenes[0].props, centerCard: true } }] }],
  ["text budget", { ...base, scenes: [{ ...base.scenes[0], props: { ...base.scenes[0].props, titleBeat: { title: "这是一个明显超出标题预算的超长中文标题应该失败" } } }] }]
];

for (const [name, manifest] of cases) {
  const failures = validateManifest(manifest, { checkMedia: false });
  if (!failures.length) {
    console.error(`expected validator failure for ${name}`);
    process.exit(1);
  }
}

const passingFailures = validateManifest(base, { checkMedia: false });
if (passingFailures.length) {
  console.error(`expected base manifest to pass:\n${passingFailures.join("\n")}`);
  process.exit(1);
}

console.log("hyperframes-composer validator negative tests passed");
