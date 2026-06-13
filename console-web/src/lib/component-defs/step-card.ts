// 步骤卡 StepCard —— 专属表单 + sample preset + 真 GSAP 入场。
// 动效逐字 port 自 composer timelines.mjs 的 StepCard 分支（.step-panel/.step-kicker/.step-title/.step-item
// 逐条 stagger 出现）。scene.start=0 独立轴，offset 即 scene.start+x 的 x。
import { gsap } from "gsap";
import { defaultPropsFor } from "../scene-templates";
import type { ComponentDef } from "./types";

function buildStepCardTimeline(id: string): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  tl.from(`#${id} .step-panel`, { opacity: 0, y: 34, scale: 0.96, duration: 0.42, ease: "power3.out" }, 0);
  tl.from(`#${id} .step-kicker`, { opacity: 0, x: -18, duration: 0.18, ease: "power2.out" }, 0.27);
  tl.from(`#${id} .step-title`, { opacity: 0, y: 24, duration: 0.3, ease: "power2.out" }, 0.45);
  tl.from(`#${id} .step-item`, { opacity: 0, y: 18, stagger: 0.09, duration: 0.22, ease: "power2.out" }, 0.89);
  return tl;
}

export const stepCardDef: ComponentDef = {
  component: "StepCard",
  formSchema: [
    {
      title: "步骤卡",
      fields: [
        { kind: "text", path: "kicker", label: "眉标", hint: "步骤序号 / 分组（如 步骤 / STEP 01）" },
        { kind: "text", path: "title", label: "步骤标题", hint: "这一组步骤的标题" },
        { kind: "list", path: "items", label: "步骤要点", hint: "逐条出现的要点，可增删", addLabel: "+ 添加要点", newItem: "新要点" },
      ],
    },
  ],
  samplePreset: () => defaultPropsFor("StepCard"),
  buildTimeline: buildStepCardTimeline,
};
