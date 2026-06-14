import { describe, expect, it } from "vitest";
import {
  buildUpdateBody,
  formFromProvider,
  healthBadge,
  keyPlaceholder,
  validateProviderForm,
  type Provider,
} from "./providers";

const tts: Provider = {
  id: "tts",
  label: "CosyVoice3 TTS",
  enabled: true,
  baseUrl: "http://127.0.0.1:4090",
  apiKeyEnvVar: "TTS_KEY",
  extra: { healthPath: "/health" },
  isKeySet: true,
};

describe("healthBadge — 三态健康徽标", () => {
  it("maps up/down/unconfigured to tone + 中文 label", () => {
    expect(healthBadge("up")).toEqual({ tone: "ok", label: "在线" });
    expect(healthBadge("down")).toEqual({ tone: "bad", label: "离线" });
    expect(healthBadge("unconfigured")).toEqual({ tone: "muted", label: "未配置" });
  });
});

describe("keyPlaceholder — 密钥占位（write-only，按 isKeySet）", () => {
  it("shows 已设置 / 未设置 by isKeySet, never the value", () => {
    expect(keyPlaceholder(true)).toContain("已设置");
    expect(keyPlaceholder(false)).toContain("未设置");
  });
});

describe("formFromProvider — 用 provider 初始化表单（密钥值永远空）", () => {
  it("copies fields and starts apiKeyValue empty (write-only)", () => {
    const f = formFromProvider(tts);
    expect(f).toEqual({ enabled: true, baseUrl: "http://127.0.0.1:4090", endpoint: "", apiKeyEnvVar: "TTS_KEY", apiKeyValue: "", proxy: "" });
  });
  it("defaults missing optionals to empty string", () => {
    const f = formFromProvider({ id: "x", label: "X", enabled: false, isKeySet: false });
    expect(f).toEqual({ enabled: false, baseUrl: "", endpoint: "", apiKeyEnvVar: "", apiKeyValue: "", proxy: "" });
  });
});

describe("validateProviderForm — 客户端预校验（服务端仍权威）", () => {
  it("passes a clean form", () => {
    expect(validateProviderForm(formFromProvider(tts))).toEqual([]);
  });
  it("rejects a non-http baseUrl", () => {
    expect(validateProviderForm({ ...formFromProvider(tts), baseUrl: "127.0.0.1:4090" })).toContain("基础地址需以 http:// 或 https:// 开头");
  });
  it("rejects a bad proxy scheme", () => {
    expect(validateProviderForm({ ...formFromProvider(tts), proxy: "127.0.0.1:7890" })[0]).toMatch(/代理/);
  });
  it("requires apiKeyEnvVar when a key value is typed", () => {
    expect(validateProviderForm({ ...formFromProvider(tts), apiKeyEnvVar: "", apiKeyValue: "sk-123" })[0]).toMatch(/apiKeyEnvVar/);
  });
});

describe("buildUpdateBody — PUT body（密钥写入 only，从不回显）", () => {
  it("OMITS apiKeyValue when the user did not type a new key (write-only, no echo)", () => {
    const body = buildUpdateBody(formFromProvider(tts), tts);
    expect("apiKeyValue" in body).toBe(false);
    expect(body.enabled).toBe(true);
    expect(body.baseUrl).toBe("http://127.0.0.1:4090");
    expect(body.extra).toEqual({ healthPath: "/health" }); // extra preserved
  });
  it("INCLUDES apiKeyValue only when the user typed one", () => {
    const body = buildUpdateBody({ ...formFromProvider(tts), apiKeyValue: "sk-secret" }, tts);
    expect(body.apiKeyValue).toBe("sk-secret");
  });
  it("trims text fields", () => {
    const body = buildUpdateBody({ ...formFromProvider(tts), baseUrl: "  http://h:1  ", proxy: " " }, tts);
    expect(body.baseUrl).toBe("http://h:1");
    expect(body.proxy).toBe("");
  });
});
