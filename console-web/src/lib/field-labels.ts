// R5-S1/M3: display labels for card-schema prop keys (and scene roles), so the
// Inspector / scene list show Chinese business-semantic labels instead of raw
// keys (cornerLeft / title_card). Raw key stays available as tooltip/data-field.
import { componentName } from "./i18n";

export interface FieldLabel {
  label: string;
  hint?: string;
}

// prop key (last dotted segment) → 中文展示标签 + 业务说明
export const FIELD_LABELS: Record<string, FieldLabel> = {
  cornerLeft: { label: "左上角短标", hint: "画面左上角的小角标文字" },
  cornerName: { label: "角标名称", hint: "角标右侧的场景/编号名称" },
  kicker: { label: "眉标", hint: "主标题上方的一行小标题短语" },
  title: { label: "主标题", hint: "卡片主标题" },
  subline: { label: "副标题", hint: "主标题下方的一行说明" },
  items: { label: "要点", hint: "分点列出的要点" },
  label: { label: "标签文字", hint: "数据/角标的标签" },
  number: { label: "数字", hint: "突出展示的数值" },
  unit: { label: "单位", hint: "数值的单位" },
  variant: { label: "版式变体", hint: "该组件的排版变体" },
  chip: { label: "角标", hint: "小圆角标签文字" },
  text: { label: "文字", hint: "正文文字" },
  caption: { label: "字幕", hint: "字幕文字" },
};

// scene_type/component → 语义角色名（场景列表主标题用）
const SCENE_ROLE: Record<string, string> = {
  StatsHero: "开场数据",
  TitleCard: "开场标题",
  SplitTextPresenter: "图文讲解",
  ScreenWithPip: "演示标注",
  HeroAroll: "主讲特写",
  StepCard: "步骤说明",
  ProofMontage: "证据快剪",
  SummaryCta: "收尾引导",
};

const lastKey = (path: string): { key: string; index: number | null } => {
  const segs = path.split(".");
  let index: number | null = null;
  let key = segs[segs.length - 1];
  if (/^\d+$/.test(key)) {
    index = Number(key);
    key = segs[segs.length - 2] ?? key;
  }
  return { key, index };
};

/** 中文展示标签（如 "left.0" 的数组项追加序号）。未知键回退原 key。 */
export function fieldLabel(path: string): string {
  const { key, index } = lastKey(path);
  const base = FIELD_LABELS[key]?.label ?? key;
  return index === null ? base : `${base} ${index + 1}`;
}

/** 业务说明（tooltip 用，可空）。 */
export function fieldHint(path: string): string | undefined {
  return FIELD_LABELS[lastKey(path).key]?.hint;
}

/** 场景列表主标题：语义角色名（回退 catalog 中文名）。 */
export function sceneRoleLabel(component: string | undefined): string {
  if (!component) return "场景";
  return SCENE_ROLE[component] ?? componentName(component, component);
}
