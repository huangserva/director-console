import { describe, expect, it } from "vitest";
import { fieldHint, fieldLabel, sceneRoleLabel } from "./field-labels";

describe("fieldLabel — 中文友好字段名", () => {
  it("maps known prop keys to Chinese labels", () => {
    expect(fieldLabel("cornerLeft")).toBe("左上角短标");
    expect(fieldLabel("kicker")).toBe("眉标");
    expect(fieldLabel("title")).toBe("主标题");
    expect(fieldLabel("subline")).toBe("副标题");
  });
  it("handles nested + array index paths", () => {
    expect(fieldLabel("stat.title")).toBe("主标题");
    expect(fieldLabel("items.0")).toBe("要点 1");
    expect(fieldLabel("items.2")).toBe("要点 3");
  });
  it("falls back to the raw key when unknown", () => {
    expect(fieldLabel("weirdKey")).toBe("weirdKey");
  });
  it("provides hints for known keys", () => {
    expect(fieldHint("title")).toContain("主标题");
    expect(fieldHint("unknown")).toBeUndefined();
  });
});

describe("sceneRoleLabel — 场景语义名", () => {
  it("maps components to semantic roles", () => {
    expect(sceneRoleLabel("TitleCard")).toBe("开场标题");
    expect(sceneRoleLabel("StepCard")).toBe("步骤说明");
    expect(sceneRoleLabel("SummaryCta")).toBe("收尾引导");
  });
  it("falls back to catalog Chinese name then component id", () => {
    expect(sceneRoleLabel("ProofMontage")).toBe("证据快剪");
    expect(sceneRoleLabel(undefined)).toBe("场景");
  });
});
