import type { StageStatus, WorkflowRun } from "./api";

/** Messages of errors whose code marks an external service as unavailable. */
export function serviceUnavailableMessages(run: WorkflowRun): string[] {
  return (run.errors ?? [])
    .filter((e) => e.code === "SERVICE_UNAVAILABLE")
    .map((e) => e.message);
}

/** True when any stage is awaiting review (e.g. a service the run couldn't reach). */
export function runHasNeedsReview(run: WorkflowRun): boolean {
  return run.stages.some((s) => s.status === "needs-review");
}

// A dependency is satisfied only when it has finished cleanly. Mirrors the API's
// dependency gate (a stage whose deps aren't all succeeded/skipped can't run);
// this keeps the UI from offering a Run that the API would reject with 422.
export function isDependencySatisfied(status: StageStatus | undefined): boolean {
  return status === "succeeded" || status === "skipped";
}

export interface StageGate {
  runnable: boolean;
  /** Display labels of the dependencies not yet satisfied (empty when runnable). */
  blockedBy: string[];
}

/**
 * Pure dependency gate for a workflow run. A stage is runnable iff every stage in
 * its `dependsOn` is succeeded or skipped. `dependsOnById` and `labelById` are keyed
 * by stage id (which equals recipeStageId). Returns a gate per stage id.
 */
export function computeStageGates(
  stages: { id: string; status: StageStatus }[],
  dependsOnById: Record<string, string[]>,
  labelById: Record<string, string> = {},
): Record<string, StageGate> {
  const statusById = new Map(stages.map((s) => [s.id, s.status]));
  const gates: Record<string, StageGate> = {};
  for (const stage of stages) {
    const deps = dependsOnById[stage.id] ?? [];
    const blockedBy = deps
      .filter((dep) => !isDependencySatisfied(statusById.get(dep)))
      .map((dep) => labelById[dep] ?? dep);
    gates[stage.id] = { runnable: blockedBy.length === 0, blockedBy };
  }
  return gates;
}
