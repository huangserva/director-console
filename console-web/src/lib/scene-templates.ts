// M4 structural editing: build a new scene for any catalog component with sane
// default props that pass the composer's anti-drift rules, and insert/delete it.
//
// Defaults are hand-authored per component (clearer + budget-safe than generic
// filling). Text placeholders stay within the catalog text budget (CJK counts ×2:
// chip≤24, kicker≤32, title≤28, subline≤44, card.label/step.item≤18, stat.title≤24).
//
// Media fields use a NON-PATH placeholder token: it satisfies the required-prop and
// the "exactly one PIP" rule, but is skipped by validateMediaExists (which only
// checks values ending in a media extension) — so a media component inserts WITHOUT
// a spurious "media missing" failure, while the UI still flags it as needing binding.
import type { Manifest, Scene } from "./api";
import { getComponent } from "./catalog";

/** Placeholder for a media field the operator must replace with a real path. */
export const MEDIA_PLACEHOLDER = "TODO-bind-media";

const DEFAULT_SCENE_DURATION = 5;

type PropsFactory = () => Record<string, unknown>;

const DEFAULT_PROPS: Record<string, PropsFactory> = {
  TitleCard: () => ({
    cornerLeft: "LEFT",
    cornerName: "Name",
    kicker: "KICKER",
    title: "新标题",
    subline: "副标题占位文本",
  }),
  StepCard: () => ({
    kicker: "STEP 01",
    title: "步骤标题",
    items: ["要点一", "要点二", "要点三"],
  }),
  StatsHero: () => ({
    media: { presenter: MEDIA_PLACEHOLDER },
    stat: { label: "LABEL", number: "0", unit: "个", title: "统计标题" },
    // `browser` is required by the renderer (registry.mjs renderOpeningStat) even
    // though it's not in catalog requiredProps — shape mirrors memos-v3's StatsHero.
    browser: { done: "Done", icons: ["AI", "CC", "CLI", "MCP", "✓"], mediaStart: 0 },
    titleBeat: { title: "标题占位" },
  }),
  ScreenWithPip: () => ({
    label: "屏幕标签",
    media: { screen: MEDIA_PLACEHOLDER, pip: MEDIA_PLACEHOLDER },
  }),
  SplitTextPresenter: () => ({
    variant: "course",
    chip: "CHIP",
    kicker: "KICKER",
    title: "概念标题",
    cards: [{ label: "卡片一" }, { label: "卡片二" }],
    media: { presenter: MEDIA_PLACEHOLDER },
  }),
  HeroAroll: () => ({
    media: { presenter: MEDIA_PLACEHOLDER },
  }),
  ProofMontage: () => ({
    // Renderer reads item.src/start/duration/label (registry.mjs renderProofMontage),
    // so items are objects, not strings. The bindable media slot is items[i].src.
    media: { items: [{ src: MEDIA_PLACEHOLDER, label: "Proof", start: 0, duration: 3 }] },
  }),
  SummaryCta: () => ({
    media: { presenter: MEDIA_PLACEHOLDER },
    chip: "CHIP",
    title: "总结标题",
    subline: "收尾副标题占位",
  }),
};

/** Default props for a component (empty object if unknown — caller should guard). */
export function defaultPropsFor(componentId: string): Record<string, unknown> {
  const factory = DEFAULT_PROPS[componentId];
  return factory ? factory() : {};
}

/** True when this component's default props carry a media placeholder to bind. */
export function componentNeedsMedia(componentId: string): boolean {
  return JSON.stringify(defaultPropsFor(componentId)).includes(MEDIA_PLACEHOLDER);
}

/** Does this scene still contain an unbound media placeholder? */
export function sceneHasUnboundMedia(scene: Scene): boolean {
  return JSON.stringify(scene.props ?? {}).includes(MEDIA_PLACEHOLDER);
}

export interface MediaSlot {
  /** Dotted path into props, e.g. "media.presenter", "media.items.0", "panels.0.media.presenter". */
  path: string;
  value: string;
  /** True when bound to a real value (non-empty and not the placeholder). */
  bound: boolean;
}

