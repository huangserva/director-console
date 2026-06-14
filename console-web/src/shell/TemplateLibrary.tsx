// v2-P5 → v3-2: 风格库/模板库 tab。原列表升级成可视化 gallery（借鉴 Pixelle docs，守渲染现实）。
// 每模板卡：名称/描述/卡片序列摘要/媒体需求/aspect 16:9 徽标/代表性预览(cardType mini 版式)。
// 按 用途/媒体需求 筛选。『套用』复用 onApply（App 内含 v2 套用后 media 预检）。『另存当前为模板』入口保留。
import { useEffect, useMemo, useState } from "react";
import { getTemplate, type TemplateSummary } from "../lib/api";
import {
  distinctUses,
  filterGalleryCards,
  galleryCardFromDetail,
  type GalleryCard,
  type MediaFilter,
  type TemplateDetail,
} from "../lib/template-gallery";

export interface TemplateStatus {
  kind: "ok" | "warn" | "error" | "conflict";
  text: string;
  /** Optional inline action — e.g. 跳到第一个未绑定卡片 after a template apply leaves media unbound. */
  action?: { label: string; onClick: () => void };
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

  // gallery 卡数据：逐模板取详情（cardRules + mediaRequirements）派生。
  const [cards, setCards] = useState<GalleryCard[] | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [useFilter, setUseFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (templates.length === 0) {
      setCards([]);
      return;
    }
    setLoadingDetails(true);
    Promise.all(
      templates.map((t) =>
        getTemplate(t.id)
          .then((d) => galleryCardFromDetail(d as unknown as TemplateDetail))
          .catch(() =>
            // 详情拉取失败 → 用 summary 兜底（无卡片序列/媒体需求），不漏卡。
            galleryCardFromDetail({ id: t.id, name: t.name, description: t.description, cardRules: [] }),
          ),
      ),
    ).then((built) => {
      if (cancelled) return;
      setCards(built);
      setLoadingDetails(false);
    });
    return () => {
      cancelled = true;
    };
  }, [templates]);

  const uses = useMemo(() => (cards ? distinctUses(cards) : []), [cards]);
  const filtered = useMemo(() => (cards ? filterGalleryCards(cards, { media: mediaFilter, use: useFilter }) : []), [cards, mediaFilter, useFilter]);

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
          {status.action && (
            <div className="pc-tpl-status-actions">
              <button className="primary" disabled={busy} onClick={status.action.onClick}>
                {status.action.label}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 筛选：媒体需求 + 用途（主卡类，数据派生）。 */}
      {cards && cards.length > 0 && (
        <div className="pc-gal-filters">
          <div className="pc-gal-filtergroup">
            <span className="pc-gal-filterlabel">媒体需求</span>
            {(
              [
                { id: "all", label: "全部" },
                { id: "with-media", label: "需素材" },
                { id: "no-media", label: "无需素材" },
              ] as { id: MediaFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={mediaFilter === f.id ? "pc-gal-chip active" : "pc-gal-chip"}
                onClick={() => setMediaFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {uses.length > 1 && (
            <div className="pc-gal-filtergroup">
              <span className="pc-gal-filterlabel">用途</span>
              <button type="button" className={useFilter === null ? "pc-gal-chip active" : "pc-gal-chip"} onClick={() => setUseFilter(null)}>
                全部
              </button>
              {uses.map((u) => (
                <button key={u} type="button" className={useFilter === u ? "pc-gal-chip active" : "pc-gal-chip"} onClick={() => setUseFilter(u)}>
                  {u}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pc-sectlabel">
        <span>模板（{filtered.length}{cards && filtered.length !== cards.length ? ` / ${cards.length}` : ""}）</span>
        <span className="muted">套用会用模板重写当前方案</span>
      </div>

      {loadingDetails && cards === null && <div className="pc-note muted">加载模板…</div>}
      {cards && cards.length === 0 && <div className="pc-note muted">还没有模板 — 在上面把当前方案另存为模板。</div>}
      {cards && cards.length > 0 && filtered.length === 0 && <div className="pc-note muted">没有符合筛选的模板，换个筛选条件。</div>}

      <div className="pc-gal-grid">
        {filtered.map((c) => (
          <div key={c.id} className="pc-gal-card">
            {/* 代表性预览：16:9 框 + cardType 序列 mini 版式（真渲染缩略图 future）。 */}
            <div className="pc-gal-thumb">
              <span className="pc-gal-aspect">{c.aspect}</span>
              <div className="pc-gal-tiles">
                {c.tiles.length === 0 && <span className="pc-gal-tile empty">无卡片</span>}
                {c.tiles.map((t, i) => (
                  <span key={i} className="pc-gal-tile" title={t.label}>
                    {t.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="pc-gal-body">
              {/* 模板名/描述是作者内容（常为英文 id 式命名）；复用 i18n harness 已剔除的 .pc-tpl-name/.pc-tpl-desc 类，规避误判。 */}
              <div className="pc-gal-name pc-tpl-name">{c.name}</div>
              {c.description && <div className="pc-gal-desc muted pc-tpl-desc">{c.description}</div>}

              <div className="pc-gal-meta">
                <span className="pc-gal-metakv">
                  卡片 <strong>{c.cards.total}</strong> 张
                  {c.cards.types.length > 0 && <span className="muted">（{c.cards.types.map((x) => `${x.label}×${x.count}`).join("、")}）</span>}
                </span>
                <span className="pc-gal-metakv">
                  {c.media.count > 0 ? (
                    <>
                      需 <strong>{c.media.count}</strong> 处素材
                      <span className="muted">（{c.media.kinds.map((k) => `${k.label}×${k.count}`).join("、")}）</span>
                    </>
                  ) : (
                    <span className="muted">无需素材</span>
                  )}
                </span>
              </div>

              <div className="pc-gal-tags">
                <span className="pc-gal-tag">用途 {c.use}</span>
                <code className="pc-gal-id">{c.id}</code>
              </div>

              <button className="pc-gal-apply" disabled={!canEdit || busy} onClick={() => onApply(c.id)} title="用该模板重写当前项目的方案">
                套用
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
