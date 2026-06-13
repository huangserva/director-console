// 预览卡片 = composer 真实卡片（单一真相）。直接调用 composer 的纯渲染函数 renderScene(scene) 产出与最终成片
// 完全一致的 HTML，套用 composer 那套设计 CSS（composer-card.css，scope 到 .hf-frame），在 1920×1080 整帧里
// 渲染后按 stageW/1920 缩放进画布——比例/留白/字号/排版与渲染成片一致，不再是手搓近似小方块。
//
// 画中画卡（ScreenWithPip）需要预览里随播放头同步的真实绑定视频（mediaUrls.screen/pip），所以用 composer 的
// screen-proof/screen-shell/circle-pip 结构 + 类名（同一套 CSS 比例）+ 我们的 live <video>，而非 renderScene 的静态视频标记。
import { gsap } from "gsap";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import { renderScene } from "../../../hyperframes-composer/components/registry.mjs";
import { getComponentDef, type SeekableTimeline } from "../lib/component-defs";
import type { PlanCard } from "../lib/packaging-plan";
import { isImageMediaPath } from "../lib/scene-templates";
import "./composer-card.css";

const FRAME_W = 1920;
const FRAME_H = 1080;

export interface CardVisualProps {
  card: PlanCard;
  stageW: number;
  /** 画中画卡真合成：screen=底层内容视频、pip=右下角圆形数字人小窗（服务端可服务 URL）。 */
  mediaUrls?: { screen?: string | null; pip?: string | null } | null;
  /** 合成时间相对本卡起点（composeT - card.start），驱动 screen/pip 视频 currentTime 同步。 */
  currentTime?: number;
  /** 视频轨隐藏（👁）：卡片内所有视频媒体（screen/pip 视频、图片 screen、composer 内嵌 video）随主源一起隐藏（visibility:hidden，保留挂载）。 */
  videoHidden?: boolean;
  /** 音频轨隐藏：卡片内视频静音（预览叠加视频本就 muted，这里保持语义一致）。 */
  audioHidden?: boolean;
}

// composer 场景对象（registry.render 需要的形状）：复用 PlanCard.engine 的 component/scene_type/props（即原始 scene props）。
function toScene(card: PlanCard) {
  return {
    id: card.id,
    component: card.engine?.component,
    scene_type: card.engine?.scene_type,
    track: card.engine?.track,
    start: 0,
    duration: Math.max(0.001, card.timeline?.duration || 1),
    props: (card.engine?.props as Record<string, unknown>) ?? {},
  };
}

// 把 video.currentTime 同步到合成时间（相对本卡起点）；muted/playsInline，仅画面预览。
function useSyncedVideo(time: number | undefined) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const t = Math.max(0, time ?? 0);
    if (Number.isFinite(v.duration) && v.duration > 0) v.currentTime = Math.min(t, v.duration);
    else v.currentTime = t;
  }, [time]);
  return ref;
}

// 画中画卡：composer 的 screen-proof 结构（同 CSS 比例）+ 绑定的 live 媒体；未绑则空壳占位。
// - 底层大画面 screen：图片 → <img>（object-fit cover 铺满）；视频 → <video>（随播放头同步）。
// - 右下角圆形 pip：数字人口播视频，<video> 随播放头同步。
// 图片/视频按 media.screen 的扩展名判定；都用 card.mediaUrls 的可服务 URL（不直接喂绝对路径）。
function PipFrame({ card, mediaUrls, currentTime, videoHidden }: { card: PlanCard; mediaUrls?: CardVisualProps["mediaUrls"]; currentTime?: number; videoHidden?: boolean }) {
  const props = (card.engine?.props as Record<string, unknown>) ?? {};
  const media = (props.media as Record<string, unknown> | undefined) ?? {};
  const label = typeof props.label === "string" ? props.label : "";
  const screenUrl = mediaUrls?.screen ?? null;
  const pipUrl = mediaUrls?.pip ?? null;
  const screenIsImage = isImageMediaPath(typeof media.screen === "string" ? (media.screen as string) : null);
  const screenRef = useSyncedVideo(currentTime);
  const pipRef = useSyncedVideo(currentTime);
  // 视频轨隐藏：卡片内的画面媒体（含图片 screen——它也是画面内容）随主源一起 visibility:hidden（保留挂载/同步，跟主源一致）。
  const hide: CSSProperties | undefined = videoHidden ? { visibility: "hidden" } : undefined;
  return (
    <div className="clip scene screen-proof">
      <div className="screen-label">{label}</div>
      <div className="screen-shell">
        {screenUrl ? (
          screenIsImage ? (
            <img src={screenUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...hide }} />
          ) : (
            <video ref={screenRef} src={screenUrl} muted playsInline preload="metadata" style={hide} />
          )
        ) : null}
      </div>
      <div className="circle-pip">
        {pipUrl ? <video ref={pipRef} src={pipUrl} muted playsInline preload="metadata" style={hide} /> : null}
      </div>
    </div>
  );
}

