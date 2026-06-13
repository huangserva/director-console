// Client-side packaging-plan types + a read-only projection mirroring
// packages/packaging-plan/src/index.mjs::manifestToPlan. P2 renders the plan
// read-only (4 tracks + cards + segments); editing is P3.
//
// Why a client port instead of importing the package: the package reads JSON
// from disk via node:fs at module load, which can't run in the browser bundle.
// This port is intentionally a SUBSET — only the read-only projection P2 needs.
// The card-type→coarse mapping is imported from the same source-of-truth JSON
// the package uses, so the two never drift on the mapping itself.
import cardTypeToCoarseRaw from "../../../packages/packaging-plan/mappings/card-type-to-coarse.json";
import type { Manifest, Scene } from "./api";
import { sceneRoleLabel } from "./field-labels";
import { makeNewScene } from "./scene-templates";

export const CARD_TYPES = [
  "opening",
  "caption",
  "product-highlight",
  "demo-annotation",
  "comparison",
  "pip",
  "data-proof",
  "info-structure",
  "mv-rhythm",
  "transition",
  "brand",
  "cta",
] as const;
export type CardType = (typeof CARD_TYPES)[number];

interface CoarseMapping {
  component: string;
  scene_type: string;
  defaultPropsFn: string;
}
export const cardTypeToCoarse = cardTypeToCoarseRaw as Record<string, CoarseMapping>;

const reverseMapping = new Map<string, CardType>(
  Object.entries(cardTypeToCoarse).map(
    ([cardType, m]) => [`${m.component}:${m.scene_type}`, cardType as CardType] as const,
  ),
);

// Several 12-class card types map to the same coarse component (e.g. transition /
// brand / caption all → TitleCard:title_card), so inferCardType (coarse→first
// cardType) is lossy. When the user inserts a specific card type we stamp this
// marker into props so the chosen 12-class label survives re-derivation and
// round-trips (it lives in props, which the composer ignores).
export const CARD_TYPE_MARKER = "__cardType";

// Card types with no dedicated engine component yet — inserted via an approximate
// coarse component (P4 registry work adds real ones). UI annotates these.
export const APPROXIMATED_CARD_TYPES = new Set<CardType>(["transition", "mv-rhythm", "brand"]);

export interface PlanCardContent {
  chip?: string;
  cornerLeft?: string;
  cornerName?: string;
  kicker?: string;
  title?: string;
  subline?: string;
  label?: string;
  number?: string;
  unit?: string;
  items?: string[];
  cards?: unknown[];
  panels?: unknown[];
  stat?: Record<string, unknown>;
}

export interface PlanCard {
  id: string;
  type: CardType;
  engine: {
    component?: string;
    scene_type?: string;
    track?: number;
    finePieces?: string[];
    props?: Record<string, unknown>;
  };
  content: PlanCardContent;
  media: Record<string, unknown>;
  timeline: { track: "card"; start: number; duration: number };
  validation: { status: string; failures: string[] };
  layout?: Record<string, unknown>;
  font?: Record<string, unknown>;
  color?: Record<string, unknown>;
}

export interface PlanTrackClip {
  id: string;
  track: "video" | "audio" | "subtitle";
  src?: string | null;
  start: number;
  duration: number;
  mediaStart?: number;
}

export interface PlanSegment {
  id: string;
  label: string;
  start: number;
  end: number;
  recommendedCards?: string[];
}

