import fs from "node:fs";
import path from "node:path";

export const ASSET_TYPES = [
  "video",
  "audio",
  "captions",
  "transcript",
  "scene-plan",
  "manifest",
  "html",
  "render",
  "image",
  "script",
  "metadata",
  "other",
];

export const ASSET_STATUSES = ["pending", "ready", "missing", "failed", "stale"];
export const WORKFLOW_STAGE_STATUSES = ["not-started", "ready", "running", "succeeded", "failed", "skipped", "needs-review"];
export const CHECKPOINT_STATUSES = ["open", "approved", "rejected", "skipped"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushRequiredString(failures, value, path) {
  if (typeof value !== "string" || !value.trim()) failures.push(`${path} is required`);
}

function pushArray(failures, value, path) {
  if (!Array.isArray(value)) failures.push(`${path} must be an array`);
}

function validateDateString(failures, value, path) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) failures.push(`${path} must be a finite timestamp number`);
    return;
  }
  pushRequiredString(failures, value, path);
  if (typeof value === "string" && Number.isNaN(Date.parse(value))) failures.push(`${path} must be an ISO date string`);
}

function validateStageArray(stages, failures, path = "stages") {
  pushArray(failures, stages, path);
  if (!Array.isArray(stages)) return new Set();

  const ids = new Set();
  stages.forEach((stage, index) => {
    if (!isObject(stage)) {
      failures.push(`${path}[${index}] must be an object`);
      return;
    }
    pushRequiredString(failures, stage.id, `${path}[${index}].id`);
    pushRequiredString(failures, stage.type, `${path}[${index}].type`);
    pushRequiredString(failures, stage.name, `${path}[${index}].name`);
    if (typeof stage.id === "string") {
      if (ids.has(stage.id)) failures.push(`${path}[${index}].id duplicates "${stage.id}"`);
      ids.add(stage.id);
    }
    if (stage.dependsOn !== undefined) pushArray(failures, stage.dependsOn, `${path}[${index}].dependsOn`);
    if (stage.outputs !== undefined) pushArray(failures, stage.outputs, `${path}[${index}].outputs`);
  });

  stages.forEach((stage, index) => {
    if (!Array.isArray(stage?.dependsOn)) return;
    stage.dependsOn.forEach((dependency, depIndex) => {
      if (!ids.has(dependency)) failures.push(`${path}[${index}].dependsOn[${depIndex}] references unknown stage "${dependency}"`);
    });
  });

  return ids;
}

export function validateRecipe(recipe) {
  const failures = [];
  if (!isObject(recipe)) return { value: recipe, failures: ["recipe must be an object"] };

  pushRequiredString(failures, recipe.id, "recipe.id");
  pushRequiredString(failures, recipe.name, "recipe.name");
  pushRequiredString(failures, recipe.description, "recipe.description");
  pushArray(failures, recipe.inputRequirements, "recipe.inputRequirements");
  pushArray(failures, recipe.optionalInputs, "recipe.optionalInputs");
  validateStageArray(recipe.stages, failures, "stages");
  pushRequiredString(failures, recipe.defaultThemePackId, "recipe.defaultThemePackId");
  pushArray(failures, recipe.recommendedComponents, "recipe.recommendedComponents");
  pushArray(failures, recipe.validationGates, "recipe.validationGates");

  return { value: recipe, failures };
}

function catalogComponentIds(catalog) {
  return new Set([...(catalog.coarseSceneComponents || []), ...(catalog.controlledFinePieces || [])].map((item) => item.id).filter(Boolean));
}

export function validateRecipeCatalog(recipe, { catalog, composerRoot = path.resolve(import.meta.dirname, "../../../hyperframes-composer") } = {}) {
  const failures = [];
  const sourceCatalog =
    catalog ||
    JSON.parse(fs.readFileSync(path.join(composerRoot, "components", "catalog.json"), "utf8"));
  const componentIds = catalogComponentIds(sourceCatalog);

  if (!Array.isArray(recipe?.recommendedComponents)) {
    failures.push("recipe.recommendedComponents must be an array");
    return { value: recipe, failures };
  }

  recipe.recommendedComponents.forEach((component, index) => {
    if (!componentIds.has(component)) failures.push(`recommendedComponents[${index}] "${component}" is not in composer catalog`);
  });
  return { value: recipe, failures };
}

export function validateAsset(asset) {
  const failures = [];
  if (!isObject(asset)) return { value: asset, failures: ["asset must be an object"] };

  pushRequiredString(failures, asset.id, "asset.id");
  pushRequiredString(failures, asset.type, "asset.type");
  pushRequiredString(failures, asset.path, "asset.path");
  pushRequiredString(failures, asset.status, "asset.status");
  if (asset.type && !ASSET_TYPES.includes(asset.type)) failures.push(`asset.type "${asset.type}" is not supported`);
  if (asset.status && !ASSET_STATUSES.includes(asset.status)) failures.push(`asset.status "${asset.status}" is not supported`);
  if (asset.media !== undefined && !isObject(asset.media)) failures.push("asset.media must be an object");
  if (asset.provenance !== undefined && !isObject(asset.provenance)) failures.push("asset.provenance must be an object");
  if (asset.createdByStageId !== undefined && typeof asset.createdByStageId !== "string") failures.push("asset.createdByStageId must be a string");

  return { value: asset, failures };
}

