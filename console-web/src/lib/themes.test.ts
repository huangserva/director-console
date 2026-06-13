import { describe, expect, it } from "vitest";
import type { Manifest } from "./api";
import { applyThemeToManifest, getTheme, THEMES } from "./themes";

const manifest: Manifest = {
  compositionId: "m",
  duration: 10,
  scenes: [
    { id: "s1", component: "TitleCard", scene_type: "title_card", start: 0, duration: 5, props: { title: "Hi" } },
    { id: "s2", component: "StepCard", scene_type: "step_card", start: 5, duration: 5, props: { title: "Yo", style: { font: { weight: "regular" } } } },
  ],
};

describe("THEMES", () => {
  it("ships ≥3 named presets with full color+font", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(3);
    for (const t of THEMES) {
      expect(t).toMatchObject({ accent: expect.any(String), bg: expect.any(String), text: expect.any(String) });
      expect(t.titleSize).toBeGreaterThan(0);
    }
  });
  it("getTheme finds by id", () => {
    expect(getTheme("dark-gold")?.name).toBe("暗金科技");
    expect(getTheme("nope")).toBeUndefined();
  });
});

describe("applyThemeToManifest — 风格包套用到全部卡片", () => {
  const theme = getTheme("vivid")!;
  const out = applyThemeToManifest(manifest, theme);

  it("writes color + font onto every scene's props (round-trip slots)", () => {
    for (const s of out.scenes) {
      const style = (s.props as { style?: { color?: any; font?: any } }).style!;
      expect(style.color).toEqual({ accent: theme.accent, bg: theme.bg, text: theme.text });
      expect(style.font).toMatchObject({ titleSize: theme.titleSize, bodySize: theme.bodySize, weight: theme.weight });
    }
  });
  it("preserves existing content + is immutable", () => {
    expect(out.scenes[0].props!.title).toBe("Hi");
    expect((manifest.scenes[1].props as any).style.font.weight).toBe("regular"); // original untouched
  });
});
