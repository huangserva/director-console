import fs from "node:fs";
import path from "node:path";

const packageRoot = path.resolve(import.meta.dirname, "..");
const composerRoot = path.resolve(packageRoot, "../../hyperframes-composer");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compactObject(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function loadCatalog() {
  return readJson(path.join(composerRoot, "components", "catalog.json"));
}

export const CARD_TYPES = [
  "opening",
  "caption",
  "product-highlight",
  "demo-annotation",
  "comparison",
  "pip",
  "data-proof",
  "info-structure",
  "mv-rhythm",
  "transition",
  "brand",
  "cta",
];

export const cardTypeToCoarse = readJson(path.join(packageRoot, "mappings", "card-type-to-coarse.json"));

const reverseMapping = new Map(
  Object.entries(cardTypeToCoarse).map(([cardType, mapping]) => [`${mapping.component}:${mapping.scene_type}`, cardType]),
);

const MANIFEST_TOP_LEVEL_FIELDS = new Set(["compositionId", "duration", "output", "hyperframesEntry", "audio", "scenes", "captions"]);

const defaultPropsByName = {
  defaultOpeningProps: () => ({
    media: { presenter: "TODO-bind-presenter.mp4" },
    stat: { label: "KEY", number: "1", unit: "x", title: "Opening proof" },
    titleBeat: { title: "Opening" },
    browser: { done: "Done", icons: ["AI", "CC", "CLI", "MCP"], mediaStart: 0 },
  }),
  defaultCaptionProps: () => ({
    cornerLeft: "CAPTION",
    cornerName: "Line",
    kicker: "Caption",
    title: "Caption line",
    subline: "Replace with subtitle text",
  }),
  defaultProductHighlightProps: () => ({
    kicker: "HIGHLIGHT",
    title: "Product highlight",
    items: ["Promise", "Feature", "Result"],
  }),
  defaultDemoAnnotationProps: () => ({
    label: "Demo",
    media: { screen: "TODO-bind-screen.mp4", pip: "TODO-bind-pip.mp4" },
  }),
  defaultComparisonProps: () => ({
    variant: "course",
    chip: "COMPARE",
    kicker: "Comparison",
    title: "Before and after",
    cards: [],
    media: { presenter: "TODO-bind-presenter.mp4" },
  }),
  defaultPipProps: () => ({
    label: "PIP",
    media: { screen: "TODO-bind-screen.mp4", pip: "TODO-bind-pip.mp4" },
  }),
  defaultDataProofProps: () => ({
    media: { items: [] },
  }),
  defaultInfoStructureProps: () => ({
    kicker: "STRUCTURE",
    title: "Information structure",
    items: ["Point one", "Point two", "Point three"],
  }),
  defaultMvRhythmProps: () => ({
    media: { presenter: "TODO-bind-presenter.mp4" },
  }),
  defaultTransitionProps: () => ({
    cornerLeft: "TRANSITION",
    cornerName: "Beat",
    kicker: "Transition",
    title: "Next section",
    subline: "Bridge copy",
  }),
  defaultBrandProps: () => ({
    cornerLeft: "BRAND",
    cornerName: "Identity",
    kicker: "Brand",
    title: "Brand message",
    subline: "Replace with positioning",
  }),
  defaultCtaProps: () => ({
    media: { presenter: "TODO-bind-presenter.mp4" },
    chip: "CTA",
    title: "Take the next step",
    subline: "Replace with offer",
  }),
};

function catalogComponent(componentId) {
  return loadCatalog().coarseSceneComponents.find((component) => component.id === componentId);
}

function explicitCardType(scene) {
  const cardType = scene.props?.__packagingPlan?.cardType || scene.cardType;
  return CARD_TYPES.includes(cardType) ? cardType : null;
}

function inferCardType(scene, index = 0) {
  const explicit = explicitCardType(scene);
  if (explicit) return explicit;
  if (scene.component === "StatsHero") return "opening";
  if (scene.component === "SummaryCta") return "cta";
  if (scene.component === "HeroAroll") return "mv-rhythm";
  if (scene.component === "ProofMontage") return "data-proof";
  if (scene.component === "SplitTextPresenter") return "comparison";
  if (scene.component === "ScreenWithPip") return scene.props?.label === "PIP" ? "pip" : "demo-annotation";
  if (scene.component === "StepCard") return scene.props?.kicker === "HIGHLIGHT" ? "product-highlight" : "info-structure";
  if (scene.component === "TitleCard") {
    if (scene.props?.cornerLeft === "BRAND") return "brand";
    if (scene.props?.cornerLeft === "TRANSITION") return "transition";
    if (index === 0 && scene.props?.kicker === "Opening") return "opening";
    return "caption";
  }
  return reverseMapping.get(`${scene.component}:${scene.scene_type}`) || "opening";
}

function manifestTopLevelExtras(manifest) {
  return Object.fromEntries(Object.entries(manifest || {}).filter(([key]) => !MANIFEST_TOP_LEVEL_FIELDS.has(key)));
}

function normalizeCaptionCue(cue) {
  return compactObject({
    start: Number(cue.start),
    end: Number(cue.end),
    text: cue.text,
    asr_text: cue.asr_text,
    source: cue.source,
  });
}

function captionCuesForManifest(manifest, options = {}) {
  if (Array.isArray(manifest.captions)) return clone(manifest.captions).map(normalizeCaptionCue);
  const captionsRef = manifest.audio?.captions;
  const root = options.root || options.composerRoot;
  if (!captionsRef || !root) return undefined;
  const captionsPath = path.isAbsolute(captionsRef) ? captionsRef : path.resolve(root, captionsRef);
  try {
    const payload = readJson(captionsPath);
    return Array.isArray(payload.captions) ? payload.captions.map(normalizeCaptionCue) : undefined;
  } catch {
    return undefined;
  }
}

function extractContent(props = {}) {
  return compactObject({
    chip: props.chip,
    cornerLeft: props.cornerLeft,
    cornerName: props.cornerName,
    kicker: props.kicker ?? props.titleBeat?.kicker,
    title: props.title ?? props.titleBeat?.title ?? props.stat?.title,
    subline: props.subline ?? props.titleBeat?.subline,
    label: props.label ?? props.stat?.label,
    items: clone(props.items),
    cards: clone(props.cards),
    panels: clone(props.panels),
    stat: clone(props.stat),
  });
}

function extractRichFields(props = {}) {
  return compactObject({
    layout: clone(props.layout),
    font: clone(props.style?.font),
    color: clone(props.style?.color),
    graphics: clone(props.graphics),
    animation: clone(props.animation),
  });
}

function applyRichFields(props, card) {
  const next = clone(props) || {};
  if (card.layout !== undefined) next.layout = clone(card.layout);
  if (card.font !== undefined || card.color !== undefined) {
    next.style = clone(next.style) || {};
    if (card.font !== undefined) next.style.font = clone(card.font);
    if (card.color !== undefined) next.style.color = clone(card.color);
  }
  if (card.graphics !== undefined) next.graphics = clone(card.graphics);
  if (card.animation !== undefined) next.animation = clone(card.animation);
  return next;
}

function assertCatalogScene(componentId, sceneType) {
  const component = catalogComponent(componentId);
  if (!component) throw new Error(`${componentId} is not in composer catalog`);
  if (!component.sceneTypes.includes(sceneType)) throw new Error(`scene_type ${sceneType} is not legal for ${componentId}`);
}

function defaultPropsFor(cardType) {
  const mapping = cardTypeToCoarse[cardType];
  const factory = mapping && defaultPropsByName[mapping.defaultPropsFn];
  return factory ? factory() : {};
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function objectHasKeys(value) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function numericEnd(start, duration) {
  return typeof start === "number" && typeof duration === "number" ? start + duration : 0;
}

function maxTrackEnd(tracks = {}) {
  return Math.max(
    0,
    ...["video", "audio", "subtitle", "card"].flatMap((trackName) =>
      (tracks[trackName] || []).map((clip) => numericEnd(clip.start ?? clip.timeline?.start, clip.duration ?? clip.timeline?.duration)),
    ),
  );
}

function maxManifestEnd(manifest = {}) {
  return Math.max(
    Number(manifest.duration) || 0,
    ...(manifest.scenes || []).map((scene) => numericEnd(scene.start, scene.duration)),
    ...(manifest.source?.videoClips || []).map((clip) => numericEnd(clip.start, clip.duration)),
    ...(manifest.audio?.clips || []).map((clip) => numericEnd(clip.start, clip.duration)),
    ...(manifest.captions || []).map((caption) => (typeof caption.end === "number" ? caption.end : 0)),
  );
}

function trackClipFromManifestClip(clip, track, fallbackSrc, duration, index, previewUrl) {
  return compactObject({
    id: clip.id || `${track}-${index + 1}`,
    track,
    src: clip.src ?? fallbackSrc,
    previewUrl: track === "video" ? (clip.previewUrl ?? previewUrl) : undefined,
    start: Number(clip.start ?? 0),
    duration: Number(clip.duration ?? duration),
    mediaStart: Number(clip.mediaStart ?? 0),
  });
}

function trackClipsFromManifest(clips, track, fallbackSrc, duration, previewUrl) {
  if (Array.isArray(clips) && clips.length > 0) {
    return clips.map((clip, index) => trackClipFromManifestClip(clip, track, fallbackSrc, duration, index, previewUrl));
  }
  return fallbackSrc
    ? [
        compactObject({
          id: `${track}-main`,
          track,
          src: fallbackSrc,
          previewUrl: track === "video" ? previewUrl : undefined,
          start: 0,
          duration,
        }),
      ]
    : [];
}

function manifestClipFromTrackClip(clip, fallbackSrc) {
  return compactObject({
    id: clip.id,
    src: clip.src ?? fallbackSrc,
    start: clip.start,
    duration: clip.duration,
    mediaStart: clip.mediaStart ?? 0,
  });
}

function shouldWriteClips(trackClips, fallbackSrc, totalDuration) {
  if (!Array.isArray(trackClips) || trackClips.length === 0) return false;
  if (trackClips.length > 1) return true;
  const clip = trackClips[0];
  return (
    (clip.src ?? fallbackSrc ?? null) !== (fallbackSrc ?? null) ||
    Number(clip.start ?? 0) !== 0 ||
    Number(clip.mediaStart ?? 0) !== 0 ||
    Number(clip.duration ?? 0) !== Number(totalDuration ?? 0)
  );
}

function collectMediaRequirements(value, prefix = "media") {
  const requirements = [];
  function visit(current, currentPath) {
    if (typeof current === "string") {
      requirements.push({ slot: currentPath.replace(/^media\.?/, "") || "media", kind: inferMediaKind(currentPath), required: true });
    } else if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentPath}.${index}`));
    } else if (isPlainObject(current)) {
      for (const [key, nested] of Object.entries(current)) visit(nested, `${currentPath}.${key}`);
    }
  }
  visit(value, prefix);
  return requirements;
}

function inferMediaKind(slot) {
  if (slot.includes("presenter") || slot.includes("pip")) return "presenter-video";
  if (slot.includes("screen")) return "screen-video";
  if (slot.includes("audio")) return "audio";
  return "media";
}

function contentRulesFromContent(content = {}) {
  return Object.fromEntries(
    Object.keys(content).map((key) => [
      key,
      {
        source: `segment.content.${key}`,
        required: ["title", "items", "kicker"].includes(key),
      },
    ]),
  );
}

function mergeContentIntoProps(props, content = {}, media = {}) {
  const next = clone(props) || {};
  if (content.chip !== undefined) next.chip = content.chip;
  if (content.cornerLeft !== undefined) next.cornerLeft = content.cornerLeft;
  if (content.cornerName !== undefined) next.cornerName = content.cornerName;
  if (content.kicker !== undefined) next.kicker = content.kicker;
  if (content.title !== undefined) next.title = content.title;
  if (content.subline !== undefined) next.subline = content.subline;
  if (content.label !== undefined) next.label = content.label;
  if (content.items !== undefined) next.items = clone(content.items);
  if (content.cards !== undefined) next.cards = clone(content.cards);
  if (content.panels !== undefined) next.panels = clone(content.panels);
  if (content.stat !== undefined) next.stat = clone(content.stat);
  if (objectHasKeys(media)) next.media = clone(media);
  if (next.titleBeat) {
    if (content.kicker !== undefined) next.titleBeat.kicker = content.kicker;
    if (content.title !== undefined) next.titleBeat.title = content.title;
    if (content.subline !== undefined) next.titleBeat.subline = content.subline;
  }
  return next;
}

function segmentForRule(rule, segments, index) {
  return segments.find((segment) => segment.kind === rule.segmentKind) || segments.find((segment) => segment.role === rule.role) || segments[index] || {};
}

function mediaForRule(rule, segment, mediaBindings = {}) {
  return clone(segment.media) || clone(mediaBindings[rule.role]) || clone(mediaBindings[rule.segmentKind]) || {};
}

export function validateComponentCard(card) {
  const failures = [];
  if (!card || typeof card !== "object") return { failures: ["component card must be an object"] };
  if (!card.id) failures.push("card.id is required");
  if (!CARD_TYPES.includes(card.type)) failures.push(`card.type ${card.type} is not supported`);
  if (!card.engine || typeof card.engine !== "object") failures.push("card.engine is required");
  if (!card.timeline || typeof card.timeline !== "object") failures.push("card.timeline is required");
  if (card.timeline && typeof card.timeline.start !== "number") failures.push("card.timeline.start must be a number");
  if (card.timeline && !(card.timeline.duration > 0)) failures.push("card.timeline.duration must be > 0");
  if (card.engine?.component && card.engine?.scene_type) {
    const component = catalogComponent(card.engine.component);
    if (!component) failures.push(`${card.engine.component} is not in composer catalog`);
    else if (!component.sceneTypes.includes(card.engine.scene_type)) {
      failures.push(`scene_type ${card.engine.scene_type} is not legal for ${card.engine.component}`);
    }
  }
  return { failures };
}

export function validatePackagingPlan(plan) {
  const failures = [];
  if (!plan || typeof plan !== "object") return { failures: ["packaging plan must be an object"] };
  if (!plan.schemaVersion) failures.push("plan.schemaVersion is required");
  if (!plan.source || typeof plan.source !== "object") failures.push("plan.source is required");
  for (const trackName of ["video", "audio", "subtitle", "card"]) {
    if (!Array.isArray(plan.tracks?.[trackName])) failures.push(`plan.tracks.${trackName} must be an array`);
  }
  if (!Array.isArray(plan.segments)) failures.push("plan.segments must be an array");
  for (const [index, card] of (plan.tracks?.card || []).entries()) {
    for (const failure of validateComponentCard(card).failures) failures.push(`card[${index}] ${failure}`);
  }
  return { failures };
}

export function validateTemplate(template) {
  const failures = [];
  if (!template || typeof template !== "object") return { failures: ["template must be an object"] };
  if (!template.id) failures.push("template.id is required");
  if (!template.name) failures.push("template.name is required");
  if (!Array.isArray(template.cardRules) || template.cardRules.length === 0) failures.push("template.cardRules must be a non-empty array");
  for (const [index, rule] of (template.cardRules || []).entries()) {
    if (!CARD_TYPES.includes(rule.cardType)) failures.push(`cardRules[${index}].cardType ${rule.cardType} is not supported`);
    if (!rule.role) failures.push(`cardRules[${index}].role is required`);
    if (!rule.segmentKind) failures.push(`cardRules[${index}].segmentKind is required`);
    collectConcreteContentFailures(rule.contentRules || {}, `cardRules[${index}].contentRules`, failures);
    collectConcreteMediaFailures(rule.mediaRequirements || [], `cardRules[${index}].mediaRequirements`, failures);
  }
  return { failures };
}

function collectConcreteContentFailures(value, prefix, failures) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectConcreteContentFailures(item, `${prefix}[${index}]`, failures));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const fieldPath = `${prefix}.${key}`;
    if (key === "source" && nested === "literal") failures.push(`${fieldPath} contains literal concrete content`);
    if (key === "value") failures.push(`${fieldPath} contains literal concrete content`);
    if (key === "fallback" && typeof nested === "string" && nested.trim()) failures.push(`${fieldPath} contains concrete fallback`);
    collectConcreteContentFailures(nested, fieldPath, failures);
  }
}

function isConcreteMediaString(value) {
  return (
    typeof value === "string" &&
    (/^\//.test(value) || value.startsWith("../") || value.includes("://") || /\.(mp4|mov|wav|m4a|jpg|jpeg|png)$/i.test(value))
  );
}

function collectConcreteMediaFailures(value, prefix, failures) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectConcreteMediaFailures(item, `${prefix}[${index}]`, failures));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const fieldPath = `${prefix}.${key}`;
    if (["path", "src", "value"].includes(key) && isConcreteMediaString(nested)) {
      failures.push(`${fieldPath} contains concrete media path`);
    } else if (key === "example" && isConcreteMediaString(nested)) {
      failures.push(`${fieldPath} contains concrete media example`);
    }
    collectConcreteMediaFailures(nested, fieldPath, failures);
  }
}

const componentToSkillCardType = {
  StatsHero: "opening",
  TitleCard: "caption",
  SplitTextPresenter: "comparison",
  ScreenWithPip: "pip",
  HeroAroll: "mv-rhythm",
  StepCard: "info-structure",
  ProofMontage: "data-proof",
  SummaryCta: "cta",
};

const skillScreenSlotCandidates = [
  [/prompt/i, ["assets/screen-codex-prompt.jpg", "../first120-template-duix/assets/screen-codex-prompt.jpg"]],
  [/agent.*log/i, ["assets/screen-agent-log.jpg", "../first120-template-duix/assets/screen-agent-log.jpg"]],
  [/doc.*search/i, ["assets/screen-doc-search.jpg", "../first120-template-duix/assets/screen-doc-search.jpg"]],
  [/env.*check/i, ["assets/screen-env-check.jpg", "../first120-template-duix/assets/screen-env-check.jpg"]],
];

const skillAudioCandidates = [
  "production/audio/memos-master-first120.wav",
  "production/audio/memos-master-v7.wav",
  "production/audio/memos-master-v5.wav",
  "production/audio/memos-master-v4.wav",
  "production/audio/memos-master-v3.wav",
  "assets/duix-first120-audio.m4a",
  "assets/source-first120-audio.m4a",
];

const skillCaptionCandidates = [
  "production/audio/captions-memos-first120.json",
  "production/audio/captions-memos-v7.json",
  "production/audio/captions-memos-v5.json",
  "production/audio/captions-memos-v4.json",
  "production/audio/captions-memos-v3.json",
];

const skillSourceVideoCandidates = [
  "video-template-analysis/source.mp4",
  "render/memos-v9-final.mp4",
  "render/ccedit-390-final.mp4",
  "render/aether-150-final.mp4",
  "assets/source-browser-card-263-875.mp4",
  "assets/source-first10-keyed.mp4",
];

function readJsonIfExists(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function resolveExistingPath(root, maybeRelative) {
  if (!maybeRelative || typeof maybeRelative !== "string") return null;
  const candidate = path.isAbsolute(maybeRelative) ? maybeRelative : path.resolve(root, maybeRelative);
  try {
    return fs.statSync(candidate).isFile() ? candidate : null;
  } catch {
    return null;
  }
}

function firstExisting(root, candidates) {
  for (const candidate of candidates || []) {
    const resolved = resolveExistingPath(root, candidate);
    if (resolved) return resolved;
  }
  return null;
}

function isWithinPath(child, root) {
  if (child === root) return true;
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return child.startsWith(rootWithSep);
}

function captionsFromPath(captionsPath, root) {
  if (!captionsPath) return [];
  if (root) {
    const realRoot = fs.realpathSync(root);
    const realCaptionsPath = fs.realpathSync(captionsPath);
    if (!isWithinPath(realCaptionsPath, realRoot)) {
      throw new Error("caption timeline path must stay inside the skill output root");
    }
  }
  const payload = readJsonIfExists(captionsPath);
  if (Array.isArray(payload?.captions)) return payload.captions.map(normalizeCaptionCue);
  if (Array.isArray(payload)) return payload.map(normalizeCaptionCue);
  return [];
}

function shortSkillText(value, fallback) {
  const text = String(value || fallback || "").trim();
  return [...text].slice(0, 14).join("");
}

function titleFromSkillScene(scene) {
  return shortSkillText(scene.title, scene.id);
}

function resolveSkillAssetPath(root, asset) {
  return firstExisting(root, [asset?.path, asset?.example_path]);
}

function resolveSkillScreenPath(root, slot) {
  for (const [pattern, candidates] of skillScreenSlotCandidates) {
    if (pattern.test(slot || "")) return firstExisting(root, candidates);
  }
  return null;
}

function skillMediaForScene(root, scene, assetManifest) {
  const asset = scene.asset_slot && assetManifest?.assets ? assetManifest.assets[scene.asset_slot] : null;
  const assetPath = resolveSkillAssetPath(root, asset);
  if (scene.component === "ScreenWithPip") {
    const screen = resolveSkillScreenPath(root, scene.asset_slot) || assetPath;
    return screen && assetPath ? { screen, pip: assetPath } : null;
  }
  if (scene.component === "ProofMontage") return assetPath ? { items: [{ src: assetPath, label: titleFromSkillScene(scene) }] } : null;
  if (["StatsHero", "SplitTextPresenter", "HeroAroll", "SummaryCta"].includes(scene.component)) return assetPath ? { presenter: assetPath } : null;
  return {};
}

function skillPropsForScene(scene, media) {
  const title = titleFromSkillScene(scene);
  if (scene.component === "StatsHero") {
    return {
      media,
      stat: { cornerLeft: "SKILL", label: "片段", number: String(Number(scene.id?.replace(/\D/g, "")) || 1), unit: "", title },
      browser: { done: "完成", icons: ["AI", "CLI", "MCP"], mediaStart: 0 },
      titleBeat: { cornerLeft: "SKILL", cornerName: "导入", kicker: "技能产物", title, subline: "已转换为控制台项目" },
    };
  }
  if (scene.component === "ScreenWithPip") return { label: title || "画中画", media };
  if (scene.component === "SplitTextPresenter") {
    return {
      variant: "course",
      chip: "技能产物",
      kicker: "结构片段",
      title,
      cards: [{ icon: "1", label: "已绑定素材" }],
      media,
    };
  }
  if (scene.component === "HeroAroll") return { chip: "技能产物", title, subline: "数字人口播片段", media };
  if (scene.component === "StepCard") return { kicker: scene.id || "步骤", title, items: ["来自技能时间线", "可继续编辑"] };
  if (scene.component === "ProofMontage") return { media };
  if (scene.component === "SummaryCta") return { chip: "完成", title: title || "收尾", subline: "可换装后重新渲染", media };
  return { cornerLeft: "技能产物", cornerName: scene.id || "场景", kicker: "导入场景", title, subline: "可在控制台继续编辑" };
}

function skillSceneToCard(root, scene, assetManifest, index) {
  const start = Number(scene.start ?? 0);
  const end = Number(scene.end ?? start + scene.duration);
  const duration = Number(scene.duration ?? end - start);
  // The locked skill template's opening StatsHero rows are internal sub-beats.
  // Importing each one as a standalone card causes the renderer's own nested
  // stat/browser/title timeline to overlap. Keep the source video underneath
  // and import only stable editable overlay cards.
  if (scene.component === "StatsHero" && duration < 8) return null;
  // HeroAroll currently owns a nested timed video wrapper in the renderer; keep
  // it out of generated console projects until the engine side supports it as a
  // safe editable card.
  if (scene.component === "HeroAroll") return null;
  const media = skillMediaForScene(root, scene, assetManifest);
  if (media === null) return null;
  if (!(duration > 0)) return null;
  const props = skillPropsForScene(scene, media);
  return {
    id: scene.id || `skill-card-${index + 1}`,
    type: componentToSkillCardType[scene.component] || reverseMapping.get(`${scene.component}:${scene.scene_type}`) || "caption",
    engine: compactObject({
      component: scene.component,
      scene_type: scene.scene_type,
      track: 100 + index * 10,
      props,
    }),
    content: extractContent(props),
    media: clone(media) || {},
    timeline: { track: "card", start, duration },
    validation: { status: "unchecked", failures: [] },
  };
}

function summarizeSkillPlan(plan, skippedScenes = []) {
  const mediaBindings = { screen: 0, pip: 0, presenter: 0, proof: 0 };
  for (const card of plan.tracks.card || []) {
    if (card.media?.screen) mediaBindings.screen += 1;
    if (card.media?.pip) mediaBindings.pip += 1;
    if (card.media?.presenter) mediaBindings.presenter += 1;
    if (Array.isArray(card.media?.items)) mediaBindings.proof += card.media.items.length;
  }
  return {
    scenes: plan.segments.length,
    cards: plan.tracks.card.length,
    skippedScenes: skippedScenes.length,
    captions: plan.tracks.subtitle[0]?.cues?.length || 0,
    mediaBindings,
  };
}

export async function skillOutputToPackagingPlan(skillOutputDir, options = {}) {
  const root = path.resolve(skillOutputDir);
  const sceneMap =
    readJsonIfExists(path.join(root, "data", "scene-map-390.json")) ||
    readJsonIfExists(path.join(root, "scene-plan.json")) ||
    readJsonIfExists(path.join(root, "scene-map.json"));
  if (!sceneMap || !Array.isArray(sceneMap.scenes) || sceneMap.scenes.length === 0) {
    throw new Error("skill output must contain data/scene-map-390.json or scene-plan.json with scenes");
  }
  const assetManifest = readJsonIfExists(path.join(root, "data", "asset-manifest.json")) || { assets: {} };
  const audioManifest = readJsonIfExists(path.join(root, "data", "audio-manifest.json")) || { items: {} };
  const sourceVideo =
    resolveExistingPath(root, sceneMap.source) ||
    firstExisting(root, [audioManifest.source_video, audioManifest.items?.source_video?.path, ...skillSourceVideoCandidates]);
  const audio = firstExisting(root, [
    audioManifest.items?.master_audio?.path,
    audioManifest.items?.master_audio?.preview_path,
    audioManifest.master_audio,
    ...skillAudioCandidates,
  ]);
  const captions = firstExisting(root, [
    audioManifest.items?.caption_timeline?.path,
    audioManifest.items?.captions?.path,
    audioManifest.caption_timeline,
    ...skillCaptionCandidates,
  ]);
  const cues = captionsFromPath(captions, root);
  const cards = [];
  const skippedScenes = [];
  let cutoffStart = null;
  for (const [index, scene] of sceneMap.scenes.entries()) {
    if (cutoffStart !== null && Number(scene.start ?? 0) >= cutoffStart) {
      skippedScenes.push(scene.id || `scene-${index + 1}`);
      continue;
    }
    const card = skillSceneToCard(root, scene, assetManifest, index);
    if (card) cards.push(card);
    else {
      skippedScenes.push(scene.id || `scene-${index + 1}`);
      if (["SplitTextPresenter", "ScreenWithPip", "ProofMontage", "SummaryCta"].includes(scene.component)) {
        cutoffStart = Number(scene.start ?? 0);
      }
    }
  }
  if (!cards.length) throw new Error("skill output did not contain any importable scenes with resolvable media");
  const sceneMapDuration = skippedScenes.length ? 0 : Number(sceneMap.duration) || 0;
  const duration = Math.max(
    sceneMapDuration,
    ...cards.map((card) => numericEnd(card.timeline.start, card.timeline.duration)),
    ...cues.map((cue) => (typeof cue.end === "number" ? cue.end : 0)),
  );
  const projectId = options.projectId || path.basename(root);
  const source = { video: sourceVideo, audio, captions };
  const plan = {
    schemaVersion: "2026-06-12",
    projectId,
    recipeId: "skill-output-handoff",
    duration,
    source,
    tracks: {
      video: sourceVideo ? [{ id: "video-main", track: "video", src: sourceVideo, start: 0, duration }] : [],
      audio: audio ? [{ id: "audio-main", track: "audio", src: audio, start: 0, duration }] : [],
      subtitle: captions ? [{ id: "subtitle-main", track: "subtitle", src: captions, start: 0, duration, cues }] : [],
      card: cards,
    },
    segments: cards.map((card) => ({
      id: card.id,
      role: card.type,
      kind: card.type,
      title: card.content.title,
      start: card.timeline.start,
      duration: card.timeline.duration,
      media: clone(card.media),
      content: clone(card.content),
    })),
    templateRef: null,
    output: options.output ?? null,
    hyperframesEntry: options.hyperframesEntry ?? null,
    engine: {
      skillProjectHandoff: {
        version: 1,
        sourceDir: path.basename(root),
        skippedScenes,
      },
    },
  };
  const handoff = {
    version: 1,
    kind: "director-console-project",
    projectName: projectId,
    source,
    assets: {
      digitalHumans: [...new Set(cards.map((card) => card.media?.pip).filter(Boolean))],
      screens: [...new Set(cards.map((card) => card.media?.screen).filter(Boolean))],
      presenters: [...new Set(cards.map((card) => card.media?.presenter).filter(Boolean))],
    },
    scenePlan: path.join(root, "data", "scene-map-390.json"),
    manifest: null,
    packagingPlan: null,
    summary: summarizeSkillPlan(plan, skippedScenes),
  };
  return { handoff, plan, summary: handoff.summary };
}

export function extractTemplate(plan, options = {}) {
  const styleProfile = { id: options.styleProfileId || "default", styles: {} };
  const motionProfile = { id: options.motionProfileId || "default", motions: {} };
  const cardRules = plan.tracks.card.map((card, index) => {
    const styleRef = objectHasKeys(card.font) || objectHasKeys(card.color) ? `style-${index + 1}` : "default";
    const motionRef = objectHasKeys(card.animation) ? `motion-${index + 1}` : "default";
    if (styleRef !== "default") styleProfile.styles[styleRef] = compactObject({ font: clone(card.font), color: clone(card.color) });
    if (motionRef !== "default") motionProfile.motions[motionRef] = clone(card.animation);
    return {
      cardType: card.type,
      role: `card-${index + 1}`,
      segmentKind: `card-${index + 1}`,
      layoutStrategy: clone(card.layout) || {},
      styleRef,
      motionRef,
      contentRules: contentRulesFromContent(card.content),
      mediaRequirements: collectMediaRequirements(card.media),
      engine: {
        component: card.engine.component,
        scene_type: card.engine.scene_type,
        finePieces: clone(card.engine.finePieces) || [],
      },
      timing: {
        startRatio: plan.duration > 0 ? card.timeline.start / plan.duration : 0,
        durationRatio: plan.duration > 0 ? card.timeline.duration / plan.duration : 0,
      },
    };
  });
  return {
    schemaVersion: "2026-06-12",
    id: options.id || `${plan.projectId || "packaging"}-template`,
    name: options.name || "Packaging Template",
    description: options.description || "",
    cardRules,
    styleProfile,
    motionProfile,
  };
}

export function applyTemplate(template, inputs = {}) {
  const templateValidation = validateTemplate(template);
  if (templateValidation.failures.length) throw new Error(templateValidation.failures.join("; "));
  const duration = inputs.duration ?? 0;
  const source = {
    video: inputs.source?.video ?? null,
    audio: inputs.source?.audio ?? null,
    captions: inputs.source?.captions ?? null,
  };
  const cardTracks = template.cardRules.map((rule, index) => {
    const mapping = cardTypeToCoarse[rule.cardType];
    const segment = segmentForRule(rule, inputs.segments || [], index);
    const start = typeof segment.start === "number" ? segment.start : (rule.timing?.startRatio || 0) * duration;
    const cardDuration = segment.duration > 0 ? segment.duration : Math.max(0.5, (rule.timing?.durationRatio || 0.1) * duration);
    const media = mediaForRule(rule, segment, inputs.mediaBindings || {});
    const style = template.styleProfile?.styles?.[rule.styleRef] || {};
    const animation = template.motionProfile?.motions?.[rule.motionRef];
    const engine = rule.engine || {};
    const props = mergeContentIntoProps(defaultPropsFor(rule.cardType), segment.content || {}, media);
    return compactObject({
      id: segment.id || `${rule.role}-${index + 1}`,
      type: rule.cardType,
      engine: compactObject({
        component: engine.component || mapping.component,
        scene_type: engine.scene_type || mapping.scene_type,
        track: (index + 1) * 10,
        finePieces: clone(engine.finePieces),
        props,
      }),
      content: clone(segment.content) || {},
      media,
      timeline: { track: "card", start, duration: cardDuration },
      layout: objectHasKeys(rule.layoutStrategy) ? clone(rule.layoutStrategy) : undefined,
      font: clone(style.font),
      color: clone(style.color),
      animation: clone(animation),
      validation: { status: "unchecked", failures: [] },
    });
  });

  return {
    schemaVersion: "2026-06-12",
    projectId: inputs.projectId || `${template.id}-project`,
    recipeId: inputs.recipeId ?? null,
    duration,
    source,
    tracks: {
      video: source.video ? [{ id: "video-main", track: "video", src: source.video, start: 0, duration }] : [],
      audio: source.audio ? [{ id: "audio-main", track: "audio", src: source.audio, start: 0, duration }] : [],
      subtitle: source.captions ? [{ id: "subtitle-main", track: "subtitle", src: source.captions, start: 0, duration }] : [],
      card: cardTracks,
    },
    segments: clone(inputs.segments) || [],
    templateRef: { id: template.id, version: template.schemaVersion || "2026-06-12" },
    output: inputs.output ?? null,
    hyperframesEntry: inputs.hyperframesEntry ?? null,
    engine: {},
  };
}

export function manifestToPlan(manifest, options = {}) {
  const videoUrl = options.videoUrl ?? null;
  const duration = maxManifestEnd(manifest);
  const source = compactObject({
    video: manifest.source?.video ?? null,
    videoUrl: manifest.source?.video && videoUrl ? videoUrl : undefined,
    audio: manifest.audio?.src ?? null,
    captions: manifest.audio?.captions ?? null,
  });
  const captionCues = captionCuesForManifest(manifest, options);
  const tracks = {
    video: trackClipsFromManifest(manifest.source?.videoClips, "video", source.video, duration, source.videoUrl),
    audio: trackClipsFromManifest(manifest.audio?.clips, "audio", source.audio, duration),
    subtitle: source.captions
      ? [compactObject({ id: "subtitle-main", track: "subtitle", src: source.captions, start: 0, duration, cues: captionCues })]
      : [],
    card: (manifest.scenes || []).map((scene, index) => {
      const richFields = extractRichFields(scene.props);
      return {
        id: scene.id || `card-${index + 1}`,
        type: inferCardType(scene, index),
        engine: compactObject({
          component: scene.component,
          scene_type: scene.scene_type,
          track: scene.track,
          finePieces: clone(scene.finePieces),
          scene: clone(scene.scene),
          parts: clone(scene.parts),
          props: clone(scene.props) || {},
        }),
        content: extractContent(scene.props),
        media: clone(scene.props?.media) || {},
        timeline: {
          track: "card",
          start: scene.start,
          duration: scene.duration,
        },
        validation: { status: "unchecked", failures: [] },
        ...richFields,
      };
    }),
  };

  return {
    schemaVersion: options.schemaVersion || "2026-06-12",
    projectId: options.projectId ?? manifest.compositionId ?? null,
    recipeId: options.recipeId ?? null,
    duration,
    source,
    tracks,
    segments: clone(options.segments) || [],
    templateRef: options.templateRef ?? null,
    output: manifest.output ?? null,
    hyperframesEntry: manifest.hyperframesEntry ?? null,
    engine: {
      manifestAudio: clone(manifest.audio),
      manifestTopLevel: clone(manifestTopLevelExtras(manifest)),
    },
  };
}

export function planToManifest(plan) {
  const failures = validatePackagingPlan(plan).failures;
  if (failures.length > 0) throw new Error(failures.join("; "));

  const scenes = plan.tracks.card.map((card, index) => {
    const mapping = cardTypeToCoarse[card.type];
    if (!mapping) throw new Error(`card type ${card.type} has no composer mapping`);
    const component = card.engine?.component || mapping.component;
    const sceneType = card.engine?.scene_type || mapping.scene_type;
    assertCatalogScene(component, sceneType);
    const baseProps = card.engine?.props !== undefined ? clone(card.engine.props) : defaultPropsFor(card.type);
    const props = applyRichFields(baseProps, card);
    return compactObject({
      id: card.id || `s${String(index + 1).padStart(3, "0")}`,
      component,
      scene_type: sceneType,
      start: card.timeline.start,
      duration: card.timeline.duration,
      track: card.engine?.track ?? (index + 1) * 10,
      finePieces: clone(card.engine?.finePieces),
      scene: clone(card.engine?.scene),
      parts: clone(card.engine?.parts),
      props,
    });
  });

  const videoTrackClips = plan.tracks.video || [];
  const audioTrackClips = plan.tracks.audio || [];
  const duration = maxTrackEnd(plan.tracks) || Number(plan.duration) || 0;
  const sourceVideo = plan.source.video || videoTrackClips[0]?.src;
  const sourceAudio = plan.source.audio || audioTrackClips[0]?.src;

  const audio = clone(plan.engine?.manifestAudio);
  if (audio) {
    if (sourceAudio !== undefined) audio.src = sourceAudio;
    if (plan.source.captions !== undefined) audio.captions = plan.source.captions;
    if (shouldWriteClips(audioTrackClips, sourceAudio, duration)) {
      audio.clips = audioTrackClips.map((clip) => manifestClipFromTrackClip(clip, sourceAudio));
    } else {
      delete audio.clips;
    }
  }

  const topLevel = clone(plan.engine?.manifestTopLevel) || {};
  const source = compactObject({
    ...(topLevel.source || {}),
    video: sourceVideo || undefined,
    videoClips: shouldWriteClips(videoTrackClips, sourceVideo, duration)
      ? videoTrackClips.map((clip) => manifestClipFromTrackClip(clip, sourceVideo))
      : undefined,
  });
  delete topLevel.source;

  return compactObject({
    ...topLevel,
    compositionId: plan.projectId || "packaging-plan",
    duration,
    source: objectHasKeys(source) ? source : undefined,
    output: plan.output ?? undefined,
    hyperframesEntry: plan.hyperframesEntry ?? undefined,
    audio:
      audio ||
      (sourceAudio || plan.source.captions
        ? compactObject({
            src: sourceAudio,
            captions: plan.source.captions,
            clips: shouldWriteClips(audioTrackClips, sourceAudio, duration)
              ? audioTrackClips.map((clip) => manifestClipFromTrackClip(clip, sourceAudio))
              : undefined,
          })
        : undefined),
    scenes,
  });
}
