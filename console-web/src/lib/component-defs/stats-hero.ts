// 开场数据卡 StatsHero —— 样板组件：专属表单 + sample preset + 真 GSAP 动效。
// 动效逐字 port 自 composer timelines.mjs 的 StatsHero 分支（scene.start=0 独立轴，offset 即 stats.start+x 的 x）。
// Guarded by composer-guards.test.ts: if composer timelines.mjs changes StatsHero tweens, update this port intentionally.
import { gsap } from "gsap";
import { defaultPropsFor } from "../scene-templates";
import type { ComponentDef } from "./types";

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

export const statsHeroDef: ComponentDef = {
  component: "StatsHero",
  formSchema: [
    {
      title: "数据块",
      fields: [
        { kind: "text", path: "stat.cornerLeft", label: "角标", hint: "左上角的小角标文字" },
        { kind: "text", path: "stat.label", label: "标签", hint: "数字上方的小标题（如 增长）" },
        { kind: "text", path: "stat.number", label: "数字", hint: "核心大数字（如 38），入场会弹大强调" },
        { kind: "text", path: "stat.unit", label: "单位", hint: "数字后的单位（如 % / 个 / 倍）" },
        { kind: "text", path: "stat.title", label: "统计标题", hint: "数字下方说明这组数据的含义（如 转化提升）" },
      ],
    },
    {
      title: "浏览器框",
      fields: [
        { kind: "text", path: "browser.done", label: "完成标", hint: "浏览器框右上角的完成提示（如 完成）" },
        { kind: "list", path: "browser.icons", label: "图标列表", hint: "浏览器框里逐个揭示的小图标，可增删", addLabel: "+ 添加图标", newItem: "新图标" },
      ],
    },
    {
      title: "标题块",
      fields: [
        { kind: "text", path: "titleBeat.kicker", label: "眉标", hint: "主标题上方的小字（如 开场）" },
        { kind: "text", path: "titleBeat.title", label: "主标题", hint: "数据卡收尾的大标题（如 标题节拍）" },
        { kind: "text", path: "titleBeat.subline", label: "副标题", hint: "主标题下方一句话点题" },
      ],
    },
  ],
  samplePreset: () => defaultPropsFor("StatsHero"),
  buildTimeline: buildStatsHeroTimeline,
};
