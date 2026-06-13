import { f } from "./html.mjs";
import { sanitizeAnimation } from "./rich.mjs";

function line(text) {
  return `      ${text}`;
}

function richAnimationSelector(scene) {
  if (scene.component === "TitleCard") return `#${scene.id} .title-block`;
  if (scene.component === "HeroAroll") return `#${scene.id} .clean-aroll-hero-copy`;
  if (scene.component === "ProofMontage") return `#${scene.id} .proof-grid`;
  return null;
}

function richAnimationFrom(name) {
  if (name === "fade") return `{ opacity: 0 }`;
  if (name === "fade-up" || name === "slide-up") return `{ opacity: 0, y: 28 }`;
  if (name === "slide-left") return `{ opacity: 0, x: 42 }`;
  if (name === "scale-in" || name === "scale-soft") return `{ opacity: 0, scale: 0.96 }`;
  return null;
}

function richAnimationTo(name) {
  if (name === "fade") return `{ opacity: 0 }`;
  if (name === "fade-down") return `{ opacity: 0, y: 28 }`;
  if (name === "slide-left") return `{ opacity: 0, x: -42 }`;
  if (name === "slide-right") return `{ opacity: 0, x: 42 }`;
  if (name === "scale-out" || name === "scale-soft") return `{ opacity: 0, scale: 0.98 }`;
  return null;
}

function renderRichAnimation(scene) {
  const animation = sanitizeAnimation(scene);
  const selector = richAnimationSelector(scene);
  if (!animation || !selector) return [];

  const lines = [`// rich animation: ${scene.id}`];
  if (animation.in) {
    lines.push(`tl.fromTo("${selector}", ${richAnimationFrom(animation.in)}, { opacity: 1, x: 0, y: 0, scale: 1, duration: ${f(animation.duration)}, ease: "${animation.ease}" }, ${f(scene.start)});`);
  }
  if (animation.out) {
    const outStart = Math.max(scene.start, scene.start + Math.max(0, scene.duration - animation.outDuration));
    lines.push(`tl.to("${selector}", ${richAnimationTo(animation.out).replace(" }", `, duration: ${f(animation.outDuration)}, ease: "${animation.outEase}" }`)}, ${f(outStart)});`);
  }
  return lines;
}

