// 主讲人特写卡 HeroAroll —— 专属表单 + sample preset + 真 GSAP 入场。
// composer 里 HeroAroll 走 config 驱动的 rich-animation（fade-up 等，作用于 .clean-aroll-hero-copy）；sample 带
// animation.in="fade-up" 让 renderHeroAroll 渲染文案块（rich 才出 copy）。这里 port 该 fade-up 入场（copy 上浮淡入 +
// 标题 blur-in），复用 composer 的 .clean-aroll-hero-copy/.clean-title 类名。Guarded by composer-guards.test.ts。
import { gsap } from "gsap";
import { defaultPropsFor } from "../scene-templates";
import type { ComponentDef } from "./types";

function buildHeroArollTimeline(id: string): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  tl.fromTo(`#${id} .clean-aroll-hero-copy`, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.42, ease: "power3.out" }, 0.4);
  tl.from(`#${id} .clean-title`, { opacity: 0, y: 18, filter: "blur(6px)", duration: 0.34, ease: "power3.out" }, 0.62);
  return tl;
}

export const heroArollDef: ComponentDef = {
  component: "HeroAroll",
  formSchema: [
    {
      title: "主讲人特写卡",
      fields: [
        { kind: "text", path: "chip", label: "标签", hint: "强调小标签（如 重点）" },
        { kind: "text", path: "title", label: "主标题", hint: "特写时的强调文案" },
        { kind: "text", path: "subline", label: "说明", hint: "补充说明" },
      ],
    },
  ],
  samplePreset: () => defaultPropsFor("HeroAroll"),
  buildTimeline: buildHeroArollTimeline,
};
