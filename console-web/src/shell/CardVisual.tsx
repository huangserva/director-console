// 预览卡片 = composer 真实卡片（单一真相）。直接调用 composer 的纯渲染函数 renderScene(scene) 产出与最终成片
// 完全一致的 HTML，套用 composer 那套设计 CSS（composer-card.css，scope 到 .hf-frame），在 1920×1080 整帧里
// 渲染后按 stageW/1920 缩放进画布——比例/留白/字号/排版与渲染成片一致，不再是手搓近似小方块。
//
// 画中画卡（ScreenWithPip）需要预览里随播放头同步的真实绑定视频（mediaUrls.screen/pip），所以用 composer 的
// screen-proof/screen-shell/circle-pip 结构 + 类名（同一套 CSS 比例）+ 我们的 live <video>，而非 renderScene 的静态视频标记。
import { gsap } from "gsap";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import { renderScene } from "../../../hyperframes-composer/components/registry.mjs";
import type { PlanCard } from "../lib/packaging-plan";
import { isImageMediaPath } from "../lib/scene-templates";
import "./composer-card.css";

const FRAME_W = 1920;
const FRAME_H = 1080;

// 开场数据卡（StatsHero）真实入场/强调动效——逐字 port 自 composer 的 timelines.mjs（renderTimelineScript 里的
// StatsHero 分支）。这里 scene.start=0（CardVisual.toScene 把每张卡当独立时间轴），所以各 beat 起点是 composer
// 里 stats.start + offset 的 offset 本身：stat 0.705 进场、数字 1.355 弹大、browser 2.539 入场、icon-cloud 2.939
// 逐个揭示、title 9.781 入场。timeline 建成后 paused，由播放头 seek 到 (composeT - card.start) 推进。
// 选择器用 #${id}-stat / -browser / -title（renderOpeningStat 产出的子场景 id），在 .hf-frame 容器内 scope。
function buildStatsHeroTimeline(id: string): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  const statStart = 0.705;
  const browserStart = 2.539;
  const titleStart = 9.781;
  const returnStart = 8.448;

  tl.from(`#${id}-stat`, { opacity: 0, duration: 0.001 }, statStart);
  tl.from(`#${id}-stat`, { clipPath: "inset(0 100% 0 0)", duration: 0.3, ease: "power2.inOut" }, statStart);
  tl.fromTo(`#${id}-stat .stat-pack`, { opacity: 0.62, x: 124, y: -66, scale: 0.72 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.7, ease: "power3.out" }, statStart + 0.15);
  tl.from(`#${id}-stat .stat-shell`, { opacity: 0, scale: 0.78, duration: 0.24, ease: "power3.out" }, statStart + 0.27);
  tl.from(`#${id}-stat .stat-label`, { opacity: 0, x: -16, duration: 0.18, ease: "power2.out" }, statStart + 0.57);
  tl.fromTo(`#${id}-stat .stat-number`, { opacity: 0, x: -34, scale: 0.52 }, { opacity: 1, x: 0, scale: 1.18, duration: 0.18, ease: "power4.out" }, statStart + 0.65);
  tl.to(`#${id}-stat .stat-number`, { scale: 1, duration: 0.18, ease: "power2.out" }, statStart + 0.83);
  tl.from(`#${id}-stat .stat-unit`, { opacity: 0, x: -20, scale: 0.65, duration: 0.18, ease: "power3.out" }, statStart + 0.83);
  tl.from(`#${id}-stat .stat-title`, { opacity: 0, y: 12, duration: 0.18, ease: "power2.out" }, statStart + 0.95);
  tl.to(`#${id}-stat .stat-pack`, { x: -18, y: 8, scale: 1.065, duration: 0.86, ease: "power1.out" }, statStart + 0.95);
  tl.to(`#${id}-stat`, { opacity: 0, duration: 0.18, ease: "power1.out" }, statStart + 2.0);
  tl.set(`#${id}-stat`, { opacity: 0 }, statStart + 2.24);

  tl.fromTo(`#${id}-browser .browser-stage`, { opacity: 0, x: -360, y: 22, scale: 0.72, clipPath: "inset(0 88% 0 0)" }, { opacity: 1, x: 0, y: 0, scale: 1, clipPath: "inset(0 0% 0 0)", duration: 0.66, ease: "power3.out" }, browserStart);
  tl.fromTo(`#${id}-browser .browser-video-card`, { opacity: 0.72, x: -260, y: 18, scale: 0.58, clipPath: "inset(0 82% 0 0)" }, { opacity: 1, x: 12, y: 0, scale: 1.15, clipPath: "inset(0 0% 0 0)", duration: 0.18, ease: "power4.out" }, browserStart + 0.11);
  tl.to(`#${id}-browser .browser-video-card`, { x: 0, y: 0, scale: 1, duration: 0.24, ease: "power2.out" }, browserStart + 0.3);
  tl.from(`#${id}-browser .icon-cloud span`, { opacity: 0, scale: 0.25, stagger: 0.035, duration: 0.16, ease: "power2.out" }, browserStart + 0.4);
  tl.to(`#${id}-browser .browser-stage`, { x: 18, y: -8, scale: 1.018, duration: 0.72, ease: "power1.inOut" }, browserStart + 0.67);
  tl.to(`#${id}-browser .browser-video-card`, { x: 14, y: 8, scale: 1.035, duration: 0.75, ease: "power1.inOut" }, browserStart + 0.69);
  tl.to(`#${id}-browser .browser-stage`, { x: 7, y: 0, scale: 1.006, duration: 0.45, ease: "power1.out" }, browserStart + 1.39);
  tl.to(`#${id}-browser .browser-video-card`, { x: 4, y: 0, scale: 1.01, duration: 0.55, ease: "power1.out" }, browserStart + 1.45);
  tl.to(`#${id}-browser`, { opacity: 0, duration: 0.16, ease: "power1.out" }, returnStart - 0.12);
  tl.set(`#${id}-browser`, { opacity: 0 }, returnStart);

  tl.from(`#${id}-title`, { opacity: 0, duration: 0.001 }, titleStart);
  tl.from(`#${id}-title`, { clipPath: "inset(0 100% 0 0)", duration: 0.34, ease: "power2.inOut" }, titleStart);
  tl.from(`#${id}-title .main-title`, { opacity: 0, x: -20, filter: "blur(6px)", duration: 0.38, ease: "power3.out" }, titleStart + 0.33);
  tl.from(`#${id}-title .title-kicker`, { opacity: 0, y: 10, duration: 0.22, ease: "power2.out" }, titleStart + 0.45);
  tl.from(`#${id}-title .title-sub`, { opacity: 0, y: 10, duration: 0.22, ease: "power2.out" }, titleStart + 0.73);
  tl.from(`#${id}-title .underline-stack i`, { scaleX: 0, stagger: 0.1, duration: 0.28, ease: "none" }, titleStart + 1.42);
  tl.to(`#${id}-title`, { opacity: 0, duration: 0.22, ease: "power1.in" }, titleStart + 2.84);
  tl.set(`#${id}-title`, { opacity: 0 }, titleStart + 3.04);

  return tl;
}

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

