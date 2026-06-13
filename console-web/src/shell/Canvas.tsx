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
import type { Cue } from "../lib/captions";
import { cardTypeLabel, type PlanCard } from "../lib/packaging-plan";
import { CardVisual } from "./CardVisual";

export function Canvas(props: {
  card: PlanCard | null;
  editable?: boolean;
  onLayoutChange?: (layout: Layout) => void;
  /** 核心编辑 C：源视频可播放 URL（@全栈工程师经 plan.source.videoUrl 提供）；为空时预览优雅降级。 */
  videoUrl?: string | null;
  /** 预览模式：true 时画布显示合成预览（视频 + 当下卡片/字幕叠加），编辑卡片层隐藏。 */
  previewMode?: boolean;
  /** 切换编辑↔预览。 */
  onTogglePreviewMode?: () => void;
  /** App 持有的 video 元素 ref（时间线 ▶/⏸/seek 直接操作它）。 */
  videoRef?: React.RefObject<HTMLVideoElement>;
  /** video.timeupdate → 上抛当前秒数（驱动播放头）。 */
  onVideoTime?: (sec: number) => void;
  /** video play/pause/ended → 上抛播放状态。 */
  onPlayStateChange?: (playing: boolean) => void;
  /** 合成预览：全部卡片（按 timeline.start/duration 决定当下是否叠加）。 */
  cards?: PlanCard[];
  selectedId?: string | null;
  /** 合成预览：字幕 cue（按 start/end 决定当下叠加哪句）。 */
  cues?: Cue[];
  /** 合成预览：隐藏的轨道在叠加层里真的不显示（👁 生效）。 */
  hiddenTracks?: Set<string>;
  /** 当前播放秒数（seek/scrub/timeupdate 回流）；播放中另用 rAF 读 video.currentTime 求顺滑。 */
  playTime?: number;
  playing?: boolean;
  /** 合成预览：点叠加卡片 → 选中（Inspector 切到该卡）。 */
  onSelect?: (id: string) => void;
}) {
  const { card, editable, onLayoutChange, videoUrl, previewMode, onTogglePreviewMode, videoRef, onVideoTime, onPlayStateChange, cards, selectedId, cues, hiddenTracks, playTime, playing, onSelect } = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(760);
  // 合成预览时间：播放中用 rAF 读 video.currentTime（顺滑），否则跟随 playTime（seek/scrub/暂停）。
  const [rafT, setRafT] = useState(0);
  useEffect(() => {
    if (!previewMode || !playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef?.current;
      if (v) setRafT(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [previewMode, playing, videoRef]);
  const composeT = playing ? rafT : (playTime ?? 0);
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

  const editTxt = cardText(card);
  const tag = card ? editTxt.tag : "";
  const title = card ? editTxt.title : "（未选中卡片）";
  const body = card ? editTxt.body : "在左侧时间线或场景列表选中一张卡片，查看它在画面中的样子。";
  const accent = editTxt.accent;

  // 合成预览：当下应出现的卡片（start ≤ t < start+duration）+ 当前字幕 cue；隐藏轨道不参与。
  const activeCards =
    previewMode && !hiddenTracks?.has("card")
      ? (cards ?? []).filter((c) => c.timeline.start <= composeT && composeT < c.timeline.start + c.timeline.duration)
      : [];
  const activeCue =
    previewMode && !hiddenTracks?.has("subtitle")
      ? (cues ?? []).find((c) => c.start <= composeT && composeT < c.end) ?? null
      : null;

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
          {/* 合成预览叠加层：按 currentTime 把当下卡片 + 字幕叠在视频上（WYSIWYG）。pointer-events:none，
              不挡视频/scrub；隐藏轨道在此真不显示（👁 生效）。 */}
          {previewMode && (
            <div className="pc-composite">
              {activeCards.map((c) => {
                const r = pxRect(resolveLayout(c.layout as Partial<Layout> | undefined), stageW);
                const sel = c.id === selectedId;
                // 真实卡片渲染器（@全栈工程师 CardVisual.tsx，含画中画小人像窗等真实样式）；
                // 外层 div 按 resolveLayout/pxRect 定位 + 选中高亮 + 点选。
                return (
                  <div
                    key={c.id}
                    className={sel ? "pc-overlay-cv selected" : "pc-overlay-cv"}
                    style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                    onClick={() => onSelect?.(c.id)}
                  >
                    <CardVisual card={c} stageW={stageW} />
                  </div>
                );
              })}
              {activeCue && <div className="pc-overlay-sub">{activeCue.text}</div>}
            </div>
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

// 单卡的展示文本（chip/标题/正文/主色），编辑层与合成叠加层共用。
function cardText(card: PlanCard | null): { tag: string; title: string; body: string; accent?: string } {
  if (!card) return { tag: "", title: "", body: "" };
  const tag = card.content.chip ?? card.content.label ?? card.content.kicker ?? cardTypeLabel(card.type);
  const title = card.content.title ?? `${cardTypeLabel(card.type)} · 待填标题`;
  const body =
    card.content.subline ??
    (Array.isArray(card.content.items) ? card.content.items.join(" · ") : undefined) ??
    "在右侧 Inspector 编辑内容 / 布局 / 字体 / 颜色。";
  const accent = (card.color as { accent?: string } | undefined)?.accent;
  return { tag, title, body, accent };
}

function hexAlpha(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "rgba(232,178,58,0.18)";
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.18)`;
}
