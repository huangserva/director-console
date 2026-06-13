import fs from "node:fs/promises";
import path from "node:path";

import { recipes } from "./recipes.mjs";
import { normalizeProjectMetadata, validateWorkflowRun } from "./validator.mjs";

const STAGE_TRANSITIONS = {
  "not-started": ["ready", "skipped"],
  ready: ["running", "skipped", "needs-review"],
  running: ["succeeded", "failed", "needs-review"],
  succeeded: ["ready"],
  failed: ["ready", "skipped"],
  skipped: ["ready"],
  "needs-review": ["ready", "succeeded", "skipped"],
};

function nowIso() {
  return new Date().toISOString();
}

function slug(value) {
  return String(value || "project")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recipeById(recipeId, availableRecipes = recipes) {
  return availableRecipes.find((recipe) => recipe.id === recipeId);
}

function dependenciesSucceeded(recipeStage, stageById) {
  return (recipeStage.dependsOn || []).every((dependency) => ["succeeded", "skipped"].includes(stageById.get(dependency)?.status));
}

function syncStageState(project, workflowRun) {
  const nextProject = clone(project);
  nextProject.stageState = Object.fromEntries(
    workflowRun.stages.map((stage) => [
      stage.id,
      {
        ...(nextProject.stageState?.[stage.id] || {}),
        status: stage.status,
      },
    ]),
  );
  return nextProject;
}

export function createProjectFromRecipe(recipeId, inputs = {}, { projectId, name, now = nowIso(), availableRecipes = recipes } = {}) {
  const recipe = recipeById(recipeId, availableRecipes);
  if (!recipe) return { failures: [`recipe "${recipeId}" was not found`] };

  const id = slug(projectId || name || recipeId);
  const workflowRunId = `run-${id}`;
  const stageState = Object.fromEntries(recipe.stages.map((stage) => [stage.id, { status: "not-started" }]));
  const project = {
    id,
    name: name || id,
    recipeId,
    workflowRunId,
    sourceCapabilities: [],
    assets: [],
    stageState,
    outputs: {},
    inputs,
    createdAt: now,
    updatedAt: now,
  };
  const workflowRun = {
    id: workflowRunId,
    projectId: id,
    recipeId,
    stages: recipe.stages.map((stage) => ({
      id: stage.id,
      recipeStageId: stage.id,
      type: stage.type,
      name: stage.name,
      dependsOn: stage.dependsOn || [],
      status: "not-started",
      inputs: {},
      outputs: {},
      errors: [],
    })),
    currentStageId: null,
    checkpoints: [],
    errors: [],
    startedAt: now,
    updatedAt: now,
  };
  return { project, workflowRun, failures: [] };
}

export function setStageState(workflowRun, stageId, nextStatus, { now = nowIso() } = {}) {
  const current = workflowRun.stages.find((stage) => stage.id === stageId);
  if (!current) return { value: workflowRun, failures: [`stage "${stageId}" was not found`] };

  const allowed = STAGE_TRANSITIONS[current.status] || [];
  if (!allowed.includes(nextStatus)) {
    return { value: workflowRun, failures: [`illegal stage transition ${current.status} -> ${nextStatus} for "${stageId}"`] };
  }

  const value = clone(workflowRun);
  const nextStage = value.stages.find((stage) => stage.id === stageId);
  nextStage.status = nextStatus;
  nextStage.updatedAt = now;
  if (nextStatus === "running" && !nextStage.startedAt) nextStage.startedAt = now;
  if (["succeeded", "failed", "skipped"].includes(nextStatus)) nextStage.finishedAt = now;
  value.currentStageId = ["succeeded", "failed", "skipped"].includes(nextStatus) ? null : stageId;
  value.updatedAt = now;
  return { value, failures: validateWorkflowRun(value).failures };
}

export function advance(workflowRun, { now = nowIso() } = {}) {
  const value = clone(workflowRun);
  if (value.currentStageId) return { value, failures: [] };

  const stageById = new Map(value.stages.map((stage) => [stage.id, stage]));
  const nextStage = value.stages.find((stage) => stage.status === "not-started" && dependenciesSucceeded(stage, stageById));
  if (!nextStage) return { value, failures: [] };

  nextStage.status = "ready";
  nextStage.updatedAt = now;
  value.currentStageId = nextStage.id;
  value.updatedAt = now;
  return { value, failures: validateWorkflowRun(value).failures };
}

export function addCheckpoint(workflowRun, checkpoint, { now = nowIso() } = {}) {
  const stageExists = workflowRun.stages.some((stage) => stage.id === checkpoint.stageId);
  if (!stageExists) return { value: workflowRun, failures: [`checkpoint.stageId references unknown stage "${checkpoint.stageId}"`] };
  const value = clone(workflowRun);
  value.checkpoints.push({
    id: checkpoint.id,
    stageId: checkpoint.stageId,
    status: "open",
    notes: checkpoint.notes || "",
    createdAt: now,
    updatedAt: now,
  });
  value.updatedAt = now;
  return { value, failures: validateWorkflowRun(value).failures };
}

export function approveCheckpoint(workflowRun, checkpointId, { now = nowIso() } = {}) {
  const value = clone(workflowRun);
  const checkpoint = value.checkpoints.find((item) => item.id === checkpointId);
  if (!checkpoint) return { value: workflowRun, failures: [`checkpoint "${checkpointId}" was not found`] };
  if (checkpoint.status !== "open") return { value: workflowRun, failures: [`checkpoint "${checkpointId}" is not open`] };
  checkpoint.status = "approved";
  checkpoint.updatedAt = now;
  value.updatedAt = now;
  return { value, failures: validateWorkflowRun(value).failures };
}

export async function saveProject(projectDir, { project, workflowRun }) {
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, "project.json"), `${JSON.stringify(project, null, 2)}\n`);
  await fs.writeFile(path.join(projectDir, "workflow-run.json"), `${JSON.stringify(workflowRun, null, 2)}\n`);
}

export async function loadProject(projectDir) {
  const project = JSON.parse(await fs.readFile(path.join(projectDir, "project.json"), "utf8"));
  let workflowRun = null;
  try {
    workflowRun = JSON.parse(await fs.readFile(path.join(projectDir, "workflow-run.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const normalizedProject = normalizeProjectMetadata(project);
  const failures = [...normalizedProject.failures];
  if (workflowRun) failures.push(...validateWorkflowRun(workflowRun).failures);
  const referencesWorkflow = normalizedProject.value.workflowRunId && workflowRun?.id === normalizedProject.value.workflowRunId;
  return {
    project: referencesWorkflow ? syncStageState(normalizedProject.value, workflowRun) : normalizedProject.value,
    workflowRun: referencesWorkflow ? workflowRun : null,
    failures,
  };
}
