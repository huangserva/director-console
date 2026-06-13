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
const html = readFileSync(path.join(composerRoot, "components", "html.mjs"), "utf8"); // renderCards 的 course-card/card-icon/course-big 在此

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

describe("composer 漂移护栏：SummaryCta port（summary-cta.ts）", () => {
  it("timelines.mjs 仍有 .clean-aroll-copy(0.78) + .clean-title(1.02) 入场", () => {
    expect(timelines).toContain(".clean-aroll-copy");
    expect(timelines).toContain("scene.start + 0.78");
    expect(timelines).toContain("scene.start + 1.02");
  });
  it("registry.mjs renderSummaryCta 仍产出 clean-aroll-copy/clean-chip/clean-title/clean-sub", () => {
    for (const cls of ["clean-aroll-copy", "clean-chip", "clean-title", "clean-sub"]) expect(registry).toContain(cls);
  });
});

describe("composer 漂移护栏：SplitTextPresenter port（split-text-presenter.ts）", () => {
  it("timelines.mjs 仍有 course 分支的 .course-card stagger(0.40) + .course-presenter(1.36)", () => {
    expect(timelines).toContain(".course-card");
    expect(timelines).toContain("scene.start + 0.40");
    expect(timelines).toContain(".course-presenter");
    expect(timelines).toContain("scene.start + 1.36");
  });
  it("registry.mjs renderSplitTextPresenter(course) 仍产出 course-chip/course-heading/course-presenter", () => {
    for (const cls of ["course-chip", "course-heading", "course-presenter"]) expect(registry).toContain(cls);
  });
  it("html.mjs renderCards 仍产出 course-card/card-icon/course-big（cards 的 class 在 html.mjs）", () => {
    for (const cls of ["course-card", "card-icon", "course-big"]) expect(html).toContain(cls);
  });
});

describe("composer 漂移护栏：ProofMontage port（proof-montage.ts，作者级入场复用 composer 类名）", () => {
  it("registry.mjs renderProofMontage 仍产出 proof-grid/proof-card/proof-label", () => {
    for (const cls of ["proof-grid", "proof-card", "proof-label"]) expect(registry).toContain(cls);
  });
});

describe("composer 漂移护栏：HeroAroll port（hero-aroll.ts，port rich fade-up 入场）", () => {
  it("registry.mjs renderHeroAroll 仍产出 clean-aroll-hero-copy/clean-title（rich 才出 copy，sample 带 animation.in）", () => {
    for (const cls of ["clean-aroll-hero-copy", "clean-title"]) expect(registry).toContain(cls);
  });
});
