// P0 专业时间轴（对标剪映）：pxPerSecond + 横向滚动 viewport 坐标系，替代旧的全片百分比布局。
//  · 缩放：Ctrl/⌘+滚轮以光标为锚、Alt+滚轮横移、缩放滑块、『适配全片』；标尺刻度随缩放自适应。
//  · 卡片自由拖到任意时间（允许 gap、默认不 reflow、同轨重叠吸到最近空位）。
//  · 卡片左右边缘 trim（左=固定 end 改 start，右=固定 start 改 duration，最小 0.5s）。
//  · 吸附：拖动/trim 吸到 0/播放头/相邻 clip 边/轨尾/可见刻度，显对齐辅助线，按 Alt 临时关闭。
//  · 播放头拖动 scrub（实时 seek，预览 currentTime + 时间码联动）；点标尺/轨道仍 seek。
// 保留 a62e63ea 的删除（hover × / 右键菜单）与播放控制。
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Scene } from "../lib/api";
import type { Cue } from "../lib/captions";
import { DRAG_HINTS } from "../lib/guidance";
import type { CardType, PackagingPlan } from "../lib/packaging-plan";
import {
  buildSnapTargets,
  clipEnd as spanEnd,
  moveCardStart,
  resolveCardStart,
  type Span,
  snapTime,
  timelineEndMax,
  trimLeft,
  trimRight,
} from "../lib/timeline-edit";
import {
  chooseTickInterval,
  clampPps,
  fitPps,
  generateTicks,
  MAX_PPS,
  MIN_PPS,
  pxToTime,
  timeToPx,
  zoomAtAnchor,
} from "../lib/timeline-view";
import { CARD_DRAG_MIME } from "./ComponentLibrary";
import { Icon } from "./Icon";

function cardLaneClass(type: CardType): string {
  if (type === "demo-annotation" || type === "pip") return "cardlane-purple";
  if (type === "comparison" || type === "info-structure") return "cardlane-blue";
  if (type === "caption" || type === "transition") return "cardlane-dim";
  return "cardlane-gold";
}

function fmtTc(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const ff = String(Math.floor((seconds - s) * 25)).padStart(2, "0");
  return `00:${mm}:${ss}:${ff}`;
}

const EMPTY_SET: Set<string> = new Set();
const PPS_KEY = "pc-timeline-pps";
const SNAP_KEY = "pc-timeline-snap";
const SNAP_PX = 7; // 吸附阈值（屏幕像素）
const TAIL_PAD_PX = 240; // 内容右侧留白，便于把卡片拖到末端之后

// 拖动中的实时预览（mouseup 提交）。
type LiveDrag =
  | { kind: "move"; id: string; start: number; duration: number; guide: number | null }
  | { kind: "trimL" | "trimR"; id: string; start: number; duration: number; guide: number | null }
  | null;

