// v3-2 模板库可视化 gallery：从 GET /templates/:id 详情派生 gallery 卡数据 + 筛选。
// 守渲染现实：aspect 固定 16:9（渲染器 1920×1080）；9:16/1:1 标 future。代表性预览=cardType 序列 mini tile（真渲染缩略图 future）。
import { cardTypeLabel, type CardType } from "./packaging-plan";

export interface TemplateMediaRequirement {
  slot: string;
  kind: string;
  required?: boolean;
}

export interface TemplateCardRule {
  cardType: string;
  mediaRequirements?: TemplateMediaRequirement[];
  engine?: { component?: string; scene_type?: string };
}

export interface TemplateDetail {
  id: string;
  name: string;
  description?: string;
  cardRules?: TemplateCardRule[];
}

// 渲染器固定 1920×1080；9:16 / 1:1 渲不出 → 仅作展示属性，全 16:9，其它标 future。
export const TEMPLATE_ASPECT = "16:9";

const MEDIA_KIND_LABELS: Record<string, string> = {
  "presenter-video": "数字人/人像视频",
  "screen-video": "屏幕录制",
  audio: "音频",
  media: "视频/图片",
};

export function mediaKindLabel(kind: string): string {
  return MEDIA_KIND_LABELS[kind] ?? kind;
}

// 卡片序列摘要：总张数 + 按类型分组（中文 label，保留首现序）。
export interface CardSequenceSummary {
  total: number;
  types: { label: string; count: number }[];
}
export function summarizeCardSequence(cardRules: TemplateCardRule[] | undefined): CardSequenceSummary {
  const rules = cardRules ?? [];
  const counts = new Map<string, number>();
  for (const r of rules) {
    const label = cardTypeLabel(r.cardType as CardType);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { total: rules.length, types: [...counts.entries()].map(([label, count]) => ({ label, count })) };
}

// 媒体需求摘要：总处数 + required 处数 + 按 kind 分组（中文，复用 v2 媒体词汇）。
export interface MediaRequirementSummary {
  count: number;
  required: number;
  kinds: { label: string; count: number }[];
}
export function summarizeMediaRequirements(cardRules: TemplateCardRule[] | undefined): MediaRequirementSummary {
  const reqs = (cardRules ?? []).flatMap((r) => r.mediaRequirements ?? []);
  const counts = new Map<string, number>();
  for (const m of reqs) {
    const label = mediaKindLabel(m.kind);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return {
    count: reqs.length,
    required: reqs.filter((m) => m.required !== false).length,
    kinds: [...counts.entries()].map(([label, count]) => ({ label, count })),
  };
}

// 代表性预览 tile：每张卡的 cardType + 中文 label（组件渲染成 mini 版式块）。
export interface SequenceTile {
  cardType: string;
  label: string;
}
export function sequenceTiles(cardRules: TemplateCardRule[] | undefined): SequenceTile[] {
  return (cardRules ?? []).map((r) => ({ cardType: r.cardType, label: cardTypeLabel(r.cardType as CardType) }));
}

// 主用途 = 出现最多的 cardType 分类（纯数据派生，不编造平台/用途）。空 → 通用。
export function primaryUse(cardRules: TemplateCardRule[] | undefined): string {
  const summary = summarizeCardSequence(cardRules);
  if (summary.types.length === 0) return "通用";
  return summary.types.slice().sort((a, b) => b.count - a.count)[0].label;
}

export interface GalleryCard {
  id: string;
  name: string;
  description: string;
  aspect: string; // 恒 "16:9"
  cards: CardSequenceSummary;
  media: MediaRequirementSummary;
  tiles: SequenceTile[];
  use: string; // primaryUse（筛选维度）
}

export function galleryCardFromDetail(detail: TemplateDetail): GalleryCard {
  return {
    id: detail.id,
    name: detail.name || detail.id,
    description: detail.description ?? "",
    aspect: TEMPLATE_ASPECT,
    cards: summarizeCardSequence(detail.cardRules),
    media: summarizeMediaRequirements(detail.cardRules),
    tiles: sequenceTiles(detail.cardRules),
    use: primaryUse(detail.cardRules),
  };
}

// 筛选：媒体需求(all/with/without) + 用途(all 或某 primaryUse)。
export type MediaFilter = "all" | "with-media" | "no-media";
export function filterGalleryCards(cards: GalleryCard[], opts: { media?: MediaFilter; use?: string | null }): GalleryCard[] {
  const media = opts.media ?? "all";
  const use = opts.use ?? null;
  return cards.filter((c) => {
    if (media === "with-media" && c.media.count === 0) return false;
    if (media === "no-media" && c.media.count > 0) return false;
    if (use && c.use !== use) return false;
    return true;
  });
}

// gallery 内出现的所有主用途（去重、保留首现序）—— 用途筛选 chip 来源。
export function distinctUses(cards: GalleryCard[]): string[] {
  const seen: string[] = [];
  for (const c of cards) if (!seen.includes(c.use)) seen.push(c.use);
  return seen;
}
