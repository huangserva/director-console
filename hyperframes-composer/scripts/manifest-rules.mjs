import fs from "node:fs";
import path from "node:path";
import { registry } from "../components/registry.mjs";

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function textWeight(value = "") {
  return [...String(value)].reduce((total, char) => total + (char.charCodeAt(0) > 127 ? 2 : 1), 0);
}

function getNested(object, dotted) {
  return dotted.split(".").reduce((current, key) => current?.[key], object);
}

function validateTextBudget(scene, failures) {
  const props = scene.props || {};
  const checks = [
    ["chip", props.chip, 24],
    ["kicker", props.kicker, 32],
    ["title", props.title, 28],
    ["subline", props.subline, 44],
    ["titleBeat.kicker", props.titleBeat?.kicker, 32],
    ["titleBeat.title", props.titleBeat?.title, 28],
    ["titleBeat.subline", props.titleBeat?.subline, 44],
    ["stat.title", props.stat?.title, 24],
  ];
  for (const card of props.cards || []) checks.push(["card.label", card.label || card.big, 18]);
  for (const item of props.items || []) checks.push(["step.item", item, 18]);
  for (const panel of props.panels || []) {
    checks.push(["panel.kicker", panel.kicker, 32], ["panel.gold", panel.gold, 32], ["panel.title", panel.title, 28], ["panel.subline", panel.subline, 44]);
    for (const card of panel.cards || []) checks.push(["panel.card.label", card.label, 18]);
  }
  for (const [label, value, max] of checks) {
    if (value && textWeight(value) > max) failures.push(`${scene.id} text budget exceeded: ${label} weight=${textWeight(value)} max=${max}`);
  }
}

function validateNoFaceObstruction(scene, failures) {
  if (scene.component === "StatsHero") {
    const statDuration = scene.parts?.stat?.duration ?? 0;
    if (statDuration > 2.3) failures.push(`${scene.id} StatsHero stat punch too long: ${statDuration}s`);
    if (scene.props?.centerCard || scene.props?.centralCard || scene.props?.overlayCard) {
      failures.push(`${scene.id} opening must not use central opaque card over face`);
    }
  }
  if (scene.component === "SummaryCta") {
    if (scene.props?.layout === "large_card" || scene.props?.centerCard) failures.push(`${scene.id} SummaryCta must remain clean A-roll, not a large centered card`);
    if (textWeight(scene.props?.title || "") > 28) failures.push(`${scene.id} SummaryCta title too long for off-face copy`);
  }
}

function validateComponentVariantProps(scene, failures) {
  const props = scene.props || {};
  if (scene.component === "SplitTextPresenter") {
    if (props.variant === "course") {
      for (const field of ["chip", "kicker", "title", "cards", "media.presenter"]) {
        if (getNested(props, field) === undefined) failures.push(`${scene.id} missing required course prop ${field}`);
      }
    } else if (props.variant === "definition") {
      if (!Array.isArray(props.panels) || props.panels.length === 0) failures.push(`${scene.id} definition variant requires panels`);
      for (const [index, panel] of (props.panels || []).entries()) {
        for (const field of ["kind", "kicker", "gold", "title", "subline", "cards", "start", "duration", "media.presenter"]) {
          if (getNested(panel, field) === undefined) failures.push(`${scene.id} panel ${index} missing required prop ${field}`);
        }
      }
    } else {
      failures.push(`${scene.id} SplitTextPresenter variant must be course or definition`);
    }
  }

  if (scene.component === "ScreenWithPip") {
    const pipLike = [props.media?.pip, props.media?.pip2, props.secondPip].filter(Boolean);
    if (pipLike.length !== 1) failures.push(`${scene.id} ScreenWithPip must use exactly one circular PIP`);
  }
}

function validateMediaExists(root, manifestPath, scene, failures) {
  const mediaValues = [];
  function collect(value) {
    if (!value) return;
    if (typeof value === "string") mediaValues.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (typeof value === "object") Object.values(value).forEach(collect);
  }
  collect(scene.props?.media);
  for (const panel of scene.props?.panels || []) collect(panel.media);
  for (const mediaPath of mediaValues.filter((value) => /\.(mp4|mov|wav|m4a|jpg|jpeg|png)$/i.test(value))) {
    const candidates = [path.resolve(path.dirname(manifestPath), mediaPath), path.resolve(root, mediaPath)];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) failures.push(`${scene.id} media missing: ${mediaPath}`);
  }
}

export function validateManifest(manifest, { root = process.cwd(), manifestPath = path.join(process.cwd(), "manifest.json"), checkMedia = true } = {}) {
  const catalog = loadJson(path.join(root, "components", "catalog.json"));
  const failures = [];

  if (!manifest.compositionId) failures.push("manifest missing compositionId");
  if (!(manifest.duration > 0)) failures.push("manifest duration must be > 0");
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length === 0) failures.push("manifest scenes must be a non-empty array");

  const finePieceParent = new Map();
  for (const piece of catalog.controlledFinePieces || []) {
    finePieceParent.set(piece.id, new Set(piece.parentComponents || []));
  }

  for (const scene of manifest.scenes || []) {
    const entry = registry[scene.component];
    if (!entry) {
      failures.push(`${scene.id || "(unknown)"} unknown component ${scene.component}`);
      continue;
    }
    if (!entry.sceneTypes.includes(scene.scene_type)) failures.push(`${scene.id} scene_type ${scene.scene_type} is not legal for ${scene.component}`);
    if (!(scene.duration > 0)) failures.push(`${scene.id} duration must be > 0`);
    if (typeof scene.start !== "number") failures.push(`${scene.id} start must be a number`);

    const catalogComponent = catalog.coarseSceneComponents.find((component) => component.id === scene.component);
    for (const requiredProp of catalogComponent?.requiredProps || []) {
      if (getNested(scene.props, requiredProp) === undefined) failures.push(`${scene.id} missing required prop ${requiredProp}`);
    }

    for (const finePiece of scene.finePieces || []) {
      const parents = finePieceParent.get(finePiece);
      if (!parents) failures.push(`${scene.id} unknown fine piece ${finePiece}`);
      else if (!parents.has(scene.component) && !parents.has("global")) failures.push(`${scene.id} fine piece ${finePiece} is not allowed under ${scene.component}`);
    }

    validateComponentVariantProps(scene, failures);
    validateTextBudget(scene, failures);
    validateNoFaceObstruction(scene, failures);
    if (checkMedia) validateMediaExists(root, manifestPath, scene, failures);
  }

  return failures;
}
