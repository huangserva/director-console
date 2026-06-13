import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanCard } from "../lib/packaging-plan";
import CardVisual from "./CardVisual";

// CardVisual 现用 composer 的真实 renderScene（单一真相）：断言产出 composer 卡片类名/文本，
// 而非旧手搓 cv-* 近似。engine.props 提供原始 scene props（renderScene 读它）。
function makeCard(component: string, scene_type: string, props: Record<string, unknown>, type = "opening"): PlanCard {
  return {
    id: `${component}-card`,
    type: type as PlanCard["type"],
    engine: { component, scene_type, props },
    content: { title: "关键片段", kicker: "自动包装", subline: "可编辑说明" },
    media: {},
    timeline: { track: "card", start: 0, duration: 4 },
    validation: { status: "ok", failures: [] },
  } as PlanCard;
}
const render = (card: PlanCard, stageW = 960) => renderToStaticMarkup(createElement(CardVisual, { card, stageW }));

describe("CardVisual — 复用 composer 真实卡片渲染", () => {
  it("标题卡：产出 composer 的 title-block / main-title + 文本", () => {
    const html = render(makeCard("TitleCard", "title_card", { kicker: "开场", title: "关键片段", subline: "副标题" }));
    expect(html).toContain("hf-frame");
    expect(html).toContain("title-block");
    expect(html).toContain("main-title");
    expect(html).toContain("关键片段");
  });

  it("步骤卡：产出 step-panel / step-list / step-item + 条目文本", () => {
    const html = render(makeCard("StepCard", "step_card", { kicker: "步骤", title: "三步走", items: ["第一点", "第二点", "第三点"] }, "step"));
    expect(html).toContain("step-panel");
    expect(html).toContain("step-item");
    expect(html).toContain("第二点");
  });

  it("开场数据卡：产出 stat-pack / stat-number 等（composer 整帧设计）", () => {
    const html = render(
      makeCard(
        "StatsHero",
        "hook_stat",
        { stat: { label: "增长", number: "38", unit: "%", title: "转化" }, browser: { done: "Done", icons: ["AI"] }, titleBeat: { title: "标题" }, media: { presenter: "x.mp4" } },
        "stats-hero",
      ),
    );
    expect(html).toContain("stat-pack");
    expect(html).toContain("stat-number");
    expect(html).toContain("38");
  });

  it("画中画卡：用 composer 的 screen-shell / circle-pip 结构（live 视频容器）", () => {
    const html = render(makeCard("ScreenWithPip", "screen_demo_pip", { label: "演示", media: {} }, "pip"));
    expect(html).toContain("screen-shell");
    expect(html).toContain("circle-pip");
    expect(html).toContain("演示");
  });
});
