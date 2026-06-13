import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { cardTypeLabel, type CardType, type PlanCard } from "../lib/packaging-plan";
import "./CardVisual.css";

type CardVisualVariant = CardType | "stats-hero" | "step" | "title";

interface CardVisualModel {
  variant: CardVisualVariant;
  accent: string;
  scale: number;
  kicker: string;
  title: string;
  subline: string;
  label: string;
  number: string;
  unit: string;
  items: string[];
}

export interface CardVisualProps {
  card: PlanCard;
  stageW: number;
  /** 画中画卡真合成：screen=底层内容视频、pip=右下角圆形数字人小窗（服务端可服务 URL）。 */
  mediaUrls?: { screen?: string | null; pip?: string | null } | null;
  /** 合成时间相对本卡起点的秒数（composeT - card.start），驱动 screen/pip 视频 currentTime 同步。 */
  currentTime?: number;
}

const DEFAULT_ACCENT = "#d8b25a";

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function statString(card: PlanCard, key: string): string | undefined {
  const stat = card.content.stat as Record<string, unknown> | undefined;
  return stringFrom(stat?.[key]);
}

function normalizeVariant(type: string): CardVisualVariant {
  if (type === "stats-hero" || type === "title" || type === "step") return type;
  return type as CardType;
}

export function cardVisualModel(card: PlanCard, stageW: number): CardVisualModel {
  const content = card.content;
  const variant = normalizeVariant(card.type);
  const fallbackLabel = cardTypeLabel((card.type as CardType) || "opening");
  const items = Array.isArray(content.items) && content.items.length > 0 ? content.items : ["核心信息", "视觉强调", "节奏提示"];
  return {
    variant,
    accent: stringFrom((card.color as { accent?: unknown } | undefined)?.accent) ?? DEFAULT_ACCENT,
    scale: Math.max(0.72, Math.min(1.18, stageW / 960)),
    kicker: content.chip ?? content.kicker ?? content.label ?? fallbackLabel,
    title: content.title ?? `${fallbackLabel}卡片`,
    subline: content.subline ?? "在右侧面板编辑文案、布局与动效。",
    label: content.label ?? content.cornerLeft ?? fallbackLabel,
    number: content.number ?? statString(card, "number") ?? "38",
    unit: content.unit ?? statString(card, "unit") ?? "%",
    items: items.slice(0, 4),
  };
}

function TitleStack({ model }: { model: CardVisualModel }) {
  return (
    <div className="cv-title-stack">
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-subline">{model.subline}</div>
      <div className="cv-stat-row">
        {model.items.slice(0, 2).map((item) => (
          <div className="cv-stat-pill" key={item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-step-list">
        {model.items.slice(0, 3).map((item, index) => (
          <div className="cv-step-item" key={item}>
            <span className="cv-step-index">{String(index + 1).padStart(2, "0")}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// 把 video.currentTime 同步到合成时间（相对本卡起点）。muted+playsInline，仅作画面预览。
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

function PipVisual({ model, mediaUrls, currentTime }: { model: CardVisualModel; mediaUrls?: { screen?: string | null; pip?: string | null } | null; currentTime?: number }) {
  const screenUrl = mediaUrls?.screen ?? null;
  const pipUrl = mediaUrls?.pip ?? null;
  const screenRef = useSyncedVideo(currentTime);
  const pipRef = useSyncedVideo(currentTime);
  return (
    <>
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-pip-stage">
        {/* 真合成：绑定后底层内容视频铺满 + 右下角圆形数字人小窗；未绑定保留占位示意。 */}
        {screenUrl ? (
          <video ref={screenRef} className="cv-pip-screen-video" src={screenUrl} muted playsInline preload="metadata" />
        ) : (
          <div className="cv-pip-screen-grid" />
        )}
        {pipUrl ? (
          <video ref={pipRef} className="cv-pip-window-video" src={pipUrl} muted playsInline preload="metadata" aria-label="数字人画中画" />
        ) : (
          <div className="cv-pip-window" aria-label="画中画窗口" />
        )}
      </div>
    </>
  );
}

function ComparisonVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-compare-grid">
        <div className="cv-compare-pane">
          <strong>之前</strong>
          <span>{model.items[0]}</span>
        </div>
        <div className="cv-compare-pane">
          <strong>之后</strong>
          <span>{model.items[1] ?? model.subline}</span>
        </div>
      </div>
    </>
  );
}

function DataProofVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-chip">{model.label}</div>
      <div className="cv-proof-number">
        {model.number}
        <span>{model.unit}</span>
      </div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-subline">{model.subline}</div>
    </>
  );
}

function DemoAnnotationVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-demo-stage">
        <div className="cv-demo-grid" />
        <div className="cv-annotation-box" />
        <div className="cv-annotation-arrow" />
      </div>
    </>
  );
}

function ProductVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-product-badges">
        {model.items.slice(0, 4).map((item) => (
          <div className="cv-product-badge" key={item}>
            {item}
          </div>
        ))}
      </div>
    </>
  );
}

function InfoVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-info-map">
        {model.items.slice(0, 3).map((item, index) => (
          <div className="cv-info-pair" key={item}>
            {index > 0 ? <div className="cv-info-link" /> : null}
            <div className="cv-info-node">{item}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function CtaVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-chip">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-subline">{model.subline}</div>
      <div className="cv-cta-button">{model.items[0] ?? "立即行动"}</div>
    </>
  );
}

function CaptionVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-caption-line">{model.subline}</div>
    </>
  );
}

function TransitionVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-transition-line" />
      <div className="cv-subline">{model.subline}</div>
    </>
  );
}

function RhythmVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-kicker">{model.kicker}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-rhythm-bars">
        {[0.34, 0.72, 0.48, 0.9, 0.58, 0.78].map((height, index) => (
          <div className="cv-rhythm-bar" key={index} style={{ height: `${height * 100}%` }} />
        ))}
      </div>
    </>
  );
}

function BrandVisual({ model }: { model: CardVisualModel }) {
  return (
    <>
      <div className="cv-brand-mark">{model.title.slice(0, 1)}</div>
      <h3 className="cv-title">{model.title}</h3>
      <div className="cv-subline">{model.subline}</div>
    </>
  );
}

function renderVariant(model: CardVisualModel, pip?: { mediaUrls?: CardVisualProps["mediaUrls"]; currentTime?: number }): ReactNode {
  switch (model.variant) {
    case "step":
      return <StepVisual model={model} />;
    case "pip":
      return <PipVisual model={model} mediaUrls={pip?.mediaUrls} currentTime={pip?.currentTime} />;
    case "comparison":
      return <ComparisonVisual model={model} />;
    case "data-proof":
      return <DataProofVisual model={model} />;
    case "demo-annotation":
      return <DemoAnnotationVisual model={model} />;
    case "product-highlight":
      return <ProductVisual model={model} />;
    case "info-structure":
      return <InfoVisual model={model} />;
    case "cta":
      return <CtaVisual model={model} />;
    case "caption":
      return <CaptionVisual model={model} />;
    case "transition":
      return <TransitionVisual model={model} />;
    case "mv-rhythm":
      return <RhythmVisual model={model} />;
    case "brand":
      return <BrandVisual model={model} />;
    case "opening":
    case "stats-hero":
    case "title":
    default:
      return <TitleStack model={model} />;
  }
}

export function CardVisual({ card, stageW, mediaUrls, currentTime }: CardVisualProps) {
  const model = cardVisualModel(card, stageW);
  const style = {
    "--cv-accent": model.accent,
    "--cv-accent-soft": `${model.accent}2a`,
    "--cv-scale": model.scale,
  } as CSSProperties;

  return (
    <div className={`cv-card cv-${model.variant}`} style={style}>
      <div className="cv-inner">{renderVariant(model, { mediaUrls, currentTime })}</div>
    </div>
  );
}

export default CardVisual;
