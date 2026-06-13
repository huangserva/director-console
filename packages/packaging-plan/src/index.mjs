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
    ...(manifest.captions || []).map((caption) => (typeof caption.end === "number" ? caption.end : 0)),
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
    video: source.video
      ? [compactObject({ id: "video-main", track: "video", src: source.video, previewUrl: source.videoUrl, start: 0, duration })]
      : [],
    audio: source.audio ? [{ id: "audio-main", track: "audio", src: source.audio, start: 0, duration }] : [],
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

  const audio = clone(plan.engine?.manifestAudio);
  if (audio) {
    if (plan.source.audio !== undefined) audio.src = plan.source.audio;
    if (plan.source.captions !== undefined) audio.captions = plan.source.captions;
  }

  const topLevel = clone(plan.engine?.manifestTopLevel) || {};
  const source = compactObject({ ...(topLevel.source || {}), video: plan.source.video || undefined });
  delete topLevel.source;
  const duration = maxTrackEnd(plan.tracks) || Number(plan.duration) || 0;

  return compactObject({
    ...topLevel,
    compositionId: plan.projectId || "packaging-plan",
    duration,
    source: objectHasKeys(source) ? source : undefined,
    output: plan.output ?? undefined,
    hyperframesEntry: plan.hyperframesEntry ?? undefined,
    audio: audio || (plan.source.audio || plan.source.captions ? compactObject({ src: plan.source.audio, captions: plan.source.captions }) : undefined),
    scenes,
  });
}
