// v2-P3 · canvas coordinate system ↔ render mapping (R4).
//
// The editable canvas is a fixed 16:9 design space measured in BASE units
// (1280×720). A card's `layout` {x,y,w,h} is stored in BASE units so it is
// resolution-independent; the on-screen stage scales uniformly to its pixel
// width. Corner-handle drags are computed in BASE units (pixel delta ÷ scale),
// then clamped to the stage (and to the safe area when safeAreaLock is on).
//
// Storing layout in BASE units (not screen px or 0..1 fractions) keeps the
// generator/HyperFrames mapping stable: a downstream renderer multiplies by its
// own output width / BASE_W. "What you drag is what renders" holds at any size.

export const BASE_W = 1280;
export const BASE_H = 720;
export const SAFE_INSET = 0.06; // 6% margin on every edge
export const MIN_W = 80;
export const MIN_H = 48;
export const GRID_STEP = 40; // BASE-unit grid for snap + grid overlay

export interface Layout {
  x: number;
  y: number;
  w: number;
  h: number;
  safeAreaLock?: boolean;
}

export type Handle = "tl" | "tr" | "bl" | "br";

const DEFAULT_LAYOUT: Layout = { x: 160, y: 180, w: 560, h: 220, safeAreaLock: false };

/** Resolve a card's layout to a complete Layout, filling sensible defaults. */
export function resolveLayout(layout: Partial<Layout> | undefined | null): Layout {
  if (!layout) return { ...DEFAULT_LAYOUT };
  return {
    x: num(layout.x, DEFAULT_LAYOUT.x),
    y: num(layout.y, DEFAULT_LAYOUT.y),
    w: num(layout.w, DEFAULT_LAYOUT.w),
    h: num(layout.h, DEFAULT_LAYOUT.h),
    safeAreaLock: Boolean(layout.safeAreaLock),
  };
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Uniform BASE→px scale for a stage of the given pixel width. */
export function scaleFor(stageWidthPx: number): number {
  return stageWidthPx > 0 ? stageWidthPx / BASE_W : 1;
}

export interface PxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Project a BASE-unit layout to stage pixels. */
export function pxRect(layout: Layout, stageWidthPx: number): PxRect {
  const s = scaleFor(stageWidthPx);
  return { left: layout.x * s, top: layout.y * s, width: layout.w * s, height: layout.h * s };
}

/** The safe-area rectangle in BASE units. */
export function safeRect(): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: SAFE_INSET * BASE_W,
    minY: SAFE_INSET * BASE_H,
    maxX: (1 - SAFE_INSET) * BASE_W,
    maxY: (1 - SAFE_INSET) * BASE_H,
  };
}

/**
 * Apply a corner-handle drag (pixel delta) to a layout, in BASE units.
 * The dragged corner moves; the opposite corner stays fixed. Width/height are
 * kept ≥ MIN by anchoring the opposite edge.
 */
export function applyHandleDrag(layout: Layout, handle: Handle, dxPx: number, dyPx: number, stageWidthPx: number): Layout {
  const s = scaleFor(stageWidthPx);
  const dx = dxPx / s;
  const dy = dyPx / s;
  let { x, y, w, h } = layout;
  const right = x + w;
  const bottom = y + h;

  if (handle === "tl") {
    x = Math.min(x + dx, right - MIN_W);
    y = Math.min(y + dy, bottom - MIN_H);
    w = right - x;
    h = bottom - y;
  } else if (handle === "tr") {
    y = Math.min(y + dy, bottom - MIN_H);
    w = Math.max(MIN_W, w + dx);
    h = bottom - y;
  } else if (handle === "bl") {
    x = Math.min(x + dx, right - MIN_W);
    w = right - x;
    h = Math.max(MIN_H, h + dy);
  } else {
    // br
    w = Math.max(MIN_W, w + dx);
    h = Math.max(MIN_H, h + dy);
  }
  return clampLayout({ ...layout, x, y, w, h });
}

/** Snap a layout's x/y/w/h to the BASE-unit grid (used when 吸附 is on). */
export function snapToGrid(layout: Layout, step = GRID_STEP): Layout {
  const snap = (n: number) => Math.round(n / step) * step;
  return clampLayout({
    ...layout,
    x: snap(layout.x),
    y: snap(layout.y),
    w: Math.max(MIN_W, snap(layout.w)),
    h: Math.max(MIN_H, snap(layout.h)),
  });
}

/** Clamp a layout inside the stage (and the safe area when locked). */
export function clampLayout(layout: Layout): Layout {
  const bounds = layout.safeAreaLock ? safeRect() : { minX: 0, minY: 0, maxX: BASE_W, maxY: BASE_H };
  let w = Math.max(MIN_W, Math.min(layout.w, bounds.maxX - bounds.minX));
  let h = Math.max(MIN_H, Math.min(layout.h, bounds.maxY - bounds.minY));
  let x = Math.min(Math.max(layout.x, bounds.minX), bounds.maxX - w);
  let y = Math.min(Math.max(layout.y, bounds.minY), bounds.maxY - h);
  return {
    ...layout,
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
}