export function renderTimelineScript(manifest) {
  const lines = [
    "window.__timelines = window.__timelines || {};",
    "const tl = gsap.timeline({ paused: true });",
  ];

  const byId = new Map((manifest.scenes || []).map((scene) => [scene.id, scene]));

  const stats = [...byId.values()].find((scene) => scene.component === "StatsHero");
  if (stats) {
    const p = stats.parts || {};
    const statStart = p.stat?.start ?? stats.start + 0.705;
    const browserStart = p.browser?.start ?? stats.start + 2.539;
    const titleStart = p.title?.start ?? stats.start + 9.781;
    lines.push(
      `tl.from("#${stats.id}-stat", { opacity: 0, duration: 0.001 }, ${f(statStart)});`,
      `tl.from("#${stats.id}-stat", { clipPath: "inset(0 100% 0 0)", duration: 0.30, ease: "power2.inOut" }, ${f(statStart)});`,
      `tl.fromTo("#${stats.id}-stat .stat-pack", { opacity: 0.62, x: 124, y: -66, scale: 0.72 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.70, ease: "power3.out" }, ${f(statStart + 0.15)});`,
      `tl.from("#${stats.id}-stat .stat-shell", { opacity: 0, scale: 0.78, duration: 0.24, ease: "power3.out" }, ${f(statStart + 0.27)});`,
      `tl.from("#${stats.id}-stat .stat-label", { opacity: 0, x: -16, duration: 0.18, ease: "power2.out" }, ${f(statStart + 0.57)});`,
      `tl.fromTo("#${stats.id}-stat .stat-number", { opacity: 0, x: -34, scale: 0.52 }, { opacity: 1, x: 0, scale: 1.18, duration: 0.18, ease: "power4.out" }, ${f(statStart + 0.65)});`,
      `tl.to("#${stats.id}-stat .stat-number", { scale: 1, duration: 0.18, ease: "power2.out" }, ${f(statStart + 0.83)});`,
      `tl.from("#${stats.id}-stat .stat-unit", { opacity: 0, x: -20, scale: 0.65, duration: 0.18, ease: "power3.out" }, ${f(statStart + 0.83)});`,
      `tl.from("#${stats.id}-stat .stat-title", { opacity: 0, y: 12, duration: 0.18, ease: "power2.out" }, ${f(statStart + 0.95)});`,
      `tl.to("#${stats.id}-stat .stat-pack", { x: -18, y: 8, scale: 1.065, duration: 0.86, ease: "power1.out" }, ${f(statStart + 0.95)});`,
      `tl.to("#${stats.id}-stat", { opacity: 0, duration: 0.18, ease: "power1.out" }, ${f(statStart + 2.0)});`,
      `tl.set("#${stats.id}-stat", { opacity: 0 }, ${f(statStart + 2.24)});`,
      `tl.fromTo("#${stats.id}-browser .browser-stage", { opacity: 0, x: -360, y: 22, scale: 0.72, clipPath: "inset(0 88% 0 0)" }, { opacity: 1, x: 0, y: 0, scale: 1, clipPath: "inset(0 0% 0 0)", duration: 0.66, ease: "power3.out" }, ${f(browserStart)});`,
      `tl.fromTo("#${stats.id}-browser .browser-video-card", { opacity: 0.72, x: -260, y: 18, scale: 0.58, clipPath: "inset(0 82% 0 0)" }, { opacity: 1, x: 12, y: 0, scale: 1.15, clipPath: "inset(0 0% 0 0)", duration: 0.18, ease: "power4.out" }, ${f(browserStart + 0.11)});`,
      `tl.to("#${stats.id}-browser .browser-video-card", { x: 0, y: 0, scale: 1, duration: 0.24, ease: "power2.out" }, ${f(browserStart + 0.30)});`,
      `tl.from("#${stats.id}-browser .icon-cloud span", { opacity: 0, scale: 0.25, stagger: 0.035, duration: 0.16, ease: "power2.out" }, ${f(browserStart + 0.40)});`,
      `tl.to("#${stats.id}-browser .browser-stage", { x: 18, y: -8, scale: 1.018, duration: 0.72, ease: "power1.inOut" }, ${f(browserStart + 0.67)});`,
      `tl.to("#${stats.id}-browser .browser-video-card", { x: 14, y: 8, scale: 1.035, duration: 0.75, ease: "power1.inOut" }, ${f(browserStart + 0.69)});`,
      `tl.to("#${stats.id}-browser .browser-stage", { x: 7, y: 0, scale: 1.006, duration: 0.45, ease: "power1.out" }, ${f(browserStart + 1.39)});`,
      `tl.to("#${stats.id}-browser .browser-video-card", { x: 4, y: 0, scale: 1.01, duration: 0.55, ease: "power1.out" }, ${f(browserStart + 1.45)});`,
      `tl.to("#${stats.id}-browser", { opacity: 0, duration: 0.16, ease: "power1.out" }, ${f((p.return?.start ?? stats.start + 8.448) - 0.12)});`,
      `tl.set("#${stats.id}-browser", { opacity: 0 }, ${f(p.return?.start ?? stats.start + 8.448)});`,
      `tl.from("#${stats.id}-title", { opacity: 0, duration: 0.001 }, ${f(titleStart)});`,
      `tl.from("#${stats.id}-title", { clipPath: "inset(0 100% 0 0)", duration: 0.34, ease: "power2.inOut" }, ${f(titleStart)});`,
      `tl.from("#${stats.id}-title .main-title", { opacity: 0, x: -20, filter: "blur(6px)", duration: 0.38, ease: "power3.out" }, ${f(titleStart + 0.33)});`,
      `tl.from("#${stats.id}-title .title-kicker", { opacity: 0, y: 10, duration: 0.22, ease: "power2.out" }, ${f(titleStart + 0.45)});`,
      `tl.from("#${stats.id}-title .title-sub", { opacity: 0, y: 10, duration: 0.22, ease: "power2.out" }, ${f(titleStart + 0.73)});`,
      `tl.from("#${stats.id}-title .underline-stack i", { scaleX: 0, stagger: 0.10, duration: 0.28, ease: "none" }, ${f(titleStart + 1.42)});`,
      `tl.to("#${stats.id}-title", { opacity: 0, duration: 0.22, ease: "power1.in" }, ${f(titleStart + 2.84)});`,
      `tl.set("#${stats.id}-title", { opacity: 0 }, ${f(titleStart + 3.04)});`
    );
  }

  lines.push(`function screenTimeline(id, scanId, start, panDuration) {
        tl.from("#" + scanId, { left: 1810, opacity: 0, duration: 0.36, ease: "power2.inOut" }, start - 0.22);
        tl.to("#" + scanId, { opacity: 0, duration: 0.08, ease: "power1.out" }, start + 0.18);
        tl.from("#" + id + " .screen-shell", { opacity: 0, x: -120, scale: 0.97, duration: 0.42, ease: "power3.out" }, start);
        tl.from("#" + id + " .screen-label", { opacity: 0, x: -18, duration: 0.20, ease: "power2.out" }, start + 0.26);
        tl.from("#" + id + " .circle-pip", { opacity: 0, scale: 0.70, duration: 0.30, ease: "back.out(1.7)" }, start + 0.42);
        tl.to("#" + id + " .screen-shell", { x: 18, scale: 1.01, duration: panDuration, ease: "none" }, start + 0.90);
      }`);

  for (const scene of manifest.scenes || []) {
    lines.push(...renderRichAnimation(scene));

    if (scene.component === "StepCard") {
      lines.push(
        `tl.from("#${scene.id} .step-panel", { opacity: 0, y: 34, scale: 0.96, duration: 0.42, ease: "power3.out" }, ${f(scene.start)});`,
        `tl.from("#${scene.id} .step-kicker", { opacity: 0, x: -18, duration: 0.18, ease: "power2.out" }, ${f(scene.start + 0.27)});`,
        `tl.from("#${scene.id} .step-title", { opacity: 0, y: 24, duration: 0.30, ease: "power2.out" }, ${f(scene.start + 0.45)});`,
        `tl.from("#${scene.id} .step-item", { opacity: 0, y: 18, stagger: 0.09, duration: 0.22, ease: "power2.out" }, ${f(scene.start + 0.89)});`
      );
    }
    if (scene.component === "ScreenWithPip") {
      lines.push(`screenTimeline("${scene.id}", "${scene.props.scan?.id || `scan-${scene.scene || scene.id}`}", ${f(scene.start)}, ${f(scene.props.panDuration ?? Math.max(0.001, scene.duration - 2))});`);
    }
    if (scene.component === "SplitTextPresenter" && scene.props.variant === "definition") {
      lines.push(`tl.set("#${scene.id} .def-panel", { opacity: 0 }, ${f(scene.start)});`);
      for (const panel of scene.props.panels || []) {
        const end = panel.start + panel.duration;
        lines.push(
          `tl.fromTo("#${scene.id} .${panel.kind}", { opacity: 0, x: 90, scale: 0.985 }, { opacity: 1, x: 0, scale: 1, duration: 0.44, ease: "power3.out" }, ${f(panel.start + 0.05)});`,
          `tl.from("#${scene.id} .${panel.kind} .def-kicker", { opacity: 0, x: -22, duration: 0.22, ease: "power2.out" }, ${f(panel.start + 0.21)});`,
          `tl.from("#${scene.id} .${panel.kind} .def-title", { opacity: 0, y: 28, filter: "blur(8px)", duration: 0.36, ease: "power3.out" }, ${f(panel.start + 0.39)});`,
          `tl.from("#${scene.id} .${panel.kind} .def-sub", { opacity: 0, y: 18, duration: 0.28, ease: "power2.out" }, ${f(panel.start + 0.65)});`,
          `tl.from("#${scene.id} .${panel.kind} .def-code", { opacity: 0, y: 22, stagger: 0.10, duration: 0.26, ease: "power2.out" }, ${f(panel.start + 0.87)});`,
          `tl.from("#${scene.id} .${panel.kind} .def-callout", { scaleX: 0, transformOrigin: "left center", duration: 0.38, ease: "power2.out" }, ${f(panel.start + 1.13)});`,
          `tl.from("#${scene.id} .${panel.kind} .def-presenter", { opacity: 0, x: 150, duration: 0.38, ease: "power3.out" }, ${f(panel.start + 0.72)});`
        );
        if (!panel.holdLast) lines.push(`tl.to("#${scene.id} .${panel.kind}", { opacity: 0, x: -36, duration: 0.22, ease: "power1.out" }, ${f(end - 0.22)});`);
        else lines.push(`tl.to("#${scene.id} .${panel.kind}", { x: -18, scale: 1.012, duration: ${f(Math.max(0.001, panel.duration - 1.0))}, ease: "none" }, ${f(panel.start + 1.86)});`);
      }
    }
    if (scene.component === "SplitTextPresenter" && scene.props.variant === "course") {
      lines.push(
        `tl.from("#${scene.id}", { opacity: 0, duration: 0.001 }, ${f(scene.start)});`,
        `tl.from("#${scene.id} .course-chip", { opacity: 0, x: -18, duration: 0.18, ease: "power2.out" }, ${f(scene.start + 0.10)});`,
        `tl.from("#${scene.id} .course-heading", { opacity: 0, y: 26, filter: "blur(6px)", duration: 0.34, ease: "power3.out" }, ${f(scene.start + 0.20)});`,
        `tl.fromTo("#${scene.id} .course-card", { opacity: 0, x: -34, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, x: 0, clipPath: "inset(0 0% 0 0)", stagger: 0.18, duration: 0.34, ease: "power3.out" }, ${f(scene.start + 0.40)});`,
        `tl.from("#${scene.id} .card-icon", { opacity: 0, scale: 0.72, stagger: 0.18, duration: 0.18, ease: "back.out(1.7)" }, ${f(scene.start + 0.60)});`,
        `tl.from("#${scene.id} .course-big", { opacity: 0, y: 14, stagger: 0.08, duration: 0.20, ease: "power2.out" }, ${f(scene.start + 0.80)});`,
        `tl.from("#${scene.id} .course-line", { scaleX: 0, duration: 3.7, ease: "none" }, ${f(scene.start + 0.96)});`,
        `tl.fromTo("#${scene.id} .course-presenter", { opacity: 0, x: 300, clipPath: "inset(0 0 0 100%)" }, { opacity: 1, x: 0, clipPath: "inset(0 0 0 0%)", duration: 0.46, ease: "power3.out" }, ${f(scene.start + 1.36)});`,
        `tl.to("#${scene.id} .course-layout", { x: -18, duration: ${f(Math.max(0.001, scene.duration - 4.0))}, ease: "none" }, ${f(scene.start + 2.18)});`,
        `tl.to("#${scene.id} .course-presenter", { x: -18, scale: 1.018, duration: ${f(Math.max(0.001, scene.duration - 4.0))}, ease: "none" }, ${f(scene.start + 2.13)});`
      );
    }
    if (scene.component === "SummaryCta") {
      lines.push(
        `tl.from("#${scene.id} .clean-aroll-copy", { opacity: 0, x: -26, duration: 0.42, ease: "power3.out" }, ${f(scene.start + 0.78)});`,
        `tl.from("#${scene.id} .clean-title", { opacity: 0, y: 18, filter: "blur(6px)", duration: 0.34, ease: "power3.out" }, ${f(scene.start + 1.02)});`,
        `tl.to("#v-${scene.id}-aroll-video", { scale: 1.018, duration: ${f(Math.max(0.001, scene.duration - 1.28))}, ease: "none" }, ${f(scene.start + 0.68)});`
      );
    }
  }

  lines.push("window.__timelines[\"" + (manifest.compositionId || "main") + "\"] = tl;");
  return lines.map(line).join("\n");
}
