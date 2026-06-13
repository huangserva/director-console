// v2 字幕识别: a captions panel (modal). Re-run ASR (recaption) on the project's
// source media, and list/edit the subtitle cues (text + time). Cues are fetched
// from the composer captions.json via the static preview route.
import { useEffect, useState } from "react";
import { getCaptions } from "../lib/api";
import { parseCaptions, updateCue, type Cue } from "../lib/captions";

function fmt(t: number): string {
  if (!Number.isFinite(t)) return "0.00";
  return t.toFixed(2);
}

export function CaptionsModal(props: {
  open: boolean;
  projectName: string;
  subtitleSrc: string | null;
  recaptioning: boolean;
  savingCues: boolean;
  /** Bumped by the parent after a successful recaption to force a refetch. */
  reloadKey: number;
  onRecaption: () => void;
  onSaveCues: (cues: Cue[]) => void;
  onClose: () => void;
}) {
  const { open, projectName, subtitleSrc, recaptioning, savingCues, reloadKey, onRecaption, onSaveCues, onClose } = props;
  const [cues, setCues] = useState<Cue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open || !subtitleSrc) {
      setCues([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDirty(false);
    getCaptions(subtitleSrc)
      .then((raw) => !cancelled && setCues(parseCaptions(raw)))
      .catch((e) => !cancelled && setError(`无法读取字幕文件：${String(e)}`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, subtitleSrc, reloadKey]);

  if (!open) return null;

  const editText = (id: string, text: string) => {
    setCues((prev) => updateCue(prev, id, { text }));
    setDirty(true);
  };

  return (
    <div className="pc-modal-overlay" onClick={onClose}>
      <div className="pc-modal pc-captions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pc-modal-head">
          <span>字幕识别 · {projectName || "—"}</span>
          <button className="pc-modal-close" onClick={onClose} title="关闭">
            ×
          </button>
        </div>

        <div className="pc-plan-actions" style={{ padding: "10px 16px 4px" }}>
          <button className="primary" onClick={onRecaption} disabled={recaptioning || !projectName}>
            {recaptioning ? "识别中…" : "重新识别字幕"}
          </button>
          <button onClick={() => onSaveCues(cues)} disabled={savingCues || !dirty || cues.length === 0}>
            {savingCues ? "保存中…" : "保存字幕"}
          </button>
          <span className="muted" style={{ alignSelf: "center", fontSize: 12 }}>{cues.length} 条字幕</span>
        </div>
        {recaptioning && (
          <div className="import-progress" style={{ margin: "0 16px 8px" }}>
            <span className="spinner" /> 重新识别字幕（ASR，~30s）— 请稍候，别重复点。
          </div>
        )}
        {error && <div className="banner warn pc-fp-error">{error}</div>}
        {!subtitleSrc && !error && <div className="pc-note muted" style={{ padding: "4px 16px" }}>该项目暂无字幕轨——先「重新识别字幕」生成。</div>}

        <div className="pc-cue-list">
          {loading && <div className="pc-note muted">加载字幕中…</div>}
          {cues.map((c) => (
            <div className="pc-cue" key={c.id}>
              <span className="pc-cue-time">
                {fmt(c.start)}–{fmt(c.end)}s
              </span>
              <input className="pc-cue-text" value={c.text} onChange={(e) => editText(c.id, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="pc-note muted" style={{ padding: "6px 16px" }}>
          重新识别用源视频跑 ASR 覆盖字幕；逐句文本编辑保存进方案的字幕轨（送合成需后端支持字幕轨逐条，详见交付说明）。
        </div>
      </div>
    </div>
  );
}
