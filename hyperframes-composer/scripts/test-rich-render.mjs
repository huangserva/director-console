import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderCompositionDocument } from "../blocks/composition-shell.mjs";
import { richAnimationAttrs, richAttrs } from "../components/rich.mjs";
import { renderTimelineScript } from "../components/timelines.mjs";

const root = path.resolve(import.meta.dirname, "..");
const goldenRoot = path.join(root, "__snapshots__", "rich-render");
const acceptedManifestNames = ["sample-text.json", "m1-acceptance.json", "memos-v3.json"];

function readManifest(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "manifests", name), "utf8"));
}

function renderedBody(html) {
  return html.replace(/<style>[\s\S]*?<\/style>/g, "");
}

function goldenName(manifestName) {
  return manifestName.replace(/\.json$/, ".golden.json");
}

function goldenPayload(manifest) {
  return {
    body: renderedBody(renderCompositionDocument(manifest)),
    timeline: renderTimelineScript(manifest),
  };
}

function richStyle() {
  return {
    font: { size: 64, weight: 800 },
    color: { accent: "#d4af37", text: "#ffffff", bg: "rgba(8, 10, 12, 0.72)" },
  };
}

function richManifest() {
  return {
    compositionId: "rich-render",
    duration: 16,
    scenes: [
      {
        id: "rich-title",
        component: "TitleCard",
        scene_type: "title_card",
        start: 0,
        duration: 4,
        props: {
          cornerLeft: "TITLE",
          cornerName: "Rich",
          kicker: "Accent",
          title: "Title rich",
          subline: "Sub rich",
          animation: { in: "fade-up", out: "fade", duration: 0.42, outDuration: 0.3 },
          layout: { target: "primary", x: 100, y: 80, w: 320, h: 160, safeAreaLock: true },
          style: richStyle(),
        },
      },
      {
        id: "rich-step",
        component: "StepCard",
        scene_type: "step_card",
        start: 4,
        duration: 4,
        props: {
          kicker: "Steps",
          title: "Step rich",
          items: ["One", "Two", "Three"],
          animation: { in: "scale-in" },
          layout: { target: "primary", x: 120, y: 100, w: 520, h: 240, safeAreaLock: true },
          style: richStyle(),
        },
      },
      {
        id: "rich-cta",
        component: "SummaryCta",
        scene_type: "summary_cta",
        start: 8,
        duration: 4,
        props: {
          media: { presenter: "TODO-bind-presenter.mp4" },
          chip: "CTA",
          title: "CTA rich",
          subline: "Act now",
          layout: { target: "primary", x: 80, y: 420, w: 460, h: 180, safeAreaLock: true },
          style: richStyle(),
        },
      },
      {
        id: "rich-hero",
        component: "HeroAroll",
        scene_type: "aroll_emphasis",
        start: 12,
        duration: 4,
        props: {
          media: { presenter: "TODO-bind-presenter.mp4" },
          chip: "HERO",
          title: "Hero rich",
          subline: "Overlay copy",
          animation: { in: "scale-in", out: "slide-right", duration: 0.36, outDuration: 0.24 },
          layout: { target: "primary", x: 90, y: 410, w: 500, h: 190, safeAreaLock: true },
          style: richStyle(),
        },
      },
      {
        id: "rich-proof",
        component: "ProofMontage",
        scene_type: "proof_montage",
        start: 16,
        duration: 4,
        props: {
          animation: { in: "slide-left", out: "fade", duration: 0.4 },
          media: {
            items: [
              { src: "TODO-proof-a.mp4", label: "Before" },
              { src: "TODO-proof-b.mp4", label: "After" },
            ],
          },
        },
      },
    ],
  };
}

test("richAttrs returns an empty string when rich fields are absent", () => {
  assert.equal(richAttrs({ id: "plain", props: {} }), "");
  assert.equal(richAttrs({ id: "plain" }), "");
});

