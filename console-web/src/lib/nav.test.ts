import { describe, expect, it } from "vitest";
import { resolveNav, type NavId } from "./nav";

describe("resolveNav — every nav id yields a concrete action", () => {
  const ids: NavId[] = ["import", "captions", "analyze", "style", "package", "validate", "export"];

  it("no id resolves to an empty (no-op) action", () => {
    for (const id of ids) {
      const r = resolveNav(id, { hasCaptions: true });
      const acts = [
        r.rail,
        r.openWizard,
        r.lint,
        r.compose,
        r.highlightSubtitle,
        r.openCaptions,
        r.openStylePack,
        r.openExportSettings,
      ].filter((v) => v !== undefined);
      expect(acts.length, `nav ${id} must do something`).toBeGreaterThan(0);
    }
  });

  it("maps imports/analyze to the wizard", () => {
    expect(resolveNav("import", { hasCaptions: false }).openWizard).toBe(true);
    expect(resolveNav("analyze", { hasCaptions: false }).openWizard).toBe(true);
  });

  it("style → style-pack panel, package → library tab + drag notice", () => {
    expect(resolveNav("style", { hasCaptions: true }).openStylePack).toBe(true);
    expect(resolveNav("package", { hasCaptions: true }).rail).toBe("library");
    expect(resolveNav("package", { hasCaptions: true }).notice).toContain("卡片轨道");
  });

  it("validate triggers lint, export opens the dedicated export settings panel", () => {
    expect(resolveNav("validate", { hasCaptions: true }).lint).toBe(true);
    expect(resolveNav("export", { hasCaptions: true }).openExportSettings).toBe(true);
    expect(resolveNav("export", { hasCaptions: true }).rail).toBeUndefined();
  });

  it("captions opens the captions panel + highlights the subtitle track", () => {
    expect(resolveNav("captions", { hasCaptions: true }).openCaptions).toBe(true);
    expect(resolveNav("captions", { hasCaptions: true }).highlightSubtitle).toBe(true);
    expect(resolveNav("captions", { hasCaptions: false }).notice).toContain("暂无字幕");
  });
});
