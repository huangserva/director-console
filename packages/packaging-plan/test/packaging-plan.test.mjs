import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  CARD_TYPES,
  applyTemplate,
  cardTypeToCoarse,
  extractTemplate,
  manifestToPlan,
  planToManifest,
  validateComponentCard,
  validatePackagingPlan,
  validateTemplate,
} from "../src/index.mjs";
import { renderCompositionDocument } from "../../../hyperframes-composer/blocks/composition-shell.mjs";
import { validateManifest } from "../../../hyperframes-composer/scripts/manifest-rules.mjs";

const packageRoot = path.resolve(import.meta.dirname, "..");
const composerRoot = path.resolve(import.meta.dirname, "../../../hyperframes-composer");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertManifestEquivalent(actual, expected) {
  assert.equal(actual.compositionId, expected.compositionId);
  assert.equal(actual.duration, expected.duration);
  assert.equal(actual.output, expected.output);
  assert.equal(actual.hyperframesEntry, expected.hyperframesEntry);
  assert.deepEqual(actual.audio, expected.audio);
  assert.deepEqual(actual.scenes, expected.scenes);
}

const allowedVisibleEnglish = /\b(?:Agent|Codex|Claude Code|Claude|MemOS|CLI|HyperFrames|wav|mp4)\b/g;
const visiblePropKeys = new Set(["cornerLeft", "cornerName", "kicker", "title", "subline", "subtitle", "items", "cards", "label", "chip", "stat", "titleBeat", "browser"]);

function collectVisibleStrings(value, pathParts = [], output = []) {
  if (typeof value === "string") {
    output.push({ path: pathParts.join("."), value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectVisibleStrings(entry, [...pathParts, String(index)], output));
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectVisibleStrings(entry, [...pathParts, key], output);
    }
  }
  return output;
}

function visibleEnglishResidues(plan) {
  const visibleRoots = [];
  for (const card of plan.tracks.card || []) {
    visibleRoots.push({ base: `tracks.card.${card.id}.content`, value: card.content || {} });
    const props = card.engine?.props || {};
    for (const key of visiblePropKeys) {
      if (props[key] !== undefined) visibleRoots.push({ base: `tracks.card.${card.id}.engine.props.${key}`, value: props[key] });
    }
  }
  for (const segment of plan.segments || []) {
    visibleRoots.push({ base: `segments.${segment.id}.content`, value: segment.content || {} });
  }

  return visibleRoots
    .flatMap((root) => collectVisibleStrings(root.value, [root.base]))
    .map((entry) => ({ ...entry, normalized: entry.value.replace(allowedVisibleEnglish, "") }))
    .filter((entry) => /[A-Za-z]{3,}/.test(entry.normalized));
}

function segmentForCardType(cardType, index) {
  return {
    id: `${cardType}-${index + 1}`,
    kind: `card-${index + 1}`,
    start: index * 3,
    duration: 3,
    content: {
      cornerLeft: "P5",
      cornerName: "Render",
      kicker: "Default",
      title: `${cardType} title`,
      subline: `${cardType} subline`,
      label: `${cardType} label`,
      items: ["One", "Two", "Three"],
      cards: [{ icon: "A", label: "Alpha" }],
      stat: { cornerLeft: "P5", label: "STAT", number: "1", unit: "x", title: "Stat title" },
    },
    media: mediaForCardType(cardType),
  };
}

function mediaForCardType(cardType) {
  if (["opening", "comparison", "mv-rhythm", "cta"].includes(cardType)) return { presenter: "TODO-bind-presenter.mp4" };
  if (["demo-annotation", "pip"].includes(cardType)) return { screen: "TODO-bind-screen.mp4", pip: "TODO-bind-pip.mp4" };
  if (cardType === "data-proof") return { items: [{ src: "TODO-bind-proof.mp4", label: "Proof" }] };
  return {};
}

