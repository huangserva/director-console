# Director Protocol

Lightweight M2 protocol schemas and validators for recipe-driven video workflows.

This package is intentionally zero-dependency and does not change the M0 console API
or M1 pipeline runtime. Validators return `{ value, failures }`, where `failures` is
a string array suitable for API responses.

## Public API

- `validateRecipe(recipe)` validates data-driven video type recipes.
- `validateRecipeCatalog(recipe, { composerRoot })` checks that
  `recommendedComponents` exist in the Hyperframes composer catalog.
- `validateAsset(asset)` validates managed project assets.
- `validateWorkflowRun(workflowRun)` validates workflow-run state.
- `normalizeProjectMetadata(metadata)` adds M2 extension defaults while preserving
  legacy project/manifest metadata.
- `createProjectFromRecipe(recipeId, inputs, options)` creates project metadata and
  a workflow-run from recipe stages.
- `loadProject(projectDir)` / `saveProject(projectDir, projectState)` read and write
  `project.json` and `workflow-run.json`.
- `setStageState(workflowRun, stageId, nextStatus)`, `advance(workflowRun)`,
  `addCheckpoint(workflowRun, checkpoint)`, and
  `approveCheckpoint(workflowRun, checkpointId)` provide the local state machine.
- `existingNarratedVideoRecipe` models Route B.
- `digitalHumanTalkingHeadRecipe` models Route A as a placeholder.

## Stage State Transitions

- `not-started` -> `ready`, `skipped`
- `ready` -> `running`, `skipped`, `needs-review`
- `running` -> `succeeded`, `failed`, `needs-review`
- `succeeded` -> `ready`
- `failed` -> `ready`, `skipped`
- `skipped` -> `ready`
- `needs-review` -> `ready`, `succeeded`, `skipped`