export function validateWorkflowRun(workflowRun) {
  const failures = [];
  if (!isObject(workflowRun)) return { value: workflowRun, failures: ["workflowRun must be an object"] };

  pushRequiredString(failures, workflowRun.id, "workflowRun.id");
  pushRequiredString(failures, workflowRun.projectId, "workflowRun.projectId");
  pushRequiredString(failures, workflowRun.recipeId, "workflowRun.recipeId");
  const stageIds = validateWorkflowStages(workflowRun.stages, failures);
  if (workflowRun.currentStageId !== null && workflowRun.currentStageId !== undefined) {
    pushRequiredString(failures, workflowRun.currentStageId, "workflowRun.currentStageId");
    if (typeof workflowRun.currentStageId === "string" && !stageIds.has(workflowRun.currentStageId)) {
      failures.push(`workflowRun.currentStageId references unknown stage "${workflowRun.currentStageId}"`);
    }
  }
  validateCheckpoints(workflowRun.checkpoints, failures, stageIds);
  validateErrors(workflowRun.errors, failures, stageIds);
  validateDateString(failures, workflowRun.startedAt, "workflowRun.startedAt");
  validateDateString(failures, workflowRun.updatedAt, "workflowRun.updatedAt");

  return { value: workflowRun, failures };
}

function validateWorkflowStages(stages, failures) {
  pushArray(failures, stages, "workflowRun.stages");
  const ids = new Set();
  if (!Array.isArray(stages)) return ids;
  stages.forEach((stage, index) => {
    if (!isObject(stage)) {
      failures.push(`workflowRun.stages[${index}] must be an object`);
      return;
    }
    pushRequiredString(failures, stage.id, `workflowRun.stages[${index}].id`);
    pushRequiredString(failures, stage.recipeStageId, `workflowRun.stages[${index}].recipeStageId`);
    pushRequiredString(failures, stage.status, `workflowRun.stages[${index}].status`);
    if (stage.status && !WORKFLOW_STAGE_STATUSES.includes(stage.status)) {
      failures.push(`workflowRun.stages[${index}].status "${stage.status}" is not supported`);
    }
    if (typeof stage.id === "string") {
      if (ids.has(stage.id)) failures.push(`workflowRun.stages[${index}].id duplicates "${stage.id}"`);
      ids.add(stage.id);
    }
  });
  return ids;
}

function validateCheckpoints(checkpoints, failures, stageIds) {
  pushArray(failures, checkpoints, "workflowRun.checkpoints");
  if (!Array.isArray(checkpoints)) return;
  checkpoints.forEach((checkpoint, index) => {
    if (!isObject(checkpoint)) {
      failures.push(`workflowRun.checkpoints[${index}] must be an object`);
      return;
    }
    pushRequiredString(failures, checkpoint.id, `workflowRun.checkpoints[${index}].id`);
    pushRequiredString(failures, checkpoint.stageId, `workflowRun.checkpoints[${index}].stageId`);
    pushRequiredString(failures, checkpoint.status, `workflowRun.checkpoints[${index}].status`);
    if (checkpoint.status && !CHECKPOINT_STATUSES.includes(checkpoint.status)) {
      failures.push(`workflowRun.checkpoints[${index}].status "${checkpoint.status}" is not supported`);
    }
    if (typeof checkpoint.stageId === "string" && !stageIds.has(checkpoint.stageId)) {
      failures.push(`workflowRun.checkpoints[${index}].stageId references unknown stage "${checkpoint.stageId}"`);
    }
  });
}

function validateErrors(errors, failures, stageIds) {
  pushArray(failures, errors, "workflowRun.errors");
  if (!Array.isArray(errors)) return;
  errors.forEach((error, index) => {
    if (!isObject(error)) {
      failures.push(`workflowRun.errors[${index}] must be an object`);
      return;
    }
    pushRequiredString(failures, error.message, `workflowRun.errors[${index}].message`);
    if (error.stageId !== undefined && !stageIds.has(error.stageId)) {
      failures.push(`workflowRun.errors[${index}].stageId references unknown stage "${error.stageId}"`);
    }
  });
}

export function normalizeProjectMetadata(projectMetadata = {}) {
  const failures = [];
  const input = isObject(projectMetadata) ? projectMetadata : {};
  const value = {
    ...input,
    recipeId: input.recipeId ?? null,
    workflowRunId: input.workflowRunId ?? null,
    sourceCapabilities: input.sourceCapabilities ?? [],
    assets: input.assets ?? [],
    stageState: input.stageState ?? {},
    outputs: input.outputs ?? {},
  };

  if (value.recipeId !== null && typeof value.recipeId !== "string") failures.push("projectMetadata.recipeId must be a string or null");
  if (value.workflowRunId !== null && typeof value.workflowRunId !== "string") failures.push("projectMetadata.workflowRunId must be a string or null");
  pushArray(failures, value.sourceCapabilities, "projectMetadata.sourceCapabilities");
  pushArray(failures, value.assets, "projectMetadata.assets");
  if (!isObject(value.stageState)) failures.push("projectMetadata.stageState must be an object");
  if (!isObject(value.outputs)) failures.push("projectMetadata.outputs must be an object");
  if (Array.isArray(value.assets)) {
    value.assets.forEach((asset, index) => {
      for (const failure of validateAsset(asset).failures) failures.push(`projectMetadata.assets[${index}].${failure}`);
    });
  }

  return { value, failures };
}
