import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Real composer anti-drift validator — inserted defaults must actually pass it.
import { validateManifest } from "../../../hyperframes-composer/scripts/manifest-rules.mjs";
// Real composer renderer — defaults must actually render, not just validate.
import { renderScene } from "../../../hyperframes-composer/components/registry.mjs";
import type { Manifest, Scene } from "./api";
import { allowedSceneTypes, listCatalogComponents } from "./catalog";
import {
  applyReflow,
  canDeleteScene,
  componentNeedsMedia,
  countUnboundMedia,
  defaultPropsFor,
  deleteScene,
  insertScene,
  listMediaSlots,
  makeNewScene,
  MIN_SCENE_DURATION,
  moveScene,
  moveSceneToIndex,
  placeSceneAtStart,
  pxToSeconds,
  reflowTimeline,
  resizeSceneDuration,
  sceneUnboundMediaCount,
  timelineEnd,
} from "./scene-templates";

const composerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../hyperframes-composer");
const manifestPath = path.join(composerRoot, "manifests", "scene-templates-test.json");

function wrap(scene: ReturnType<typeof makeNewScene>): Manifest {
  return {
    compositionId: "insert-test",
    duration: Math.max(1, Number(scene.start ?? 0) + Number(scene.duration ?? 0)),
    output: "index.html",
    scenes: [scene],
  };
}

function failuresFor(componentId: string, checkMedia: boolean): string[] {
  const scene = makeNewScene(componentId);
  return validateManifest(wrap(scene), { root: composerRoot, manifestPath, checkMedia });
}

describe("makeNewScene defaults pass the composer anti-drift rules", () => {
  it("inserts text components (TitleCard/StepCard) that validate even with media checking on", () => {
    expect(failuresFor("TitleCard", true)).toEqual([]);
    expect(failuresFor("StepCard", true)).toEqual([]);
  });

  it("inserts media components with valid structure (placeholder media is non-path, so no media-missing)", () => {
    for (const id of ["StatsHero", "ScreenWithPip", "SplitTextPresenter", "HeroAroll", "ProofMontage", "SummaryCta"]) {
      expect(failuresFor(id, true), `${id} should be structurally valid`).toEqual([]);
    }
  });

  it("fixes scene_type to the catalog value for the component", () => {
    const scene = makeNewScene("TitleCard");
    expect(scene.scene_type).toBe("title_card");
    expect(allowedSceneTypes("TitleCard")).toContain(scene.scene_type);
    expect(makeNewScene("StepCard").scene_type).toBe("step_card");
  });

  it("throws for a component not in the catalog (no inventing components)", () => {
    expect(() => makeNewScene("NotARealComponent")).toThrow();
  });
});

describe("componentNeedsMedia", () => {
  it("is false for text-only components and true for media ones", () => {
    expect(componentNeedsMedia("TitleCard")).toBe(false);
    expect(componentNeedsMedia("StepCard")).toBe(false);
    expect(componentNeedsMedia("StatsHero")).toBe(true);
    expect(componentNeedsMedia("ScreenWithPip")).toBe(true);
  });
});

describe("insertScene / deleteScene", () => {
  const base: Manifest = {
    compositionId: "m",
    duration: 8,
    scenes: [
      { id: "a", component: "TitleCard", scene_type: "title_card", start: 0, duration: 4, props: {} },
      { id: "b", component: "TitleCard", scene_type: "title_card", start: 4, duration: 4, props: {} },
    ],
  };

  it("inserts immediately after the given scene and starts right after it", () => {
    const newScene = makeNewScene("StepCard", { afterScene: base.scenes[0], existingIds: base.scenes.map((s) => s.id) });
    const next = insertScene(base, newScene, "a");
    expect(next.scenes.map((s) => s.id)).toEqual(["a", newScene.id, "b"]);
    expect(newScene.start).toBe(4); // a.start(0) + a.duration(4)
    expect(base.scenes).toHaveLength(2); // original untouched
  });

  it("appends when afterId is null or not found", () => {
    const ns = makeNewScene("TitleCard", { existingIds: ["a", "b"] });
    expect(insertScene(base, ns, null).scenes.map((s) => s.id)).toEqual(["a", "b", ns.id]);
    expect(insertScene(base, ns, "missing").scenes.map((s) => s.id)).toEqual(["a", "b", ns.id]);
  });

  it("generates a unique id against existing scene ids", () => {
    const ns = makeNewScene("TitleCard", { existingIds: ["new-titlecard"] });
    expect(ns.id).not.toBe("new-titlecard");
  });

  it("deletes a scene by id and leaves the rest", () => {
    expect(deleteScene(base, "a").scenes.map((s) => s.id)).toEqual(["b"]);
    expect(deleteScene(base, "nope").scenes).toHaveLength(2);
  });

  it("defaultPropsFor returns a fresh object each call (no shared mutation)", () => {
    const p1 = defaultPropsFor("StepCard");
    (p1.items as string[]).push("mutated");
    expect((defaultPropsFor("StepCard").items as string[])).toHaveLength(3);
  });
});

