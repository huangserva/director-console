// Post-import success summary + next-step guidance. Replaces the silent load:
// shows what was imported and 4 clear next steps (字幕识别 / 去拖包装卡片 / 预览 / 渲染).
import { summaryLine, type ImportSummary as Summary } from "../lib/guidance";

export function ImportSummary(props: {
  summary: Summary;
  onCaptions: () => void;
  onPackage: () => void;
  onPreview: () => void;
  onRender: () => void;
  onClose: () => void;
}) {
  const { summary, onCaptions, onPackage, onPreview, onRender, onClose } = props;
  return (
    <div className="pc-import-summary">
      <div className="pc-import-summary-head">
        <span className="pc-import-summary-line">✓ {summaryLine(summary)}</span>
        <button className="pc-import-summary-close" onClick={onClose} title="关闭">
          ×
        </button>
      </div>
      <div className="pc-import-summary-actions">
        <span className="muted">下一步：</span>
        <button onClick={onCaptions}>字幕识别</button>
        <button className="primary" onClick={onPackage}>去拖包装卡片</button>
        <button onClick={onPreview}>预览</button>
        <button onClick={onRender}>渲染</button>
      </div>
    </div>
  );
}
