// v2 captions: parse a composer captions.json into editable cues, edit text/time,
// and project cues back into a packaging-plan subtitle track. The composer file is
// { ..., captions: [{ start, end, text, ... }] } (or a bare array).
import type { PlanTrackClip } from "./packaging-plan";

export interface Cue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export function parseCaptions(raw: unknown): Cue[] {
  const arr = Array.isArray(raw) ? raw : ((raw as { captions?: unknown[] })?.captions ?? []);
  return (arr as Record<string, unknown>[]).map((c, i) => ({
    id: `cue-${i + 1}`,
    start: Number(c.start ?? 0),
    end: Number(c.end ?? Number(c.start ?? 0) + Number((c as { duration?: number }).duration ?? 0)),
    text: String(c.text ?? c.asr_text ?? ""),
  }));
}

export function updateCue(cues: Cue[], id: string, patch: Partial<Pick<Cue, "text" | "start" | "end">>): Cue[] {
  return cues.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

/**
 * Project cues into a packaging-plan subtitle track (one clip per cue). When the
 * backend consumes subtitle cues this round-trips edited text into compose; today
 * the server keeps a single file-ref clip, so this is the forward-compatible shape.
 */
export function cuesToSubtitleTrack(cues: Cue[]): (PlanTrackClip & { text: string })[] {
  return cues.map((c) => ({
    id: c.id,
    track: "subtitle" as const,
    start: c.start,
    duration: Math.max(0.01, c.end - c.start),
    text: c.text,
  }));
}
