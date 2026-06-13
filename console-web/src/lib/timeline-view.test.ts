import { describe, expect, it } from "vitest";
import {
  chooseTickInterval,
  clampPps,
  fitPps,
  fmtTickLabel,
  generateTicks,
  MAX_PPS,
  MIN_PPS,
  pxToTime,
  timeToPx,
  zoomAtAnchor,
} from "./timeline-view";

describe("clampPps", () => {
  it("clamps to [MIN_PPS, MAX_PPS]", () => {
    expect(clampPps(0)).toBe(MIN_PPS);
    expect(clampPps(-5)).toBe(MIN_PPS);
    expect(clampPps(1)).toBe(MIN_PPS);
    expect(clampPps(99999)).toBe(MAX_PPS);
    expect(clampPps(50)).toBe(50);
  });
});

describe("time/px round-trip", () => {
  it("timeToPx / pxToTime invert", () => {
    expect(timeToPx(10, 12)).toBe(120);
    expect(pxToTime(120, 12)).toBe(10);
    expect(pxToTime(100, 0)).toBe(0);
  });
});

describe("fitPps", () => {
  it("fits total into viewport width (minus margin), clamped", () => {
    expect(fitPps(100, 1008)).toBe(10); // (1008-8)/100 = 10
    expect(fitPps(0, 1000)).toBe(MIN_PPS);
    expect(fitPps(100, 0)).toBe(MIN_PPS);
  });
});

describe("zoomAtAnchor — 光标锚点缩放", () => {
  it("keeps the anchored time under the cursor after zoom-in", () => {
    // 当前 pps=10，scrollLeft=0，光标在 viewport x=200px → 锚点时间=20s
    const { pps, scrollLeft, anchorTime } = zoomAtAnchor(10, 2, 200, 0);
    expect(anchorTime).toBe(20);
    expect(pps).toBe(20);
    // 缩放后锚点时间 20s 应仍落在 x=200：scrollLeft = 20*20 - 200 = 200
    expect(scrollLeft).toBe(200);
    // 验证不变式：(scrollLeft + anchorOffset)/pps === anchorTime
    expect((scrollLeft + 200) / pps).toBe(20);
  });
  it("clamps pps and never returns negative scrollLeft", () => {
    const { pps, scrollLeft } = zoomAtAnchor(MAX_PPS, 4, 50, 0);
    expect(pps).toBe(MAX_PPS);
    expect(scrollLeft).toBeGreaterThanOrEqual(0);
  });
});

describe("chooseTickInterval — 自适应刻度", () => {
  it("picks a finer interval when zoomed in, coarser when zoomed out", () => {
    const fine = chooseTickInterval(400); // 帧/0.1/0.2... 400px/s → 0.2s*400=80>=64
    const coarse = chooseTickInterval(3); // 3px/s → 需要大间隔
    expect(fine).toBeLessThan(coarse);
    expect(coarse * 3).toBeGreaterThanOrEqual(64);
  });
});

describe("generateTicks", () => {
  it("covers [0,total] inclusive with majors every 5th", () => {
    const ticks = generateTicks(10, 64, 1); // interval 1s, pps 64
    expect(ticks.length).toBe(11); // 0..10
    expect(ticks[0]).toMatchObject({ t: 0, px: 0, major: true });
    expect(ticks[5]).toMatchObject({ t: 5, major: true });
    expect(ticks[1].major).toBe(false);
    expect(ticks[10].px).toBe(640);
  });
  it("returns [] for non-positive total", () => {
    expect(generateTicks(0, 64, 1)).toEqual([]);
  });
});

describe("fmtTickLabel", () => {
  it("m:ss for >=1s intervals, m:ss.f for sub-second", () => {
    expect(fmtTickLabel(65, 1)).toBe("1:05");
    expect(fmtTickLabel(5.4, 0.2)).toBe("0:05.4");
  });
});