// 带动效的卡：composer renderScene 产出真实 HTML（与成片一致）+ 注册表给的真 GSAP 入场/强调动效随播放头同步。
// timeline paused，currentTime 变化时 seek 到对应秒数——播放/拖播放头即可看到入场过程态（而非静态基态）。
// 编辑字段→html 重渲染→timeline 在新 DOM 上用 gsap.context 重建并 seek 回当前时刻（timeRef 命令式句柄保时刻）。
// buildTimeline 由 component-defs 注册表按 card.component 提供（StatsHero/TitleCard/StepCard…），CardVisual 不再硬编码。
function AnimatedFrame({
  card,
  frameStyle,
  currentTime,
  videoHidden,
  buildTimeline,
}: {
  card: PlanCard;
  frameStyle: CSSProperties;
  currentTime?: number;
  videoHidden?: boolean;
  buildTimeline: (id: string) => SeekableTimeline;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<SeekableTimeline | null>(null);
  const timeRef = useRef(0);
  const html = useMemo(() => {
    try {
      return renderScene(toScene(card)) as string;
    } catch {
      return null;
    }
  }, [card]);

  // 建/重建 timeline：html 变（编辑字段）或卡 id 变时，在最新 DOM 上重建并 seek 回当前时刻。
  // biome-ignore lint/correctness/useExhaustiveDependencies: html 即 props 的派生；timeRef/buildTimeline 是命令式句柄，故意不入依赖。
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !html) return;
    // gsap.context 把选择器 scope 到本卡 .hf-frame，重建/卸载干净。
    const ctx = gsap.context(() => {
      const tl = buildTimeline(card.id);
      tlRef.current = tl;
      tl.seek(timeRef.current);
    }, el);
    return () => {
      ctx.revert();
      tlRef.current = null;
    };
  }, [html, card.id]);

  // 播放头推进：seek 到 (composeT - card.start)。
  useEffect(() => {
    timeRef.current = Math.max(0, currentTime ?? 0);
    tlRef.current?.seek(timeRef.current);
  }, [currentTime]);

  if (html) {
    // biome-ignore lint/security/noDangerouslySetInnerHtml: composer renderScene 产出的可信 HTML（同成片）。
    return <div ref={frameRef} className="hf-frame" data-video-hidden={videoHidden ? "1" : undefined} style={frameStyle} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <div className="hf-frame" data-video-hidden={videoHidden ? "1" : undefined} style={frameStyle}>
      <div className="clip scene title-scene">
        <div className="title-block">
          <div className="main-title">{card.content?.title ?? card.id}</div>
        </div>
      </div>
    </div>
  );
}

export function CardVisual({ card, stageW, mediaUrls, currentTime, videoHidden, audioHidden }: CardVisualProps) {
  void audioHidden; // 卡片叠加视频本就 muted（仅主源出声）；音频轨隐藏的静音语义在 Canvas 主源侧落实，此处恒静音已满足。
  const scale = stageW > 0 ? stageW / FRAME_W : 0.4;
  const frameStyle: CSSProperties = { width: FRAME_W, height: FRAME_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 };
  const isPip = card.engine?.component === "ScreenWithPip";
  // 注册表查动效：StatsHero/TitleCard/StepCard… 有 buildTimeline → 跑真 GSAP；未注册 → 静态基态兜底。
  const buildTimeline = getComponentDef(card.engine?.component)?.buildTimeline;

  if (!isPip && buildTimeline) {
    return <AnimatedFrame card={card} frameStyle={frameStyle} currentTime={currentTime} videoHidden={videoHidden} buildTimeline={buildTimeline} />;
  }

  if (isPip) {
    return (
      <div className="hf-frame" data-has-source-video="1" data-video-hidden={videoHidden ? "1" : undefined} style={frameStyle}>
        <PipFrame card={card} mediaUrls={mediaUrls} currentTime={currentTime} videoHidden={videoHidden} />
      </div>
    );
  }

  // 其它卡片：用 composer renderScene 产出真实 HTML（与成片一致）。props 不全时 renderScene 会 throw → 兜底显示标题。
  let html: string | null = null;
  try {
    html = renderScene(toScene(card)) as string;
  } catch {
    html = null;
  }
  if (html) {
    return <div className="hf-frame" data-video-hidden={videoHidden ? "1" : undefined} style={frameStyle} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  // 兜底：用 composer 的标题样式呈现卡片标题（仍走同一套 CSS，不丑）。
  const title = card.content?.title ?? card.content?.kicker ?? card.id;
  return (
    <div className="hf-frame" data-video-hidden={videoHidden ? "1" : undefined} style={frameStyle}>
      <div className="clip scene title-scene">
        <div className="title-block">
          <div className="title-kicker">{card.content?.kicker ?? ""}</div>
          <div className="main-title">{title}</div>
          <div className="title-sub">{card.content?.subline ?? "（绑定/补全该卡内容后显示完整设计）"}</div>
        </div>
      </div>
    </div>
  );
}

export default CardVisual;
