import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  addCheckpoint,
  advance,
  approveCheckpoint,
  createProjectFromRecipe,
  digitalHumanTalkingHeadRecipe,
  digitalHumanProductIntroRecipe,
  existingNarratedVideoRecipe,
  loadProject,
  normalizeProjectMetadata,
  saveProject,
  setStageState,
  validateAsset,
  validateRecipeCatalog,
  validateRecipe,
  validateWorkflowRun,
} from "../src/index.mjs";

const composerRoot = path.resolve(import.meta.dirname, "../../../hyperframes-composer");

describe("director protocol recipes", () => {
  test("models Route B existing narrated video as data", () => {
    const result = validateRecipe(existingNarratedVideoRecipe);

    assert.deepEqual(result.failures, []);
    assert.deepEqual(
      existingNarratedVideoRecipe.stages.map((stage) => stage.id),
      ["probe", "asr", "transcript", "scene-plan", "packaging", "compose"],
    );
    assert.equal(existingNarratedVideoRecipe.id, "existing-narrated-video");
    assert.ok(existingNarratedVideoRecipe.recommendedComponents.includes("TitleCard"));
    assert.ok(existingNarratedVideoRecipe.validationGates.includes("manifest.validate"));
  });

  test("recommended components exist in the composer catalog", () => {
    assert.deepEqual(validateRecipeCatalog(existingNarratedVideoRecipe, { composerRoot }).failures, []);
    assert.deepEqual(validateRecipeCatalog(digitalHumanTalkingHeadRecipe, { composerRoot }).failures, []);
    assert.deepEqual(validateRecipeCatalog(digitalHumanProductIntroRecipe, { composerRoot }).failures, []);
  });

  test("recipe catalog validation reports missing recommended components", () => {
    const result = validateRecipeCatalog(
      {
        ...existingNarratedVideoRecipe,
        recommendedComponents: ["TitleCard", "MissingComponent"],
      },
      { composerRoot },
    );

    assert.match(result.failures.join("\n"), /recommendedComponents\[1\] "MissingComponent" is not in composer catalog/);
  });

  test("models Route A digital human talking head as a placeholder recipe", () => {
    const result = validateRecipe(digitalHumanTalkingHeadRecipe);

    assert.deepEqual(result.failures, []);
    assert.deepEqual(
      digitalHumanTalkingHeadRecipe.stages.map((stage) => stage.id),
      ["script", "tts", "lip-sync", "asr", "scene-plan", "packaging", "compose"],
    );
    assert.equal(digitalHumanTalkingHeadRecipe.id, "digital-human-talking-head");
  });

  test("models digital human product introduction as a Route A product recipe", () => {
    const result = validateRecipe(digitalHumanProductIntroRecipe);

    assert.deepEqual(result.failures, []);
    assert.equal(digitalHumanProductIntroRecipe.id, "digital-human-product-introduction");
    assert.deepEqual(
      digitalHumanProductIntroRecipe.stages.map((stage) => stage.id),
      ["product-script", "tts", "lip-sync", "asr", "scene-plan", "packaging", "compose"],
    );
    assert.deepEqual(
      digitalHumanProductIntroRecipe.inputRequirements.map((input) => input.id),
      ["presenter-video", "product-name", "product-description", "selling-points"],
    );
    assert.ok(digitalHumanProductIntroRecipe.optionalInputs.some((input) => input.id === "product-media"));
    assert.ok(digitalHumanProductIntroRecipe.recommendedComponents.includes("ProofMontage"));
    assert.ok(digitalHumanProductIntroRecipe.recommendedComponents.includes("SummaryCta"));
  });

  test("rejects recipes with missing identity and invalid stage dependencies", () => {
    const result = validateRecipe({
      name: "Bad recipe",
      description: "Missing id and broken dependency.",
      inputRequirements: [],
      optionalInputs: [],
      stages: [{ id: "compose", type: "compose", name: "Compose", dependsOn: ["missing-stage"] }],
      defaultThemePackId: "text-only-hyperframes",
      recommendedComponents: [],
      validationGates: [],
    });

    assert.match(result.failures.join("\n"), /recipe.id is required/);
    assert.match(result.failures.join("\n"), /stages\[0\].dependsOn\[0\] references unknown stage "missing-stage"/);
  });
});