export interface PackagingPlan {
  schemaVersion: string;
  projectId: string | null;
  recipeId: string | null;
  duration: number;
  // `videoUrl` is an optional HTTP-streamable URL for the source video, supplied by
  // the daemon's video-stream endpoint (GET packaging-plan → plan.source.videoUrl).
  // Optional for back-compat: older daemons omit it; the player degrades gracefully.
  source: { video: string | null; audio: string | null; captions: string | null; videoUrl?: string | null };
  tracks: { video: PlanTrackClip[]; audio: PlanTrackClip[]; subtitle: PlanTrackClip[]; card: PlanCard[] };
  segments: PlanSegment[];
  templateRef: unknown;
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function compactObject<T extends Record<string, unknown>>(object: T): Partial<T> {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function trackClipsFromManifest(
  clips: any[] | undefined,
  track: "video" | "audio",
  fallbackSrc: string | null,
  duration: number,
  previewUrl?: string | null,
): PlanTrackClip[] {
  if (Array.isArray(clips) && clips.length > 0) {
    return clips.map((clip, index) =>
      compactObject({
        id: clip.id ?? `${track}-${index + 1}`,
        track,
        src: clip.src ?? fallbackSrc,
        start: Number(clip.start ?? 0),
        duration: Number(clip.duration ?? duration),
        mediaStart: Number(clip.mediaStart ?? 0),
        previewUrl: track === "video" ? (clip.previewUrl ?? previewUrl) : undefined,
      }) as PlanTrackClip,
    );
  }
  return fallbackSrc
    ? [
        compactObject({
          id: `${track}-main`,
          track,
          src: fallbackSrc,
          start: 0,
          duration,
          mediaStart: 0,
          previewUrl: track === "video" ? previewUrl : undefined,
        }) as PlanTrackClip,
      ]
    : [];
}

export function inferCardType(scene: Scene): CardType {
  // Prefer an explicit insert-time marker (lossless); fall back to coarse→type.
  const marked = (scene.props as Record<string, unknown> | undefined)?.[CARD_TYPE_MARKER];
  if (typeof marked === "string" && (CARD_TYPES as readonly string[]).includes(marked)) return marked as CardType;
  return reverseMapping.get(`${scene.component}:${scene.scene_type}`) ?? "opening";
}

/**
 * Build a new scene for a 12-class card type: resolve the coarse component +
 * scene_type from the shared mapping, take the hardened default props (which all
 * pass real validateManifest/render), and stamp the chosen card type marker.
 * Reuses M4's makeNewScene so the engine-level defaults stay the single source.
 */
export function makeCardScene(
  cardType: CardType,
  opts: { afterScene?: Scene | null; existingIds: string[] },
): Scene {
  const mapping = cardTypeToCoarse[cardType];
  if (!mapping) throw new Error(`unknown card type: ${cardType}`);
  const scene = makeNewScene(mapping.component, opts);
  scene.scene_type = mapping.scene_type; // keep in lockstep with the mapping
  scene.props = { ...(scene.props ?? {}), [CARD_TYPE_MARKER]: cardType };
  return scene;
}

function extractContent(props: Record<string, any> = {}): PlanCardContent {
  return compactObject({
    chip: props.chip,
    cornerLeft: props.cornerLeft,
    cornerName: props.cornerName,
    kicker: props.kicker ?? props.titleBeat?.kicker,
    title: props.title ?? props.titleBeat?.title ?? props.stat?.title,
    subline: props.subline ?? props.titleBeat?.subline,
    label: props.label ?? props.stat?.label,
    items: clone(props.items),
    cards: clone(props.cards),
    panels: clone(props.panels),
    stat: clone(props.stat),
  }) as PlanCardContent;
}

function extractRichFields(props: Record<string, any> = {}) {
  return compactObject({
    layout: clone(props.layout),
    font: clone(props.style?.font),
    color: clone(props.style?.color),
  });
}

/**
 * Read-only projection of a composer manifest into a packaging-plan 4-track shape.
 * Mirrors the package's manifestToPlan for the fields P2 displays.
 */
export function manifestToPlan(
  manifest: Manifest,
  options: { projectId?: string; recipeId?: string | null; segments?: PlanSegment[] } = {},
): PackagingPlan {
  const audioSrc = (manifest.audio as any)?.src ?? null;
  const captions = (manifest.audio as any)?.captions ?? null;
  const video = (manifest as any).source?.video ?? null;
  const duration = Number(manifest.duration ?? 0);

  const videoUrl = (manifest as any).source?.videoUrl ?? null;
  const source = { video, audio: audioSrc, captions, videoUrl };
  const videoClips = (manifest as any).source?.videoClips;
  const audioClips = (manifest.audio as any)?.clips;

  const tracks: PackagingPlan["tracks"] = {
    video: trackClipsFromManifest(videoClips, "video", video, duration, videoUrl),
    audio: trackClipsFromManifest(audioClips, "audio", audioSrc, duration),
    subtitle: captions ? [{ id: "subtitle-main", track: "subtitle", src: captions, start: 0, duration }] : [],
    card: (manifest.scenes ?? []).map((scene, index) => {
      const rich = extractRichFields(scene.props as any);
      return {
        id: scene.id || `card-${index + 1}`,
        type: inferCardType(scene),
        engine: compactObject({
          component: scene.component,
          scene_type: scene.scene_type,
          track: scene.track,
          finePieces: clone(scene.finePieces),
          props: clone(scene.props) ?? {},
        }) as PlanCard["engine"],
        content: extractContent(scene.props as any),
        media: (clone((scene.props as any)?.media) as Record<string, unknown>) ?? {},
        timeline: { track: "card", start: Number(scene.start ?? 0), duration: Number(scene.duration ?? 0) },
        validation: { status: "unchecked", failures: [] },
        ...rich,
      } as PlanCard;
    }),
  };

  return {
    schemaVersion: "2026-06-12",
    projectId: options.projectId ?? (manifest.compositionId as string) ?? null,
    recipeId: options.recipeId ?? null,
    duration,
    source,
    tracks,
    segments: clone(options.segments) ?? [],
    templateRef: null,
  };
}

// ── Smart-plan-strip summary (pure) ──────────────────────────────────────────
export interface PlanSummary {
  segmentCount: number;
  recommendedCardCount: number;
  validationCount: number;
}

export interface SmartSegment {
  id: string;
  label: string;
  start: number;
  end: number;
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isGenericSegmentLabel(value: unknown): boolean {
  if (typeof value !== "string") return true;
  const label = value.trim();
  return label === "" || /^片段\s*\d+$/u.test(label);
}

export function deriveSmartSegments(plan: PackagingPlan): SmartSegment[] {
  return plan.segments.map((seg, index) => {
    const start = finiteOrNull(seg.start) ?? 0;
    const explicitEnd = finiteOrNull(seg.end);
    const nextStart = finiteOrNull(plan.segments[index + 1]?.start);
    const durationEnd = finiteOrNull(plan.duration);
    const end = explicitEnd ?? nextStart ?? durationEnd ?? start;
    const sceneComponent = plan.tracks.card[index]?.engine.component;
    return {
      id: seg.id,
      label: isGenericSegmentLabel(seg.label) ? sceneRoleLabel(sceneComponent) : seg.label,
      start,
      end: Math.max(start, end),
    };
  });
}

/**
 * Aggregate the strip's "识别 N 片段 · 推荐 M 卡 · K 校验项" line from the plan.
 * validationCount = cards carrying validation failures (P2 keeps this real, not faked).
 */
export function summarizePlan(plan: PackagingPlan, recommendedCardCount = RECOMMENDED_CARDS.length): PlanSummary {
  const segments = deriveSmartSegments(plan);
  return {
    segmentCount: segments.length,
    recommendedCardCount,
    validationCount: plan.tracks.card.filter((c) => (c.validation?.failures?.length ?? 0) > 0).length,
  };
}

// ── Component library config (12 categories + recommended grid) ──────────────
// UI vocabulary per SPEC §3 / mockup. iconName resolves in shell/Icon.tsx.
export interface LibraryCategory {
  id: CardType;
  label: string;
}
export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  { id: "opening", label: "开场" },
  { id: "caption", label: "字幕" },
  { id: "product-highlight", label: "产品展示" },
  { id: "demo-annotation", label: "讲解演示" },
  { id: "comparison", label: "对比" },
  { id: "pip", label: "画中画" },
  { id: "data-proof", label: "数据证明" },
  { id: "info-structure", label: "信息结构" },
  { id: "mv-rhythm", label: "MV节奏" },
  { id: "transition", label: "转场" },
  { id: "brand", label: "品牌元素" },
  { id: "cta", label: "行动号召" },
];

export interface RecommendedCard {
  cardType: CardType;
  title: string;
  sub: string;
  icon: string;
}
// The 8 recommended cards from the design reference grid.
export const RECOMMENDED_CARDS: RecommendedCard[] = [
  { cardType: "product-highlight", title: "产品亮点卡", sub: "卖点 / 功能 / 版本更新", icon: "star" },
  { cardType: "opening", title: "章节标题卡", sub: "开场 / 转段 / 模块分隔", icon: "title" },
  { cardType: "caption", title: "关键词字幕", sub: "逐句字幕 / 重点词强调", icon: "caption" },
  { cardType: "demo-annotation", title: "演示标注卡", sub: "截图 / 箭头 / 圈选 / 高亮", icon: "annotate" },
  { cardType: "comparison", title: "左右对比卡", sub: "方案 / 竞品 / 前后效果", icon: "compare" },
  { cardType: "pip", title: "画中画卡", sub: "人像 / 屏幕 / 反应小窗", icon: "pip" },
  { cardType: "data-proof", title: "数据证明卡", sub: "数字 / 引用 / 评价 / 证据", icon: "chart" },
  { cardType: "mv-rhythm", title: "节奏歌词卡", sub: "MV / 歌词 / 波形 / 节拍", icon: "music" },
];

const CARD_TYPE_LABELS: Record<CardType, string> = Object.fromEntries(
  LIBRARY_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<CardType, string>;

/** Human label for a card type (falls back to the raw id). */
export function cardTypeLabel(type: CardType): string {
  return CARD_TYPE_LABELS[type] ?? type;
}

// Full insertable card set — one card per category (12), so the library grid can
// be filtered by category and by search. RECOMMENDED_CARDS is the curated subset.
export const LIBRARY_CARDS: RecommendedCard[] = [
  { cardType: "opening", title: "章节标题卡", sub: "开场 / 转段 / 模块分隔", icon: "title" },
  { cardType: "caption", title: "关键词字幕", sub: "逐句字幕 / 重点词强调", icon: "captions" },
  { cardType: "product-highlight", title: "产品亮点卡", sub: "卖点 / 功能 / 版本更新", icon: "star" },
  { cardType: "demo-annotation", title: "演示标注卡", sub: "截图 / 箭头 / 圈选 / 高亮", icon: "annotate" },
  { cardType: "comparison", title: "左右对比卡", sub: "方案 / 竞品 / 前后效果", icon: "compare" },
  { cardType: "pip", title: "画中画卡", sub: "人像 / 屏幕 / 反应小窗", icon: "pip" },
  { cardType: "data-proof", title: "数据证明卡", sub: "数字 / 引用 / 评价 / 证据", icon: "chart" },
  { cardType: "info-structure", title: "信息结构卡", sub: "步骤 / 列表 / 分点讲解", icon: "plan" },
  { cardType: "mv-rhythm", title: "节奏歌词卡", sub: "MV / 歌词 / 波形 / 节拍", icon: "music" },
  { cardType: "transition", title: "转场卡", sub: "段落切换 / 过渡", icon: "spark" },
  { cardType: "brand", title: "品牌元素卡", sub: "标识 / 定位 / 品牌信息", icon: "style" },
  { cardType: "cta", title: "行动号召卡", sub: "行动号召 / 报价 / 引导", icon: "export" },
];

export type LibraryFilter = CardType | "all";

/** Filter the library cards by category ("all" = no category filter) and a text query. */
export function filterLibraryCards(cards: RecommendedCard[], category: LibraryFilter, query: string): RecommendedCard[] {
  const q = query.trim().toLowerCase();
  return cards.filter((c) => {
    if (category !== "all" && c.cardType !== category) return false;
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.sub.toLowerCase().includes(q) ||
      c.cardType.toLowerCase().includes(q) ||
      cardTypeLabel(c.cardType).toLowerCase().includes(q)
    );
  });
}
