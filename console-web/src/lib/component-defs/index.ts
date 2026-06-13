// 组件定义注册表（单一入口）。CardVisual 查 buildTimeline、App 查 formSchema、scene-templates 间接经各 def
// 的 samplePreset 委托。没命中 → 回退通用裸字段表单 + 静态基态（兜底，无需在此登记）。
//
// 加一个新组件：① 新建 ./<comp>.ts 导出 ComponentDef（formSchema + samplePreset + 可选 buildTimeline）；
//               ② 在下面 DEFS 注册一行；③ 若该组件还没有默认 props，在 scene-templates 的 DEFAULT_PROPS 补一份。
import { heroArollDef } from "./hero-aroll";
import { proofMontageDef } from "./proof-montage";
import { splitTextPresenterDef } from "./split-text-presenter";
import { statsHeroDef } from "./stats-hero";
import { stepCardDef } from "./step-card";
import { summaryCtaDef } from "./summary-cta";
import { titleCardDef } from "./title-card";
import type { ComponentDef } from "./types";

const DEFS: Record<string, ComponentDef> = {
  [statsHeroDef.component]: statsHeroDef,
  [titleCardDef.component]: titleCardDef,
  [stepCardDef.component]: stepCardDef,
  [summaryCtaDef.component]: summaryCtaDef,
  [splitTextPresenterDef.component]: splitTextPresenterDef,
  [proofMontageDef.component]: proofMontageDef,
  [heroArollDef.component]: heroArollDef,
};

/** 该 composer 组件的专属定义；未注册返回 undefined（调用方回退通用表单/静态预览）。 */
export function getComponentDef(component?: string | null): ComponentDef | undefined {
  return component ? DEFS[component] : undefined;
}

/** 已注册（做透）的组件名列表 —— 报告/测试用。 */
export function registeredComponents(): string[] {
  return Object.keys(DEFS);
}

export type { ComponentDef, FormField, FormFieldList, FormFieldText, FormSection, SeekableTimeline } from "./types";
