// v2-P3: editable right Inspector (属性 / 动画 / 校验 / 历史).
// 属性: reused props-era content editor (底子) + editable 布局/字体/颜色 that write
//        card.layout / card.font / card.color (P0 schema; generator transparently
//        carries them through props.layout / props.style.{font,color}).
// 校验: lint/inspect content + card.validation messages.
// 动画: basic motion-token in/out (P4 真渲染).
// 历史: placeholder.
import type { ReactNode } from "react";
import type { CatalogComponent } from "../lib/catalog";
import { resolveLayout } from "../lib/canvas-geometry";
import { colorLabel, componentName, componentPurpose, motionLabel, weightLabel } from "../lib/i18n";
import { cardTypeLabel, type PlanCard } from "../lib/packaging-plan";

export type InspectorTab = "props" | "animation" | "validation" | "history";

const MOTION_OPTIONS = ["none", "fade", "slide-up", "slide-down", "slide-left", "slide-right", "scale", "pop"];
const WEIGHTS = ["regular", "medium", "bold"];

function numOrEmpty(v: unknown): string {
  return v === undefined || v === null || v === "" ? "" : String(v);
}

export function Inspector(props: {
  tab: InspectorTab;
  onTab: (t: InspectorTab) => void;
  card: PlanCard | null;
  component: CatalogComponent | undefined;
  attributes: ReactNode;
  validation: ReactNode;
  editable?: boolean;
  onLayoutChange?: (patch: Record<string, unknown>) => void;
  onFontChange?: (patch: Record<string, unknown>) => void;
  onColorChange?: (patch: Record<string, unknown>) => void;
  onAnimationChange?: (patch: Record<string, unknown>) => void;
}) {
  const { tab, onTab, card, component, attributes, validation, editable } = props;
  const layout = resolveLayout(card?.layout);
  const font = (card?.font ?? {}) as Record<string, unknown>;
  const color = (card?.color ?? {}) as Record<string, unknown>;
  const animation = ((card?.engine?.props as any)?.animation ?? {}) as Record<string, unknown>;
  const messages = card?.validation?.failures ?? [];

  const numField = (label: string, value: unknown, onChange: (n: number) => void) => (
    <label className="pc-numfield">
      <span>{label}</span>
      <input
        type="number"
        value={numOrEmpty(value)}
        disabled={!editable || !card}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </label>
  );

  const TABS: { id: InspectorTab; label: string }[] = [
    { id: "props", label: "属性" },
    { id: "animation", label: "动画" },
    { id: "validation", label: "校验" },
    { id: "history", label: "历史" },
  ];

  return (
    <aside className="pc-inspector">
      <div className="pc-insptabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={t.id === tab ? "pc-insptab active" : "pc-insptab"} onClick={() => onTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="pc-inspbody">
        {tab === "props" && (
          <>
            {card && (
              <div className="pc-inspsect">
                <h4>组件信息</h4>
                <div className="pc-kv"><span className="pc-k">名称</span><span className="pc-vv">{componentName(component?.id ?? card.engine.component, card.engine.component)}</span></div>
                <div className="pc-kv"><span className="pc-k">类型</span><span className="pc-vv">{cardTypeLabel(card.type)}</span></div>
                <div className="pc-kv"><span className="pc-k">用途</span><span className="pc-vv">{componentPurpose(component?.id, card.engine.scene_type ?? "")}</span></div>
              </div>
            )}
            <div className="pc-inspsect pc-attrs">{attributes}</div>

            {card && (
            <>
            <div className="pc-inspsect">
              <h4>布局</h4>
              <div className="pc-grid2">
                {numField("X", layout.x, (n) => props.onLayoutChange?.({ x: n }))}
                {numField("Y", layout.y, (n) => props.onLayoutChange?.({ y: n }))}
                {numField("宽", layout.w, (n) => props.onLayoutChange?.({ w: n }))}
                {numField("高", layout.h, (n) => props.onLayoutChange?.({ h: n }))}
              </div>
              <label className="pc-checkfield">
                <input
                  type="checkbox"
                  checked={!!layout.safeAreaLock}
                  disabled={!editable || !card}
                  onChange={(e) => props.onLayoutChange?.({ safeAreaLock: e.target.checked })}
                />
                安全区锁定
              </label>
              <div className="pc-note muted">基准画布 1280×720；画布四角手柄拖拽同步这些值。</div>
            </div>

            <div className="pc-inspsect">
              <h4>字体</h4>
              <div className="pc-grid2">
                {numField("标题字号", font.titleSize, (n) => props.onFontChange?.({ titleSize: n }))}
                {numField("正文字号", font.bodySize, (n) => props.onFontChange?.({ bodySize: n }))}
              </div>
              <label className="pc-numfield">
                <span>字重</span>
                <select value={String(font.weight ?? "")} disabled={!editable || !card} onChange={(e) => props.onFontChange?.({ weight: e.target.value })}>
                  <option value="">—</option>
                  {WEIGHTS.map((w) => (
                    <option key={w} value={w}>{weightLabel(w)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="pc-inspsect">
              <h4>颜色</h4>
              {(["accent", "bg", "text"] as const).map((key) => (
                <label className="pc-colorfield" key={key}>
                  <span>{colorLabel(key)}</span>
                  <input
                    type="text"
                    placeholder="#rrggbb"
                    value={String(color[key] ?? "")}
                    disabled={!editable || !card}
                    onChange={(e) => props.onColorChange?.({ [key]: e.target.value })}
                  />
                  <span className="pc-swatch" style={{ background: String(color[key] ?? "transparent") }} />
                </label>
              ))}
            </div>
            </>
            )}
          </>
        )}

        {tab === "animation" && (
          <div className="pc-inspsect">
            <h4>动画</h4>
            <label className="pc-numfield">
              <span>进场</span>
              <select value={String(animation.in ?? "none")} disabled={!editable || !card} onChange={(e) => props.onAnimationChange?.({ in: e.target.value })}>
                {MOTION_OPTIONS.map((o) => (<option key={o} value={o}>{motionLabel(o)}</option>))}
              </select>
            </label>
            <label className="pc-numfield">
              <span>出场</span>
              <select value={String(animation.out ?? "none")} disabled={!editable || !card} onChange={(e) => props.onAnimationChange?.({ out: e.target.value })}>
                {MOTION_OPTIONS.map((o) => (<option key={o} value={o}>{motionLabel(o)}</option>))}
              </select>
            </label>
            <div className="pc-note muted">进场 / 出场 动效已接入真渲染（保存后会在合成预览中体现）。</div>
          </div>
        )}

        {tab === "validation" && (
          <div className="pc-inspsect pc-attrs">
            <h4>校验</h4>
            {messages.length > 0 && (
              <ul className="failures">
                {messages.map((m, i) => (<li key={i}>{m}</li>))}
              </ul>
            )}
            {validation ?? <div className="pc-note muted">运行「校验 / 检视」查看结果。</div>}
          </div>
        )}

        {tab === "history" && (
          <div className="pc-inspsect">
            <h4>历史</h4>
            <div className="pc-note muted">编辑历史 / 撤销在后续阶段接入。</div>
          </div>
        )}
      </div>
    </aside>
  );
}