describe("director protocol assets and workflow runs", () => {
  test("validates project assets with provenance and lifecycle status", () => {
    const result = validateAsset({
      id: "asset-captions",
      type: "captions",
      path: "hyperframes-composer/projects/demo/captions.json",
      media: { mimeType: "application/json" },
      createdByStageId: "asr",
      provenance: { source: "route-b", inputPath: "/videos/demo.mp4" },
      status: "ready",
    });

    assert.deepEqual(result.failures, []);
  });

  test("rejects workflow runs whose current stage is not part of the run", () => {
    const result = validateWorkflowRun({
      id: "run-1",
      projectId: "project-1",
      recipeId: "existing-narrated-video",
      stages: [
        { id: "probe", recipeStageId: "probe", status: "completed" },
        { id: "asr", recipeStageId: "asr", status: "running" },
      ],
      currentStageId: "compose",
      checkpoints: [{ id: "after-asr", stageId: "asr", status: "open" }],
      errors: [],
      startedAt: "2026-06-12T00:00:00.000Z",
      updatedAt: "2026-06-12T00:01:00.000Z",
    });

    assert.match(result.failures.join("\n"), /workflowRun.currentStageId references unknown stage "compose"/);
  });

  test("accepts valid workflow-run state machine fields", () => {
    const result = validateWorkflowRun({
      id: "run-1",
      projectId: "project-1",
      recipeId: "existing-narrated-video",
      stages: [
        { id: "probe", recipeStageId: "probe", status: "succeeded" },
        { id: "asr", recipeStageId: "asr", status: "running" },
      ],
      currentStageId: "asr",
      checkpoints: [{ id: "after-asr", stageId: "asr", status: "open" }],
      errors: [],
      startedAt: "2026-06-12T00:00:00.000Z",
      updatedAt: "2026-06-12T00:01:00.000Z",
    });

    assert.deepEqual(result.failures, []);
  });
});

describe("director protocol project metadata compatibility", () => {
  test("defaults M2 extension fields without invalidating legacy project metadata", () => {
    const result = normalizeProjectMetadata({
      id: "legacy-project",
      name: "Legacy Project",
    });

    assert.deepEqual(result.failures, []);
    assert.equal(result.value.recipeId, null);
    assert.equal(result.value.workflowRunId, null);
    assert.deepEqual(result.value.sourceCapabilities, []);
    assert.deepEqual(result.value.assets, []);
    assert.deepEqual(result.value.stageState, {});
    assert.deepEqual(result.value.outputs, {});
    assert.equal(result.value.name, "Legacy Project");
  });
});

