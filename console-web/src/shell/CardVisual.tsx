// 预览卡片 = composer 真实卡片（单一真相）。直接调用 composer 的纯渲染函数 renderScene(scene) 产出与最终成片
// 完全一致的 HTML，套用 composer 那套设计 CSS（composer-card.css，scope 到 .hf-frame），在 1920×1080 整帧里
// 渲染后按 stageW/1920 缩放进画布——比例/留白/字号/排版与渲染成片一致，不再是手搓近似小方块。
//
// 画中画卡（ScreenWithPip）需要预览里随播放头同步的真实绑定视频（mediaUrls.screen/pip），所以用 composer 的
// screen-proof/screen-shell/circle-pip 结构 + 类名（同一套 CSS 比例）+ 我们的 live <video>，而非 renderScene 的静态视频标记。
import { type CSSProperties, useEffect, useRef } from "react";
import { renderScene } from "../../../hyperframes-composer/components/registry.mjs";
import type { PlanCard } from "../lib/packaging-plan";
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

// 画中画卡：composer 的 screen-proof 结构（同 CSS 比例）+ 绑定的 live 视频；未绑则空壳占位。
function PipFrame({ card, mediaUrls, currentTime }: { card: PlanCard; mediaUrls?: CardVisualProps["mediaUrls"]; currentTime?: number }) {
  const props = (card.engine?.props as Record<string, unknown>) ?? {};
  const label = typeof props.label === "string" ? props.label : "";
  const screenUrl = mediaUrls?.screen ?? null;
  const pipUrl = mediaUrls?.pip ?? null;
  const screenRef = useSyncedVideo(currentTime);
  const pipRef = useSyncedVideo(currentTime);
  return (
    <div className="clip scene screen-proof">
      <div className="screen-label">{label}</div>
      <div className="screen-shell">
        {screenUrl ? <video ref={screenRef} src={screenUrl} muted playsInline preload="metadata" /> : null}
      </div>
      <div className="circle-pip">
        {pipUrl ? <video ref={pipRef} src={pipUrl} muted playsInline preload="metadata" /> : null}
      </div>
    </div>
  );
}

export function CardVisual({ card, stageW, mediaUrls, currentTime }: CardVisualProps) {
  const scale = stageW > 0 ? stageW / FRAME_W : 0.4;
  const frameStyle: CSSProperties = { width: FRAME_W, height: FRAME_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 };
  const isPip = card.engine?.component === "ScreenWithPip";

  if (isPip) {
    return (
      <div className="hf-frame" data-has-source-video="1" style={frameStyle}>
        <PipFrame card={card} mediaUrls={mediaUrls} currentTime={currentTime} />
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
    return <div className="hf-frame" style={frameStyle} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  // 兜底：用 composer 的标题样式呈现卡片标题（仍走同一套 CSS，不丑）。
  const title = card.content?.title ?? card.content?.kicker ?? card.id;
  return (
    <div className="hf-frame" style={frameStyle}>
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
