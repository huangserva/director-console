// v2-P3 + UI-fix #4: editable canvas. The selected card sits in a fixed 16:9
// design space (canvas-geometry BASE units); four gold corner handles resize it
// and dragging the body moves it. Toolbar toggles are REAL: 安全区 shows/hides the
// safe-area overlay, 网格 shows/hides a snap-grid overlay, 吸附 snaps drags to the
// grid on commit. Drag is live (DOM mouse events, web-only); commit on mouseup.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  applyHandleDrag,
  clampLayout,
  GRID_STEP,
  pxRect,
  resolveLayout,
  scaleFor,
  snapToGrid,
  type Handle,
  type Layout,
} from "../lib/canvas-geometry";
import { cardTypeLabel, type PlanCard } from "../lib/packaging-plan";

export function Canvas(props: {
  card: PlanCard | null;
  editable?: boolean;
  onLayoutChange?: (layout: Layout) => void;
  /** 核心编辑 C：源视频可播放 URL（@全栈工程师经 plan.source.videoUrl 提供）；为空时预览优雅降级。 */
  videoUrl?: string | null;
  /** 预览模式：true 时画布显示 <video> 源视频，编辑卡片层隐藏。 */
  previewMode?: boolean;
  /** 切换编辑↔预览。 */
  onTogglePreviewMode?: () => void;
  /** App 持有的 video 元素 ref（时间线 ▶/⏸/seek 直接操作它）。 */
  videoRef?: React.RefObject<HTMLVideoElement>;
  /** video.timeupdate → 上抛当前秒数（驱动播放头）。 */
  onVideoTime?: (sec: number) => void;
  /** video play/pause/ended → 上抛播放状态。 */
  onPlayStateChange?: (playing: boolean) => void;
}) {
  const { card, editable, onLayoutChange, videoUrl, previewMode, onTogglePreviewMode, videoRef, onVideoTime, onPlayStateChange } = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(760);
  const [preview, setPreview] = useState<Layout | null>(null);
  const dragRef = useRef<{ mode: Handle | "move"; startX: number; startY: number; startLayout: Layout } | null>(null);

  // Real canvas toggles (UI-fix #4).
  const [showSafe, setShowSafe] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(true);

  useLayoutEffect(() => {
    const measure = () => {
      const w = stageRef.current?.getBoundingClientRect().width;
      if (w) setStageW(w);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => setPreview(null), [card?.id]);

  const layout = resolveLayout(card?.layout as Partial<Layout> | undefined);
  const live = preview ?? layout;
  const rect = pxRect(live, stageW);
  const gridPx = GRID_STEP * scaleFor(stageW);

  const beginDrag = (mode: Handle | "move", e: React.MouseEvent) => {
    if (!editable || !card) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startLayout: layout };
    setPreview(layout);
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      let next: Layout;
      if (d.mode === "move") {
        const s = scaleFor(stageW);
        next = clampLayout({ ...d.startLayout, x: d.startLayout.x + dx / s, y: d.startLayout.y + dy / s });
      } else {
        next = applyHandleDrag(d.startLayout, d.mode, dx, dy, stageW);
      }
      // UI-fix #4 residual: snap live while dragging so the card hugs the grid in real time.
      setPreview(snap ? snapToGrid(next) : next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const d = dragRef.current;
      dragRef.current = null;
      setPreview((p) => {
        if (d && p) onLayoutChange?.(snap ? snapToGrid(p) : p);
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const tag = card?.content.chip ?? card?.content.label ?? card?.content.kicker ?? (card ? cardTypeLabel(card.type) : "");
  const title = card ? (card.content.title ?? `${cardTypeLabel(card.type)} · 待填标题`) : "（未选中卡片）";
  const body = card
    ? (card.content.subline ??
        (Array.isArray(card.content.items) ? card.content.items.join(" · ") : undefined) ??
        "在右侧 Inspector 编辑内容 / 布局 / 字体 / 颜色。")
    : "在左侧时间线或场景列表选中一张卡片，查看它在画面中的样子。";
  const accent = (card?.color as { accent?: string } | undefined)?.accent;

  return (
    <div className="pc-canvas-wrap">
      <div className="pc-canvastool">
        <span className="pc-tool active" title="光标">▣</span>
        <span className="pc-tool" title="抓手">✋</span>
        <span className="pc-tool" title="缩放">⊕</span>
        <span className="pc-fit">适配 {Math.round(scaleFor(stageW) * 100)}%</span>
        <span className="pc-spacer" />
        <span className="pc-toggle on">16:9 横屏</span>
        <button type="button" className={showSafe ? "pc-toggle on" : "pc-toggle"} onClick={() => setShowSafe((v) => !v)}>
          安全区
        </button>
        <button type="button" className={showGrid ? "pc-toggle on" : "pc-toggle"} onClick={() => setShowGrid((v) => !v)}>
          网格
        </button>
        <button type="button" className={snap ? "pc-toggle on" : "pc-toggle"} onClick={() => setSnap((v) => !v)}>
          吸附
        </button>
        {/* 核心编辑 C：编辑↔预览切换。源视频不可用时禁用并提示。 */}
        <button
          type="button"
          className={previewMode ? "pc-toggle on" : "pc-toggle"}
          onClick={() => onTogglePreviewMode?.()}
          disabled={!videoUrl}
          title={videoUrl ? "切换 编辑 / 预览（播放源视频）" : "源视频不可用"}
        >
          预览
        </button>
      </div>
      <div className="pc-canvas">
        <div className={previewMode ? "pc-stage pc-stage-preview" : "pc-stage"} ref={stageRef}>
          {/* 源视频 <video>：有 URL 时常驻挂载（保证时间线 ▶/seek 能操作 ref），仅预览模式可见。 */}
          {videoUrl && (
            <video
              ref={videoRef}
              className={previewMode ? "pc-stage-video show" : "pc-stage-video"}
              src={videoUrl}
              playsInline
              preload="metadata"
              onTimeUpdate={(e) => onVideoTime?.(e.currentTarget.currentTime)}
              onPlay={() => onPlayStateChange?.(true)}
              onPause={() => onPlayStateChange?.(false)}
              onEnded={() => onPlayStateChange?.(false)}
            />
          )}
          {!previewMode && showGrid && (
            <div
              className="pc-grid-overlay"
              style={{ backgroundSize: `${gridPx}px ${gridPx}px, ${gridPx}px ${gridPx}px` }}
            />
          )}
          {!previewMode && showSafe && <div className="pc-safearea" />}
          {!previewMode && (
            <div className="pc-presenter">
              <div className="pc-presenter-body" />
              <div className="pc-presenter-head" />
            </div>
          )}
          {!previewMode &&
            (card ? (
            <div
              className={editable ? "pc-selcard editable" : "pc-selcard"}
              style={{ left: rect.left, top: rect.top, width: rect.width, minHeight: rect.height, borderColor: accent || undefined }}
              onMouseDown={(e) => beginDrag("move", e)}
            >
              {tag && <span className="pc-tag" style={accent ? { color: accent, background: hexAlpha(accent) } : undefined}>{tag}</span>}
              <h3>{title}</h3>
              <p>{body}</p>
              {editable && (
                <>
                  <span className="pc-handle tl" onMouseDown={(e) => beginDrag("tl", e)} />
                  <span className="pc-handle tr" onMouseDown={(e) => beginDrag("tr", e)} />
                  <span className="pc-handle bl" onMouseDown={(e) => beginDrag("bl", e)} />
                  <span className="pc-handle br" onMouseDown={(e) => beginDrag("br", e)} />
                </>
              )}
            </div>
            ) : (
              <div className="pc-selcard empty">
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          {/* R5-M4: hint is a floating pill, only while editing a selected card or dragging —
              clearly above the grid/presenter layers, not competing as a background label. */}
          {!previewMode &&
            card &&
            editable &&
            (preview ? (
              <div className="pc-canvashint pc-hint-pill active">{snap ? "吸附网格中…" : "拖动中…"}</div>
            ) : (
              <div className="pc-canvashint pc-hint-pill">拖动卡片移动 · 拖四角手柄改大小{snap ? "（吸附网格）" : ""}</div>
            ))}
          {/* 预览模式但未选卡片仍显示视频；视频本身由上方 <video> 渲染。 */}
        </div>
      </div>
    </div>
  );
}

function hexAlpha(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "rgba(232,178,58,0.18)";
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.18)`;
}