describe("director workflow project orchestration", () => {
  test("creates project metadata and workflow-run stages from a recipe", () => {
    const result = createProjectFromRecipe("existing-narrated-video", { sourceVideo: "/videos/demo.mp4" }, { projectId: "demo-project" });

    assert.deepEqual(result.failures, []);
    assert.equal(result.project.id, "demo-project");
    assert.equal(result.project.recipeId, "existing-narrated-video");
    assert.equal(result.project.workflowRunId, "run-demo-project");
    assert.deepEqual(Object.keys(result.project.stageState), ["probe", "asr", "transcript", "scene-plan", "packaging", "compose"]);
    assert.ok(Object.values(result.project.stageState).every((state) => state.status === "not-started"));
    assert.deepEqual(
      result.workflowRun.stages.map((stage) => [stage.id, stage.status]),
      [
        ["probe", "not-started"],
        ["asr", "not-started"],
        ["transcript", "not-started"],
        ["scene-plan", "not-started"],
        ["packaging", "not-started"],
        ["compose", "not-started"],
      ],
    );
  });

  test("advances only dependency-ready stages and rejects illegal transitions", () => {
    const created = createProjectFromRecipe("existing-narrated-video", {}, { projectId: "demo-project" });

    const firstResult = advance(created.workflowRun);
    assert.deepEqual(firstResult.failures, []);
    const first = firstResult.value;
    assert.equal(first.currentStageId, "probe");
    assert.equal(first.stages[0].status, "ready");

    const runningResult = setStageState(first, "probe", "running");
    assert.deepEqual(runningResult.failures, []);
    const running = runningResult.value;
    const succeededResult = setStageState(running, "probe", "succeeded");
    assert.deepEqual(succeededResult.failures, []);
    const succeeded = succeededResult.value;
    const secondResult = advance(succeeded);
    assert.deepEqual(secondResult.failures, []);
    const second = secondResult.value;
    assert.equal(second.currentStageId, "asr");
    assert.equal(second.stages[1].status, "ready");

    const rejected = setStageState(second, "asr", "succeeded");
    assert.deepEqual(rejected.failures, ['illegal stage transition ready -> succeeded for "asr"']);
  });

  test("legal workflow mutations keep numeric timestamps valid and failures clean", () => {
    const created = createProjectFromRecipe("existing-narrated-video", { videoPath: "/x.mp4" }, { projectId: "p1", name: "demo", now: 1 });

    assert.deepEqual(created.failures, []);
    assert.equal(created.workflowRun.startedAt, 1);
    assert.equal(created.workflowRun.updatedAt, 1);

    const transitioned = setStageState(created.workflowRun, "probe", "ready", { now: 2 });
    assert.deepEqual(transitioned.failures, []);
    assert.equal(transitioned.value.startedAt, 1);
    assert.equal(transitioned.value.updatedAt, 2);
    assert.equal(transitioned.value.stages[0].status, "ready");

    const advanced = advance(created.workflowRun, { now: 2 });
    assert.deepEqual(advanced.failures, []);
    assert.equal(advanced.value.startedAt, 1);
    assert.equal(advanced.value.updatedAt, 2);

    const withCheckpoint = addCheckpoint(created.workflowRun, { id: "cp-probe", stageId: "probe" }, { now: 2 });
    assert.deepEqual(withCheckpoint.failures, []);
    const approved = approveCheckpoint(withCheckpoint.value, "cp-probe", { now: 3 });
    assert.deepEqual(approved.failures, []);
    assert.equal(approved.value.startedAt, 1);
    assert.equal(approved.value.updatedAt, 3);
  });

  test("adds and approves checkpoints", () => {
    const created = createProjectFromRecipe("existing-narrated-video", {}, { projectId: "demo-project" });
    const withCheckpoint = addCheckpoint(created.workflowRun, { id: "cp-probe", stageId: "probe", notes: "Review probe metadata." }).value;
    const approved = approveCheckpoint(withCheckpoint, "cp-probe").value;

    assert.equal(approved.checkpoints[0].id, "cp-probe");
    assert.equal(approved.checkpoints[0].status, "approved");
  });

  test("load/save project JSON round-trips and normalizes missing extension fields", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "director-protocol-"));
    const created = createProjectFromRecipe("existing-narrated-video", { sourceVideo: "/videos/demo.mp4" }, { projectId: "demo-project" });

    await saveProject(dir, created);
    const loaded = await loadProject(dir);
    assert.deepEqual(loaded.failures, []);
    assert.deepEqual(loaded.project, created.project);
    assert.deepEqual(loaded.workflowRun, created.workflowRun);

    await fs.writeFile(path.join(dir, "project.json"), JSON.stringify({ id: "legacy", name: "Legacy" }, null, 2));
    const legacy = await loadProject(dir);
    assert.deepEqual(legacy.project.assets, []);
    assert.deepEqual(legacy.project.stageState, {});
    assert.equal(legacy.project.recipeId, null);
  });
});