describe("reflowTimeline", () => {
  const tc = (id: string, start: number, duration: number): import("./api").Scene => ({
    id,
    component: "TitleCard",
    scene_type: "title_card",
    start,
    duration,
    props: {},
  });

  it("eliminates overlaps: each start becomes the previous scene's end", () => {
    // a:[0,4] b overlaps at 2, c overlaps at 3
    const reflowed = reflowTimeline([tc("a", 0, 4), tc("b", 2, 6), tc("c", 3, 2)]);
    expect(reflowed.map((s) => s.start)).toEqual([0, 4, 10]);
    expect(reflowed.map((s) => s.duration)).toEqual([4, 6, 2]); // durations untouched
  });

  it("eliminates gaps: a late-starting scene is pulled back to the previous end", () => {
    const reflowed = reflowTimeline([tc("a", 0, 4), tc("b", 100, 5)]);
    expect(reflowed.map((s) => s.start)).toEqual([0, 4]);
  });

  it("preserves the first scene's start", () => {
    const reflowed = reflowTimeline([tc("a", 2.5, 3), tc("b", 0, 4)]);
    expect(reflowed.map((s) => s.start)).toEqual([2.5, 5.5]);
  });

  it("rounds to ms precision (no float drift on values like 18.48)", () => {
    const reflowed = reflowTimeline([tc("a", 0, 18.48), tc("b", 0, 0.1)]);
    expect(reflowed[1].start).toBe(18.48);
    expect(timelineEnd(reflowed)).toBe(18.58);
  });

  it("handles the empty list", () => {
    expect(reflowTimeline([])).toEqual([]);
    expect(timelineEnd([])).toBe(0);
  });
});

describe("applyReflow", () => {
  it("reflows scenes and syncs manifest.duration to the timeline end", () => {
    const manifest: Manifest = {
      compositionId: "m",
      duration: 999,
      scenes: [
        { id: "a", component: "TitleCard", scene_type: "title_card", start: 0, duration: 4, props: {} },
        { id: "b", component: "TitleCard", scene_type: "title_card", start: 50, duration: 6, props: {} },
      ],
    };
    const next = applyReflow(manifest);
    expect(next.scenes.map((s) => s.start)).toEqual([0, 4]);
    expect(next.duration).toBe(10);
  });
});

