// 收尾 CTA 卡 SummaryCta —— 专属表单 + sample preset + 真 GSAP 入场。
// 动效逐字 port 自 composer timelines.mjs 的 SummaryCta 分支（scene.start=0 独立轴，offset 即 scene.start+x 的 x）。
// Guarded by composer-guards.test.ts。
import { gsap } from "gsap";
import { defaultPropsFor } from "../scene-templates";
import type { ComponentDef } from "./types";

function buildSummaryCtaTimeline(id: string): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  tl.from(`#${id} .clean-aroll-copy`, { opacity: 0, x: -26, duration: 0.42, ease: "power3.out" }, 0.78);
  tl.from(`#${id} .clean-title`, { opacity: 0, y: 18, filter: "blur(6px)", duration: 0.34, ease: "power3.out" }, 1.02);
  return tl;
}

export const summaryCtaDef: ComponentDef = {
  component: "SummaryCta",
  formSchema: [
    {
      title: "收尾 CTA 卡",
      fields: [
        { kind: "text", path: "chip", label: "标签", hint: "行动召唤的小标签（如 马上开始）" },
        { kind: "text", path: "title", label: "主标题", hint: "收尾大标题 / 行动号召" },
        { kind: "text", path: "subline", label: "说明", hint: "主标题下方的引导说明" },
      ],
    },
  ],
  samplePreset: () => defaultPropsFor("SummaryCta"),
  buildTimeline: buildSummaryCtaTimeline,
};
