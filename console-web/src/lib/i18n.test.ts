import { describe, expect, it } from "vitest";
import {
  colorLabel,
  componentName,
  componentPurpose,
  motionLabel,
  QUALITY_LABELS,
  recipeDescription,
  recipeName,
  weightLabel,
} from "./i18n";

describe("recipe i18n", () => {
  it("localizes known recipe ids, falls back otherwise", () => {
    expect(recipeName("existing-narrated-video", "Existing Narrated Video")).toBe("成片导入");
    expect(recipeName("digital-human-talking-head", "x")).toBe("数字人口播");
    expect(recipeName("digital-human-product-introduction", "x")).toBe("数字人产品介绍");
    expect(recipeName("unknown", "Fallback Name")).toBe("Fallback Name");
  });
  it("localizes descriptions", () => {
    expect(recipeDescription("existing-narrated-video", "en")).toContain("成片");
    expect(recipeDescription("unknown", "en fallback")).toBe("en fallback");
  });
});

describe("component i18n", () => {
  it("localizes the 8 catalog component names + purposes", () => {
    expect(componentName("TitleCard")).toBe("标题卡");
    expect(componentName("StatsHero")).toBe("开场数据卡");
    expect(componentPurpose("TitleCard", "en")).toContain("标题转场");
  });
  it("falls back for unknown components / undefined", () => {
    expect(componentName("Whatever", "Whatever")).toBe("Whatever");
    expect(componentName(undefined, "fb")).toBe("fb");
    expect(componentPurpose(undefined, "fallback purpose")).toBe("fallback purpose");
  });
});

describe("label maps (动画 / 字重 / 颜色 / 质量)", () => {
  it("motion / weight / color labels are Chinese, fall back for unknown", () => {
    expect(motionLabel("none")).toBe("无");
    expect(motionLabel("slide-up")).toBe("上滑");
    expect(motionLabel("scale")).toBe("缩放");
    expect(motionLabel("custom-x")).toBe("custom-x");
    expect(weightLabel("bold")).toBe("加粗");
    expect(colorLabel("accent")).toBe("强调色");
    expect(colorLabel("bg")).toBe("背景色");
  });
  it("quality enum maps to Chinese (value kept as enum elsewhere)", () => {
    expect(QUALITY_LABELS.draft).toBe("草稿");
    expect(QUALITY_LABELS.high).toBe("高清");
  });
});
