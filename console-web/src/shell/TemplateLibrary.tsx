// v2-P5: 风格库/模板库 tab — save the current project's plan as a reusable
// template (spec acceptance #5) and apply a template to the current project
// (#6). Read-only list + a minimal save form + per-template "套用" action.
import { useState } from "react";
import type { TemplateSummary } from "../lib/api";

export interface TemplateStatus {
  kind: "ok" | "error" | "conflict";
  text: string;
}

export function TemplateLibrary(props: {
  templates: TemplateSummary[];
  currentProject: string | null;
  canEdit: boolean;
  busy: boolean;
  status: TemplateStatus | null;
  onRefresh: () => void;
  onSave: (body: { name: string; description: string; overwrite: boolean }) => void;
  onApply: (templateId: string) => void;
}) {
  const { templates, currentProject, canEdit, busy, status, onRefresh, onSave, onApply } = props;
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [overwrite, setOverwrite] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), overwrite });
  };

  return (
    <div className="pc-templates">
      <div className="pc-panelhead">风格库 · 模板</div>

      <div className="pc-plan-actions">
        <button className="primary" disabled={!canEdit || busy} onClick={() => setShowForm((v) => !v)}>
          ＋ 另存当前方案为模板
        </button>
        <button disabled={busy} onClick={onRefresh}>
          {busy ? "…" : "刷新"}
        </button>
      </div>
      {!currentProject && <div className="pc-note muted">先在「方案」选择或新建一个项目，才能另存 / 套用模板。</div>}

      {showForm && (
        <div className="pc-tpl-form">
          <label className="pc-tpl-field">
            <span>模板名</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 product-intro-3card" />
          </label>
          <label className="pc-tpl-field">
            <span>描述</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" />
          </label>
          <label className="pc-checkfield">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
            覆盖同名模板（overwrite）
          </label>
          <div className="pc-tpl-form-actions">
            <button className="primary" disabled={!name.trim() || busy} onClick={submit}>
              {busy ? "保存中…" : "保存模板"}
            </button>
            <button disabled={busy} onClick={() => setShowForm(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className={status.kind === "ok" ? "banner ok-banner" : "banner warn"}>
          {status.text}
          {status.kind === "conflict" && <div className="pc-note">勾选「覆盖同名模板」后再保存。</div>}
        </div>
      )}

      <div className="pc-sectlabel">
        <span>模板（{templates.length}）</span>
        <span className="muted">套用会用模板重写当前方案</span>
      </div>
      <ul className="pc-tpl-list">
        {templates.length === 0 && <li className="pc-note muted">还没有模板 — 在上面把当前方案另存为模板。</li>}
        {templates.map((t) => (
          <li key={t.id} className="pc-tpl-item">
            <div className="pc-tpl-main">
              <div className="pc-tpl-name">{t.name}</div>
              {t.description && <div className="pc-tpl-desc muted">{t.description}</div>}
              <div className="pc-tpl-id muted">{t.id}</div>
            </div>
            <button disabled={!canEdit || busy} onClick={() => onApply(t.id)} title="用该模板重写当前项目的方案">
              套用
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