describe("packaging-plan schemas and mapping", () => {
  test("schema anchors expose the v2 packaging-plan shape", () => {
    const planSchema = readJson(path.join(packageRoot, "schemas", "packaging-plan.schema.json"));
    const cardSchema = readJson(path.join(packageRoot, "schemas", "component-card.schema.json"));

    assert.deepEqual(planSchema.required, ["schemaVersion", "source", "tracks", "segments", "templateRef"]);
    assert.deepEqual(planSchema.properties.tracks.required, ["video", "audio", "subtitle", "card"]);
    assert.ok(planSchema.properties.source.properties.video);
    assert.ok(planSchema.properties.source.properties.audio);
    assert.ok(planSchema.properties.source.properties.captions);
    assert.deepEqual(cardSchema.properties.type.enum, CARD_TYPES);
    for (const field of ["engine", "content", "media", "timeline", "layout", "font", "color", "graphics", "animation", "validation"]) {
      assert.ok(cardSchema.properties[field], `component-card schema missing ${field}`);
    }
  });

  test("12 card types map only to catalog coarse components and legal scene types", () => {
    const catalog = readJson(path.join(composerRoot, "components", "catalog.json"));
    const catalogComponents = new Map(catalog.coarseSceneComponents.map((component) => [component.id, component]));

    assert.deepEqual(Object.keys(cardTypeToCoarse), CARD_TYPES);
    for (const [cardType, mapping] of Object.entries(cardTypeToCoarse)) {
      const component = catalogComponents.get(mapping.component);
      assert.ok(component, `${cardType} maps to unknown component ${mapping.component}`);
      assert.ok(component.sceneTypes.includes(mapping.scene_type), `${cardType} maps to illegal scene_type ${mapping.scene_type}`);
      assert.match(mapping.defaultPropsFn, /^default[A-Z].+Props$/);
    }
  });

  test("template schema anchors reusable method fields separately from concrete plans", () => {
    const templateSchema = readJson(path.join(packageRoot, "schemas", "template.schema.json"));

    assert.deepEqual(templateSchema.required, ["id", "name", "description", "cardRules", "styleProfile", "motionProfile"]);
    const cardRule = templateSchema.properties.cardRules.items.properties;
    for (const field of ["cardType", "role", "segmentKind", "layoutStrategy", "styleRef", "motionRef", "contentRules", "mediaRequirements"]) {
      assert.ok(cardRule[field], `template cardRules missing ${field}`);
    }
  });
});

