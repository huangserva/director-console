// 漂移护栏（G2）：console-web 的 buildTimeline 是从 composer timelines.mjs 逐字 port 的拷贝，class 名/关键 beat
// 偏移则两边会漂移。本测试断言 composer 源里仍有这些 port 所依赖的 class 名与 beat 偏移；composer 改了 → 本测试
// 失败 → 提示「有意更新 component-defs 里对应的 port」。不跑 gsap，只对源做 substring 断言（确定、无 DOM）。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const composerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../hyperframes-composer");
const timelines = readFileSync(path.join(composerRoot, "components", "timelines.mjs"), "utf8");
const registry = readFileSync(path.join(composerRoot, "components", "registry.mjs"), "utf8");

describe("composer 漂移护栏：StatsHero port（stats-hero.ts）", () => {
  it("timelines.mjs 仍有 StatsHero 三个 beat 起点（0.705/2.539/9.781）", () => {
    expect(timelines).toContain("stats.start + 0.705");
    expect(timelines).toContain("stats.start + 2.539");
    expect(timelines).toContain("stats.start + 9.781");
  });
  it("timelines.mjs 仍以 .stat-number / .icon-cloud span 为动效目标", () => {
    expect(timelines).toContain(".stat-number");
    expect(timelines).toContain(".icon-cloud span");
  });
  it("registry.mjs renderOpeningStat 仍产出 -stat/-browser/-title 子场景 + 关键 class", () => {
    expect(registry).toContain("${scene.id}-stat");
    expect(registry).toContain("${scene.id}-browser");
    expect(registry).toContain("${scene.id}-title");
    for (const cls of ["stat-pack", "stat-number", "icon-cloud", "browser-video-card"]) expect(registry).toContain(cls);
  });
});

describe("composer 漂移护栏：StepCard port（step-card.ts）", () => {
  it("timelines.mjs 仍有 .step-item 逐条 stagger 在 scene.start + 0.89", () => {
    expect(timelines).toContain(".step-item");
    expect(timelines).toContain("scene.start + 0.89");
    expect(timelines).toContain(".step-panel");
  });
  it("registry.mjs renderStepCard 仍产出 step-panel/step-kicker/step-title/step-item", () => {
    for (const cls of ["step-panel", "step-kicker", "step-title", "step-item"]) expect(registry).toContain(cls);
  });
});

describe("composer 漂移护栏：TitleCard port（title-card.ts）", () => {
  it("registry.mjs renderTitleCard 仍产出 title-block/main-title/title-kicker/title-sub/underline-stack", () => {
    for (const cls of ["title-block", "main-title", "title-kicker", "title-sub", "underline-stack"]) expect(registry).toContain(cls);
  });
});