test("richAttrs emits only sanitized allow-listed CSS variables", () => {
  const attrs = richAttrs({
    id: "rich",
    props: {
      style: {
        font: { size: 300, weight: 777, family: "Helvetica; background:url(x)" },
        color: {
          accent: "#d4af37",
          text: "rgb(255, 255, 255)",
          bg: "javascript:alert(1)",
          other: "#000000",
        },
      },
    },
  });

  assert.match(attrs, /^ data-rich-render="1" style="/);
  assert.match(attrs, /--hf-accent:#d4af37/);
  assert.match(attrs, /--hf-text:rgb\(255, 255, 255\)/);
  assert.match(attrs, /--hf-font-size:120px/);
  assert.doesNotMatch(attrs, /777/);
  assert.doesNotMatch(attrs, /font-family/);
  assert.doesNotMatch(attrs, /javascript/);
  assert.doesNotMatch(attrs, /--hf-bg/);
  assert.doesNotMatch(attrs, /--hf-other/);
});

test("richAttrs drops invalid values instead of emitting unsafe inline CSS", () => {
  const attrs = richAttrs({
    id: "bad",
    props: {
      style: {
        font: { size: "calc(100vh)", weight: "900;display:block" },
        color: { accent: "url(javascript:alert(1))", text: "expression(alert(1))" },
      },
    },
  });

  assert.equal(attrs, "");
});

test("rich animation attrs only emit allow-listed motion for low-conflict components", () => {
  const titleAttrs = richAnimationAttrs({
    id: "animated-title",
    component: "TitleCard",
    props: { animation: { in: "fade-up", out: "scale-out", duration: 0.4, outDuration: 0.24 } },
  });
  const complexAttrs = richAnimationAttrs({
    id: "animated-step",
    component: "StepCard",
    props: { animation: { in: "fade-up" } },
  });
  const unsafeAttrs = richAnimationAttrs({
    id: "unsafe-title",
    component: "TitleCard",
    props: { animation: { in: "fade;alert(1)", out: "url(javascript:1)" } },
  });

  assert.match(titleAttrs, /data-rich-animation="fade-up"/);
  assert.match(titleAttrs, /data-rich-animation-out="scale-out"/);
  assert.equal(complexAttrs, "");
  assert.equal(unsafeAttrs, "");
});

test("richAttrs projects safe primary layout from 1280x720 BASE units to 1920x1080 CSS variables", () => {
  const attrs = richAttrs(
    {
      id: "layout",
      props: {
        layout: { target: "primary", x: 100, y: 80, w: 320, h: 160, safeAreaLock: true },
      },
    },
    "primary",
  );

  assert.match(attrs, /data-rich-render="1"/);
  assert.match(attrs, /data-rich-layout="primary"/);
  assert.match(attrs, /--hf-x:150px/);
  assert.match(attrs, /--hf-y:120px/);
  assert.match(attrs, /--hf-w:480px/);
  assert.match(attrs, /--hf-h:240px/);
});

test("richAttrs ignores unknown layout targets and clamps safe-area locked layout", () => {
  const ignored = richAttrs(
    {
      id: "ignored",
      props: { layout: { target: "unknown", x: 100, y: 80, w: 320, h: 160 } },
    },
    "primary",
  );
  assert.equal(ignored, "");

  const clamped = richAttrs(
    {
      id: "clamped",
      props: { layout: { target: "primary", x: -500, y: -500, w: 2000, h: 1000, safeAreaLock: true } },
    },
    "primary",
  );
  assert.match(clamped, /--hf-x:115px/);
  assert.match(clamped, /--hf-y:65px/);
  assert.match(clamped, /--hf-w:1690px/);
  assert.match(clamped, /--hf-h:950px/);
});

test("existing manifests without rich fields render without rich markers or inline drift", () => {
  for (const name of acceptedManifestNames) {
    const manifest = readManifest(name);
    const first = renderCompositionDocument(manifest);
    const second = renderCompositionDocument(manifest);
    const body = renderedBody(first);
    const timeline = renderTimelineScript(manifest);

    assert.equal(second, first, `${name} render should be deterministic`);
    assert.doesNotMatch(body, /data-rich-render/);
    assert.doesNotMatch(body, /data-rich-animation/);
    assert.doesNotMatch(body, /style="--hf-/);
    assert.doesNotMatch(timeline, /rich animation:/);
  }
});

test("accepted manifests without rich fields match frozen no-drift golden snapshots", () => {
  for (const name of acceptedManifestNames) {
    const manifest = readManifest(name);
    const expected = JSON.parse(fs.readFileSync(path.join(goldenRoot, goldenName(name)), "utf8"));

    assert.deepEqual(goldenPayload(manifest), expected, `${name} no-drift golden should match`);
  }
});

test("rich font and color fields render through gated text containers", () => {
  const html = renderCompositionDocument(richManifest());
  const css = fs.readFileSync(path.join(root, "components", "hyperframes-tech-talk.css"), "utf8");

  assert.match(html, /<div class="title-block" data-rich-render="1" data-rich-layout="primary"[^>]*style="[^"]*--hf-accent:#d4af37/);
  assert.match(html, /<div class="title-block" data-rich-render="1" data-rich-layout="primary"[^>]*style="[^"]*--hf-x:150px/);
  assert.match(html, /<div class="step-panel" data-rich-render="1" data-rich-layout="primary" style="[^"]*--hf-font-size:64px/);
  assert.match(html, /<div class="clean-aroll-copy" data-rich-render="1" data-rich-layout="primary" style="[^"]*--hf-bg:rgba\(8, 10, 12, 0\.72\)/);
  assert.match(html, /<div class="clean-aroll-copy" data-rich-render="1" data-rich-layout="primary" style="[^"]*--hf-h:270px/);
  assert.match(html, /<div class="clean-aroll-copy clean-aroll-hero-copy" data-rich-render="1" data-rich-layout="primary"[^>]*style="[^"]*--hf-font-weight:800/);
  assert.match(css, /\[data-rich-render="1"\] \.main-title/);
  assert.match(css, /\[data-rich-render="1"\] \.step-title/);
  assert.match(css, /\[data-rich-render="1"\] \.clean-title/);
  assert.match(css, /\.title-block\[data-rich-layout="primary"\]/);
  assert.match(css, /\.step-panel\[data-rich-layout="primary"\]/);
  assert.match(css, /\.clean-aroll-copy\[data-rich-layout="primary"\]/);
  assert.match(css, /font-size: var\(--hf-font-size, inherit\)/);
  assert.match(css, /background: var\(--hf-bg, transparent\)/);
  assert.match(css, /left: var\(--hf-x\)/);
});

