import { describe, expect, it } from "vitest";
import type { PackagingPlan } from "./packaging-plan";
import {
  formatHistoryTime,
  hasDownloadableArtifact,
  historyArtifacts,
  type HistoryEntry,
  historyKindLabel,
  historyParamsSummary,
  historyValidationBadge,
  mediaPreviewHref,
  snapshotSummary,
} from "./history";

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: "import-0001",
  ts: "2026-06-14T13:25:09.000Z",
  kind: "import",
  ...over,
});

describe("historyKindLabel — kind → 中文名", () => {
  it("maps the 5 known kinds", () => {
    expect(historyKindLabel("import")).toBe("导入");
    expect(historyKindLabel("apply-template")).toBe("套模板");
    expect(historyKindLabel("render")).toBe("渲染");
    expect(historyKindLabel("recaption")).toBe("字幕识别");
    expect(historyKindLabel("restore")).toBe("回滚");
  });
  it("passes unknown kinds through (forward-compat)", () => {
    expect(historyKindLabel("future-kind")).toBe("future-kind");
  });
});

describe("formatHistoryTime — ISO → 本地可读（确定性，不依赖 Date/时区）", () => {
  it("trims ISO to YYYY-MM-DD HH:mm", () => {
    expect(formatHistoryTime("2026-06-14T13:25:09.000Z")).toBe("2026-06-14 13:25");
  });
  it("passes through too-short / garbage", () => {
    expect(formatHistoryTime("")).toBe("");
    expect(formatHistoryTime("nope")).toBe("nope");
  });
});

describe("historyValidationBadge — 验证态 三态", () => {
  it("ok → 通过 / ok", () => {
    expect(historyValidationBadge({ ok: true })).toEqual({ tone: "ok", label: "通过" });
  });
  it("fail with failures → 失败 · N 项 / bad", () => {
    expect(historyValidationBadge({ ok: false, failures: ["a", "b"] })).toEqual({ tone: "bad", label: "失败 · 2 项" });
  });
  it("fail without failures → 失败 / bad", () => {
    expect(historyValidationBadge({ ok: false })).toEqual({ tone: "bad", label: "失败" });
  });
  it("undefined → muted", () => {
    expect(historyValidationBadge(undefined)).toEqual({ tone: "muted", label: "—" });
  });
});

describe("historyParamsSummary — 参数摘要（label 中文 + id 技术标识分离）", () => {
  it("apply-template → 模板 + templateId", () => {
    expect(historyParamsSummary(entry({ kind: "apply-template", params: { templateId: "dark-tech-talk" } }))).toEqual({ label: "模板", id: "dark-tech-talk" });
  });
  it("restore → 回滚自 + entryId", () => {
    expect(historyParamsSummary(entry({ kind: "restore", params: { restoredEntryId: "apply-template-0002" } }))).toEqual({ label: "回滚自", id: "apply-template-0002" });
  });
  it("import → 导入 + basename(path)", () => {
    expect(historyParamsSummary(entry({ kind: "import", params: { videoPath: "/a/b/memos.mp4" } }))).toEqual({ label: "导入", id: "memos.mp4" });
  });
  it("import without source → 纯中文，无 id", () => {
    expect(historyParamsSummary(entry({ kind: "import", params: {} }))).toEqual({ label: "导入素材" });
  });
  it("render / recaption → 固定中文 label，无 id", () => {
    expect(historyParamsSummary(entry({ kind: "render" }))).toEqual({ label: "渲染 MP4" });
    expect(historyParamsSummary(entry({ kind: "recaption" }))).toEqual({ label: "重新识别字幕" });
  });
});

describe("historyArtifacts — 产物（mp4 可下载）", () => {
  it("extracts mp4 as downloadable, manifest/plan as non-downloadable", () => {
    const arts = historyArtifacts(entry({ kind: "render", artifacts: { mp4Path: "/o/out.mp4", manifestPath: "/m/x.json" } }));
    expect(arts).toEqual([
      { kind: "mp4", label: "MP4 成片", path: "/o/out.mp4", downloadable: true },
      { kind: "manifest", label: "清单", path: "/m/x.json", downloadable: false },
    ]);
    expect(hasDownloadableArtifact(entry({ kind: "render", artifacts: { mp4Path: "/o/out.mp4" } }))).toBe(true);
    expect(hasDownloadableArtifact(entry({ kind: "import", artifacts: { manifestPath: "/m/x.json" } }))).toBe(false);
  });
  it("mediaPreviewHref encodes the absolute path into the /api/preview/media route", () => {
    expect(mediaPreviewHref("/o/my out.mp4")).toBe("/api/preview/media?path=%2Fo%2Fmy%20out.mp4");
  });
});

describe("snapshotSummary — 从 plan 算 场景数/时长/卡片类型分布", () => {
  const plan = {
    duration: 42,
    tracks: {
      video: [],
      audio: [],
      subtitle: [],
      card: [
        { type: "opening" },
        { type: "caption" },
        { type: "caption" },
      ],
    },
  } as unknown as PackagingPlan;

  it("counts scenes, duration, and groups card types (中文 label)", () => {
    const s = snapshotSummary(plan);
    expect(s.scenes).toBe(3);
    expect(s.durationSec).toBe(42);
    expect(s.cardTypes).toEqual([
      { label: "开场", count: 1 },
      { label: "字幕", count: 2 },
    ]);
  });
  it("null plan → zeros", () => {
    expect(snapshotSummary(null)).toEqual({ scenes: 0, durationSec: 0, cardTypes: [] });
  });
});
