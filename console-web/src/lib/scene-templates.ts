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

/** Image file extensions a screen slot may carry (rendered as <img>, not <video>). */
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i;

/** True when a bound media path points at an image (vs a video). Empty/placeholder → false. */
export function isImageMediaPath(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() !== "" && value !== MEDIA_PLACEHOLDER && IMAGE_EXT.test(value.trim());
}

const DEFAULT_SCENE_DURATION = 5;

type PropsFactory = () => Record<string, unknown>;

const DEFAULT_PROPS: Record<string, PropsFactory> = {
  // Sample preset：插入即成形（非占位）。标题卡是最常用的开场/分段卡。
  TitleCard: () => ({
    cornerLeft: "OPENING",
    cornerName: "PASEO",
    kicker: "开场",
    title: "用一句话讲清主题",
    subline: "副标题承接，引出下文",
  }),
  // Sample preset：三步上手，逐条出现。
  StepCard: () => ({
    kicker: "步骤",
    title: "三步上手",
    items: ["准备素材与脚本", "一键生成草稿", "微调导出成片"],
  }),
  StatsHero: () => ({
    media: { presenter: MEDIA_PLACEHOLDER },
    // Sample preset (not empty placeholders): inserting the card gives a polished,
    // meaningful "开场数据卡" out of the box — a real data beat the operator tweaks,
    // not "标题占位 / 0 / LABEL". This is the standard template for the other components.
    stat: { cornerLeft: "DATA", label: "增长", number: "38", unit: "%", title: "转化提升" },
    // `browser` is required by the renderer (registry.mjs renderOpeningStat) even
    // though it's not in catalog requiredProps — shape mirrors memos-v3's StatsHero.
    browser: { done: "完成", icons: ["AI", "CC", "CLI", "MCP", "✓"], mediaStart: 0 },
    titleBeat: { cornerLeft: "OPENING", cornerName: "PASEO", kicker: "开场", title: "标题节拍", subline: "一句话点题，承接下文" },
  }),
  ScreenWithPip: () => ({
    label: "屏幕标签",
    media: { screen: MEDIA_PLACEHOLDER, pip: MEDIA_PLACEHOLDER },
  }),
  // Sample preset：图文讲解卡，左侧 3 张要点卡 + 右侧主讲人窗口。
  SplitTextPresenter: () => ({
    variant: "course",
    chip: "概念",
    kicker: "讲解",
    title: "一图看懂核心概念",
    cards: [{ label: "输入素材" }, { label: "自动成片" }, { label: "一键导出" }],
    media: { presenter: MEDIA_PLACEHOLDER },
  }),
  // Sample preset：主讲人特写强调卡。animation.in 让 renderHeroAroll 渲染文案块（rich 才出 copy）。
  HeroAroll: () => ({
    media: { presenter: MEDIA_PLACEHOLDER },
    chip: "重点",
    title: "这一点最关键",
    subline: "记住这句话就够了",
    animation: { in: "fade-up" },
  }),
  // Sample preset：证据快剪，三格证据（文字标签像样，视频在媒体绑定区绑）。
  // Renderer reads item.src/start/duration/label (registry.mjs renderProofMontage)，items 是对象，src 是可绑媒体槽。
  ProofMontage: () => ({
    media: {
      items: [
        { src: MEDIA_PLACEHOLDER, label: "真实数据", start: 0, duration: 3 },
        { src: MEDIA_PLACEHOLDER, label: "用户好评", start: 0, duration: 3 },
        { src: MEDIA_PLACEHOLDER, label: "权威引用", start: 0, duration: 3 },
      ],
    },
  }),
  // Sample preset：收尾行动号召。
  SummaryCta: () => ({
    media: { presenter: MEDIA_PLACEHOLDER },
    chip: "马上开始",
    title: "现在就动手做第一条",
    subline: "按这套流程，今天就能产出成片",
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

/** Does this scene still contain an unbound media placeholder (either placeholder family)? */
export function sceneHasUnboundMedia(scene: Scene): boolean {
  return /TODO-bind/i.test(JSON.stringify(scene.props ?? {}));
}

export interface MediaSlot {
  /** Dotted path into props, e.g. "media.presenter", "media.items.0", "panels.0.media.presenter". */
  path: string;
  value: string;
  /** True when bound to a real value (non-empty and not the placeholder). */
  bound: boolean;
}

// A media slot is unbound when it is empty OR carries any "to be bound" placeholder.
// Two placeholder shapes exist: the UI's add-card default (MEDIA_PLACEHOLDER =
// "TODO-bind-media", extensionless) and the template-apply family that projects a
// per-slot stub ("TODO-bind-presenter.mp4", "TODO-bind-screen.mp4", "TODO-bind-pip.mp4").
// Both must read as unbound so the post-apply precheck and the compose/render soft-gate
// catch a freshly-applied template before it renders blank media (or 422s downstream).
function isBoundMediaValue(value: string): boolean {
  const v = value.trim();
  return v !== "" && v !== MEDIA_PLACEHOLDER && !/^TODO-bind/i.test(v);
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

/** One scene's unbound-media breakdown, for the post-apply precheck banner. */
export interface SceneUnboundMedia {
  /** Scene/card id carrying unbound slots — also the jump-to target. */
  sceneId: string;
  /** The scene's component id; the UI maps this to a human card label. */
  component: string;
  /** How many media slots in this scene are still unbound. */
  count: number;
  /** Dotted prop paths of the unbound slots (e.g. "media.presenter"). */
  paths: string[];
}

/** Whole-manifest unbound-media precheck result. */
export interface MediaPrecheck {
  /** Total unbound media slots across the manifest. */
  total: number;
  /** Per-scene breakdown, manifest order, only scenes with ≥1 unbound slot. */
  scenes: SceneUnboundMedia[];
  /** First scene (manifest order) with an unbound slot, for a jump-to action. */
  firstUnboundSceneId: string | null;
}

/**
 * Client-side media precheck for a manifest: which scenes still carry unbound /
 * placeholder (TODO-bind-media) or stale-path media slots, how many, and where.
 * Pure — used to warn right after applying a template (its slots usually land as
 * placeholders or point at the old project's media) BEFORE the user composes /
 * renders and the server's validateManifest 422s with a cryptic error.
 */
export function precheckUnboundMedia(manifest: Manifest): MediaPrecheck {
  const scenes: SceneUnboundMedia[] = [];
  for (const scene of manifest.scenes) {
    const unbound = listMediaSlots(scene).filter((slot) => !slot.bound);
    if (unbound.length > 0) {
      scenes.push({
        sceneId: scene.id,
        component: scene.component,
        count: unbound.length,
        paths: unbound.map((slot) => slot.path),
      });
    }
  }
  const total = scenes.reduce((sum, s) => sum + s.count, 0);
  return { total, scenes, firstUnboundSceneId: scenes[0]?.sceneId ?? null };
}

/** Soft-gate predicate: true when compose/render should warn before proceeding. */
export function hasUnboundMedia(manifest: Manifest): boolean {
  return countUnboundMedia(manifest) > 0;
}

/** Friendly breakdown of a failed apply's media-missing failures. */
export interface MediaMissingSummary {
  /** Number of "<scene> media missing: <path>" failures. */
  total: number;
  /** Distinct scene ids that are missing media, first-seen order. */
  scenes: string[];
  /** Failures that are NOT media-missing — surfaced verbatim so nothing is swallowed. */
  otherFailures: string[];
}

// Server apply/lint emits one line per missing media file: "<sceneId> media missing: <path>".
const MEDIA_MISSING_RE = /^(.+?) media missing: /;

/**
 * Summarize a failed template-apply's failure list. The server 422s an apply when the
 * projected media files don't exist (template stubs like TODO-bind-presenter.mp4, or a
 * source project's media the new project lacks), emitting raw "media missing" lines. We
 * turn those into a friendly "N 处媒体待绑定（卡片…）" banner while keeping every non-media
 * failure verbatim — the precheck never swallows a real validation error.
 */
export function summarizeMediaMissing(failures: string[]): MediaMissingSummary {
  const scenes: string[] = [];
  const otherFailures: string[] = [];
  let total = 0;
  for (const failure of failures) {
    const match = MEDIA_MISSING_RE.exec(failure);
    if (match) {
      total += 1;
      if (!scenes.includes(match[1])) scenes.push(match[1]);
    } else {
      otherFailures.push(failure);
    }
  }
  return { total, scenes, otherFailures };
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

/**
 * Place `scene` at an explicit start time (free-position model: gaps/overlap allowed,
 * NO reflow of other scenes — same model as drag-move). Used when a palette card is
 * dropped at a point on the timeline so it lands there, not appended to the tail.
 * Clamps start to ≥ 0 and rounds to ms. Pure — returns a fresh scenes array.
 */
export function placeSceneAtStart(scenes: Scene[], scene: Scene, start: number): Scene[] {
  const safe = Number.isFinite(start) ? Math.max(0, start) : 0;
  return [...scenes, { ...scene, start: round3(safe) }];
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
