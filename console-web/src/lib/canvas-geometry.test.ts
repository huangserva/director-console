import { describe, expect, it } from "vitest";
import {
  applyHandleDrag,
  BASE_H,
  BASE_W,
  clampLayout,
  GRID_STEP,
  MIN_H,
  MIN_W,
  pxRect,
  resolveLayout,
  scaleFor,
  snapToGrid,
  type Layout,
} from "./canvas-geometry";

describe("resolveLayout", () => {
  it("fills defaults when layout is missing", () => {
    const l = resolveLayout(undefined);
    expect(l).toMatchObject({ x: 160, y: 180, w: 560, h: 220, safeAreaLock: false });
  });
  it("keeps provided numbers and coerces lock to boolean", () => {
    expect(resolveLayout({ x: 10, y: 20, w: 100, h: 50, safeAreaLock: true })).toEqual({
      x: 10, y: 20, w: 100, h: 50, safeAreaLock: true,
    });
  });
});

describe("scale + pxRect — BASE units to stage pixels", () => {
  it("scales uniformly by stage width / BASE_W", () => {
    expect(scaleFor(BASE_W)).toBe(1);
    expect(scaleFor(BASE_W / 2)).toBe(0.5);
  });
  it("projects a layout into px at half scale", () => {
    const r = pxRect({ x: 100, y: 200, w: 400, h: 100 }, BASE_W / 2);
    expect(r).toEqual({ left: 50, top: 100, width: 200, height: 50 });
  });
});

describe("applyHandleDrag — corner resize in BASE units", () => {
  const base: Layout = { x: 200, y: 200, w: 400, h: 200 };

  it("br handle grows width/height by pixel delta ÷ scale", () => {
    const next = applyHandleDrag(base, "br", 100, 50, BASE_W / 2); // scale 0.5 → +200,+100 base
    expect(next.w).toBe(600);
    expect(next.h).toBe(300);
    expect(next.x).toBe(200);
    expect(next.y).toBe(200);
  });

  it("tl handle moves the top-left corner, keeping the opposite corner fixed", () => {
    const next = applyHandleDrag(base, "tl", 100, 100, BASE_W); // scale 1 → +100,+100
    expect(next.x).toBe(300);
    expect(next.y).toBe(300);
    expect(next.x + next.w).toBe(600); // right edge unchanged
    expect(next.y + next.h).toBe(400); // bottom edge unchanged
  });

  it("never shrinks below MIN_W/MIN_H", () => {
    const next = applyHandleDrag(base, "br", -100000, -100000, BASE_W);
    expect(next.w).toBeGreaterThanOrEqual(MIN_W);
    expect(next.h).toBeGreaterThanOrEqual(MIN_H);
  });
});

describe("clampLayout", () => {
  it("clamps inside the full stage when unlocked", () => {
    const c = clampLayout({ x: -50, y: -50, w: 5000, h: 5000 });
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    expect(c.w).toBeLessThanOrEqual(BASE_W);
    expect(c.h).toBeLessThanOrEqual(BASE_H);
  });

  it("keeps the card inside the safe area when safeAreaLock is on", () => {
    const c = clampLayout({ x: 0, y: 0, w: 400, h: 200, safeAreaLock: true });
    expect(c.x).toBeGreaterThanOrEqual(Math.round(0.06 * BASE_W));
    expect(c.y).toBeGreaterThanOrEqual(Math.round(0.06 * BASE_H));
    expect(c.x + c.w).toBeLessThanOrEqual(Math.round(0.94 * BASE_W) + 1);
  });
});

describe("snapToGrid — 吸附", () => {
  it("rounds x/y/w/h to the nearest grid step", () => {
    const s = snapToGrid({ x: 167, y: 183, w: 351, h: 198 }, GRID_STEP);
    expect(s.x % GRID_STEP).toBe(0);
    expect(s.y % GRID_STEP).toBe(0);
    expect(s.w % GRID_STEP).toBe(0);
    expect(s.h % GRID_STEP).toBe(0);
    expect(s.x).toBe(160); // 167 → 160
    expect(s.w).toBe(360); // 351 → 360
  });
  it("never snaps below MIN_W/MIN_H and stays in bounds", () => {
    const s = snapToGrid({ x: 5, y: 5, w: 10, h: 10 });
    expect(s.w).toBeGreaterThanOrEqual(MIN_W);
    expect(s.h).toBeGreaterThanOrEqual(MIN_H);
    expect(s.x).toBeGreaterThanOrEqual(0);
  });
});
