import { describe, expect, it } from "vitest";
import { generateErrorMessage, type GenerateResult, SCRIPT_MAX, validateGenerateForm } from "./generate-form";

describe("validateGenerateForm — 粘脚本无凭据路径前置校验", () => {
  it("empty / whitespace script → 失败，提示粘贴脚本", () => {
    expect(validateGenerateForm({ script: "", name: "", title: "" })).toEqual({ ok: false, reason: "请先粘贴脚本文本。" });
    expect(validateGenerateForm({ script: "   \n ", name: "", title: "" })).toEqual({ ok: false, reason: "请先粘贴脚本文本。" });
  });
  it("over-long script → 失败，提示字数上限", () => {
    const v = validateGenerateForm({ script: "字".repeat(SCRIPT_MAX + 1), name: "", title: "" });
    expect(v.ok).toBe(false);
    expect(v.reason).toContain(String(SCRIPT_MAX));
  });
  it("valid script → ok", () => {
    expect(validateGenerateForm({ script: "第一句。第二句。", name: "", title: "" })).toEqual({ ok: true });
  });
  it("script exactly at the limit → ok", () => {
    expect(validateGenerateForm({ script: "字".repeat(SCRIPT_MAX), name: "", title: "" }).ok).toBe(true);
  });
});

describe("generateErrorMessage — 4xx/状态 → 友好中文（读 body 不吞）", () => {
  const r = (over: Partial<GenerateResult>): GenerateResult => ({ ok: false, ...over });
  it("400 → 空脚本/非法名", () => {
    expect(generateErrorMessage(r({ status: 400, error: "script is required" }))).toContain("脚本为空");
  });
  it("413 → 超长", () => {
    expect(generateErrorMessage(r({ status: 413 }))).toContain("过长");
  });
  it("409 → 重名", () => {
    expect(generateErrorMessage(r({ status: 409 }))).toContain("已存在");
  });
  it("422 → 校验失败，带 failures", () => {
    const msg = generateErrorMessage(r({ status: 422, failures: ["scene invalid", "missing title"] }));
    expect(msg).toContain("校验失败");
    expect(msg).toContain("2");
  });
  it("unknown status → 用 error 兜底，无则通用", () => {
    expect(generateErrorMessage(r({ status: 500, error: "boom" }))).toContain("boom");
    expect(generateErrorMessage(r({}))).toContain("生成失败");
  });
});
