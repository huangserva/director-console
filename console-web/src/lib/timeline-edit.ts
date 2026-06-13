// P0 专业时间轴 · 自由编辑（纯函数，可单测）。
// 统一模型：clip 有任意 start，允许 gap、自由拖动/trim 默认不 reflow；同轨重叠禁止
// （拖到重叠时吸到最近无冲突位置）；项目总时长 = 所有轨道 clip 的 max(start+duration)。

export const MIN_DUR = 0.5; // 最小时长（秒），与 scene-templates.MIN_SCENE_DURATION 一致

const round3 = (n: number): number => Number(n.toFixed(3));

export interface Span {
  start: number;
  duration: number;
}

export function clipEnd(c: Span): number {
  return round3((Number(c.start) || 0) + (Number(c.duration) || 0));
}

/** 项目总时长 = 所有轨道所有 clip 的 max(start+duration)，再与一个下限取大。 */
export function timelineEndMax(clipGroups: Span[][], floor = 0): number {
  let max = floor;
  for (const group of clipGroups) {
    for (const c of group) {
      const e = clipEnd(c);
      if (e > max) max = e;
    }
  }
  return round3(max);
}

/** 自由移动：把 start 钳到 [0, ∞)（允许向右留 gap、扩展总时长），按 ms 量化。 */
export function moveCardStart(rawStart: number): number {
  return Math.max(0, round3(rawStart));
}

/** 左 trim：固定 end，改 start（钳到 [0, end-MIN_DUR]），duration=end-start。 */
export function trimLeft(end: number, rawStart: number): Span {
  const start = Math.min(round3(Math.max(0, rawStart)), round3(end - MIN_DUR));
  return { start, duration: round3(end - start) };
}

/** 右 trim：固定 start，改 end（钳到 [start+MIN_DUR, ∞)），duration=end-start。 */
export function trimRight(start: number, rawEnd: number): Span {
  const end = Math.max(round3(rawEnd), round3(start + MIN_DUR));
  return { start: round3(start), duration: round3(end - start) };
}

/**
 * 吸附：把 raw 吸到最近的 target（在 thresholdSec 内），返回吸附后的时间与命中的 target。
 * 无命中则原样返回 snapped=null。targets 应排除被拖 clip 自身的边以免抖动。
 */
export function snapTime(raw: number, targets: number[], thresholdSec: number): { time: number; snapped: number | null } {
  let best: number | null = null;
  let bestDist = thresholdSec;
  for (const t of targets) {
    const d = Math.abs(t - raw);
    if (d <= bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best === null ? { time: round3(raw), snapped: null } : { time: round3(best), snapped: round3(best) };
}

const overlaps = (s: number, e: number, os: number, oe: number): boolean => s < oe - 1e-6 && os < e - 1e-6;

/**
 * 同轨防重叠：把时长 duration 的 clip 放到最接近 desiredStart 且不与 others 重叠的位置。
 * 在「0 与各 other.end」开出的每个空位里取离 desiredStart 最近的合法落点；都放不下则追加到末尾。
 * others 不含被拖 clip 自身。返回最终 start。
 */
export function resolveCardStart(others: Span[], desiredStart: number, duration: number): number {
  const desired = Math.max(0, round3(desiredStart));
  const sorted = [...others].map((c) => ({ s: round3(c.start), e: clipEnd(c) })).sort((a, b) => a.s - b.s);
  const hit = sorted.some((o) => overlaps(desired, desired + duration, o.s, o.e));
  if (!hit) return desired;

  // 候选空位起点：0 以及每个 other 的 end；每个空位的右界是下一个 other 的 start（或 ∞）。
  const candidates: number[] = [0, ...sorted.map((o) => o.e)];
  let bestStart: number | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    // 该候选起点之后第一个会挡路的 other.start
    const nextStart = sorted.filter((o) => o.s >= c - 1e-6).reduce((min, o) => Math.min(min, o.s), Infinity);
    const slotEnd = nextStart; // 空位 [c, slotEnd)
    if (slotEnd - c + 1e-6 < duration) continue; // 放不下
    const placed = Math.min(Math.max(desired, c), round3(slotEnd === Infinity ? desired : slotEnd - duration));
    // 该落点不得与任何 other 重叠（候选构造已保证，双保险）
    if (sorted.some((o) => overlaps(placed, placed + duration, o.s, o.e))) continue;
    const dist = Math.abs(placed - desired);
    if (dist < bestDist) {
      bestDist = dist;
      bestStart = round3(placed);
    }
  }
  if (bestStart !== null) return bestStart;
  // 兜底：追加到所有 clip 之后
  const end = sorted.reduce((m, o) => Math.max(m, o.e), 0);
  return round3(end);
}

/** 拖动/trim 的吸附目标集合：0、播放头、其它 clip 的 start/end、轨道尾、可见刻度 tick。 */
export function buildSnapTargets(opts: {
  playhead?: number;
  others: Span[];
  trackEnd?: number;
  ticks?: number[];
}): number[] {
  const out = new Set<number>([0]);
  if (opts.playhead != null) out.add(round3(opts.playhead));
  if (opts.trackEnd != null) out.add(round3(opts.trackEnd));
  for (const c of opts.others) {
    out.add(round3(c.start));
    out.add(clipEnd(c));
  }
  for (const t of opts.ticks ?? []) out.add(round3(t));
  return [...out];
}