function isBoundMediaValue(value: string): boolean {
  return value.trim() !== "" && value !== MEDIA_PLACEHOLDER;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Media-path field names a renderer reads as a video source. A string leaf under a
// `media` subtree is a bindable slot only if its key is one of these OR a numeric
// array index (e.g. `media.items.0` when items are bare strings). This excludes
// sibling text like `media.items.0.label`, which is NOT a media path.
const MEDIA_FIELD_KEYS = new Set(["presenter", "pip", "pip2", "screen", "src", "poster"]);
const isMediaSlotKey = (key: string): boolean => MEDIA_FIELD_KEYS.has(key) || /^\d+$/.test(key);

/**
 * Every bindable media slot in a scene: a string leaf under a `media` subtree whose
 * key is a media-path field (`presenter`/`pip`/`screen`/`src`/…) or an array index.
 * Covers `media.presenter`/`media.pip`/`media.screen`, `media.items[i]` (string) and
 * `media.items[i].src` (object), and `panels[i].media.presenter`. No media → [].
 */
export function listMediaSlots(scene: Scene): MediaSlot[] {
  const out: MediaSlot[] = [];
  const walk = (value: unknown, path: string, inMedia: boolean) => {
    if (typeof value === "string") {
      const key = path.split(".").pop() ?? "";
      if (inMedia && isMediaSlotKey(key)) out.push({ path, value, bound: isBoundMediaValue(value) });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i), inMedia));
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        walk(child, path ? `${path}.${key}` : key, inMedia || key === "media");
      }
    }
  };
  walk(scene.props ?? {}, "", false);
  return out;
}

/** Count of unbound media slots in a scene. */
export function sceneUnboundMediaCount(scene: Scene): number {
  return listMediaSlots(scene).filter((slot) => !slot.bound).length;
}

/** Total unbound media slots across the whole manifest. */
export function countUnboundMedia(manifest: Manifest): number {
  return manifest.scenes.reduce((total, scene) => total + sceneUnboundMediaCount(scene), 0);
}

