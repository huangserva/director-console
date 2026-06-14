import { describe, expect, it } from "vitest";
import {
  distinctUses,
  filterGalleryCards,
  galleryCardFromDetail,
  type GalleryCard,
  mediaKindLabel,
  primaryUse,
  sequenceTiles,
  summarizeCardSequence,
  summarizeMediaRequirements,
  TEMPLATE_ASPECT,
  type TemplateDetail,
} from "./template-gallery";

const detail = (over: Partial<TemplateDetail>): TemplateDetail => ({
  id: "t-1",
  name: "模板一",
  description: "用途说明",
  cardRules: [],
  ...over,
});

const rules = [
  { cardType: "opening", mediaRequirements: [] },
  { cardType: "caption", mediaRequirements: [{ slot: "screen", kind: "screen-video", required: true }] },
  { cardType: "caption", mediaRequirements: [{ slot: "pip", kind: "presenter-video", required: false }] },
];

describe("summarizeCardSequence — 卡片序列摘要（几类几张）", () => {
  it("counts total + groups by 中文 cardType label (first-seen order)", () => {
    const s = summarizeCardSequence(rules);
    expect(s.total).toBe(3);
    expect(s.types).toEqual([
      { label: "开场", count: 1 },
      { label: "字幕", count: 2 },
    ]);
  });
  it("empty → zeros", () => {
    expect(summarizeCardSequence([])).toEqual({ total: 0, types: [] });
    expect(summarizeCardSequence(undefined)).toEqual({ total: 0, types: [] });
  });
});

describe("summarizeMediaRequirements — 媒体需求摘要（N 处 + 类型）", () => {
  it("flattens across cardRules, counts total/required, groups by kind 中文", () => {
    const m = summarizeMediaRequirements(rules);
    expect(m.count).toBe(2);
    expect(m.required).toBe(1); // 一处 required:true，一处 required:false
    expect(m.kinds).toEqual([
      { label: "屏幕录制", count: 1 },
      { label: "数字人/人像视频", count: 1 },
    ]);
  });
  it("no media → zeros", () => {
    expect(summarizeMediaRequirements([{ cardType: "opening", mediaRequirements: [] }])).toEqual({ count: 0, required: 0, kinds: [] });
  });
});

describe("mediaKindLabel — kind → 中文（复用 v2 媒体词汇）", () => {
  it("maps known kinds, passes unknown through", () => {
    expect(mediaKindLabel("presenter-video")).toBe("数字人/人像视频");
    expect(mediaKindLabel("screen-video")).toBe("屏幕录制");
    expect(mediaKindLabel("audio")).toBe("音频");
    expect(mediaKindLabel("media")).toBe("视频/图片");
    expect(mediaKindLabel("weird")).toBe("weird");
  });
});

describe("primaryUse — 主用途 = 最频卡类（数据派生，不编造）", () => {
  it("returns most frequent cardType label", () => {
    expect(primaryUse(rules)).toBe("字幕"); // caption ×2 胜 opening ×1
  });
  it("empty → 通用", () => {
    expect(primaryUse([])).toBe("通用");
  });
});

describe("sequenceTiles — 代表性预览 tile（cardType + 中文 label）", () => {
  it("maps each card to a tile", () => {
    expect(sequenceTiles(rules)).toEqual([
      { cardType: "opening", label: "开场" },
      { cardType: "caption", label: "字幕" },
      { cardType: "caption", label: "字幕" },
    ]);
  });
});

describe("galleryCardFromDetail — 派生 gallery 卡数据", () => {
  it("assembles name/desc/aspect/cards/media/tiles/use", () => {
    const c = galleryCardFromDetail(detail({ cardRules: rules }));
    expect(c.id).toBe("t-1");
    expect(c.name).toBe("模板一");
    expect(c.aspect).toBe(TEMPLATE_ASPECT);
    expect(c.aspect).toBe("16:9");
    expect(c.cards.total).toBe(3);
    expect(c.media.count).toBe(2);
    expect(c.tiles.length).toBe(3);
    expect(c.use).toBe("字幕");
  });
  it("falls back name to id, description to empty", () => {
    const c = galleryCardFromDetail({ id: "x", name: "", cardRules: [] });
    expect(c.name).toBe("x");
    expect(c.description).toBe("");
  });
});

describe("filterGalleryCards / distinctUses — 按媒体需求 / 用途 筛选", () => {
  const cards: GalleryCard[] = [
    galleryCardFromDetail(detail({ id: "a", cardRules: [{ cardType: "opening", mediaRequirements: [] }] })), // no media, use 开场
    galleryCardFromDetail(detail({ id: "b", cardRules: rules })), // with media, use 字幕
  ];
  it("media filter: with/without", () => {
    expect(filterGalleryCards(cards, { media: "with-media" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterGalleryCards(cards, { media: "no-media" }).map((c) => c.id)).toEqual(["a"]);
    expect(filterGalleryCards(cards, { media: "all" }).map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("use filter", () => {
    expect(filterGalleryCards(cards, { use: "字幕" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterGalleryCards(cards, { use: null }).map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("distinctUses preserves first-seen order, deduped", () => {
    expect(distinctUses(cards)).toEqual(["开场", "字幕"]);
  });
});