describe("manifest and packaging-plan projection", () => {
  test("demo project packaging plans do not expose English default copy", () => {
    for (const projectName of ["sample-text", "m1-acceptance"]) {
      const plan = readJson(path.join(composerRoot, "projects", projectName, "packaging-plan.json"));
      assert.deepEqual(visibleEnglishResidues(plan), [], `${projectName} visible copy should be localized`);
    }
  });

  for (const fixture of ["m1-acceptance.json", "sample-text.json", "memos-v3.json"]) {
    test(`round-trips ${fixture} without changing manifest fields`, () => {
      const manifestPath = path.join(composerRoot, "manifests", fixture);
      const manifest = readJson(manifestPath);

      const plan = manifestToPlan(manifest);
      assert.deepEqual(validatePackagingPlan(plan).failures, []);
      assert.equal(plan.tracks.card.length, manifest.scenes.length);
      assert.equal(plan.source.audio, manifest.audio?.src ?? null);
      assert.equal(plan.source.captions, manifest.audio?.captions ?? null);

      const projected = planToManifest(plan);
      assertManifestEquivalent(projected, manifest);
      for (const key of ["auditCopy", "theme", "source", "custom"]) {
        if (manifest[key] !== undefined) assert.deepEqual(projected[key], manifest[key]);
      }
      assert.deepEqual(validateManifest(projected, { root: composerRoot, manifestPath, checkMedia: false }), []);
    });
  }

  test("all 12 default card types render through the real registry path", () => {
    const template = {
      id: "all-card-types",
      name: "All card types",
      description: "Renderer smoke",
      cardRules: CARD_TYPES.map((cardType, index) => ({
        cardType,
        role: `card-${index + 1}`,
        segmentKind: `card-${index + 1}`,
        layoutStrategy: {},
        styleRef: "default",
        motionRef: "default",
        contentRules: {},
        mediaRequirements: [],
      })),
      styleProfile: {},
      motionProfile: {},
    };
    const plan = applyTemplate(template, {
      projectId: "all-card-types-render",
      duration: CARD_TYPES.length * 3,
      source: { video: null, audio: null, captions: null },
      segments: CARD_TYPES.map(segmentForCardType),
      output: "projects/all-card-types-render/index.html",
      hyperframesEntry: "projects/all-card-types-render/index.html",
    });
    const manifest = planToManifest(plan);

    assert.doesNotThrow(() => renderCompositionDocument(manifest));
  });

  test("rich card fields pass through into props namespaces and survive another projection", () => {
    const manifestPath = path.join(composerRoot, "manifests", "sample-text.json");
    const manifest = readJson(manifestPath);
    const plan = manifestToPlan(manifest);

    plan.tracks.card[0].layout = { safeArea: "title-safe", align: "center" };
    plan.tracks.card[0].font = { family: "Inter", weight: 700 };
    plan.tracks.card[0].color = { accent: "#d4af37", background: "#07090d" };
    plan.tracks.card[0].graphics = { underline: "stacked" };
    plan.tracks.card[0].animation = { enter: "fade-up", duration: 0.35 };

    const projected = planToManifest(plan);
    assert.deepEqual(projected.scenes[0].props.layout, plan.tracks.card[0].layout);
    assert.deepEqual(projected.scenes[0].props.style.font, plan.tracks.card[0].font);
    assert.deepEqual(projected.scenes[0].props.style.color, plan.tracks.card[0].color);
    assert.deepEqual(projected.scenes[0].props.graphics, plan.tracks.card[0].graphics);
    assert.deepEqual(projected.scenes[0].props.animation, plan.tracks.card[0].animation);
    assert.deepEqual(validateManifest(projected, { root: composerRoot, manifestPath, checkMedia: false }), []);

    const nextPlan = manifestToPlan(projected);
    assert.deepEqual(nextPlan.tracks.card[0].layout, plan.tracks.card[0].layout);
    assert.deepEqual(nextPlan.tracks.card[0].font, plan.tracks.card[0].font);
    assert.deepEqual(nextPlan.tracks.card[0].color, plan.tracks.card[0].color);
    assert.deepEqual(nextPlan.tracks.card[0].graphics, plan.tracks.card[0].graphics);
    assert.deepEqual(nextPlan.tracks.card[0].animation, plan.tracks.card[0].animation);
  });

  test("manifestToPlan loads caption cues and planToManifest keeps the captions reference", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(process.cwd(), "packaging-plan-captions-"));
    try {
      fs.mkdirSync(path.join(fixtureRoot, "projects", "captioned"), { recursive: true });
      fs.writeFileSync(
        path.join(fixtureRoot, "projects", "captioned", "captions.json"),
        JSON.stringify({ captions: [{ start: 0, end: 1.5, text: "Claude Code", asr_text: "cloud code" }] }, null, 2),
      );
      const manifest = {
        ...readJson(path.join(composerRoot, "manifests", "sample-text.json")),
        compositionId: "captioned",
        audio: {
          src: "projects/captioned/audio.wav",
          captions: "projects/captioned/captions.json",
        },
      };

      const plan = manifestToPlan(manifest, { root: fixtureRoot });

      assert.deepEqual(plan.tracks.subtitle[0].cues, [{ start: 0, end: 1.5, text: "Claude Code", asr_text: "cloud code" }]);
      plan.tracks.subtitle[0].cues[0].text = "Claude Code edited";
      const projected = planToManifest(plan);
      assert.equal(projected.audio.captions, "projects/captioned/captions.json");
      assert.equal(plan.tracks.subtitle[0].cues[0].text, "Claude Code edited");
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  test("source video survives plan-to-manifest projection and returns as a video track", () => {
    const manifest = readJson(path.join(composerRoot, "manifests", "sample-text.json"));
    const plan = manifestToPlan(manifest);
    plan.source.video = "/Users/example/input/source.mp4";
    plan.tracks.video = [{ id: "video-main", track: "video", src: "/Users/example/input/source.mp4", start: 0, duration: 12.345 }];

    const projected = planToManifest(plan);
    assert.deepEqual(projected.source, { video: "/Users/example/input/source.mp4" });
    assert.equal(projected.duration, 12.345);

    const nextPlan = manifestToPlan(projected);
    assert.deepEqual(nextPlan.source.video, "/Users/example/input/source.mp4");
    assert.deepEqual(nextPlan.tracks.video, [
      {
        id: "video-main",
        track: "video",
        src: "/Users/example/input/source.mp4",
        start: 0,
        duration: 12.345,
      },
    ]);
  });

  test("video and audio clips round-trip with mediaStart without merging segments", () => {
    const manifest = readJson(path.join(composerRoot, "manifests", "sample-text.json"));
    const plan = manifestToPlan(manifest);
    plan.source.video = "/Users/example/input/source.mp4";
    plan.source.audio = "projects/split/audio.wav";
    plan.tracks.video = [
      { id: "video-a", track: "video", src: plan.source.video, start: 0, duration: 4, mediaStart: 10 },
      { id: "video-b", track: "video", src: plan.source.video, start: 7, duration: 3, mediaStart: 24 },
    ];
    plan.tracks.audio = [
      { id: "audio-a", track: "audio", src: plan.source.audio, start: 0, duration: 4, mediaStart: 10 },
      { id: "audio-b", track: "audio", src: plan.source.audio, start: 7, duration: 3, mediaStart: 24 },
    ];

    const projected = planToManifest(plan);

    assert.deepEqual(projected.source.videoClips, [
      { id: "video-a", src: "/Users/example/input/source.mp4", start: 0, duration: 4, mediaStart: 10 },
      { id: "video-b", src: "/Users/example/input/source.mp4", start: 7, duration: 3, mediaStart: 24 },
    ]);
    assert.deepEqual(projected.audio.clips, [
      { id: "audio-a", src: "projects/split/audio.wav", start: 0, duration: 4, mediaStart: 10 },
      { id: "audio-b", src: "projects/split/audio.wav", start: 7, duration: 3, mediaStart: 24 },
    ]);
    assert.equal(projected.duration, 12);

    const nextPlan = manifestToPlan(projected);
    assert.deepEqual(nextPlan.tracks.video, [
      { id: "video-a", track: "video", src: "/Users/example/input/source.mp4", start: 0, duration: 4, mediaStart: 10 },
      { id: "video-b", track: "video", src: "/Users/example/input/source.mp4", start: 7, duration: 3, mediaStart: 24 },
    ]);
    assert.deepEqual(nextPlan.tracks.audio, [
      { id: "audio-a", track: "audio", src: "projects/split/audio.wav", start: 0, duration: 4, mediaStart: 10 },
      { id: "audio-b", track: "audio", src: "projects/split/audio.wav", start: 7, duration: 3, mediaStart: 24 },
    ]);
  });

  test("ScreenWithPip media bindings survive manifest-plan round-trip", () => {
    const manifest = readJson(path.join(composerRoot, "manifests", "sample-text.json"));
    manifest.scenes = [
      {
        id: "pip-card",
        component: "ScreenWithPip",
        scene_type: "screen_demo_pip",
        start: 0,
        duration: 4,
        track: 10,
        props: {
          label: "画中画",
          media: {
            screen: "/Users/example/media/screen.mp4",
            pip: "/Users/example/media/presenter.mp4",
          },
        },
      },
    ];

    const plan = manifestToPlan(manifest);
    assert.deepEqual(plan.tracks.card[0].media, {
      screen: "/Users/example/media/screen.mp4",
      pip: "/Users/example/media/presenter.mp4",
    });

    const projected = planToManifest(plan);
    assert.deepEqual(projected.scenes[0].props.media, {
      screen: "/Users/example/media/screen.mp4",
      pip: "/Users/example/media/presenter.mp4",
    });
  });

  test("manifestToPlan exposes a playable source video URL for API consumers", () => {
    const manifest = {
      ...readJson(path.join(composerRoot, "manifests", "sample-text.json")),
      source: { video: "/Users/example/input/source.mp4" },
    };

    const plan = manifestToPlan(manifest, { videoUrl: "/api/preview/source/sample-text" });

    assert.equal(plan.source.video, "/Users/example/input/source.mp4");
    assert.equal(plan.source.videoUrl, "/api/preview/source/sample-text");
    assert.equal(plan.tracks.video[0].previewUrl, "/api/preview/source/sample-text");
  });

  test("card timelines round-trip with arbitrary gaps and non-contiguous ordering", () => {
    const manifest = readJson(path.join(composerRoot, "manifests", "sample-text.json"));
    const plan = manifestToPlan(manifest);
    plan.duration = 18;
    plan.tracks.card = [
      {
        ...plan.tracks.card[1],
        id: "late-card",
        timeline: { track: "card", start: 10.25, duration: 2.5 },
      },
      {
        ...plan.tracks.card[0],
        id: "early-card",
        timeline: { track: "card", start: 1.5, duration: 3 },
      },
    ];

    const projected = planToManifest(plan);
    assert.deepEqual(
      projected.scenes.map((scene) => [scene.id, scene.start, scene.duration]),
      [
        ["late-card", 10.25, 2.5],
        ["early-card", 1.5, 3],
      ],
    );

    const nextPlan = manifestToPlan(projected);
    assert.deepEqual(
      nextPlan.tracks.card.map((card) => [card.id, card.timeline.start, card.timeline.duration]),
      [
        ["late-card", 10.25, 2.5],
        ["early-card", 1.5, 3],
      ],
    );
    assert.equal(nextPlan.tracks.card[0].timeline.start - (nextPlan.tracks.card[1].timeline.start + nextPlan.tracks.card[1].timeline.duration), 5.75);
  });

  test("planToManifest derives duration from the max end across every track", () => {
    const manifest = readJson(path.join(composerRoot, "manifests", "sample-text.json"));
    const plan = manifestToPlan(manifest);
    plan.duration = 4;
    plan.source.video = "/Users/example/input/source.mp4";
    plan.tracks.video = [{ id: "video-main", track: "video", src: plan.source.video, start: 0, duration: 20 }];
    plan.tracks.audio = [{ id: "audio-main", track: "audio", src: "audio.wav", start: 2, duration: 24 }];
    plan.tracks.subtitle = [{ id: "subtitle-main", track: "subtitle", src: "captions.json", start: 1, duration: 10 }];
    plan.tracks.card[0].timeline = { track: "card", start: 5, duration: 3 };

    const projected = planToManifest(plan);

    assert.equal(projected.duration, 26);
  });

  test("manifestToPlan derives duration from scene ends when manifest duration is stale", () => {
    const manifest = {
      ...readJson(path.join(composerRoot, "manifests", "sample-text.json")),
      duration: 4,
      scenes: [
        {
          ...readJson(path.join(composerRoot, "manifests", "sample-text.json")).scenes[0],
          start: 12,
          duration: 4.5,
        },
      ],
    };

    const plan = manifestToPlan(manifest);

    assert.equal(plan.duration, 16.5);
    assert.equal(plan.tracks.card[0].timeline.start, 12);
    assert.equal(plan.tracks.card[0].timeline.duration, 4.5);
  });

  test("R3 gate rejects cards that would project outside the composer catalog", () => {
    const manifest = readJson(path.join(composerRoot, "manifests", "sample-text.json"));
    const plan = manifestToPlan(manifest);

    plan.tracks.card[0].engine.component = "MissingComponent";
    assert.throws(() => planToManifest(plan), /not in composer catalog/);

    const invalidCard = { ...plan.tracks.card[0], engine: { ...plan.tracks.card[0].engine, component: "TitleCard", scene_type: "bad_scene_type" } };
    assert.match(validateComponentCard(invalidCard).failures.join("\n"), /scene_type bad_scene_type is not legal for TitleCard/);
  });
});

describe("packaging template extraction and application", () => {
  function samplePlanWithRichFields() {
    const manifest = readJson(path.join(composerRoot, "manifests", "sample-text.json"));
    const plan = manifestToPlan(manifest);
    plan.tracks.card[0].layout = { safeArea: "title-safe", align: "center" };
    plan.tracks.card[0].font = { family: "Inter", weight: 700 };
    plan.tracks.card[0].color = { accent: "#d4af37" };
    plan.tracks.card[0].animation = { enter: "fade-up" };
    return plan;
  }

  function segmentsFromPlan(plan, prefix = "same") {
    return plan.tracks.card.map((card, index) => ({
      id: `${prefix}-${index + 1}`,
      kind: `card-${index + 1}`,
      start: card.timeline.start,
      duration: card.timeline.duration,
      content: card.content,
      media: card.media,
    }));
  }

  test("extractTemplate strips concrete copy, timing, media paths, and card ids", () => {
    const plan = samplePlanWithRichFields();
    const template = extractTemplate(plan, {
      id: "sample-template",
      name: "Sample template",
      description: "Reusable sample structure",
    });

    assert.deepEqual(validateTemplate(template).failures, []);
    assert.deepEqual(template.cardRules.map((rule) => rule.cardType), plan.tracks.card.map((card) => card.type));
    assert.equal(template.cardRules[0].layoutStrategy.safeArea, "title-safe");
    assert.equal(template.cardRules[0].styleRef, "style-1");
    assert.equal(template.cardRules[0].motionRef, "motion-1");
    const serialized = JSON.stringify(template);
    assert.doesNotMatch(serialized, /Text-only preview/);
    assert.doesNotMatch(serialized, /No external media required/);
    assert.doesNotMatch(serialized, /sample-title/);
    assert.doesNotMatch(serialized, /"start":0/);
    assert.doesNotMatch(serialized, /"duration":4/);
  });

  test("applyTemplate with extracted rules and same inputs restores an equivalent plan structure", () => {
    const sourcePlan = samplePlanWithRichFields();
    const template = extractTemplate(sourcePlan, { id: "same-template", name: "Same", description: "Same inputs" });
    const applied = applyTemplate(template, {
      projectId: "same-project",
      duration: sourcePlan.duration,
      source: sourcePlan.source,
      segments: segmentsFromPlan(sourcePlan),
      output: "projects/same-project/index.html",
      hyperframesEntry: "projects/same-project/index.html",
    });

    assert.deepEqual(validatePackagingPlan(applied).failures, []);
    assert.deepEqual(applied.tracks.card.map((card) => card.type), sourcePlan.tracks.card.map((card) => card.type));
    assert.deepEqual(applied.tracks.card.map((card) => card.content), sourcePlan.tracks.card.map((card) => card.content));
    assert.deepEqual(applied.tracks.card.map((card) => card.timeline), sourcePlan.tracks.card.map((card) => card.timeline));
    assert.deepEqual(applied.tracks.card[0].layout, sourcePlan.tracks.card[0].layout);
    assert.deepEqual(applied.tracks.card[0].font, sourcePlan.tracks.card[0].font);
    assert.deepEqual(applied.tracks.card[0].color, sourcePlan.tracks.card[0].color);
    assert.deepEqual(applied.tracks.card[0].animation, sourcePlan.tracks.card[0].animation);

    const manifest = planToManifest(applied);
    assert.deepEqual(validateManifest(manifest, { root: composerRoot, manifestPath: path.join(composerRoot, "manifests", "same-project.json"), checkMedia: false }), []);
  });

  test("applyTemplate on different inputs changes concrete values but keeps the cardType sequence", () => {
    const sourcePlan = samplePlanWithRichFields();
    const template = extractTemplate(sourcePlan, { id: "different-template", name: "Different", description: "Different inputs" });
    const differentSegments = segmentsFromPlan(sourcePlan, "new").map((segment, index) => ({
      ...segment,
      start: index * 5,
      duration: 5,
      content: {
        ...segment.content,
        title: `New title ${index + 1}`,
        subline: `New subline ${index + 1}`,
      },
    }));

    const applied = applyTemplate(template, {
      projectId: "different-project",
      duration: 15,
      source: { video: "new-source.mp4", audio: null, captions: null },
      segments: differentSegments,
      output: "projects/different-project/index.html",
      hyperframesEntry: "projects/different-project/index.html",
    });

    assert.deepEqual(applied.tracks.card.map((card) => card.type), template.cardRules.map((rule) => rule.cardType));
    assert.equal(applied.tracks.card[0].content.title, "New title 1");
    assert.equal(applied.tracks.card[0].timeline.duration, 5);
    assert.equal(applied.source.video, "new-source.mp4");
    assert.notEqual(applied.tracks.card[0].content.title, sourcePlan.tracks.card[0].content.title);

    const manifest = planToManifest(applied);
    assert.equal(manifest.scenes[0].props.title, "New title 1");
    assert.deepEqual(validateManifest(manifest, { root: composerRoot, manifestPath: path.join(composerRoot, "manifests", "different-project.json"), checkMedia: false }), []);
  });

  test("validateTemplate rejects concrete leakage and invalid card rules", () => {
    const result = validateTemplate({
      id: "bad",
      name: "Bad",
      description: "Concrete leakage",
      cardRules: [
        {
          cardType: "not-a-card",
          role: "card-1",
          segmentKind: "card-1",
          layoutStrategy: {},
          styleRef: "default",
          motionRef: "default",
          contentRules: { title: { source: "literal", value: "Do not store this" }, subtitle: { fallback: "Concrete fallback" } },
          mediaRequirements: [{ slot: "presenter", path: "/tmp/presenter.mp4" }, { slot: "screen", example: "assets/demo.mp4" }],
        },
      ],
      styleProfile: {},
      motionProfile: {},
    });

    assert.match(result.failures.join("\n"), /cardRules\[0\].cardType not-a-card is not supported/);
    assert.match(result.failures.join("\n"), /literal concrete content/);
    assert.match(result.failures.join("\n"), /concrete media path/);
    assert.match(result.failures.join("\n"), /concrete fallback/);
    assert.match(result.failures.join("\n"), /concrete media example/);
  });
});
