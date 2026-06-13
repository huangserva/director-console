import { describe, expect, it } from "vitest";
import { clampDockHeight, DOCK_MIN_PX, deriveWorkflowSteps, dockMaxPx, fmtClock, summaryLine } from "./guidance";

describe("deriveWorkflowSteps — 工作流步骤器状态", () => {
  it("fresh (no manifest): 导入 current, rest locked", () => {
    const s = deriveWorkflowSteps({ hasManifest: false, hasCaptions: false, hasScenes: false, linted: false, rendered: false });
    expect(s.map((x) => x.status)).toEqual(["current", "locked", "locked", "locked", "locked"]);
  });
  it("imported with captions+scenes, not linted: 导入/字幕/包装 done, 校验 current, 渲染 locked", () => {
    const s = deriveWorkflowSteps({ hasManifest: true, hasCaptions: true, hasScenes: true, linted: false, rendered: false });
    expect(s.map((x) => `${x.id}:${x.status}`)).toEqual([
      "import:done",
      "captions:done",
      "package:done",
      "validate:current",
      "render:locked",
    ]);
  });
  it("all done", () => {
    const s = deriveWorkflowSteps({ hasManifest: true, hasCaptions: true, hasScenes: true, linted: true, rendered: true });
    expect(s.every((x) => x.status === "done")).toBe(true);
  });
  it("labels are Chinese", () => {
    expect(deriveWorkflowSteps({ hasManifest: true, hasCaptions: true, hasScenes: true, linted: true, rendered: true }).map((x) => x.label)).toEqual([
      "导入",
      "字幕",
      "包装",
      "校验",
      "渲染",
    ]);
  });
});

describe("import summary", () => {
  it("fmtClock → mm:ss", () => {
    expect(fmtClock(0)).toBe("00:00");
    expect(fmtClock(156)).toBe("02:36");
    expect(fmtClock(75.4)).toBe("01:15");
  });
  it("summaryLine assembles the Chinese line", () => {
    expect(summaryLine({ name: "memos-v3", scenes: 9, captions: 78, durationSec: 156 })).toBe(
      "已导入 memos-v3 · 9 场景 · 78 字幕 · 时长 02:36 · 1920×1080",
    );
  });
});

describe("clampDockHeight — 时间线 dock 高度边界", () => {
  it("clamps below min up to DOCK_MIN_PX", () => {
    expect(clampDockHeight(50, 900)).toBe(DOCK_MIN_PX);
  });
  it("clamps above max (leave room for top bar)", () => {
    expect(clampDockHeight(99999, 900)).toBe(dockMaxPx(900));
    expect(dockMaxPx(900)).toBe(700);
  });
  it("passes through a valid height (rounded)", () => {
    expect(clampDockHeight(320.6, 900)).toBe(321);
  });
});
