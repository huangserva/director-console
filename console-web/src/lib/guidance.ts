// Post-import guidance + workflow stepper + drag-discoverability copy. Pure
// helpers (tested) feed the ImportSummary banner, the top-bar WorkflowStepper,
// and the card-track drop hints. All user-facing text is Chinese.

export type StepStatus = "done" | "current" | "todo" | "locked";

export interface WorkflowStep {
  id: "import" | "captions" | "package" | "validate" | "render";
  label: string;
  status: StepStatus;
}

const STEP_DEFS: { id: WorkflowStep["id"]; label: string }[] = [
  { id: "import", label: "导入" },
  { id: "captions", label: "字幕" },
  { id: "package", label: "包装" },
  { id: "validate", label: "校验" },
  { id: "render", label: "渲染" },
];

export interface WorkflowContext {
  hasManifest: boolean;
  hasCaptions: boolean;
  hasScenes: boolean;
  linted: boolean;
  rendered: boolean;
}

/**
 * Sequential 5-step high-level workflow (导入→字幕→包装→校验→渲染). A step is
 * `done` when its condition holds; the first not-done step is `current`; steps
 * after the current one are `locked` (prerequisite not met yet).
 */
export function deriveWorkflowSteps(ctx: WorkflowContext): WorkflowStep[] {
  const done: Record<WorkflowStep["id"], boolean> = {
    import: ctx.hasManifest,
    captions: ctx.hasCaptions,
    package: ctx.hasManifest && ctx.hasScenes,
    validate: ctx.linted,
    render: ctx.rendered,
  };
  let blocked = false;
  return STEP_DEFS.map((s) => {
    if (done[s.id]) return { ...s, status: "done" as StepStatus };
    if (blocked) return { ...s, status: "locked" as StepStatus };
    blocked = true;
    return { ...s, status: "current" as StepStatus };
  });
}

export interface ImportSummary {
  name: string;
  scenes: number;
  captions: number;
  durationSec: number;
}

/** mm:ss clock for a second count. */
export function fmtClock(sec: number): string {
  const t = Math.max(0, Math.round(Number(sec) || 0));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** "已导入 X · N 场景 · M 字幕 · 时长 mm:ss · 1920×1080" */
export function summaryLine(s: ImportSummary): string {
  return `已导入 ${s.name} · ${s.scenes} 场景 · ${s.captions} 字幕 · 时长 ${fmtClock(s.durationSec)} · 1920×1080`;
}

// ③ 时间线 dock 高度边界：min 必须装得下 工具栏(tlhead 37) + 标尺(22) + 4×lane(32=128) + 边框余量，
// 否则 .pc-lanes-scroll 会把底部「卡片轨」裁掉（dispatch 8e13462c：旧 190/196 太紧，min 处 153<155 内容 → 第 4 轨被切）。
// 实测内容高 ≈ 37+22+128+边框 ≈ 190，给足余量：MIN=220（lanes-scroll≈183>内容155）、DEFAULT=248。
// max 仍不盖顶栏（留 ~200px 给顶栏+步骤器+工作区）。
export const DOCK_MIN_PX = 220;
export const DOCK_DEFAULT_PX = 248;
export const DOCK_EXPANDED_PX = 420;
export function dockMaxPx(viewportH: number): number {
  return Math.max(DOCK_MIN_PX + 40, viewportH - 200);
}
export function clampDockHeight(h: number, viewportH: number): number {
  return Math.min(dockMaxPx(viewportH), Math.max(DOCK_MIN_PX, Math.round(h)));
}

// 拖拽可发现性文案
export const DRAG_HINTS = {
  cardTrackEmpty: "从左侧组件库拖卡片到这里 →",
  cardTrackDrop: "松开以插入卡片",
  libraryGrab: "可拖入时间线 / 点击插入",
  packageNotice: "从「组件库」拖卡片到底部卡片轨道，或点击卡片插入。",
};