describe("moveScene", () => {
  const scenes = [
    { id: "a", component: "TitleCard", scene_type: "title_card", start: 0, duration: 4, props: {} },
    { id: "b", component: "TitleCard", scene_type: "title_card", start: 4, duration: 4, props: {} },
    { id: "c", component: "TitleCard", scene_type: "title_card", start: 8, duration: 4, props: {} },
  ];

  it("moves a scene up and down", () => {
    expect(moveScene(scenes, "b", "up").map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(moveScene(scenes, "b", "down").map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("is a no-op at the boundaries or for an unknown id", () => {
    expect(moveScene(scenes, "a", "up").map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(moveScene(scenes, "c", "down").map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(moveScene(scenes, "z", "up").map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("moveSceneToIndex — 时间线拖动重排", () => {
  const scenes = [
    { id: "a", component: "TitleCard", scene_type: "title_card", start: 0, duration: 4, props: {} },
    { id: "b", component: "TitleCard", scene_type: "title_card", start: 4, duration: 4, props: {} },
    { id: "c", component: "TitleCard", scene_type: "title_card", start: 8, duration: 4, props: {} },
  ];

  it("drags the first block to the end", () => {
    expect(moveSceneToIndex(scenes, "a", 3).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("drags the last block to the front", () => {
    expect(moveSceneToIndex(scenes, "c", 0).map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("drags a middle block before the first", () => {
    expect(moveSceneToIndex(scenes, "b", 0).map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("dropping a block onto its own boundary is a no-op", () => {
    expect(moveSceneToIndex(scenes, "b", 1).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(moveSceneToIndex(scenes, "b", 2).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("clamps out-of-range indices and ignores unknown ids", () => {
    expect(moveSceneToIndex(scenes, "a", 99).map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(moveSceneToIndex(scenes, "c", -5).map((s) => s.id)).toEqual(["c", "a", "b"]);
    expect(moveSceneToIndex(scenes, "z", 0).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("reflow after reorder yields contiguous start times in the new order", () => {
    const reordered = moveSceneToIndex(scenes, "a", 3); // [b,c,a]
    const reflowed = reflowTimeline(reordered);
    expect(reflowed.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(reflowed.map((s) => s.start)).toEqual([4, 8, 12]); // first start preserved (b was at 4)
  });
});

describe("default props pass the REAL composer render (root-cause regression)", () => {
  // Every catalog component's inserted defaults must render without throwing —
  // the renderer requires more than the schema (e.g. StatsHero.browser, ProofMontage items[].src).
  for (const component of listCatalogComponents()) {
    it(`renders ${component.id} default scene without throwing`, () => {
      const html = renderScene(makeNewScene(component.id));
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
    });
  }

  it("covers all 8 catalog components", () => {
    expect(listCatalogComponents().length).toBe(8);
  });
});

describe("canDeleteScene", () => {
  const scene = makeNewScene("TitleCard");
  it("forbids deleting the last scene, allows when more than one", () => {
    expect(canDeleteScene({ compositionId: "m", duration: 5, scenes: [scene] })).toBe(false);
    expect(canDeleteScene({ compositionId: "m", duration: 10, scenes: [scene, makeNewScene("StepCard")] })).toBe(true);
  });
});

describe("listMediaSlots / unbound media counting", () => {
  it("returns no slots for a text-only component", () => {
    expect(listMediaSlots(makeNewScene("TitleCard"))).toEqual([]);
    expect(listMediaSlots(makeNewScene("StepCard"))).toEqual([]);
  });

  it("lists each media slot of a component with its bound flag (defaults are unbound)", () => {
    const stats = listMediaSlots(makeNewScene("StatsHero"));
    expect(stats).toEqual([{ path: "media.presenter", value: "TODO-bind-media", bound: false }]);

    const screen = listMediaSlots(makeNewScene("ScreenWithPip")).map((s) => s.path).sort();
    expect(screen).toEqual(["media.pip", "media.screen"]);
    expect(listMediaSlots(makeNewScene("ScreenWithPip")).every((s) => !s.bound)).toBe(true);
  });

  it("treats a real path as bound and an empty/placeholder value as unbound", () => {
    const scene = {
      id: "x",
      component: "StatsHero",
      scene_type: "hook_stat",
      start: 0,
      duration: 5,
      props: { media: { presenter: "projects/demo/duix.mp4" } },
    };
    expect(listMediaSlots(scene)).toEqual([{ path: "media.presenter", value: "projects/demo/duix.mp4", bound: true }]);
    expect(sceneUnboundMediaCount(scene)).toBe(0);
  });

  it("finds nested media under panels[] and items arrays", () => {
    const scene = {
      id: "x",
      component: "SplitTextPresenter",
      scene_type: "concept_split",
      start: 0,
      duration: 5,
      props: {
        variant: "definition",
        panels: [
          { media: { presenter: "real.mp4" } },
          { media: { presenter: "TODO-bind-media" } },
        ],
        media: { items: ["TODO-bind-media", "real2.mp4"] },
      },
    };
    const byPath = Object.fromEntries(listMediaSlots(scene).map((s) => [s.path, s.bound]));
    expect(byPath["panels.0.media.presenter"]).toBe(true);
    expect(byPath["panels.1.media.presenter"]).toBe(false);
    expect(byPath["media.items.0"]).toBe(false);
    expect(byPath["media.items.1"]).toBe(true);
    expect(sceneUnboundMediaCount(scene)).toBe(2);
  });

  it("treats ProofMontage items[i].src as the media slot but not items[i].label", () => {
    const slots = listMediaSlots(makeNewScene("ProofMontage"));
    // sample preset 现在是 3 格证据，各一个 src 媒体槽（label 不是媒体槽）。
    expect(slots.map((s) => s.path)).toEqual(["media.items.0.src", "media.items.1.src", "media.items.2.src"]);
    expect(slots.every((s) => !s.bound)).toBe(true);
  });

  it("countUnboundMedia sums across scenes", () => {
    const manifest: Manifest = {
      compositionId: "m",
      duration: 15,
      scenes: [
        makeNewScene("TitleCard"), // 0
        makeNewScene("StatsHero"), // 1 (presenter)
        makeNewScene("ScreenWithPip"), // 2 (screen + pip)
      ],
    };
    expect(countUnboundMedia(manifest)).toBe(3);
  });
});

describe("pxToSeconds", () => {
  it("converts a pixel delta to seconds by track-width ratio", () => {
    expect(pxToSeconds(50, 500, 100)).toBe(10);
    expect(pxToSeconds(-25, 500, 100)).toBe(-5);
    expect(pxToSeconds(100, 0, 100)).toBe(0); // guard div-by-zero
  });
});

describe("resizeSceneDuration", () => {
  const scenes = [
    { id: "a", component: "TitleCard", scene_type: "title_card", start: 0, duration: 4, props: {} },
    { id: "b", component: "TitleCard", scene_type: "title_card", start: 4, duration: 4, props: {} },
    { id: "c", component: "TitleCard", scene_type: "title_card", start: 8, duration: 4, props: {} },
  ];

  it("updates the target duration and reflows later scenes to stay contiguous", () => {
    const next = resizeSceneDuration(scenes, "a", 6);
    expect(next.find((s) => s.id === "a")!.duration).toBe(6);
    expect(next.map((s) => s.start)).toEqual([0, 6, 10]); // b/c shift to follow
    expect(timelineEnd(next)).toBe(14);
  });

  it("clamps below the minimum duration", () => {
    const next = resizeSceneDuration(scenes, "b", 0.1);
    expect(next.find((s) => s.id === "b")!.duration).toBe(MIN_SCENE_DURATION);
    expect(next.map((s) => s.start)).toEqual([0, 4, 4.5]);
  });

  it("rounds to ms and leaves the array immutable", () => {
    const next = resizeSceneDuration(scenes, "a", 5.0009);
    expect(next.find((s) => s.id === "a")!.duration).toBe(5.001);
    expect(scenes[0].duration).toBe(4); // original untouched
  });

  it("resize + reflow keeps the manifest passing real validateManifest", () => {
    const manifest: Manifest = {
      compositionId: "resize-test",
      duration: 10,
      output: "index.html",
      scenes: [
        makeNewScene("TitleCard", { existingIds: [] }),
        makeNewScene("StepCard", { existingIds: ["new-titlecard"] }),
      ],
    };
    const resized = resizeSceneDuration(manifest.scenes, manifest.scenes[0].id, 9);
    const next: Manifest = { ...manifest, scenes: resized, duration: timelineEnd(resized) };
    expect(next.scenes.map((s) => s.start)).toEqual([0, 9]);
    expect(next.duration).toBe(14);
    const failures = validateManifest(next, { root: composerRoot, manifestPath, checkMedia: true });
    expect(failures).toEqual([]);
  });
});

describe("reflow keeps the manifest valid (real validateManifest)", () => {
  it("insert + reflow produces a manifest that passes the anti-drift rules", () => {
    const base: Manifest = {
      compositionId: "reflow-test",
      duration: 4,
      output: "index.html",
      scenes: [makeNewScene("TitleCard", { existingIds: [] })],
    };
    const inserted = insertScene(base, makeNewScene("StepCard", { existingIds: base.scenes.map((s) => s.id) }), base.scenes[0].id);
    const reflowed = applyReflow(inserted);
    // contiguous + duration synced
    expect(reflowed.scenes.map((s) => s.start)).toEqual([0, 5]);
    expect(reflowed.duration).toBe(10);
    const failures = validateManifest(reflowed, { root: composerRoot, manifestPath, checkMedia: true });
    expect(failures).toEqual([]);
  });
});

describe("placeSceneAtStart — 拖拽落点时间生效，不 append 到尾部（S2 回归）", () => {
  const scenes: Scene[] = [
    { id: "a", component: "TitleCard", scene_type: "title_card", start: 0, duration: 5, props: {} },
    { id: "b", component: "StepCard", scene_type: "step_card", start: 5, duration: 5, props: {} },
  ];
  const fresh: Scene = { id: "new", component: "TitleCard", scene_type: "title_card", start: 0, duration: 5, props: {} };

  it("把新卡放到指定落点 start（自由摆位，不动其它卡）", () => {
    const out = placeSceneAtStart(scenes, fresh, 40);
    expect(out).toHaveLength(3);
    expect(out.find((s) => s.id === "new")?.start).toBe(40);
    // 其它卡不被 reflow
    expect(out.find((s) => s.id === "a")?.start).toBe(0);
    expect(out.find((s) => s.id === "b")?.start).toBe(5);
  });

  it("允许落在中部（gap/overlap 不 reflow）", () => {
    const out = placeSceneAtStart(scenes, fresh, 7.5);
    expect(out.find((s) => s.id === "new")?.start).toBe(7.5);
  });

  it("负数/NaN 落点 clamp 到 0；start 四舍五入到毫秒", () => {
    expect(placeSceneAtStart(scenes, fresh, -3).find((s) => s.id === "new")?.start).toBe(0);
    expect(placeSceneAtStart(scenes, fresh, Number.NaN).find((s) => s.id === "new")?.start).toBe(0);
    expect(placeSceneAtStart(scenes, fresh, 12.34567).find((s) => s.id === "new")?.start).toBe(12.346);
  });

  it("不修改入参数组", () => {
    placeSceneAtStart(scenes, fresh, 40);
    expect(scenes).toHaveLength(2);
  });
});
