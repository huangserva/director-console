export const COMPOSER_CARD_CSS_HEADER = `/* 由 hyperframes-composer/components/hyperframes-tech-talk.css 派生（scope 到 .hf-frame）。
   预览卡片 = composer 真实卡片样式，单一真相。改 composer CSS 后用 scripts 重新生成（见 research）。 */
`;

export const VIDEO_HIDDEN_APPENDIX = `/* 视频轨隐藏（👁）：卡片内 composer 内嵌的 <video>（如 StatsHero 的 source-video / browser-video-card）
   随主源一起隐藏，保留挂载不卸载。画中画卡的 screen/pip 视频 + 图片 screen 由 CardVisual 内联 visibility 处理。 */
.hf-frame[data-video-hidden="1"] video { visibility: hidden; }
`;

function scopeSelector(selector: string): string {
  const trimmed = selector.trim();
  if (trimmed === "*") return ".hf-frame, .hf-frame *";
  if (trimmed === "html" || trimmed === "body") return ".hf-frame";
  if (trimmed.startsWith("#root")) return `.hf-frame${trimmed.slice("#root".length)}`;
  return `.hf-frame ${trimmed}`;
}

export function scopeComposerCss(composerCss: string): string {
  const blocks: string[] = [];
  const rulePattern = /([^{}]+)\{([^{}]+)\}/g;

  for (const match of composerCss.matchAll(rulePattern)) {
    const [, selectorSource, bodySource] = match;
    const selector = selectorSource
      .split(",")
      .map(scopeSelector)
      .join(", ");
    blocks.push(`${selector} {${bodySource}}`);
  }

  return `${blocks.join("\n")}\n`;
}

export function expectedComposerCardCss(composerCss: string): string {
  return `${COMPOSER_CARD_CSS_HEADER}${scopeComposerCss(composerCss)}\n\n\n${VIDEO_HIDDEN_APPENDIX}`;
}

export interface StatsHeroTimelineGuardCheck {
  label: string;
  composerNeedles: string[];
  previewNeedles: string[];
}

export function statsHeroTimelineGuardChecks(): StatsHeroTimelineGuardCheck[] {
  return [
    {
      label: "stat reveal",
      composerNeedles: [
        'tl.from("#${stats.id}-stat", { clipPath: "inset(0 100% 0 0)", duration: 0.30, ease: "power2.inOut" }, ${f(statStart)});',
        'tl.fromTo("#${stats.id}-stat .stat-pack", { opacity: 0.62, x: 124, y: -66, scale: 0.72 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.70, ease: "power3.out" }, ${f(statStart + 0.15)});',
      ],
      previewNeedles: [
        'tl.from(`#${id}-stat`, { clipPath: "inset(0 100% 0 0)", duration: 0.3, ease: "power2.inOut" }, statStart);',
        'tl.fromTo(`#${id}-stat .stat-pack`, { opacity: 0.62, x: 124, y: -66, scale: 0.72 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.7, ease: "power3.out" }, statStart + 0.15);',
      ],
    },
    {
      label: "stat number emphasis",
      composerNeedles: [
        'tl.fromTo("#${stats.id}-stat .stat-number", { opacity: 0, x: -34, scale: 0.52 }, { opacity: 1, x: 0, scale: 1.18, duration: 0.18, ease: "power4.out" }, ${f(statStart + 0.65)});',
        'tl.to("#${stats.id}-stat .stat-number", { scale: 1, duration: 0.18, ease: "power2.out" }, ${f(statStart + 0.83)});',
      ],
      previewNeedles: [
        'tl.fromTo(`#${id}-stat .stat-number`, { opacity: 0, x: -34, scale: 0.52 }, { opacity: 1, x: 0, scale: 1.18, duration: 0.18, ease: "power4.out" }, statStart + 0.65);',
        'tl.to(`#${id}-stat .stat-number`, { scale: 1, duration: 0.18, ease: "power2.out" }, statStart + 0.83);',
      ],
    },
    {
      label: "browser entrance and icon stagger",
      composerNeedles: [
        'tl.fromTo("#${stats.id}-browser .browser-stage", { opacity: 0, x: -360, y: 22, scale: 0.72, clipPath: "inset(0 88% 0 0)" }, { opacity: 1, x: 0, y: 0, scale: 1, clipPath: "inset(0 0% 0 0)", duration: 0.66, ease: "power3.out" }, ${f(browserStart)});',
        'tl.from("#${stats.id}-browser .icon-cloud span", { opacity: 0, scale: 0.25, stagger: 0.035, duration: 0.16, ease: "power2.out" }, ${f(browserStart + 0.40)});',
      ],
      previewNeedles: [
        'tl.fromTo(`#${id}-browser .browser-stage`, { opacity: 0, x: -360, y: 22, scale: 0.72, clipPath: "inset(0 88% 0 0)" }, { opacity: 1, x: 0, y: 0, scale: 1, clipPath: "inset(0 0% 0 0)", duration: 0.66, ease: "power3.out" }, browserStart);',
        'tl.from(`#${id}-browser .icon-cloud span`, { opacity: 0, scale: 0.25, stagger: 0.035, duration: 0.16, ease: "power2.out" }, browserStart + 0.4);',
      ],
    },
    {
      label: "browser return",
      composerNeedles: [
        'tl.to("#${stats.id}-browser", { opacity: 0, duration: 0.16, ease: "power1.out" }, ${f((p.return?.start ?? stats.start + 8.448) - 0.12)});',
        'tl.set("#${stats.id}-browser", { opacity: 0 }, ${f(p.return?.start ?? stats.start + 8.448)});',
      ],
      previewNeedles: [
        'tl.to(`#${id}-browser`, { opacity: 0, duration: 0.16, ease: "power1.out" }, returnStart - 0.12);',
        'tl.set(`#${id}-browser`, { opacity: 0 }, returnStart);',
      ],
    },
    {
      label: "title entrance and underline",
      composerNeedles: [
        'tl.from("#${stats.id}-title .title-kicker", { opacity: 0, y: 10, duration: 0.22, ease: "power2.out" }, ${f(titleStart + 0.45)});',
        'tl.from("#${stats.id}-title .underline-stack i", { scaleX: 0, stagger: 0.10, duration: 0.28, ease: "none" }, ${f(titleStart + 1.42)});',
      ],
      previewNeedles: [
        'tl.from(`#${id}-title .title-kicker`, { opacity: 0, y: 10, duration: 0.22, ease: "power2.out" }, titleStart + 0.45);',
        'tl.from(`#${id}-title .underline-stack i`, { scaleX: 0, stagger: 0.1, duration: 0.28, ease: "none" }, titleStart + 1.42);',
      ],
    },
  ];
}
