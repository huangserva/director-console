import { describe, expect, it } from "vitest";
import {
  buildSnapTargets,
  clipEnd,
  MIN_DUR,
  moveCardStart,
  resolveCardStart,
  snapTime,
  timelineEndMax,
  trimLeft,
  trimRight,
} from "./timeline-edit";

describe("timelineEndMax — 总时长=所有轨道 max(start+duration)", () => {
  it("takes the max end across all tracks, not the last card", () => {
    const card = [
      { start: 0, duration: 4 },
      { start: 20, duration: 3 }, // 末端 23（不是数组最后但 start 最大）
    ];
    const video = [{ start: 0, duration: 30 }];
    expect(timelineEndMax([card, video])).toBe(30);
  });
  it("handles gaps/out-of-order and respects floor", () => {
    const card = [{ start: 10, duration: 2 }];
    expect(timelineEndMax([card])).toBe(12);
    expect(timelineEndMax([[]], 60)).toBe(60);
  });
});

describe("moveCardStart — 自由移动钳到 [0,∞)", () => {
  it("allows arbitrary start (gap) and clamps negatives to 0", () => {
    expect(moveCardStart(7.3)).toBe(7.3);
    expect(moveCardStart(-5)).toBe(0);
  });
});

describe("trimLeft / trimRight — 左右边缘 trim", () => {
  it("left trim fixes end, changes start+duration", () => {
    expect(trimLeft(10, 3)).toEqual({ start: 3, duration: 7 });
  });
  it("left trim cannot cross end (min duration)", () => {
    expect(trimLeft(10, 9.9)).toEqual({ start: round(10 - MIN_DUR), duration: MIN_DUR });
  });
  it("left trim clamps start at 0", () => {
    expect(trimLeft(10, -2)).toEqual({ start: 0, duration: 10 });
  });
  it("right trim fixes start, changes duration", () => {
    expect(trimRight(2, 9)).toEqual({ start: 2, duration: 7 });
  });
  it("right trim enforces min duration", () => {
    expect(trimRight(2, 2.1)).toEqual({ start: 2, duration: MIN_DUR });
  });
});

describe("snapTime — 吸附到最近 target", () => {
  it("snaps when within threshold, picks nearest", () => {
    expect(snapTime(5.05, [0, 5, 10], 0.2)).toEqual({ time: 5, snapped: 5 });
  });
  it("no snap beyond threshold", () => {
    expect(snapTime(5.5, [0, 5, 10], 0.2)).toEqual({ time: 5.5, snapped: null });
  });
});

describe("resolveCardStart — 同轨防重叠，吸到最近空位", () => {
  const others = [
    { start: 0, duration: 5 }, // [0,5]
    { start: 10, duration: 5 }, // [10,15]
  ];
  it("keeps desired start when no overlap", () => {
    expect(resolveCardStart(others, 6, 3)).toBe(6); // gap [5,10] fits
  });
  it("pushes out of an overlap to the nearest free slot", () => {
    // desired 4 (dur 3) overlaps [0,5] → nearest free is gap [5,10], placed at 5
    expect(resolveCardStart(others, 4, 3)).toBe(5);
  });
  it("appends past the last clip when nothing fits before it", () => {
    // dur 8 doesn't fit gap [5,10]; desired 6 → ends up appended at 15
    expect(resolveCardStart(others, 6, 8)).toBe(15);
  });
});

describe("buildSnapTargets", () => {
  it("collects 0, playhead, track end, other edges and ticks (deduped)", () => {
    const t = buildSnapTargets({
      playhead: 7,
      others: [{ start: 2, duration: 3 }],
      trackEnd: 20,
      ticks: [0, 5, 10],
    });
    expect(new Set(t)).toEqual(new Set([0, 7, 20, 2, 5, 10]));
  });
});

describe("clipEnd", () => {
  it("rounds start+duration to ms precision", () => {
    expect(clipEnd({ start: 1.111, duration: 2.222 })).toBe(3.333);
  });
});

function round(n: number): number {
  return Number(n.toFixed(3));
}
