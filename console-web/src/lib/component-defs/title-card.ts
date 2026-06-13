// 标题卡 TitleCard —— 专属表单 + sample preset + 真 GSAP 入场。
// 动效 port 自 composer 的 title-scene 入场词汇（renderTitleCard 产出 .title-block/.main-title/.title-kicker/
// .title-sub/.underline-stack i；同 timelines.mjs StatsHero title 子场景那套 reveal）。scene.start=0 独立轴。
import { gsap } from "gsap";
import { defaultPropsFor } from "../scene-templates";
import type { ComponentDef } from "./types";

function buildTitleCardTimeline(id: string): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  tl.from(`#${id} .title-block`, { opacity: 0, duration: 0.001 }, 0);
  tl.from(`#${id} .title-block`, { clipPath: "inset(0 100% 0 0)", duration: 0.34, ease: "power2.inOut" }, 0);
  tl.from(`#${id} .main-title`, { opacity: 0, x: -20, filter: "blur(6px)", duration: 0.42, ease: "power3.out" }, 0.12);
  tl.from(`#${id} .title-kicker`, { opacity: 0, y: 10, duration: 0.24, ease: "power2.out" }, 0.3);
  tl.from(`#${id} .title-sub`, { opacity: 0, y: 10, duration: 0.24, ease: "power2.out" }, 0.55);
  tl.from(`#${id} .underline-stack i`, { scaleX: 0, transformOrigin: "left center", stagger: 0.1, duration: 0.3, ease: "none" }, 0.72);
  return tl;
}

export const titleCardDef: ComponentDef = {
  component: "TitleCard",
  formSchema: [
    {
      title: "标题卡",
      fields: [
        { kind: "text", path: "cornerLeft", label: "左角标", hint: "左上角的小角标文字" },
        { kind: "text", path: "cornerName", label: "右角名", hint: "右上角的署名 / 标识" },
        { kind: "text", path: "kicker", label: "眉标", hint: "主标题上方的小字（如 开场）" },
        { kind: "text", path: "title", label: "主标题", hint: "卡片正中的大标题" },
        { kind: "text", path: "subline", label: "副标题", hint: "主标题下方的一句说明" },
      ],
    },
  ],
  samplePreset: () => defaultPropsFor("TitleCard"),
  buildTimeline: buildTitleCardTimeline,
};
