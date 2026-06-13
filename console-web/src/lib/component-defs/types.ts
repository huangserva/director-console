// 可扩展的「组件定义注册表」类型。每个 composer 组件一个模块，导出一份 ComponentDef：
//   ① formSchema   —— 专属 Inspector 表单（分组 + 中文 label/说明，按 registry.mjs 该组件真实 props 结构）
//   ② samplePreset —— 有意义的默认 props（插入即成形，委托 scene-templates 的 DEFAULT_PROPS 单一真相）
//   ③ buildTimeline—— 可选，从 composer timelines.mjs 对应 tween port 的 paused gsap 时间线（本卡 start=0 独立轴，由 currentTime seek 驱动）
// CardVisual / App / scene-templates 查注册表，不再硬编码 if StatsHero。注册表没命中 → 回退通用裸字段表单 + 静态基态。
//
// 加一个新组件 = 新建 ./<comp>.ts（这三样）+ 在 ./index.ts 注册一行（+ scene-templates 补 sample preset）。
/** 最小化的「可 seek 时间线」接口（gsap.core.Timeline 结构上满足）。类型层不引入 gsap，保持数据层轻。 */
export interface SeekableTimeline {
  seek(time: number): unknown;
}

/** 文本输入字段（写裸 prop 路径，如 stat.label / titleBeat.kicker / kicker）。 */
export interface FormFieldText {
  kind: "text";
  /** 点路径到 props，如 "stat.number"、"titleBeat.title"、"kicker"。 */
  path: string;
  label: string;
  hint: string;
  /** "number" 渲染数字输入；默认文本。 */
  inputType?: "number";
}

/** 字符串数组字段（逐条输入 + 增删，如 browser.icons / items）。 */
export interface FormFieldList {
  kind: "list";
  path: string;
  label: string;
  hint: string;
  /** 「添加」按钮文案。 */
  addLabel?: string;
  /** 新增条目的默认值。 */
  newItem?: string;
}

export type FormField = FormFieldText | FormFieldList;

export interface FormSection {
  title: string;
  fields: FormField[];
}

export interface ComponentDef {
  /** composer 组件名（card.engine.component）。 */
  component: string;
  /** 专属 Inspector 表单结构。 */
  formSchema: FormSection[];
  /** 有意义的默认 props（插入即成形）。 */
  samplePreset: () => Record<string, unknown>;
  /** 可选：真 GSAP 入场/强调动效（paused 时间线，currentTime seek 驱动）。无则预览取静态基态。 */
  buildTimeline?: (id: string) => SeekableTimeline;
}
