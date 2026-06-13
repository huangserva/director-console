import { esc } from "./html.mjs";

const FONT_SIZE_MIN = 16;
const FONT_SIZE_MAX = 120;
const BASE_W = 1280;
const BASE_H = 720;
const OUTPUT_W = 1920;
const OUTPUT_H = 1080;
const SAFE_INSET = 0.06;
const FONT_WEIGHTS = new Set([400, 500, 600, 700, 800, 900, 950]);
const LAYOUT_TARGETS = new Set(["primary"]);
const ANIMATION_COMPONENTS = new Set(["TitleCard", "HeroAroll", "ProofMontage"]);
const ANIMATION_IN = new Set(["fade", "fade-up", "slide-up", "slide-left", "scale-in", "scale-soft"]);
const ANIMATION_OUT = new Set(["fade", "fade-down", "slide-left", "slide-right", "scale-out", "scale-soft"]);
const ANIMATION_EASE = new Set(["none", "power1.in", "power1.out", "power2.in", "power2.out", "power3.in", "power3.out"]);
const COLOR_VARS = new Map([
  ["accent", "--hf-accent"],
  ["bg", "--hf-bg"],
  ["text", "--hf-text"],
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function richTarget(value, target) {
  if (!isPlainObject(value)) return {};
  if (isPlainObject(value[target])) return value[target];
  return value;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeFont(font = {}) {
  const vars = {};
  if (typeof font.size === "number" && Number.isFinite(font.size)) {
    vars["--hf-font-size"] = `${clampNumber(font.size, FONT_SIZE_MIN, FONT_SIZE_MAX)}px`;
  }
  if (typeof font.weight === "number" && FONT_WEIGHTS.has(font.weight)) {
    vars["--hf-font-weight"] = String(font.weight);
  }
  return vars;
}

function sanitizeColorValue(value) {
  if (typeof value !== "string") return null;
  const color = value.trim();
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color)) return color;
  if (/^rgba?\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(color)) {
    return color;
  }
  return null;
}

function sanitizeColor(color = {}) {
  const vars = {};
  for (const [key, variable] of COLOR_VARS) {
    const value = sanitizeColorValue(color[key]);
    if (value) vars[variable] = value;
  }
  return vars;
}

function sanitizeLayout(layout = {}, target = "root") {
  if (!isPlainObject(layout) || target === "root" || layout.target !== target || !LAYOUT_TARGETS.has(target)) {
    return { vars: {}, layoutTarget: null };
  }
  const values = ["x", "y", "w", "h"].map((key) => layout[key]);
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return { vars: {}, layoutTarget: null };

  const bounds =
    layout.safeAreaLock === true
      ? {
          minX: SAFE_INSET * BASE_W,
          minY: SAFE_INSET * BASE_H,
          maxX: (1 - SAFE_INSET) * BASE_W,
          maxY: (1 - SAFE_INSET) * BASE_H,
        }
      : { minX: 0, minY: 0, maxX: BASE_W, maxY: BASE_H };
  const maxW = bounds.maxX - bounds.minX;
  const maxH = bounds.maxY - bounds.minY;
  const w = clampNumber(layout.w, 1, maxW);
  const h = clampNumber(layout.h, 1, maxH);
  const x = clampNumber(layout.x, bounds.minX, bounds.maxX - w);
  const y = clampNumber(layout.y, bounds.minY, bounds.maxY - h);
  const sx = OUTPUT_W / BASE_W;
  const sy = OUTPUT_H / BASE_H;
  return {
    layoutTarget: target,
    vars: {
      "--hf-x": `${Math.round(x * sx)}px`,
      "--hf-y": `${Math.round(y * sy)}px`,
      "--hf-w": `${Math.round(w * sx)}px`,
      "--hf-h": `${Math.round(h * sy)}px`,
    },
  };
}

function sanitizeDuration(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return clampNumber(value, 0.05, 2);
}

export function sanitizeAnimation(scene) {
  const animation = scene?.props?.animation;
  if (!ANIMATION_COMPONENTS.has(scene?.component) || !isPlainObject(animation)) return null;
  if (scene.component === "HeroAroll" && !(scene.props?.chip || scene.props?.title || scene.props?.subline)) return null;
  const input = typeof animation.in === "string" && ANIMATION_IN.has(animation.in) ? animation.in : null;
  const output = typeof animation.out === "string" && ANIMATION_OUT.has(animation.out) ? animation.out : null;
  if (!input && !output) return null;

  return {
    in: input,
    out: output,
    duration: sanitizeDuration(animation.duration, 0.42),
    outDuration: sanitizeDuration(animation.outDuration, 0.3),
    ease: typeof animation.ease === "string" && ANIMATION_EASE.has(animation.ease) ? animation.ease : "power2.out",
    outEase: typeof animation.outEase === "string" && ANIMATION_EASE.has(animation.outEase) ? animation.outEase : "power1.in",
  };
}

export function richAnimationAttrs(scene) {
  const animation = sanitizeAnimation(scene);
  if (!animation) return "";
  const input = animation.in ? ` data-rich-animation="${esc(animation.in)}"` : "";
  const output = animation.out ? ` data-rich-animation-out="${esc(animation.out)}"` : "";
  return `${input}${output}`;
}

export function sanitizeRichFields(scene, target = "root") {
  const props = scene?.props || {};
  const layout = sanitizeLayout(props.layout, target);
  return {
    ...sanitizeColor(richTarget(props.style?.color, target)),
    ...sanitizeFont(richTarget(props.style?.font, target)),
    ...layout.vars,
  };
}

export function richAttrs(scene, target = "root") {
  const vars = sanitizeRichFields(scene, target);
  const layout = sanitizeLayout(scene?.props?.layout, target);
  const animationAttrs = richAnimationAttrs(scene);
  const style = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  const layoutAttr = layout.layoutTarget ? ` data-rich-layout="${esc(layout.layoutTarget)}"` : "";
  if (!style && !animationAttrs) return "";
  const styleAttr = style ? ` style="${esc(style)}"` : "";
  return ` data-rich-render="1"${layoutAttr}${animationAttrs}${styleAttr}`;
}
