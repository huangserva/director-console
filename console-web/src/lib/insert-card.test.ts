import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateManifest } from "../../../hyperframes-composer/scripts/manifest-rules.mjs";
import type { Manifest, Scene } from "./api";
import {
  CARD_TYPE_MARKER,
  cardTypeToCoarse,
  makeCardScene,
  manifestToPlan,
  RECOMMENDED_CARDS,
} from "./packaging-plan";
import { applyReflow, canDeleteScene, deleteScene, insertScene, makeNewScene } from "./scene-templates";

const composerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../hyperframes-composer");
const manifestPath = path.join(composerRoot, "manifests", "insert-card-test.json");

function baseManifest(): Manifest {
  const first = makeNewScene("TitleCard", { existingIds: [] });
  return { compositionId: "insert-card-test", duration: Number(first.duration ?? 1), output: "index.html", scenes: [first] };
}

describe("makeCardScene — 12-class card type → coarse scene", () => {
  it("resolves component + scene_type from the shared mapping and stamps the marker", () => {
    const s = makeCardScene("product-highlight", { existingIds: [] });
    expect(s.component).toBe(cardTypeToCoarse["product-highlight"].component);
    expect(s.scene_type).toBe(cardTypeToCoarse["product-highlight"].scene_type);
    expect((s.props as Record<string, unknown>)[CARD_TYPE_MARKER]).toBe("product-highlight");
  });

  it("approximated types (brand) still produce a legal coarse scene", () => {
    const s = makeCardScene("brand", { existingIds: [] });
    expect(s.component).toBe("TitleCard"); // approximated mapping
    expect((s.props as Record<string, unknown>)[CARD_TYPE_MARKER]).toBe("brand");
  });
});

describe("insert every recommended card → manifest stays valid + plan reflects it", () => {
  for (const rec of RECOMMENDED_CARDS) {
    it(`insert ${rec.cardType} passes real validateManifest and lands on the card track`, () => {
      const base = baseManifest();
      const scene = makeCardScene(rec.cardType, {
        afterScene: base.scenes[0],
        existingIds: base.scenes.map((s) => s.id),
      });
      const next = applyReflow(insertScene(base, scene, base.scenes[0].id));

      // 1) passes the real composer anti-drift rules (media checking off — defaults use placeholders)
      expect(validateManifest(next, { root: composerRoot, manifestPath, checkMedia: false })).toEqual([]);

      // 2) the new card appears on the plan's card track with the chosen 12-class type (marker respected)
      const plan = manifestToPlan(next);
      expect(plan.tracks.card).toHaveLength(2);
      const inserted = plan.tracks.card.find((c) => c.id === scene.id)!;
      expect(inserted.type).toBe(rec.cardType);
    });
  }

  it("reflow keeps the card track contiguous (each start = previous end)", () => {
    const base = baseManifest();
    const scene = makeCardScene("cta", { afterScene: base.scenes[0], existingIds: base.scenes.map((s) => s.id) });
    const next = applyReflow(insertScene(base, scene, base.scenes[0].id));
    const cards = manifestToPlan(next).tracks.card;
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i].timeline.start).toBeCloseTo(cards[i - 1].timeline.start + cards[i - 1].timeline.duration, 3);
    }
  });
});

describe("delete card from the track never produces an empty manifest", () => {
  it("allows delete when >1 card, blocks the last", () => {
    const base = baseManifest();
    const scene = makeCardScene("opening", { afterScene: base.scenes[0], existingIds: base.scenes.map((s) => s.id) });
    const two = applyReflow(insertScene(base, scene, base.scenes[0].id));
    expect(canDeleteScene(two)).toBe(true);

    const one = applyReflow(deleteScene(two, scene.id)) as Manifest;
    expect(one.scenes).toHaveLength(1);
    expect(canDeleteScene(one)).toBe(false); // last card guarded
  });
});

// sanity: a plain scene without the marker still infers a representative type
describe("marker fallback", () => {
  it("falls back to inferCardType when no marker present", () => {
    const plain: Scene = { id: "x", component: "SummaryCta", scene_type: "summary_cta", start: 0, duration: 5, props: {} };
    const plan = manifestToPlan({ compositionId: "m", duration: 5, scenes: [plain] });
    expect(plan.tracks.card[0].type).toBe("cta");
  });
});
