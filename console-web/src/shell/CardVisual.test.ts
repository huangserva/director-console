import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CARD_TYPES, type CardType, type PlanCard } from "../lib/packaging-plan";
import CardVisual, { cardVisualModel } from "./CardVisual";

function makeCard(type: CardType, content: PlanCard["content"] = {}): PlanCard {
  return {
    id: `${type}-card`,
    type,
    engine: { component: "TitleCard", scene_type: "title_card" },
    content: {
      kicker: "自动包装",
      title: "关键片段",
      subline: "可编辑说明",
      label: "标签",
      items: ["第一点", "第二点"],
      ...content,
    },
    media: {},
    timeline: { track: "card", start: 0, duration: 4 },
    validation: { status: "ok", failures: [] },
    color: { accent: "#6ee7b7" },
  };
}

function render(card: PlanCard, stageW = 960): string {
  return renderToStaticMarkup(createElement(CardVisual, { card, stageW }));
}

describe("CardVisual", () => {
  it("为全部 12 类卡片生成可区分的视觉模型", () => {
    const variants = new Set(CARD_TYPES.map((type) => cardVisualModel(makeCard(type), 960).variant));

    expect(variants).toEqual(new Set(CARD_TYPES));
  });

  it("按类型渲染关键视觉元素，尤其画中画不是标题卡", () => {
    const cases: Array<[CardType, string]> = [
      ["opening", "cv-title-stack"],
      ["stats-hero" as CardType, "cv-title-stack"],
      ["step" as CardType, "cv-step-list"],
      ["pip", "cv-pip-window"],
      ["comparison", "cv-compare-grid"],
      ["data-proof", "cv-proof-number"],
      ["demo-annotation", "cv-annotation-arrow"],
      ["product-highlight", "cv-product-badges"],
      ["info-structure", "cv-info-map"],
      ["cta", "cv-cta-button"],
      ["caption", "cv-caption-line"],
      ["transition", "cv-transition-line"],
      ["mv-rhythm", "cv-rhythm-bars"],
      ["brand", "cv-brand-mark"],
    ];

    for (const [type, marker] of cases) {
      const html = render(makeCard(type));
      expect(html).toContain(marker);
      expect(html).toContain("关键片段");
    }
  });

  it("使用内容字段和强调色，不依赖外部 App 状态", () => {
    const html = render(
      makeCard("data-proof", {
        title: "转化提升",
        label: "增长",
        number: "38",
        unit: "%",
      }),
      640,
    );

    expect(html).toContain("转化提升");
    expect(html).toContain("38");
    expect(html).toContain("%");
    expect(html).toContain("--cv-accent:#6ee7b7");
  });
});