export function FourTrackTimeline(props: {
  plan: PackagingPlan;
  scenes: Scene[];
  selectedId: string | null;
  unboundIds?: Set<string>;
  onSelect: (id: string) => void;
  /** P0 自由移动：把卡片 start 改到落点时间（不 reflow）。 */
  onMoveCard?: (id: string, start: number) => void;
  /** P0 trim：左/右边缘改 start+duration / duration（不 reflow）。 */
  onTrimCard?: (id: string, span: { start: number; duration: number }) => void;
  /** v2-P4: drop a library card type onto the card lane → insert at the drop time. */
  onDropCard?: (cardType: CardType, afterId: string | null) => void;
  /** UI-fix #5: pulse-highlight the subtitle lane (字幕识别 nav). */
  highlightSubtitle?: boolean;
  /** ③ 可拉伸 dock 高度（px）。 */
  heightPx?: number;
  /** 核心编辑 A：删除卡片（hover × / 右键）。 */
  onDeleteScene?: (id: string) => void;
  /** 核心编辑 C：播放状态 + 当前秒数。 */
  playing?: boolean;
  playTime?: number;
  onTogglePlay?: () => void;
  /** 点标尺/轨道 seek + 播放头拖动 scrub。 */
  onSeek?: (sec: number) => void;
  /** 合成预览：轨道可见性由 App 持有（👁 隐藏在预览里真生效）。 */
  hiddenTracks?: Set<string>;
  onToggleTrackHidden?: (key: string) => void;
  /** 字幕条：真实 cue（含 text+start+end），点击选中可编辑。 */
  cues?: Cue[];
  selectedCueId?: string | null;
  onSelectCue?: (id: string | null) => void;
  onEditCueText?: (id: string, text: string) => void;
  /** 剪映式：视频/音频轨片段选中（点 clip）+ 高亮。 */
  selectedClipId?: string | null;
  onSelectClip?: (kind: "video" | "audio", id: string) => void;
  /** 剪映式：在播放头处分割选中片段（S / 分割按钮）。 */
  onSplit?: () => void;
  canSplit?: boolean;
}) {
  const { plan, scenes, selectedId, unboundIds, onSelect, onMoveCard, onTrimCard, onDropCard, highlightSubtitle, heightPx, onDeleteScene, playing, playTime, onTogglePlay, onSeek, hiddenTracks, onToggleTrackHidden, cues, selectedCueId, onSelectCue, onEditCueText, selectedClipId, onSelectClip, onSplit, canSplit } = props;
  const editable = !!onMoveCard;

  // 总时长 = 所有轨道 clip 的 max(start+duration)，与 plan.duration 取大。
  const total =
    timelineEndMax(
      [
        plan.tracks.video.map((c) => ({ start: c.start, duration: c.duration })),
        plan.tracks.audio.map((c) => ({ start: c.start, duration: c.duration })),
        plan.tracks.subtitle.map((c) => ({ start: c.start, duration: c.duration })),
        scenes.map((s) => ({ start: Number(s.start ?? 0), duration: Number(s.duration ?? 0) })),
      ],
      plan.duration || 0,
    ) || 1;

  const cardTypeById = new Map(plan.tracks.card.map((c) => [c.id, c.type]));
  const hidden = hiddenTracks ?? EMPTY_SET; // 轨道可见性由 App 控制
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [dropActive, setDropActive] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // 字幕条点击 → 小编辑框（floating，视口固定定位），改文本回落 captions。
  const [cueEdit, setCueEdit] = useState<{ id: string; x: number; y: number; text: string } | null>(null);

  // ── 视图坐标系：pxPerSecond + 横向滚动 ──────────────────────────────
  const [pps, setPps] = useState<number>(() => {
    if (typeof localStorage === "undefined") return 18;
    const raw = Number(localStorage.getItem(PPS_KEY));
    return Number.isFinite(raw) && raw > 0 ? clampPps(raw) : 18;
  });
  const [snapEnabled, setSnapEnabled] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(SNAP_KEY) !== "0";
  });
  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(PPS_KEY, String(pps));
  }, [pps]);
  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(SNAP_KEY, snapEnabled ? "1" : "0");
  }, [snapEnabled]);

  const lanesRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const [viewportW, setViewportW] = useState(800);
  useLayoutEffect(() => {
    const el = lanesRef.current;
    if (!el) return;
    const measure = () => setViewportW(el.clientWidth);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  // pps 改变后应用待定 scrollLeft（光标锚点缩放）。
  useLayoutEffect(() => {
    if (pendingScrollRef.current != null && lanesRef.current) {
      lanesRef.current.scrollLeft = pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [pps]);

  const laneWidth = Math.max(timeToPx(total, pps) + TAIL_PAD_PX, viewportW);
  const [live, setLive] = useState<LiveDrag>(null);

  // clientX → 内容时间（含滚动）。
  const timeAtClientX = useCallback(
    (clientX: number): number => {
      const el = lanesRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return pxToTime(el.scrollLeft + (clientX - rect.left), pps);
    },
    [pps],
  );

  // 非 passive wheel：Ctrl/⌘ 缩放（光标锚点）、Alt 横移。
  useEffect(() => {
    const el = lanesRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const anchorOffset = e.clientX - rect.left;
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const { pps: np, scrollLeft } = zoomAtAnchor(pps, factor, anchorOffset, el.scrollLeft);
        pendingScrollRef.current = scrollLeft;
        setPps(np);
      } else if (e.altKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY || e.deltaX;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pps]);

  const zoomBy = (factor: number) => {
    const el = lanesRef.current;
    const anchorOffset = (el?.clientWidth ?? viewportW) / 2;
    const { pps: np, scrollLeft } = zoomAtAnchor(pps, factor, anchorOffset, el?.scrollLeft ?? 0);
    pendingScrollRef.current = scrollLeft;
    setPps(np);
  };
  const fitAll = () => {
    pendingScrollRef.current = 0;
    setPps(fitPps(total, viewportW));
  };

  // ── 吸附目标 / 量化 ────────────────────────────────────────────────
  const head_time = Math.min(Math.max(playTime ?? 0, 0), total);
  const tickInterval = chooseTickInterval(pps);
  const ticks = generateTicks(total, pps, tickInterval);
  const snapTargetsFor = (excludeId: string): number[] =>
    buildSnapTargets({
      playhead: head_time,
      trackEnd: total,
      others: scenes.filter((s) => s.id !== excludeId).map((s) => ({ start: Number(s.start ?? 0), duration: Number(s.duration ?? 0) })),
      ticks: ticks.map((t) => t.t),
    });
  const othersFor = (excludeId: string): Span[] =>
    scenes.filter((s) => s.id !== excludeId).map((s) => ({ start: Number(s.start ?? 0), duration: Number(s.duration ?? 0) }));
  const snapPx = () => pxToTime(SNAP_PX, pps);

  // ── 卡片拖动：移动 / 左 trim / 右 trim ────────────────────────────
  const didDragRef = useRef(false);
  const beginCardDrag = (kind: "move" | "trimL" | "trimR", scene: Scene, e: React.MouseEvent) => {
    if (!editable || locked.has("card") || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const origStart = Number(scene.start ?? 0);
    const origDur = Number(scene.duration ?? 0);
    const origEnd = origStart + origDur;
    didDragRef.current = false;
    const targets = snapTargetsFor(scene.id);
    const others = othersFor(scene.id);
    // trim 时不与相邻 clip 重叠的硬边界
    const prevEnd = others.filter((o) => spanEnd(o) <= origStart + 1e-6).reduce((m, o) => Math.max(m, spanEnd(o)), 0);
    const nextStart = others.filter((o) => o.start >= origEnd - 1e-6).reduce((m, o) => Math.min(m, o.start), Infinity);

    const onMove = (ev: MouseEvent) => {
      if (!didDragRef.current && Math.abs(ev.clientX - startX) < 4) return;
      didDragRef.current = true;
      const dt = pxToTime(ev.clientX - startX, pps);
      const noSnap = ev.altKey || !snapEnabled;
      const thr = snapPx();
      if (kind === "move") {
        let desired = moveCardStart(origStart + dt);
        let guide: number | null = null;
        if (!noSnap) {
          const sStart = snapTime(desired, targets, thr);
          const sEnd = snapTime(desired + origDur, targets, thr);
          if (sStart.snapped != null && (sEnd.snapped == null || Math.abs(sStart.snapped - desired) <= Math.abs(sEnd.snapped - (desired + origDur)))) {
            desired = sStart.snapped;
            guide = sStart.snapped;
          } else if (sEnd.snapped != null) {
            desired = Math.max(0, sEnd.snapped - origDur);
            guide = sEnd.snapped;
          }
        }
        const start = resolveCardStart(others, desired, origDur);
        setLive({ kind: "move", id: scene.id, start, duration: origDur, guide });
      } else if (kind === "trimL") {
        let rawStart = origStart + dt;
        let guide: number | null = null;
        if (!noSnap) {
          const s = snapTime(rawStart, targets, thr);
          if (s.snapped != null) {
            rawStart = s.snapped;
            guide = s.snapped;
          }
        }
        rawStart = Math.max(rawStart, prevEnd); // 不重叠左邻
        const span = trimLeft(origEnd, rawStart);
        setLive({ kind: "trimL", id: scene.id, ...span, guide });
      } else {
        let rawEnd = origEnd + dt;
        let guide: number | null = null;
        if (!noSnap) {
          const s = snapTime(rawEnd, targets, thr);
          if (s.snapped != null) {
            rawEnd = s.snapped;
            guide = s.snapped;
          }
        }
        if (nextStart !== Infinity) rawEnd = Math.min(rawEnd, nextStart); // 不重叠右邻
        const span = trimRight(origStart, rawEnd);
        setLive({ kind: "trimR", id: scene.id, ...span, guide });
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setLive((cur) => {
        if (cur && didDragRef.current) {
          if (cur.kind === "move") onMoveCard?.(cur.id, cur.start);
          else onTrimCard?.(cur.id, { start: cur.start, duration: cur.duration });
        }
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── 播放头拖动 scrub + 标尺/轨道点击 seek ─────────────────────────
  const beginScrub = (e: React.MouseEvent) => {
    if (!onSeek || e.button !== 0) return;
    e.preventDefault();
    onSeek(Math.min(Math.max(timeAtClientX(e.clientX), 0), total));
    const onMove = (ev: MouseEvent) => onSeek(Math.min(Math.max(timeAtClientX(ev.clientX), 0), total));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onLaneDrop = (e: React.DragEvent) => {
    if (!onDropCard) return;
    const cardType = e.dataTransfer.getData(CARD_DRAG_MIME) as CardType;
    if (!cardType) return;
    e.preventDefault();
    const t = timeAtClientX(e.clientX);
    // 落点时间所在/之前的最后一张卡片作为锚（插入其后）
    const cards = [...plan.tracks.card].sort((a, b) => a.timeline.start - b.timeline.start);
    const anchor = cards.filter((c) => c.timeline.start <= t).pop() ?? cards[cards.length - 1] ?? null;
    onDropCard(cardType, anchor?.id ?? null);
  };

  const head = (key: string, color: string, label: string) => {
    const isHidden = hidden.has(key);
    const isLocked = locked.has(key);
    return (
      <div className="tl-head">
        <span className="tl-dot" style={{ background: color }} />
        <span className="tl-head-label">{label}</span>
        <span className="tl-toggles">
          <button type="button" className={isHidden ? "tl-ctrl off" : "tl-ctrl"} onClick={() => onToggleTrackHidden?.(key)} title={isHidden ? "显示该轨道" : "隐藏该轨道"} aria-pressed={!isHidden}>
            <Icon name="eye" size={15} />
          </button>
          <button type="button" className={isLocked ? "tl-ctrl active" : "tl-ctrl"} onClick={() => toggleSet(locked, setLocked, key)} title={isLocked ? "解锁该轨道" : "锁定该轨道"} aria-pressed={isLocked}>
            <Icon name="lock" size={15} />
          </button>
        </span>
      </div>
    );
  };
  const toggleSet = (set: Set<string>, setFn: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setFn(next);
  };
  const laneCls = (key: string, extra = "") =>
    ["pc-lane", extra, hidden.has(key) ? "tl-lane-hidden" : "", locked.has(key) ? "tl-lane-locked" : ""].filter(Boolean).join(" ");

  // 剪映式：clip 点击=选中该片段（不冒泡到 lane 的 seek）+ 高亮描边；mousedown stopPropagation 防 seek。
  const clip = (c: { id: string; src?: string | null; start: number; duration: number }, kind: "video" | "audio", label: string) => {
    const sel = c.id === selectedClipId;
    return (
      <div
        key={c.id}
        className={`tl-clip ${kind}${sel ? " selected" : ""}`}
        style={{ left: timeToPx(c.start, pps), width: Math.max(timeToPx(c.duration, pps), 2) }}
        title={`${c.src ?? label} · ${Number(c.start).toFixed(2)}s +${Number(c.duration).toFixed(2)}s${onSelectClip ? " · 点击选中" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onSelectClip ? (e) => { e.stopPropagation(); onSelectClip(kind, c.id); } : undefined}
      >
        {label}
      </div>
    );
  };

  const playheadPx = timeToPx(head_time, pps);
  const guidePx = live?.guide != null ? timeToPx(live.guide, pps) : null;

  return (
    <div className="pc-timeline" style={heightPx ? { flex: `0 0 ${heightPx}px` } : undefined}>
      <div className="pc-tlhead">
        <span className="pc-tc">{fmtTc(head_time)}</span>
        <span className="pc-transport">
          <button type="button" className="pc-tctrl" title="回到开头" onClick={() => onSeek?.(0)} disabled={!onSeek}>
            <Icon name="skipBack" size={15} />
          </button>
          <button type="button" className={playing ? "pc-tctrl pc-tctrl-play active" : "pc-tctrl pc-tctrl-play"} title={playing ? "暂停" : "播放"} onClick={() => onTogglePlay?.()} disabled={!onTogglePlay}>
            <Icon name={playing ? "pause" : "play"} size={15} />
          </button>
          <button type="button" className="pc-tctrl" title="跳到结尾" onClick={() => onSeek?.(total)} disabled={!onSeek}>
            <Icon name="skipFwd" size={15} />
          </button>
        </span>
        {/* 缩放控件 */}
        <span className="pc-zoom">
          <button type="button" className="pc-tctrl" title="缩小" onClick={() => zoomBy(1 / 1.4)}>−</button>
          <input className="pc-zoom-slider" type="range" min={MIN_PPS} max={MAX_PPS} step={1} value={Math.round(pps)} onChange={(e) => zoomBy(Number(e.target.value) / pps)} title="时间轴缩放" aria-label="时间轴缩放" />
          <button type="button" className="pc-tctrl" title="放大" onClick={() => zoomBy(1.4)}>+</button>
          <button type="button" className="pc-btn-fit" title="适配全片" onClick={fitAll}>适配全片</button>
          <button type="button" className={snapEnabled ? "pc-btn-snap on" : "pc-btn-snap"} onClick={() => setSnapEnabled((v) => !v)} title={snapEnabled ? "吸附：开（按 Alt 临时关闭）" : "吸附：关"} aria-pressed={snapEnabled}>
            吸附
          </button>
          {onSplit && (
            <button type="button" className="pc-btn-split" onClick={() => onSplit()} disabled={!canSplit} title="在播放头处分割选中片段（S）">
              ✂ 分割
            </button>
          )}
        </span>
        <span className="pc-tl-right">四类轨道：视频 / 音频 / 字幕 / 卡片</span>
      </div>
      <div className="pc-tlbody">
        <div className="pc-trackheads">
          {head("video", "var(--pc-blue)", "视频轨道")}
          {head("audio", "var(--pc-green)", "音频轨道")}
          {head("subtitle", "var(--pc-cap)", "字幕轨道")}
          {head("card", "var(--pc-gold)", "卡片轨道")}
        </div>
        <div className="pc-lanes-scroll" ref={lanesRef}>
          <div className="pc-lanes-content" style={{ width: laneWidth }}>
            <div className="pc-ruler pc-ruler-seek" onMouseDown={onSeek ? beginScrub : undefined} title={onSeek ? "点击/拖动跳转" : undefined}>
              {ticks.map((t, i) => (
                <span key={i} className={t.major ? "pc-tick major" : "pc-tick"} style={{ left: t.px }}>
                  {t.label}
                </span>
              ))}
            </div>
            <div className={laneCls("video")} onMouseDown={onSeek ? beginScrub : undefined}>
              {plan.tracks.video.map((c) => clip(c, "video", "主视频素材"))}
            </div>
            <div className={laneCls("audio")} onMouseDown={onSeek ? beginScrub : undefined}>
              {plan.tracks.audio.map((c) => clip(c, "audio", "原始音频"))}
            </div>
            <div className={laneCls("subtitle", highlightSubtitle ? "pc-lane-pulse" : "")} onMouseDown={onSeek ? beginScrub : undefined}>
              {cues && cues.length > 0
                ? cues.map((cue) => (
                    <div
                      key={cue.id}
                      // pc-cueclip：字幕条文本是用户转写内容（含品牌/技术英文），非可翻译 UI chrome；
                      // 与字幕弹窗 .pc-cue 一致，被 i18n 残留检查排除。
                      className={cue.id === selectedCueId ? "tl-clip cap pc-cueclip selected" : "tl-clip cap pc-cueclip"}
                      style={{ left: timeToPx(cue.start, pps), width: Math.max(timeToPx(cue.end - cue.start, pps), 3) }}
                      title={cue.text}
                      // 点字幕条 = 选中该 cue + 弹小编辑框（不只 seek）。
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCue?.(cue.id);
                        if (onEditCueText) setCueEdit({ id: cue.id, x: e.clientX, y: e.clientY, text: cue.text });
                      }}
                    >
                      {cue.text}
                    </div>
                  ))
                : plan.tracks.subtitle.length === 0
                  ? null
                  : <SubtitleClips total={total} pps={pps} count={plan.tracks.card.length} />}
            </div>
            <div
              className={laneCls("card", `pc-cardlane${dropActive ? " pc-cardlane-over" : ""}`)}
              onMouseDown={onSeek ? beginScrub : undefined}
              onDragOver={onDropCard ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDropActive(true); } : undefined}
              onDragLeave={onDropCard ? () => setDropActive(false) : undefined}
              onDrop={onDropCard ? (e) => { setDropActive(false); onLaneDrop(e); } : undefined}
            >
              {scenes.length === 0 ? (
                <div className="pc-lane-empty">{onDropCard ? DRAG_HINTS.cardTrackEmpty : "未加载项目 — 新建或选择项目后显示卡片轨"}</div>
              ) : (
                scenes.map((s) => {
                  const isLive = live && live.id === s.id;
                  const start = isLive ? live!.start : Number(s.start ?? 0);
                  const duration = isLive ? live!.duration : Number(s.duration ?? 0);
                  const unbound = unboundIds?.has(s.id);
                  const cls = ["timeline-block", cardLaneClass(cardTypeById.get(s.id) ?? "opening"), s.id === selectedId ? "selected" : "", unbound ? "unbound" : "", isLive ? "dragging" : ""].filter(Boolean).join(" ");
                  return (
                    <div
                      key={s.id}
                      className={cls}
                      style={{ left: timeToPx(start, pps), width: Math.max(timeToPx(duration, pps), 6) }}
                      title={`${s.id} · ${Number(start.toFixed(2))}s → +${Number(duration.toFixed(2))}s${unbound ? " · 未绑定素材" : ""}${editable ? " · 拖动移动 / 边缘 trim" : ""}`}
                      // 回归修复：卡片块上的 mousedown 永远 stopPropagation，不冒泡到 lane 的 seek（点卡片=选中，不是 seek）；
                      // 可编辑时进入拖动判定（beginCardDrag 内部再 4px 阈值区分单击/拖动）。
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (editable) beginCardDrag("move", s, e);
                      }}
                      onClick={() => {
                        if (didDragRef.current) {
                          didDragRef.current = false;
                          return;
                        }
                        onSelect(s.id);
                      }}
                      onContextMenu={onDeleteScene && editable ? (e) => { e.preventDefault(); e.stopPropagation(); onSelect(s.id); setMenu({ id: s.id, x: e.clientX, y: e.clientY }); } : undefined}
                    >
                      <span className="timeline-label">
                        {unbound ? "⚠ " : ""}
                        {s.id}
                      </span>
                      {editable && onDeleteScene && (
                        <span className="block-delete" role="button" title="删除卡片" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDeleteScene(s.id); }}>
                          ×
                        </span>
                      )}
                      {editable && (
                        <>
                          <span className="trim-handle left" title="拖动左边缘改入点" onMouseDown={(e) => beginCardDrag("trimL", s, e)} onClick={(e) => e.stopPropagation()} />
                          <span className="trim-handle right" title="拖动右边缘改时长" onMouseDown={(e) => beginCardDrag("trimR", s, e)} onClick={(e) => e.stopPropagation()} />
                        </>
                      )}
                    </div>
                  );
                })
              )}
              {onDropCard && scenes.length > 0 && (
                <span className="pc-cardlane-hint">{DRAG_HINTS.cardTrackEmpty}</span>
              )}
            </div>
            {/* 吸附对齐辅助线 */}
            {guidePx != null && <div className="pc-snapline" style={{ left: guidePx }} />}
            {/* 播放头：竖线 pointer-events:none（不抢卡片点击），仅顶部抓手可拖动 scrub。 */}
            <div className={playing ? "pc-playhead playing" : "pc-playhead"} style={{ left: playheadPx }}>
              {onSeek && <span className="pc-playhead-grab" title="拖动播放头" onMouseDown={(e) => { e.stopPropagation(); beginScrub(e); }} />}
            </div>
          </div>
        </div>
      </div>
      {menu && onDeleteScene && (
        <>
          <div className="pc-ctxmenu-backdrop" onMouseDown={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="pc-ctxmenu" style={{ left: menu.x, top: menu.y }}>
            <button type="button" className="pc-ctxmenu-item danger" onClick={() => { onDeleteScene(menu.id); setMenu(null); }}>
              删除卡片
            </button>
          </div>
        </>
      )}
      {/* 字幕条小编辑框：改文本 → 保存落 captions。 */}
      {cueEdit && onEditCueText && (
        <>
          <div className="pc-ctxmenu-backdrop" onMouseDown={() => setCueEdit(null)} />
          <div className="pc-cueedit" style={{ left: Math.min(cueEdit.x, 1180), top: cueEdit.y }}>
            <div className="pc-cueedit-title">编辑字幕</div>
            <textarea
              className="pc-cueedit-input"
              value={cueEdit.text}
              autoFocus
              onChange={(e) => setCueEdit((c) => (c ? { ...c, text: e.target.value } : c))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  onEditCueText(cueEdit.id, cueEdit.text);
                  setCueEdit(null);
                } else if (e.key === "Escape") setCueEdit(null);
              }}
            />
            <div className="pc-cueedit-actions">
              <button type="button" className="pc-cueedit-cancel" onClick={() => setCueEdit(null)}>取消</button>
              <button type="button" className="pc-cueedit-save" onClick={() => { onEditCueText(cueEdit.id, cueEdit.text); setCueEdit(null); }}>保存</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SubtitleClips({ total, pps, count }: { total: number; pps: number; count: number }) {
  const n = Math.min(Math.max(count, 1), 4);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const span = total / (n + 1);
        const start = span * (i + 0.2);
        return (
          <div key={i} className="tl-clip cap" style={{ left: timeToPx(start, pps), width: Math.max(timeToPx(span * 0.7, pps), 2) }} title="字幕（由 captions 投影）">
            字幕{String(i + 1).padStart(2, "0")}
          </div>
        );
      })}
    </>
  );
}
