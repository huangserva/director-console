// v3-3 任务历史 + 回滚（Inspector 历史 tab）。自取 GET history → 列条目；点开 GET detail → 该快照摘要；
// 每条（除当前态）『回滚到此』→ 确认 → POST restore → 成功重载项目 + 绿 banner；422 展 failures 不吞、404 友好提示。
import { useCallback, useEffect, useState } from "react";
import { getHistoryEntry, getProjectHistory, restoreHistory } from "../lib/api";
import {
  formatHistoryTime,
  historyArtifacts,
  type HistoryEntry,
  historyKindLabel,
  historyParamsSummary,
  historyValidationBadge,
  mediaPreviewHref,
  snapshotSummary,
} from "../lib/history";
import type { PackagingPlan } from "../lib/packaging-plan";

export function HistoryPanel(props: { projectName: string | null; active: boolean; onRestored: () => void }) {
  const { projectName, active, onRestored } = props;
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ entry: HistoryEntry; plan: PackagingPlan | null } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreFailures, setRestoreFailures] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    if (!projectName) {
      setEntries(null);
      return;
    }
    setLoading(true);
    setListError(null);
    const res = await getProjectHistory(projectName);
    setLoading(false);
    if (res.ok) setEntries(res.entries ?? []);
    else {
      setEntries(null);
      setListError(res.error ?? "无法加载历史。");
    }
  }, [projectName]);

  // 进入历史 tab（或换项目）时拉取；收起时不主动清，便于回看。
  useEffect(() => {
    if (active && projectName) {
      setOpenId(null);
      setDetail(null);
      setConfirmId(null);
      load();
    }
  }, [active, projectName, load]);

  const toggleDetail = async (id: string) => {
    setConfirmId(null);
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    const res = await getHistoryEntry(projectName ?? "", id);
    setDetailLoading(false);
    if (res.ok && res.entry) setDetail({ entry: res.entry, plan: res.plan ?? null });
  };

  const doRestore = async (id: string) => {
    if (!projectName) return;
    setRestoringId(id);
    setRestoreError(null);
    setRestoreFailures(null);
    setBanner(null);
    const res = await restoreHistory(projectName, id);
    setRestoringId(null);
    if (res.ok) {
      setConfirmId(null);
      setBanner(`已回滚到 ${id} —— 当前方案与 manifest 已重发布。`);
      await load(); // 历史多一条 restore（成为新的当前态）
      onRestored(); // 重载项目：刷新画布 + 时间线
    } else if (res.failures && res.failures.length) {
      setRestoreFailures(res.failures); // 422 校验失败：不发布，展示问题
    } else {
      setRestoreError(res.error ?? "回滚失败。"); // 404 等
    }
  };

  if (!projectName) {
    return (
      <div className="pc-inspsect">
        <h4>历史</h4>
        <div className="pc-note muted">先在左上选择或新建一个项目，这里会列出它的任务历史。</div>
      </div>
    );
  }

  return (
    <div className="pc-inspsect pc-history">
      <div className="pc-history-head">
        <h4>历史</h4>
        <button type="button" className="pc-history-refresh" onClick={load} disabled={loading} title="刷新历史">
          {loading ? "刷新中…" : "刷新"}
        </button>
      </div>

      {banner && <div className="pc-history-banner ok">{banner}</div>}
      {listError && <div className="pc-history-banner bad">{listError}</div>}

      {!loading && entries && entries.length === 0 && (
        <div className="pc-note muted">暂无历史。导入、套模板、渲染、字幕识别、回滚都会在这里留下一条可回滚的快照。</div>
      )}

      {entries && entries.length > 0 && (
        <ul className="pc-history-list">
          {entries.map((e, i) => {
            const badge = historyValidationBadge(e.validation);
            const arts = historyArtifacts(e);
            const isCurrent = i === 0; // 倒序：第一条 = 当前态
            const expanded = openId === e.id;
            const summary = historyParamsSummary(e);
            return (
              <li key={e.id} className={expanded ? "pc-history-item open" : "pc-history-item"}>
                <button type="button" className="pc-history-row" onClick={() => toggleDetail(e.id)}>
                  <span className="pc-history-time">{formatHistoryTime(e.ts)}</span>
                  <span className="pc-history-kind">{historyKindLabel(e.kind)}</span>
                  {isCurrent && <span className="pc-history-cur">当前</span>}
                  <span className={`pc-history-badge ${badge.tone}`}>{badge.label}</span>
                </button>
                {(summary.label || summary.id) && (
                  <div className="pc-history-summary">
                    {summary.label}
                    {summary.id && <code className="pc-history-id">{summary.id}</code>}
                  </div>
                )}
                {arts.length > 0 && (
                  <div className="pc-history-arts">
                    {arts.map((a) =>
                      a.downloadable ? (
                        <a key={a.kind} className="pc-history-art mp4" href={mediaPreviewHref(a.path)} target="_blank" rel="noreferrer" title={a.path}>
                          {a.label} ↗
                        </a>
                      ) : (
                        <span key={a.kind} className="pc-history-art" title={a.path}>
                          {a.label}
                        </span>
                      ),
                    )}
                  </div>
                )}

                {expanded && (
                  <div className="pc-history-detail">
                    {detailLoading && <div className="pc-note muted">加载快照…</div>}
                    {!detailLoading && detail && detail.entry.id === e.id && <SnapshotView plan={detail.plan} />}
                    {!detailLoading && !detail && <div className="pc-note muted">无法加载该快照详情。</div>}

                    {!isCurrent && (
                      <div className="pc-history-actions">
                        {confirmId === e.id ? (
                          <div className="pc-history-confirm">
                            <div className="pc-history-confirm-msg">
                              回滚到此快照会<strong>重写当前方案并重新发布 manifest</strong>（当前态会作为一条历史保留，可再回滚）。确认？
                            </div>
                            <div className="pc-history-confirm-btns">
                              <button type="button" className="pc-btn-danger" onClick={() => doRestore(e.id)} disabled={restoringId === e.id}>
                                {restoringId === e.id ? "回滚中…" : "确认回滚"}
                              </button>
                              <button type="button" className="pc-btn-ghost" onClick={() => setConfirmId(null)} disabled={restoringId === e.id}>
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="pc-history-restore"
                            onClick={() => {
                              setRestoreError(null);
                              setRestoreFailures(null);
                              setBanner(null);
                              setConfirmId(e.id);
                            }}
                          >
                            回滚到此
                          </button>
                        )}
                        {confirmId === e.id && restoreFailures && restoreFailures.length > 0 && (
                          <div className="pc-history-fail">
                            <div className="pc-history-fail-h">回滚被拦截（校验失败，未发布）：</div>
                            <ul className="failures">
                              {restoreFailures.map((f, k) => (
                                <li key={k}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {confirmId === e.id && restoreError && <div className="pc-history-banner bad">{restoreError}</div>}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SnapshotView(props: { plan: PackagingPlan | null }) {
  const s = snapshotSummary(props.plan);
  if (!props.plan) return <div className="pc-note muted">该条目无 plan 快照（无法预览/回滚）。</div>;
  return (
    <div className="pc-snapshot">
      <div className="pc-snapshot-kv">
        <span className="pc-k">场景数</span>
        <span className="pc-vv">{s.scenes}</span>
      </div>
      <div className="pc-snapshot-kv">
        <span className="pc-k">时长</span>
        <span className="pc-vv">{s.durationSec}s</span>
      </div>
      {s.cardTypes.length > 0 && (
        <div className="pc-snapshot-kv">
          <span className="pc-k">卡片类型</span>
          <span className="pc-vv">{s.cardTypes.map((c) => `${c.label}×${c.count}`).join("、")}</span>
        </div>
      )}
      <div className="pc-note muted">与相邻较早快照的增删改差异对比将在后续刀接入。</div>
    </div>
  );
}
