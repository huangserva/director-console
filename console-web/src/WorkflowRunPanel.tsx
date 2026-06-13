import type { StageStatus, WorkflowRun } from "./lib/api";
import { runHasNeedsReview, serviceUnavailableMessages, type StageGate } from "./lib/workflow";

const STATUS_LABEL: Record<StageStatus, string> = {
  "not-started": "未开始",
  ready: "就绪",
  running: "运行中",
  succeeded: "成功",
  failed: "失败",
  skipped: "已跳过",
  "needs-review": "待复核",
};

export function WorkflowRunPanel(props: {
  projectName: string;
  run: WorkflowRun;
  gates: Record<string, StageGate>;
  busy: boolean;
  failures: string[] | null;
  onRunStage: (stageId: string) => void;
  onApproveCheckpoint: (checkpointId: string) => void;
  onClose: () => void;
}) {
  const { projectName, run, gates, busy, failures, onRunStage, onApproveCheckpoint, onClose } = props;
  const openCheckpoints = run.checkpoints.filter((c) => c.status === "open");
  const serviceMessages = serviceUnavailableMessages(run);
  const needsReview = runHasNeedsReview(run);

  return (
    <div className="workflow">
      <div className="panel-title">
        工作流 · {projectName} <span className="muted">· 流程 {run.recipeId}</span>
        <button className="link-btn" onClick={onClose}>
          收起
        </button>
      </div>

      {(serviceMessages.length > 0 || needsReview) && (
        <div className="banner warn">
          <strong>部分阶段需要未启动的外部服务。</strong> 这不是 bug — 启动服务（TTS / DUIX）后，重跑受影响的阶段。
          {serviceMessages.length > 0 && (
            <ul className="failures">
              {serviceMessages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {failures && failures.length > 0 && (
        <div className="banner warn">
          状态切换被拒：
          <ul className="failures">
            {failures.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <ol className="stages">
        {run.stages.map((stage) => {
          const isCurrent = run.currentStageId === stage.id;
          // Default to runnable when no gate is known, so a missing gate never hides the action.
          const gate = gates[stage.id] ?? { runnable: true, blockedBy: [] };
          const blocked = !gate.runnable;
          return (
            <li key={stage.id} className={isCurrent ? "stage-row current" : "stage-row"}>
              <span className={`status-badge status-${stage.status}`}>{STATUS_LABEL[stage.status]}</span>
              <span className="stage-name">{stage.recipeStageId}</span>
              {blocked && <span className="blocked-note">等待 {gate.blockedBy.join("、")}</span>}
              {stage.logPath && <span className="muted stage-log">日志：{stage.logPath}</span>}
              <span className="stage-actions">
                <button
                  onClick={() => onRunStage(stage.id)}
                  disabled={busy || blocked}
                  title={blocked ? `被阻塞 — 等待 ${gate.blockedBy.join("、")}` : "运行 / 重跑该阶段"}
                >
                  {busy ? "…" : blocked ? "被阻塞" : "运行"}
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      {openCheckpoints.length > 0 && (
        <div className="checkpoints">
          <div className="panel-subtitle">待复核的检查点</div>
          {openCheckpoints.map((cp) => (
            <div className="checkpoint-row" key={cp.id}>
              <span className="status-badge status-needs-review">待复核</span>
              <span className="stage-name">
                {cp.id} <span className="muted">@ {cp.stageId}</span>
              </span>
              {cp.notes && <span className="muted">{cp.notes}</span>}
              <button className="primary" onClick={() => onApproveCheckpoint(cp.id)} disabled={busy}>
                通过
              </button>
            </div>
          ))}
        </div>
      )}

      {run.errors.length > 0 && (
        <div className="run-errors">
          <div className="panel-subtitle">错误</div>
          <ul className="failures">
            {run.errors.map((e, i) => (
              <li key={i}>
                {e.stageId ? `[${e.stageId}] ` : ""}
                {e.message}
                {e.code ? ` (${e.code})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
