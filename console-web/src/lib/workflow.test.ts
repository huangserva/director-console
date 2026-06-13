import { describe, expect, it } from "vitest";
import type { StageStatus, WorkflowRun } from "./api";
import {
  computeStageGates,
  isDependencySatisfied,
  runHasNeedsReview,
  serviceUnavailableMessages,
} from "./workflow";

type S = { id: string; status: StageStatus };

const dependsOn = {
  probe: [],
  asr: ["probe"],
  transcript: ["asr"],
};
const labels = { probe: "Probe source media", asr: "Extract audio and transcribe", transcript: "Build transcript" };

describe("isDependencySatisfied", () => {
  it("counts only succeeded or skipped as satisfied", () => {
    expect(isDependencySatisfied("succeeded")).toBe(true);
    expect(isDependencySatisfied("skipped")).toBe(true);
    expect(isDependencySatisfied("not-started")).toBe(false);
    expect(isDependencySatisfied("ready")).toBe(false);
    expect(isDependencySatisfied("running")).toBe(false);
    expect(isDependencySatisfied("failed")).toBe(false);
    expect(isDependencySatisfied("needs-review")).toBe(false);
    expect(isDependencySatisfied(undefined)).toBe(false);
  });
});

describe("computeStageGates", () => {
  it("makes a no-dependency stage runnable and blocks a downstream stage until its dep succeeds", () => {
    const stages: S[] = [
      { id: "probe", status: "not-started" },
      { id: "asr", status: "not-started" },
      { id: "transcript", status: "not-started" },
    ];
    const gates = computeStageGates(stages, dependsOn, labels);

    expect(gates.probe.runnable).toBe(true);
    expect(gates.probe.blockedBy).toEqual([]);
    expect(gates.asr.runnable).toBe(false);
    expect(gates.asr.blockedBy).toEqual(["Probe source media"]); // label, not id
    expect(gates.transcript.runnable).toBe(false);
  });

  it("unblocks a stage once all its deps are succeeded/skipped", () => {
    const stages: S[] = [
      { id: "probe", status: "succeeded" },
      { id: "asr", status: "not-started" },
      { id: "transcript", status: "not-started" },
    ];
    const gates = computeStageGates(stages, dependsOn, labels);
    expect(gates.asr.runnable).toBe(true);
    expect(gates.asr.blockedBy).toEqual([]);
    // transcript still waits on asr
    expect(gates.transcript.runnable).toBe(false);
    expect(gates.transcript.blockedBy).toEqual(["Extract audio and transcribe"]);
  });

  it("treats a skipped dependency as satisfied", () => {
    const stages: S[] = [
      { id: "probe", status: "skipped" },
      { id: "asr", status: "not-started" },
    ];
    const gates = computeStageGates(stages, dependsOn, labels);
    expect(gates.asr.runnable).toBe(true);
  });

  it("falls back to the stage id as label when no label map is given", () => {
    const stages: S[] = [
      { id: "probe", status: "running" },
      { id: "asr", status: "not-started" },
    ];
    const gates = computeStageGates(stages, dependsOn);
    expect(gates.asr.blockedBy).toEqual(["probe"]);
  });
});

describe("needs-review / service-unavailable helpers", () => {
  const run: WorkflowRun = {
    id: "r",
    projectId: "p",
    recipeId: "digital-human-talking-head",
    stages: [
      { id: "script", recipeStageId: "script", status: "succeeded" },
      { id: "tts", recipeStageId: "tts", status: "needs-review" },
      { id: "lip-sync", recipeStageId: "lip-sync", status: "needs-review" },
    ],
    currentStageId: "tts",
    checkpoints: [],
    errors: [
      { stageId: "tts", code: "SERVICE_UNAVAILABLE", message: "CosyVoice3 at 127.0.0.1:4090 is not reachable" },
      { stageId: "lip-sync", code: "SERVICE_UNAVAILABLE", message: "DUIX/HeyGem service is not running" },
      { stageId: "x", code: "OTHER", message: "ignored" },
    ],
    startedAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
  };

  it("collects only SERVICE_UNAVAILABLE error messages", () => {
    expect(serviceUnavailableMessages(run)).toEqual([
      "CosyVoice3 at 127.0.0.1:4090 is not reachable",
      "DUIX/HeyGem service is not running",
    ]);
  });

  it("detects a needs-review stage", () => {
    expect(runHasNeedsReview(run)).toBe(true);
    expect(runHasNeedsReview({ ...run, stages: [{ id: "a", recipeStageId: "a", status: "succeeded" }] })).toBe(false);
  });

  it("returns no messages when there are no service errors", () => {
    expect(serviceUnavailableMessages({ ...run, errors: [] })).toEqual([]);
  });
});
