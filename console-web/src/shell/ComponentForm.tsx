// 数据驱动的组件专属表单：读 ComponentDef.formSchema（分组 + 中文 label/说明），渲染文本字段与字符串数组字段
// （可增删）。文本写裸 prop 路径（onText/onFieldChange，点路径），列表整组替换（onList，setAtPath）。
// 替代过去硬编码在 App 里的 statsHeroForm —— 任何注册了 formSchema 的组件都走这一套。
import { Fragment } from "react";
import type { FormFieldList, FormSection } from "../lib/component-defs";

function readPath(props: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), props);
}
const str = (v: unknown) => (v == null ? "" : String(v));

function ListField({ field, raw, onList }: { field: FormFieldList; raw: unknown[]; onList: (path: string, items: unknown[]) => void }) {
  const key = field.itemKey;
  // 显示值：对象数组取 item[itemKey]，字符串数组取自身。
  const display = raw.map((it) => (key ? String((it as Record<string, unknown> | null)?.[key] ?? "") : String(it ?? "")));
  const setAt = (i: number, v: string) =>
    onList(field.path, raw.map((it, j) => (j !== i ? it : key ? { ...(it && typeof it === "object" ? it : {}), [key]: v } : v)));
  const removeAt = (i: number) => onList(field.path, raw.filter((_, j) => j !== i));
  const add = () => onList(field.path, [...raw, key ? (field.newItemObj ?? { [key]: field.newItem ?? "新项" }) : (field.newItem ?? "新项")]);
  return (
    <div className="prop-field pc-icons-field">
      <span className="prop-path" title={field.hint}>
        {field.label}
        <span className="pc-field-hint muted">{field.hint}</span>
      </span>
      <div className="pc-icons-list">
        {display.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 按位置编辑，索引即身份。
          <div className="pc-icon-row" key={i}>
            <input type="text" value={item} onChange={(e) => setAt(i, e.target.value)} />
            <button type="button" className="clear-btn" title="删除该项" onClick={() => removeAt(i)}>
              删除
            </button>
          </div>
        ))}
        <button type="button" className="pc-btn ghost pc-icon-add" onClick={add}>
          {field.addLabel ?? "+ 添加"}
        </button>
      </div>
    </div>
  );
}

export function ComponentForm({
  schema,
  props,
  onText,
  onList,
}: {
  schema: FormSection[];
  props: Record<string, unknown>;
  onText: (path: string, value: string) => void;
  onList: (path: string, items: unknown[]) => void;
}) {
  return (
    <div className="props pc-comp-form">
      {schema.map((section) => (
        <Fragment key={section.title}>
          <div className="panel-title">{section.title}</div>
          {section.fields.map((field) =>
            field.kind === "text" ? (
              <label className="prop-field" key={field.path}>
                <span className="prop-path" title={field.hint}>
                  {field.label}
                  <span className="pc-field-hint muted">{field.hint}</span>
                </span>
                <input
                  type={field.inputType === "number" ? "number" : "text"}
                  step={field.inputType === "number" ? "any" : undefined}
                  value={str(readPath(props, field.path))}
                  onChange={(e) => onText(field.path, e.target.value)}
                />
              </label>
            ) : (
              <ListField
                key={field.path}
                field={field}
                raw={Array.isArray(readPath(props, field.path)) ? (readPath(props, field.path) as unknown[]) : []}
                onList={onList}
              />
            ),
          )}
        </Fragment>
      ))}
    </div>
  );
}