// 开场数据卡：composer renderScene 产出真实 HTML（与成片一致）+ 真正的 GSAP 入场/强调动效随播放头同步。
// timeline paused，currentTime 变化时 seek 到对应秒数——播放/拖播放头即可看到数字弹大、icon-cloud 逐个揭示、
// browser 框入场等过程态（而非静态基态）。编辑字段→html 重渲染→timeline 在新 DOM 上重建并 seek 回当前时刻。
function StatsHeroFrame({ card, frameStyle, currentTime, videoHidden }: { card: PlanCard; frameStyle: CSSProperties; currentTime?: number; videoHidden?: boolean }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const timeRef = useRef(0);
  const html = useMemo(() => {
    try {
      return renderScene(toScene(card)) as string;
    } catch {
      return null;
    }
  }, [card]);

  // 建/重建 timeline：html 变（编辑字段）或卡 id 变时，在最新 DOM 上重建并 seek 回当前时刻。
  // biome-ignore lint/correctness/useExhaustiveDependencies: html 即 props 的派生，timeRef 是命令式句柄，故意不入依赖。
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !html) return;
    const ctx = gsap.context(() => {
      const tl = buildStatsHeroTimeline(card.id);
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
  const isStatsHero = card.engine?.component === "StatsHero";

  if (isStatsHero) {
    return <StatsHeroFrame card={card} frameStyle={frameStyle} currentTime={currentTime} videoHidden={videoHidden} />;
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
