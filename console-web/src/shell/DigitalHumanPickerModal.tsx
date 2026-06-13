// 画中画卡 media.pip = 选数字人：从 GET /api/assets/digital-humans 拉数字人库，列名称 + 时长（+ 试看视频），
// 点一个 → 把它的绝对路径写进 card.props.media.pip（digitalHumanMediaPath）。纯展示，所有写入由父组件回调。
import { useEffect, useState } from "react";
import { type DigitalHuman, listDigitalHumans } from "../lib/api";

function fmtDuration(sec?: number): string {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

export function DigitalHumanPickerModal(props: {
  open: boolean;
  /** 当前已选数字人的 manifest 路径值（用于高亮），可空。 */
  selectedPath?: string | null;
  onPick: (dh: DigitalHuman) => void;
  onClose: () => void;
}) {
  const { open, selectedPath, onPick, onClose } = props;
  const [items, setItems] = useState<DigitalHuman[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    listDigitalHumans()
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch((e) => {
        if (alive) setError(String(e instanceof Error ? e.message : e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="pc-modal-overlay" onClick={onClose}>
      <div className="pc-modal pc-dh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pc-modal-head">
          <span>选择数字人 · 右下角圆形口播小窗</span>
          <button className="pc-modal-close" onClick={onClose} title="关闭">
            ×
          </button>
        </div>
        {loading && <div className="pc-note muted" style={{ padding: "12px 16px" }}>正在加载数字人库…</div>}
        {error && !loading && (
          <div className="pc-note muted" style={{ padding: "12px 16px" }}>
            数字人库加载失败：{error}。请确认本地服务已提供 数字人库 接口。
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="pc-note muted" style={{ padding: "12px 16px" }}>数字人库为空。请先在本地准备数字人素材。</div>
        )}
        {!loading && items.length > 0 && (
          <div className="pc-dh-grid">
            {items.map((dh) => {
              const isSel = !!selectedPath && (dh.path === selectedPath || (dh.url ?? "").includes(encodeURIComponent(selectedPath)));
              const dur = fmtDuration(dh.duration);
              return (
                <button
                  type="button"
                  key={dh.name + (dh.path ?? dh.url ?? "")}
                  className={isSel ? "pc-dh-card selected" : "pc-dh-card"}
                  onClick={() => onPick(dh)}
                  aria-pressed={isSel}
                  title={dh.path ?? dh.url ?? dh.name}
                >
                  <div className="pc-dh-thumb">
                    {dh.url ? (
                      // 试看：静音、不自动播，hover/点选用；不绑定播放头。
                      <video src={dh.url} muted playsInline preload="metadata" />
                    ) : (
                      <div className="pc-dh-thumb-fallback">数字人</div>
                    )}
                    {isSel && <span className="pc-dh-check">✓ 已选</span>}
                  </div>
                  <div className="pc-dh-meta">
                    <span className="media-slot-file pc-dh-name">{dh.name}</span>
                    {dur && <span className="pc-dh-dur muted">{dur}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="pc-note muted" style={{ padding: "0 16px 14px" }}>
          选中后会把该数字人写入这张画中画卡的口播小窗，保存进方案即生效。
        </div>
      </div>
    </div>
  );
}
