import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanCard } from "../lib/packaging-plan";
import CardVisual from "./CardVisual";
import { renderScene } from "../../../hyperframes-composer/components/registry.mjs";

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

describe("composer renderScene — malicious input regression", () => {
  const assertNoExecutableHtml = (html: string) => {
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<img\b[^>]*\bon\w+=/i);
    expect(html).not.toMatch(/<[^>]+\son\w+=/i);
    expect(html).not.toMatch(/\s(?:src|href)=["']javascript:/i);
  };

  it("escapes malicious text fields instead of emitting executable tags or event attributes", () => {
    const html = renderScene({
      id: "evil-title",
      component: "TitleCard",
      scene_type: "title_card",
      start: 0,
      duration: 4,
      props: {
        cornerLeft: `"><img src=x onerror=alert(1)>`,
        cornerName: "<script>alert(1)</script>",
        kicker: `hello" onmouseover="alert(1)`,
        title: `<script src=x></script><img src=x onerror=alert(1)>`,
        subline: `javascript:alert(1)`,
      },
    });

    assertNoExecutableHtml(html);
    expect(html).toContain("&lt;script");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;");
  });

  it("does not emit javascript: media URLs for user-controlled media props", () => {
    const html = renderScene({
      id: "evil-pip",
      component: "ScreenWithPip",
      scene_type: "screen_demo_pip",
      start: 0,
      duration: 4,
      props: {
        label: `"><img src=x onerror=alert(1)>`,
        media: {
          screen: "javascript:alert(1)",
          pip: `javascript:alert("pip")`,
        },
      },
    });

    assertNoExecutableHtml(html);
    expect(html).toContain("screen-shell");
    expect(html).toContain("circle-pip");
  });
});
