import { describe, expect, it } from "vitest";
import type { Manifest } from "./api";
import {
  cardTypeLabel,
  deriveSmartSegments,
  inferCardType,
  LIBRARY_CATEGORIES,
  manifestToPlan,
  RECOMMENDED_CARDS,
  summarizePlan,
  type PackagingPlan,
} from "./packaging-plan";

const manifest: Manifest = {
  compositionId: "demo",
  duration: 45,
  audio: { src: "projects/demo/audio.wav", captions: "projects/demo/captions.json" } as any,
  scenes: [
    { id: "s001", component: "TitleCard", scene_type: "title_card", start: 0, duration: 15, props: { title: "Hi", kicker: "K" } },
    {
      id: "s002",
      component: "StepCard",
      scene_type: "step_card",
      start: 15,
      duration: 30,
      props: { title: "Steps", items: ["a", "b"], layout: { x: 10 }, style: { font: { weight: "bold" } } },
    },
  ],
};

describe("manifestToPlan — read-only projection into 4 tracks", () => {
  const plan = manifestToPlan(manifest, { recipeId: "existing-narrated-video" });

  it("projects video/audio/subtitle from manifest.audio + source", () => {
    expect(plan.tracks.video).toEqual([]); // no source.video on this manifest
    expect(plan.tracks.audio).toHaveLength(1);
    expect(plan.tracks.audio[0]).toMatchObject({ track: "audio", src: "projects/demo/audio.wav", start: 0, duration: 45 });
    expect(plan.tracks.subtitle).toHaveLength(1);
    expect(plan.tracks.subtitle[0].src).toBe("projects/demo/captions.json");
  });

  it("maps every scene to one card on the card track, preserving id/timeline", () => {
    expect(plan.tracks.card).toHaveLength(2);
    expect(plan.tracks.card[0]).toMatchObject({ id: "s001", timeline: { track: "card", start: 0, duration: 15 } });
    expect(plan.tracks.card[1].timeline).toEqual({ track: "card", start: 15, duration: 30 });
  });

  it("infers card type from component:scene_type via the shared mapping", () => {
    // TitleCard:title_card → "caption" is first in mapping; StepCard:step_card → "product-highlight"
    expect(plan.tracks.card[0].type).toBe(inferCardType(manifest.scenes[0]));
    expect(["caption", "transition", "brand"]).toContain(plan.tracks.card[0].type);
    expect(["product-highlight", "info-structure"]).toContain(plan.tracks.card[1].type);
  });

  it("extracts content + rich fields (layout/font) onto the card", () => {
    expect(plan.tracks.card[0].content.title).toBe("Hi");
    expect(plan.tracks.card[1].content.items).toEqual(["a", "b"]);
    expect(plan.tracks.card[1].layout).toEqual({ x: 10 });
    expect(plan.tracks.card[1].font).toEqual({ weight: "bold" });
  });

  it("carries recipeId + duration through", () => {
    expect(plan.recipeId).toBe("existing-narrated-video");
    expect(plan.duration).toBe(45);
  });
});

describe("summarizePlan — smart-plan-strip counts", () => {
  it("counts segments, recommended cards, and cards with validation failures", () => {
    const plan: PackagingPlan = {
      ...manifestToPlan(manifest),
      segments: [
        { id: "seg1", label: "开场钩子", start: 0, end: 5 },
        { id: "seg2", label: "收尾", start: 5, end: 12 },
      ],
    };
    plan.tracks.card[0].validation = { status: "error", failures: ["missing media"] };
    const sum = summarizePlan(plan);
    expect(sum.segmentCount).toBe(2);
    expect(sum.recommendedCardCount).toBe(RECOMMENDED_CARDS.length);
    expect(sum.validationCount).toBe(1);
  });

  it("defaults to zero counts on an empty/derived plan", () => {
    const sum = summarizePlan(manifestToPlan(manifest));
    expect(sum.segmentCount).toBe(0);
    expect(sum.validationCount).toBe(0);
  });
});

describe("deriveSmartSegments — semantic strip entries", () => {
  it("uses real segment titles and derives missing end from the next start", () => {
    const plan: PackagingPlan = {
      ...manifestToPlan(manifest),
      segments: [
        { id: "seg1", label: "开场钩子", start: 0, end: Number.NaN },
        { id: "seg2", label: "功能演示", start: 12, end: 28 },
      ],
    };

    expect(deriveSmartSegments(plan)).toEqual([
      { id: "seg1", label: "开场钩子", start: 0, end: 12 },
      { id: "seg2", label: "功能演示", start: 12, end: 28 },
    ]);
  });

  it("uses project duration for the final missing end and does not invent segments", () => {
    const plan: PackagingPlan = {
      ...manifestToPlan(manifest),
      duration: 45,
      segments: [{ id: "seg1", label: "问题说明", start: 8, end: Number.NaN }],
    };

    expect(deriveSmartSegments(plan)).toEqual([{ id: "seg1", label: "问题说明", start: 8, end: 45 }]);
  });

  it("falls back to the matching scene role when segment label is generic", () => {
    const plan: PackagingPlan = {
      ...manifestToPlan(manifest),
      segments: [
        { id: "seg1", label: "片段 1", start: 0, end: 15 },
        { id: "seg2", label: "", start: 15, end: 45 },
      ],
    };

    expect(deriveSmartSegments(plan).map((s) => s.label)).toEqual(["开场标题", "步骤说明"]);
  });
});

describe("library config", () => {
  it("exposes the 12 spec categories", () => {
    expect(LIBRARY_CATEGORIES).toHaveLength(12);
    expect(LIBRARY_CATEGORIES.map((c) => c.id)).toContain("cta");
  });
  it("labels card types from the category list", () => {
    expect(cardTypeLabel("product-highlight")).toBe("产品展示");
    expect(cardTypeLabel("cta")).toBe("行动号召");
  });
});

import { LIBRARY_CARDS, filterLibraryCards } from "./packaging-plan";

describe("library cards filter (#2 category / #3 search)", () => {
  it("has one card per category (12)", () => {
    expect(LIBRARY_CARDS).toHaveLength(12);
    expect(new Set(LIBRARY_CARDS.map((c) => c.cardType)).size).toBe(12);
  });
  it("'all' returns everything", () => {
    expect(filterLibraryCards(LIBRARY_CARDS, "all", "")).toHaveLength(12);
  });
  it("category filters to that type", () => {
    const r = filterLibraryCards(LIBRARY_CARDS, "cta", "");
    expect(r).toHaveLength(1);
    expect(r[0].cardType).toBe("cta");
  });
  it("search matches title/sub/type/label case-insensitively", () => {
    expect(filterLibraryCards(LIBRARY_CARDS, "all", "对比").map((c) => c.cardType)).toEqual(["comparison"]);
    expect(filterLibraryCards(LIBRARY_CARDS, "all", "CTA").length).toBeGreaterThanOrEqual(1);
    expect(filterLibraryCards(LIBRARY_CARDS, "all", "字幕").map((c) => c.cardType)).toContain("caption");
  });
  it("category + search combine", () => {
    expect(filterLibraryCards(LIBRARY_CARDS, "opening", "歌词")).toHaveLength(0);
    expect(filterLibraryCards(LIBRARY_CARDS, "mv-rhythm", "歌词")).toHaveLength(1);
  });
});