function uniqueId(base: string, existingIds: Set<string>): string {
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Build a new scene for `componentId`: scene_type fixed to the catalog's value for
 * that component, default props, a unique id, and timing that starts right after
 * `afterScene` (or at 0). Timeline reflow of later scenes is a later M4 cut — this
 * only places the new scene; it does not push the others.
 */
export function makeNewScene(
  componentId: string,
  opts: { afterScene?: Scene | null; existingIds?: Iterable<string> } = {},
): Scene {
  const component = getComponent(componentId);
  if (!component) throw new Error(`unknown component ${componentId}`);
  const sceneType = component.sceneTypes[0];
  const existing = new Set(opts.existingIds ?? []);
  const afterScene = opts.afterScene ?? null;
  const start = afterScene ? Number(afterScene.start ?? 0) + Number(afterScene.duration ?? 0) : 0;
  const id = uniqueId(`new-${componentId.toLowerCase()}`, existing);
  return {
    id,
    component: componentId,
    scene_type: sceneType,
    start,
    duration: DEFAULT_SCENE_DURATION,
    props: defaultPropsFor(componentId),
  };
}

/** Insert `scene` immediately after `afterId` (or at the end if not found/null). */
export function insertScene(manifest: Manifest, scene: Scene, afterId: string | null): Manifest {
  const scenes = [...manifest.scenes];
  const idx = afterId ? scenes.findIndex((s) => s.id === afterId) : -1;
  if (idx === -1) scenes.push(scene);
  else scenes.splice(idx + 1, 0, scene);
  return { ...manifest, scenes };
}

/** Remove the scene with `sceneId` (no-op if absent). */
export function deleteScene(manifest: Manifest, sceneId: string): Manifest {
  return { ...manifest, scenes: manifest.scenes.filter((s) => s.id !== sceneId) };
}

// Round to ms precision so chained additions of values like 18.48 don't drift.
const round3 = (n: number): number => Number(n.toFixed(3));

/**
 * Lay scenes out contiguously in their current order: each scene's `start` becomes the
 * previous scene's end (start+duration), eliminating overlaps and gaps. The first
 * scene's start is preserved (manifest-rules doesn't check overlap, so reflow is how
 * we keep the timeline coherent after insert/delete/reorder). Durations are untouched.
 * Pure — returns a new array.
 */
export function reflowTimeline(scenes: Scene[]): Scene[] {
  let cursor = scenes.length ? Number(scenes[0].start ?? 0) : 0;
  return scenes.map((scene) => {
    const next = { ...scene, start: round3(cursor) };
    // Guard against negative/NaN durations: never advance the cursor backward
    // (would re-introduce overlap). Durations themselves are left untouched here;
    // resizeSceneDuration is where a duration gets clamped to the minimum.
    const dur = Number(scene.duration);
    cursor = round3(cursor + (Number.isFinite(dur) && dur > 0 ? dur : 0));
    return next;
  });
}

/** End time of the timeline (start+duration of the last scene), 0 when empty. */
export function timelineEnd(scenes: Scene[]): number {
  if (!scenes.length) return 0;
  const last = scenes[scenes.length - 1];
  return round3(Number(last.start ?? 0) + Number(last.duration ?? 0));
}

/** Reflow the manifest's scenes and sync `duration` to the new timeline end. */
export function applyReflow(manifest: Manifest): Manifest {
  const scenes = reflowTimeline(manifest.scenes);
  const end = timelineEnd(scenes);
  // duration must stay > 0 for manifest-rules; keep the old value if reflow yields 0.
  return { ...manifest, scenes, duration: end > 0 ? end : manifest.duration };
}

/** Minimum scene duration (seconds) — a drag can't shrink a scene below this. */
export const MIN_SCENE_DURATION = 0.5;

/** Convert a pixel delta on the timeline track to seconds, given the track width and total. */
export function pxToSeconds(deltaPx: number, trackWidthPx: number, totalSeconds: number): number {
  if (trackWidthPx <= 0) return 0;
  return round3((deltaPx / trackWidthPx) * totalSeconds);
}

/**
 * Set one scene's duration (clamped to MIN_SCENE_DURATION) and reflow so later scenes
 * shift to follow. Pure — returns a new, contiguous scenes array.
 */
export function resizeSceneDuration(scenes: Scene[], sceneId: string, newDuration: number): Scene[] {
  const clamped = Math.max(MIN_SCENE_DURATION, round3(newDuration));
  const updated = scenes.map((s) => (s.id === sceneId ? { ...s, duration: clamped } : s));
  return reflowTimeline(updated);
}

/**
 * Move `sceneId` to a new position by drag-and-drop. `insertIndex` is the boundary
 * in the ORIGINAL n-block layout: 0 = before the first block, n = after the last.
 * Removing the dragged block shifts later indices left by one, which this accounts
 * for, so dragging a block onto its own boundary (insertIndex === from or from+1) is
 * a no-op. Pure — returns a fresh array; caller reflows for contiguous timing.
 */
export function moveSceneToIndex(scenes: Scene[], sceneId: string, insertIndex: number): Scene[] {
  const from = scenes.findIndex((s) => s.id === sceneId);
  if (from < 0) return scenes.slice();
  let to = Math.max(0, Math.min(scenes.length, Math.round(insertIndex)));
  const copy = [...scenes];
  const [moved] = copy.splice(from, 1);
  if (to > from) to -= 1; // removal shifted everything after `from` left by one
  copy.splice(to, 0, moved);
  return copy;
}

/** Move a scene one slot up or down in order (no-op at the ends or if absent). */
export function moveScene(scenes: Scene[], sceneId: string, direction: "up" | "down"): Scene[] {
  const i = scenes.findIndex((s) => s.id === sceneId);
  if (i < 0) return scenes.slice(); // always return a fresh array, even on no-op
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= scenes.length) return scenes.slice();
  const copy = [...scenes];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

/** A scene can be deleted only if it's not the last remaining one (scenes must be non-empty). */
export function canDeleteScene(manifest: Manifest): boolean {
  return manifest.scenes.length > 1;
}
