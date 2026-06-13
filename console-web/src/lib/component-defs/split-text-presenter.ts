// 图文讲解卡 SplitTextPresenter（course 变体）—— 专属表单 + sample preset + 真 GSAP 入场。
// 动效逐字 port 自 composer timelines.mjs 的 SplitTextPresenter(variant==="course") 分支（scene.start=0 独立轴）。
// Guarded by composer-guards.test.ts。
import { gsap } from "gsap";
import { defaultPropsFor } from "../scene-templates";
import type { ComponentDef } from "./types";

function buildSplitTextPresenterTimeline(id: string): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  tl.from(`#${id}`, { opacity: 0, duration: 0.001 }, 0);
  tl.from(`#${id} .course-chip`, { opacity: 0, x: -18, duration: 0.18, ease: "power2.out" }, 0.1);
  tl.from(`#${id} .course-heading`, { opacity: 0, y: 26, filter: "blur(6px)", duration: 0.34, ease: "power3.out" }, 0.2);
  tl.fromTo(`#${id} .course-card`, { opacity: 0, x: -34, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, x: 0, clipPath: "inset(0 0% 0 0)", stagger: 0.18, duration: 0.34, ease: "power3.out" }, 0.4);
  tl.from(`#${id} .card-icon`, { opacity: 0, scale: 0.72, stagger: 0.18, duration: 0.18, ease: "back.out(1.7)" }, 0.6);
  tl.from(`#${id} .course-big`, { opacity: 0, y: 14, stagger: 0.08, duration: 0.2, ease: "power2.out" }, 0.8);
  tl.from(`#${id} .course-line`, { scaleX: 0, duration: 3.7, ease: "none" }, 0.96);
  tl.fromTo(`#${id} .course-presenter`, { opacity: 0, x: 300, clipPath: "inset(0 0 0 100%)" }, { opacity: 1, x: 0, clipPath: "inset(0 0 0 0%)", duration: 0.46, ease: "power3.out" }, 1.36);
  return tl;
}

export const splitTextPresenterDef: ComponentDef = {
  component: "SplitTextPresenter",
  formSchema: [
    {
      title: "图文讲解卡",
      fields: [
        { kind: "text", path: "chip", label: "标签", hint: "左上角小标签（如 概念）" },
        { kind: "text", path: "kicker", label: "眉标", hint: "主标题前缀小字" },
        { kind: "text", path: "title", label: "主标题", hint: "讲解主标题" },
        { kind: "list", path: "cards", label: "要点卡", hint: "左侧逐张揭示的要点卡，可增删（右侧主讲人窗口在媒体绑定区绑）", itemKey: "label", addLabel: "+ 添加要点", newItem: "新要点" },
      ],
    },
  ],
  samplePreset: () => defaultPropsFor("SplitTextPresenter"),
  buildTimeline: buildSplitTextPresenterTimeline,
};