test("rich animation fields render only for low-conflict components and add timeline hooks", () => {
  const manifest = richManifest();
  const html = renderCompositionDocument(manifest);
  const timeline = renderTimelineScript(manifest);

  assert.match(html, /<div class="title-block" data-rich-render="1" data-rich-layout="primary" data-rich-animation="fade-up" data-rich-animation-out="fade"/);
  assert.doesNotMatch(html, /<div class="step-panel"[^>]*data-rich-animation/);
  assert.match(html, /<div class="clean-aroll-copy clean-aroll-hero-copy"[^>]*data-rich-animation="scale-in"[^>]*data-rich-animation-out="slide-right"/);
  assert.match(html, /<div class="proof-grid" data-rich-animation="slide-left" data-rich-animation-out="fade">/);

  assert.match(timeline, /rich animation: rich-title/);
  assert.match(timeline, /#rich-title \.title-block/);
  assert.match(timeline, /rich animation: rich-hero/);
  assert.match(timeline, /#rich-hero \.clean-aroll-hero-copy/);
  assert.match(timeline, /rich animation: rich-proof/);
  assert.match(timeline, /#rich-proof \.proof-grid/);
  assert.doesNotMatch(timeline, /rich animation: rich-step/);
});

test("HeroAroll animation without copy does not emit a missing-target timeline hook", () => {
  const manifest = {
    compositionId: "hero-animation-no-copy",
    duration: 4,
    scenes: [
      {
        id: "hero-no-copy",
        component: "HeroAroll",
        scene_type: "aroll_emphasis",
        start: 0,
        duration: 4,
        props: {
          media: { presenter: "TODO-bind-presenter.mp4" },
          animation: { in: "fade-up", out: "fade" },
        },
      },
    ],
  };
  const html = renderCompositionDocument(manifest);
  const timeline = renderTimelineScript(manifest);

  assert.doesNotMatch(html, /clean-aroll-hero-copy/);
  assert.doesNotMatch(timeline, /rich animation: hero-no-copy/);
  assert.doesNotMatch(timeline, /#hero-no-copy \.clean-aroll-hero-copy/);
});
