// 证据快剪卡 ProofMontage —— 专属表单 + sample preset + 真 GSAP 入场。
// composer 里 ProofMontage 走 config 驱动的 rich-animation（richAnimationAttrs，作用于 .proof-grid）；这里给一份忠实的
// 默认入场：proof-grid 显出 + proof-card 逐格 stagger + proof-label 跟进，复用 composer 的 .proof-grid/.proof-card/
// .proof-label 类名。Guarded by composer-guards.test.ts（钉住这些 class 名）。
import { gsap } from "gsap";
import { defaultPropsFor, MEDIA_PLACEHOLDER } from "../scene-templates";
import type { ComponentDef } from "./types";

function buildProofMontageTimeline(id: string): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  tl.from(`#${id} .proof-grid`, { opacity: 0, duration: 0.001 }, 0);
  tl.fromTo(`#${id} .proof-card`, { opacity: 0, y: 24, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, stagger: 0.14, duration: 0.34, ease: "power3.out" }, 0.2);
  tl.from(`#${id} .proof-label`, { opacity: 0, y: 8, stagger: 0.14, duration: 0.22, ease: "power2.out" }, 0.5);
  return tl;
}

export const proofMontageDef: ComponentDef = {
  component: "ProofMontage",
  formSchema: [
    {
      title: "证据快剪卡",
      fields: [
        {
          kind: "list",
          path: "media.items",
          label: "证据条目",
          hint: "逐格证据的文字标签（数字 / 引用 / 评价），可增删；每格的视频在「媒体绑定」区绑",
          itemKey: "label",
          addLabel: "+ 添加证据",
          newItem: "新证据",
          newItemObj: { src: MEDIA_PLACEHOLDER, label: "新证据", start: 0, duration: 3 },
        },
      ],
    },
  ],
  samplePreset: () => defaultPropsFor("ProofMontage"),
  buildTimeline: buildProofMontageTimeline,
};
