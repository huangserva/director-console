// 组件定义注册表：命中的组件给 formSchema+samplePreset(+buildTimeline)，未命中回退 undefined。
// 关键不变式：每个 formSchema 字段的 path 都能在该组件 samplePreset 里取到（表单字段映射真实 props，不悬空）。
import { describe, expect, it } from "vitest";
import { getComponentDef, registeredComponents } from "./index";

function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]), obj);
}

describe("getComponentDef registry", () => {
  it("本批做透 StatsHero / TitleCard / StepCard", () => {
    expect(registeredComponents().sort()).toEqual(["StatsHero", "StepCard", "TitleCard"]);
  });

  it("未注册组件回退 undefined（走通用表单 + 静态基态）", () => {
    expect(getComponentDef("ScreenWithPip")).toBeUndefined();
    expect(getComponentDef("HeroAroll")).toBeUndefined();
    expect(getComponentDef(undefined)).toBeUndefined();
    expect(getComponentDef(null)).toBeUndefined();
  });

  it("每个做透组件都有 formSchema + samplePreset + buildTimeline", () => {
    for (const name of registeredComponents()) {
      const def = getComponentDef(name)!;
      expect(def.component).toBe(name);
      expect(def.formSchema.length).toBeGreaterThan(0);
      expect(typeof def.samplePreset).toBe("function");
      expect(typeof def.buildTimeline).toBe("function");
    }
  });

  it("formSchema 每个字段 path 都能在 samplePreset 里取到值（字段不悬空）", () => {
    for (const name of registeredComponents()) {
      const def = getComponentDef(name)!;
      const preset = def.samplePreset();
      for (const section of def.formSchema) {
        for (const field of section.fields) {
          const v = readPath(preset, field.path);
          expect(v, `${name}.${field.path} 应在 samplePreset 有值`).not.toBeUndefined();
          if (field.kind === "list") expect(Array.isArray(v), `${name}.${field.path} 应为数组`).toBe(true);
        }
      }
    }
  });
  // 注：buildTimeline 实跑需 DOM（gsap 用选择器 querySelectorAll），由真浏览器 CDP 验收覆盖，node 环境只断言它是函数。
});
