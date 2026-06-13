// v2 风格包: named style themes (pure frontend presets). R5-M5: card body = select
// (one highlighted), a single sticky bottom primary 「套用选中主题」; per-card CTA
// removed so 4 gold buttons no longer fight for focus.
import { useEffect, useState } from "react";
import { weightLabel } from "../lib/i18n";
import { THEMES, type Theme } from "../lib/themes";

export function StylePackModal(props: {
  open: boolean;
  applying: boolean;
  hasManifest: boolean;
  onApply: (theme: Theme) => void;
  onClose: () => void;
}) {
  const { open, applying, hasManifest, onApply, onClose } = props;
  const [selectedId, setSelectedId] = useState<string>(THEMES[0]?.id ?? "");

  useEffect(() => {
    if (open) setSelectedId(THEMES[0]?.id ?? "");
  }, [open]);

  if (!open) return null;
  const selected = THEMES.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="pc-modal-overlay" onClick={onClose}>
      <div className="pc-modal pc-style-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pc-modal-head">
          <span>风格包 · 命名主题</span>
          <button className="pc-modal-close" onClick={onClose} title="关闭">
            ×
          </button>
        </div>
        {!hasManifest && <div className="pc-note muted" style={{ padding: "8px 16px" }}>先加载一个项目，才能套用风格包。</div>}
        <div className="pc-theme-grid">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.id}
              className={t.id === selectedId ? "pc-theme-card selected" : "pc-theme-card"}
              style={{ background: t.bg, borderColor: t.id === selectedId ? t.accent : "transparent" }}
              onClick={() => setSelectedId(t.id)}
              aria-pressed={t.id === selectedId}
            >
              <div className="pc-theme-name" style={{ color: t.text }}>
                {t.name}
                {t.id === selectedId && <span className="pc-theme-check" style={{ color: t.accent }}>✓ 已选</span>}
              </div>
              <div className="pc-theme-sample" style={{ color: t.text }}>
                <span style={{ color: t.accent, fontWeight: 700, fontSize: 15 }}>标题示例</span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>正文示例文本</span>
              </div>
              <div className="pc-theme-swatches">
                <span style={{ background: t.accent }} title={`强调色 ${t.accent}`} />
                <span style={{ background: t.bg, border: "1px solid #3a3a3a" }} title={`背景色 ${t.bg}`} />
                <span style={{ background: t.text }} title={`文字色 ${t.text}`} />
                <span className="pc-theme-font" style={{ color: t.text }}>
                  {t.titleSize}/{t.bodySize} · {weightLabel(t.weight)}
                </span>
              </div>
            </button>
          ))}
        </div>
        <div className="pc-modal-foot pc-style-foot">
          <span className="muted">{selected ? `已选：${selected.name}` : "请选择一套主题"}</span>
          <button
            className="primary"
            disabled={applying || !hasManifest || !selected}
            onClick={() => selected && onApply(selected)}
          >
            {applying ? "套用中…" : "套用选中主题到全部卡片"}
          </button>
        </div>
        <div className="pc-note muted" style={{ padding: "0 16px 12px" }}>
          套用会给所有卡片写入该主题的颜色/字体，保存进方案并重新合成，统一换风格（颜色/字体已接入真渲染）。
        </div>
      </div>
    </div>
  );
}
