import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  expectedComposerCardCss,
  statsHeroTimelineGuardChecks,
} from "./composer-guards";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

describe("composer preview guardrails", () => {
  it("keeps composer-card.css in sync with the scoped composer CSS derivation", () => {
    const composerCss = fs.readFileSync(
      path.join(repoRoot, "hyperframes-composer/components/hyperframes-tech-talk.css"),
      "utf8",
    );
    const current = fs.readFileSync(path.join(testDir, "composer-card.css"), "utf8");

    expect(current).toBe(expectedComposerCardCss(composerCss));
  });

  it("keeps the StatsHero preview timeline port aligned with composer key tweens", () => {
    const composerTimeline = fs.readFileSync(
      path.join(repoRoot, "hyperframes-composer/components/timelines.mjs"),
      "utf8",
    );
    const previewStatsHeroPort = fs.readFileSync(
      path.join(repoRoot, "console-web/src/lib/component-defs/stats-hero.ts"),
      "utf8",
    );

    for (const check of statsHeroTimelineGuardChecks()) {
      for (const needle of check.composerNeedles) {
        expect(composerTimeline, `composer timeline missing ${check.label}: ${needle}`).toContain(needle);
      }
      for (const needle of check.previewNeedles) {
        expect(previewStatsHeroPort, `StatsHero preview port missing ${check.label}: ${needle}`).toContain(needle);
      }
    }
  });
});
