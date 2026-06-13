import { describe, expect, it } from "vitest";
import { cuesToSubtitleTrack, parseCaptions, updateCue } from "./captions";

const raw = {
  captions: [
    { start: 0.29, end: 2.97, text: "第一句", asr_text: "raw1" },
    { start: 3.17, end: 7.71, text: "第二句" },
  ],
};

describe("parseCaptions", () => {
  it("reads {captions:[...]} into cues", () => {
    const cues = parseCaptions(raw);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ id: "cue-1", start: 0.29, end: 2.97, text: "第一句" });
  });
  it("tolerates a bare array and falls back to asr_text", () => {
    const cues = parseCaptions([{ start: 1, asr_text: "fallback" }]);
    expect(cues[0].text).toBe("fallback");
    expect(cues[0].end).toBe(1); // no end/duration → end=start
  });
});

describe("updateCue — 字幕编辑", () => {
  it("edits one cue's text immutably", () => {
    const cues = parseCaptions(raw);
    const next = updateCue(cues, "cue-1", { text: "改了" });
    expect(next[0].text).toBe("改了");
    expect(cues[0].text).toBe("第一句"); // original untouched
    expect(next[1]).toBe(cues[1]);
  });
  it("can edit timing", () => {
    const cues = parseCaptions(raw);
    expect(updateCue(cues, "cue-2", { start: 4, end: 8 })[1]).toMatchObject({ start: 4, end: 8 });
  });
});

describe("cuesToSubtitleTrack", () => {
  it("projects cues into subtitle clips carrying text + duration", () => {
    const track = cuesToSubtitleTrack(parseCaptions(raw));
    expect(track[0]).toMatchObject({ track: "subtitle", start: 0.29, text: "第一句" });
    expect(track[0].duration).toBeCloseTo(2.68, 2);
  });
});
