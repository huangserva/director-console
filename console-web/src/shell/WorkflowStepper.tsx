// Top-bar workflow stepper: 导入 → 字幕 → 包装 → 校验 → 渲染. Done ticked, current
// highlighted, locked greyed — so the operator always knows where they are.
import type { WorkflowStep } from "../lib/guidance";

export function WorkflowStepper({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="pc-stepper" role="list" aria-label="工作流进度">
      {steps.map((s, i) => (
        <div key={s.id} className="pc-step-wrap">
          <div className={`pc-step pc-step-${s.status}`} role="listitem" aria-current={s.status === "current"}>
            <span className="pc-step-dot">{s.status === "done" ? "✓" : i + 1}</span>
            <span className="pc-step-label">{s.label}</span>
          </div>
          {i < steps.length - 1 && <span className={s.status === "done" ? "pc-step-sep done" : "pc-step-sep"} />}
        </div>
      ))}
    </div>
  );
}
