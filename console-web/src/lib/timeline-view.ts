// P0 专业时间轴 · 视图坐标系（纯函数，可单测）。
// 把旧的「全片压成百分比」换成 pxPerSecond + 横向滚动 viewport：clip/playhead/标尺都用
// px 定位。缩放以光标为锚（保持锚点时间在屏幕同一 x），刻度随缩放自适应（帧级↔全片）。

export const MIN_PPS = 2; // 每秒最少 2px（全片概览）
export const MAX_PPS = 400; // 每秒最多 400px（帧级精修）
export const FPS = 25; // 与 fmtTimecode 帧数一致

const round3 = (n: number): number => Number(n.toFixed(3));

export function clampPps(pps: number): number {
  if (!Number.isFinite(pps) || pps <= 0) return MIN_PPS;
  return Math.min(MAX_PPS, Math.max(MIN_PPS, pps));
}

/** 秒 → 像素。 */
export function timeToPx(t: number, pps: number): number {
  return t * pps;
}
/** 像素 → 秒。 */
export function pxToTime(px: number, pps: number): number {
  return pps > 0 ? px / pps : 0;
}

/** 「适配全片」：让 totalSeconds 恰好填满 viewport 宽度（留一点右边距），并 clamp。 */
export function fitPps(totalSeconds: number, viewportPx: number): number {
  if (totalSeconds <= 0 || viewportPx <= 0) return clampPps(MIN_PPS);
  return clampPps((viewportPx - 8) / totalSeconds);
}

/**
 * 以光标为锚缩放：anchorOffsetPx = 光标相对 lanes viewport 左缘的 x；oldScrollLeft = 当前
 * 横向滚动量。返回新的 pps（clamped）与新的 scrollLeft，使锚点时间在缩放后仍落在 anchorOffsetPx。
 */
export function zoomAtAnchor(
  oldPps: number,
  factor: number,
  anchorOffsetPx: number,
  oldScrollLeft: number,
): { pps: number; scrollLeft: number; anchorTime: number } {
  const anchorTime = pxToTime(oldScrollLeft + anchorOffsetPx, oldPps);
  const pps = clampPps(oldPps * factor);
  const scrollLeft = Math.max(0, timeToPx(anchorTime, pps) - anchorOffsetPx);
  return { pps, scrollLeft: round3(scrollLeft), anchorTime: round3(anchorTime) };
}

// 刻度阶梯（秒）：帧 → 0.5s → … → 10min。选「标签间距 >= minLabelPx」的最小间隔。
const TICK_LADDER = [1 / FPS, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

/** 选择刻度间隔：随 pps 自适应，保证相邻刻度像素间距 >= minLabelPx（默认 64px）。 */
export function chooseTickInterval(pps: number, minLabelPx = 64): number {
  for (const interval of TICK_LADDER) {
    if (interval * pps >= minLabelPx) return interval;
  }
  return TICK_LADDER[TICK_LADDER.length - 1];
}

export interface Tick {
  t: number;
  px: number;
  label: string;
  major: boolean;
}

/** 刻度标签：>=1s 用 m:ss；<1s 用 m:ss.f（一位小数）。 */
export function fmtTickLabel(t: number, interval: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  if (interval < 1) return `${m}:${String(Math.floor(s)).padStart(2, "0")}.${Math.round((s % 1) * 10)}`;
  return `${m}:${String(Math.round(s)).padStart(2, "0")}`;
}

/**
 * 生成覆盖 [0, totalSeconds] 的刻度（含末端）。每 5 个为 major（带标签）。
 * px 已是内容坐标（未减 scrollLeft），渲染容器内部直接用 left=px。
 */
export function generateTicks(totalSeconds: number, pps: number, interval?: number): Tick[] {
  const step = interval ?? chooseTickInterval(pps);
  if (step <= 0 || totalSeconds <= 0) return [];
  const ticks: Tick[] = [];
  const n = Math.floor(totalSeconds / step + 1e-6);
  for (let i = 0; i <= n; i++) {
    const t = round3(i * step);
    const major = i % 5 === 0;
    ticks.push({ t, px: round3(timeToPx(t, pps)), label: major ? fmtTickLabel(t, step) : "", major });
  }
  return ticks;
}
