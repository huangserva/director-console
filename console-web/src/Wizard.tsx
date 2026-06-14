import { useEffect, useState, type ReactNode } from "react";
import { chooseNativeFile, type Recipe, type RouteARunResult, type RouteBImportResult, type SkillOutputResult } from "./lib/api";
import { T } from "./lib/i18n";
import {
  defaultRouteId,
  findRoute,
  isRouteSelectable,
  PIPELINE_ROUTES,
  type PipelineRoute,
} from "./lib/pipeline-routes";
import { SCRIPT_MAX } from "./lib/generate-form";
import { StringListInput } from "./StringListInput";

export interface RouteAValues {
  sourceVideoPath: string;
  topic: string;
  approvedScript: string;
  voiceReference: string;
}

export interface ProductIntroValues {
  sourceVideoPath: string;
  productName: string;
  productDescription: string;
  sellingPoints: string[];
  productMedia: string[];
  offerCta: string;
  voiceReference: string;
}

// A labeled form field (label + optional 必填 mark + control).
function Field(props: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="wz-field">
      <span className="wz-label">
        {props.label}
        {props.required && <span className="wz-req">{T.wizard.required}</span>}
      </span>
      {props.children}
    </label>
  );
}

export function Wizard(props: {
  recipes: Recipe[];
  recipesError: string | null;
  recommendedId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  projectName: string;
  setProjectName: (v: string) => void;
  // Route B
  videoPath: string;
  setVideoPath: (v: string) => void;
  importing: boolean;
  onImport: () => void;
  importFailure: RouteBImportResult | null;
  // Route A
  routeA: RouteAValues;
  onRouteAChange: (field: keyof RouteAValues, value: string) => void;
  runningRouteA: boolean;
  onRunRouteA: () => void;
  routeAFailure: RouteARunResult | null;
  // Product intro (M5)
  productIntro: ProductIntroValues;
  onProductIntroChange: (field: keyof ProductIntroValues, value: string | string[]) => void;
  runningProductIntro: boolean;
  onRunProductIntro: () => void;
  productIntroFailure: RouteARunResult | null;
  // 打开 skill 产物
  skillOutputPath: string;
  setSkillOutputPath: (v: string) => void;
  openingSkill: boolean;
  onOpenSkillOutput: () => void;
  skillFailure: SkillOutputResult | null;
  // v3-5 一句话自动生成（无凭据：粘脚本）
  generateScript: string;
  setGenerateScript: (v: string) => void;
  generateTitle: string;
  setGenerateTitle: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
  generateFailure: string | null;
  onClose: () => void;
}) {
  const {
    recipesError,
    recommendedId,
    selectedId,
    onSelect,
    projectName,
    setProjectName,
    videoPath,
    setVideoPath,
    importing,
    onImport,
    importFailure,
    routeA,
    onRouteAChange,
    runningRouteA,
    onRunRouteA,
    routeAFailure,
    productIntro,
    onProductIntroChange,
    runningProductIntro,
    onRunProductIntro,
    productIntroFailure,
    skillOutputPath,
    setSkillOutputPath,
    openingSkill,
    onOpenSkillOutput,
    skillFailure,
    generateScript,
    setGenerateScript,
    generateTitle,
    setGenerateTitle,
    generating,
    onGenerate,
    generateFailure,
    onClose,
  } = props;

  // Which field's native picker is in flight (for spinner/disable).
  const [browsing, setBrowsing] = useState<string | null>(null);
  // 失败详情展开（原始 error）。
  const [showSkillError, setShowSkillError] = useState(false);

  // v3-4：当前激活的能力路线 tab。初始按 App 传入的 selectedId 映射，否则取第一个可用路线。
  const [activeRouteId, setActiveRouteId] = useState<string>(() => {
    const fromSelected = PIPELINE_ROUTES.find((r) => r.recipeId !== null && r.recipeId === selectedId);
    return fromSelected ? fromSelected.id : defaultRouteId();
  });

  const busy = importing || runningRouteA || runningProductIntro || openingSkill || generating;
  const isRouteB = activeRouteId === "import";
  const isRouteA = activeRouteId === "routeA";
  const isProductIntro = activeRouteId === "productIntro";
  const isSkill = activeRouteId === "skill";
  const isGenerate = activeRouteId === "auto";
  const activeRoute = findRoute(activeRouteId);

  // 进向导即把 App 的 recipe 选择同步到当前路线（供推荐徽标/其他读取者一致）。
  useEffect(() => {
    const r = findRoute(activeRouteId);
    if (r?.recipeId && r.recipeId !== selectedId) onSelect(r.recipeId);
    // 仅在挂载时同步一次默认路线；后续切换在 selectRoute 里同步。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切路线：占位/禁用 tab 不可选；进行中锁定不切。recipe 路线同步 App 的 selectedId。
  const selectRoute = (route: PipelineRoute) => {
    if (!isRouteSelectable(route) || busy) return;
    setActiveRouteId(route.id);
    if (route.recipeId) onSelect(route.recipeId);
  };

  const routeAReady = routeA.sourceVideoPath.trim() !== "" && (routeA.topic.trim() !== "" || routeA.approvedScript.trim() !== "");
  const productIntroReady =
    productIntro.sourceVideoPath.trim() !== "" &&
    productIntro.productName.trim() !== "" &&
    productIntro.productDescription.trim() !== "" &&
    productIntro.sellingPoints.some((s) => s.trim() !== "");

  // Native OS file dialog → fill the target field. `apply` decides how to use the result.
  const browse = async (
    field: string,
    kind: "video" | "wav" | "any",
    apply: (r: { path?: string; paths?: string[] }) => void,
    multiple = false,
  ) => {
    setBrowsing(field);
    try {
      const r = await chooseNativeFile(kind, multiple);
      if (r.ok && (r.path || r.paths?.length)) apply({ path: r.path, paths: r.paths });
    } finally {
      setBrowsing(null);
    }
  };

  // A text input + native 浏览 button row.
  const pathRow = (field: string, kind: "video" | "wav", value: string, set: (v: string) => void, placeholder: string, disabled: boolean) => (
    <div className="wz-path-row">
      <input type="text" placeholder={placeholder} value={value} onChange={(e) => set(e.target.value)} disabled={disabled} />
      <button
        type="button"
        className="wz-browse"
        disabled={disabled || browsing !== null}
        onClick={() => browse(field, kind, (r) => r.path && set(r.path))}
      >
        {browsing === field ? T.wizard.browsing : T.wizard.browse}
      </button>
    </div>
  );

  return (
    <div className="wizard">
      <div className="wizard-head">
        <span className="wizard-title">{T.wizard.title}</span>
        <button className="wizard-close" onClick={onClose} disabled={busy} title={T.wizard.close}>
          ×
        </button>
      </div>

      {recipesError && <div className="banner error">{recipesError}</div>}

      {/* v3-4 显式 pipeline tabs：先选能力路线（高亮），再进对应表单；路线间可切换；占位 tab 标灰不可点。 */}
      <div className="pc-pipeline-tabs" role="tablist">
        {PIPELINE_ROUTES.map((route) => {
          const selectable = isRouteSelectable(route);
          const active = route.id === activeRouteId;
          const recommended = route.recipeId !== null && route.recipeId === recommendedId;
          return (
            <button
              key={route.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`pc-route-tab${active ? " active" : ""}${selectable ? "" : " disabled"}`}
              onClick={() => selectRoute(route)}
              disabled={!selectable || busy}
              title={selectable ? route.subtitle : "即将上线"}
            >
              <span className="pc-route-tab-title">
                {route.title}
                {recommended && selectable && <span className="badge rec">{T.wizard.recommended}</span>}
                {!selectable && <span className="badge m3">即将上线</span>}
              </span>
              <span className="pc-route-tab-sub">{route.subtitle}</span>
            </button>
          );
        })}
      </div>

      <div className="pc-pipeline-panel">
        {activeRoute && (
          <div className="pc-route-headline">
            <h3>{activeRoute.title}</h3>
            <p className="recipe-detail-desc">{activeRoute.subtitle}</p>
          </div>
        )}

        {/* 打开 skill 产物：把一个 skill 产出目录/入口导入为 console 项目，直接进四轨编辑。 */}
        {isSkill && (
          <div className="wizard-run">
            <div className="wz-path-row">
              <input
                type="text"
                placeholder="skill 产出目录或入口的绝对路径"
                value={skillOutputPath}
                onChange={(e) => setSkillOutputPath(e.target.value)}
                disabled={openingSkill}
              />
              {/* 原生选择器无「选目录」模式：选产物目录内任一文件 → 取其所在目录（后端要的是目录）。也可直接粘贴目录路径。 */}
              <button
                type="button"
                className="wz-browse"
                disabled={openingSkill || browsing !== null}
                onClick={() => browse("skill-out", "any", (r) => r.path && setSkillOutputPath(r.path.replace(/[\\/][^\\/]*$/, "")))}
              >
                {browsing === "skill-out" ? T.wizard.browsing : "选目录内文件"}
              </button>
            </div>
            <Field label={T.wizard.projectName}>
              <input
                type="text"
                placeholder={T.wizard.phAutoName}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={openingSkill}
              />
            </Field>
            <div className="wizard-actions">
              <button className="primary" onClick={onOpenSkillOutput} disabled={openingSkill || !skillOutputPath.trim()}>
                {openingSkill ? "打开中…" : "打开 skill 产物"}
              </button>
            </div>
            {openingSkill && (
              <div className="import-progress">
                <span className="spinner" /> 正在导入 skill 产物…
              </div>
            )}
            {skillFailure && !skillFailure.ok && (
              <div className="import-fail-block">
                <div className="import-fail">暂不支持该 skill 产物结构，或导入失败。</div>
                <button type="button" className="wz-detail-toggle" onClick={() => setShowSkillError((v) => !v)}>
                  {showSkillError ? "收起详情" : "查看详情"}
                </button>
                {showSkillError && skillFailure.error && <pre className="bad">{skillFailure.error}</pre>}
              </div>
            )}
          </div>
        )}

        {isRouteB && (
          <div className="wizard-run">
            <Field label={T.wizard.videoPath} required>
              {pathRow("rb-video", "video", videoPath, setVideoPath, T.wizard.phVideo, importing)}
            </Field>
            <Field label={T.wizard.projectName}>
              <input type="text" placeholder={T.wizard.phAutoName} value={projectName} onChange={(e) => setProjectName(e.target.value)} disabled={importing} />
            </Field>
            <div className="wizard-actions">
              <button className="primary" onClick={onImport} disabled={importing || !videoPath.trim()}>
                {importing ? T.wizard.importing : T.wizard.createProject}
              </button>
            </div>
            {importing && (
              <div className="import-progress">
                <span className="spinner" /> {T.wizard.importProgress}
              </div>
            )}
            {importFailure && !importFailure.ok && (
              <>
                <div className="import-fail">{T.wizard.importFailed}</div>
                {importFailure.stderr && <pre className="bad">{importFailure.stderr}</pre>}
                {importFailure.logPath && <div className="muted">{T.wizard.log}：{importFailure.logPath}</div>}
              </>
            )}
          </div>
        )}

        {isRouteA && (
          <div className="wizard-run">
            <Field label={T.wizard.sourceVideo} required>
              {pathRow("ra-src", "video", routeA.sourceVideoPath, (v) => onRouteAChange("sourceVideoPath", v), T.wizard.phSource, runningRouteA)}
            </Field>
            <Field label={T.wizard.topic}>
              <input type="text" placeholder={T.wizard.phTopic} value={routeA.topic} onChange={(e) => onRouteAChange("topic", e.target.value)} disabled={runningRouteA} />
            </Field>
            <Field label={T.wizard.approvedScript}>
              <textarea rows={3} placeholder={T.wizard.phScript} value={routeA.approvedScript} onChange={(e) => onRouteAChange("approvedScript", e.target.value)} disabled={runningRouteA} />
            </Field>
            <Field label={T.wizard.voiceRef}>
              {pathRow("ra-wav", "wav", routeA.voiceReference, (v) => onRouteAChange("voiceReference", v), T.wizard.phWav, runningRouteA)}
            </Field>
            <Field label={T.wizard.projectName}>
              <input type="text" placeholder={T.wizard.phAutoName} value={projectName} onChange={(e) => setProjectName(e.target.value)} disabled={runningRouteA} />
            </Field>
            <div className="wizard-actions">
              <button className="primary" onClick={onRunRouteA} disabled={runningRouteA || !routeAReady}>
                {runningRouteA ? T.wizard.running : T.wizard.runRouteA}
              </button>
            </div>
            {!routeAReady && <div className="muted">{T.wizard.routeANeeds}</div>}
            {runningRouteA && (
              <div className="import-progress">
                <span className="spinner" /> {T.wizard.pipelineProgress}
              </div>
            )}
            {routeAFailure && !routeAFailure.ok && (
              <>
                <div className="import-fail">{T.wizard.routeAFailed}</div>
                {routeAFailure.stderr && <pre className="bad">{routeAFailure.stderr}</pre>}
                {routeAFailure.logPath && <div className="muted">{T.wizard.log}：{routeAFailure.logPath}</div>}
              </>
            )}
          </div>
        )}

        {isProductIntro && (
          <div className="wizard-run">
            <Field label={T.wizard.sourceVideo} required>
              {pathRow("pi-src", "video", productIntro.sourceVideoPath, (v) => onProductIntroChange("sourceVideoPath", v), T.wizard.phSource, runningProductIntro)}
            </Field>
            <Field label={T.wizard.productName} required>
              <input type="text" placeholder={T.wizard.phProductName} value={productIntro.productName} onChange={(e) => onProductIntroChange("productName", e.target.value)} disabled={runningProductIntro} />
            </Field>
            <Field label={T.wizard.productDesc} required>
              <textarea rows={2} placeholder={T.wizard.phProductDesc} value={productIntro.productDescription} onChange={(e) => onProductIntroChange("productDescription", e.target.value)} disabled={runningProductIntro} />
            </Field>
            <StringListInput
              label={`${T.wizard.sellingPoints}（${T.wizard.required}）`}
              values={productIntro.sellingPoints}
              onChange={(next) => onProductIntroChange("sellingPoints", next)}
              placeholder={T.wizard.phSellingPoint}
              disabled={runningProductIntro}
            />
            <StringListInput
              label={T.wizard.productMedia}
              values={productIntro.productMedia}
              onChange={(next) => onProductIntroChange("productMedia", next)}
              placeholder={T.wizard.phMedia}
              disabled={runningProductIntro}
            />
            <button
              type="button"
              className="wz-browse wz-browse-block"
              disabled={runningProductIntro || browsing !== null}
              onClick={() =>
                browse(
                  "pi-media",
                  "video",
                  (r) => {
                    const add = r.paths ?? (r.path ? [r.path] : []);
                    if (add.length) {
                      const merged = [...productIntro.productMedia.filter((p) => p.trim() !== ""), ...add];
                      onProductIntroChange("productMedia", Array.from(new Set(merged)));
                    }
                  },
                  true,
                )
              }
            >
              {browsing === "pi-media" ? T.wizard.browsing : `${T.wizard.browse} 添加视频`}
            </button>
            <Field label={T.wizard.offerCta}>
              <input type="text" placeholder={T.wizard.phCta} value={productIntro.offerCta} onChange={(e) => onProductIntroChange("offerCta", e.target.value)} disabled={runningProductIntro} />
            </Field>
            <Field label={T.wizard.voiceRef}>
              {pathRow("pi-wav", "wav", productIntro.voiceReference, (v) => onProductIntroChange("voiceReference", v), T.wizard.phWav, runningProductIntro)}
            </Field>
            <Field label={T.wizard.projectName}>
              <input type="text" placeholder={T.wizard.phAutoName} value={projectName} onChange={(e) => setProjectName(e.target.value)} disabled={runningProductIntro} />
            </Field>
            <div className="wizard-actions">
              <button className="primary" onClick={onRunProductIntro} disabled={runningProductIntro || !productIntroReady}>
                {runningProductIntro ? T.wizard.running : T.wizard.runProductIntro}
              </button>
            </div>
            {!productIntroReady && <div className="muted">{T.wizard.productIntroNeeds}</div>}
            {runningProductIntro && (
              <div className="import-progress">
                <span className="spinner" /> {T.wizard.pipelineProgress}
              </div>
            )}
            {productIntroFailure && !productIntroFailure.ok && (
              <>
                <div className="import-fail">{T.wizard.productIntroFailed}</div>
                {productIntroFailure.stderr && <pre className="bad">{productIntroFailure.stderr}</pre>}
                {productIntroFailure.logPath && <div className="muted">{T.wizard.log}：{productIntroFailure.logPath}</div>}
              </>
            )}
          </div>
        )}

        {/* v3-5 一句话自动生成 · 无凭据路径（粘脚本 → 确定性切句 → text-only 可编辑项目）。 */}
        {isGenerate && (
          <div className="wizard-run">
            <Field label="脚本" required>
              <textarea
                rows={8}
                placeholder="粘贴一段脚本 / 口播稿。系统会确定性切句、生成标题卡 + 步骤卡的可编辑项目（媒体待绑定）。≤2 万字。"
                value={generateScript}
                onChange={(e) => setGenerateScript(e.target.value)}
                disabled={generating}
              />
            </Field>
            <div className={generateScript.length > SCRIPT_MAX ? "pc-gen-counter bad" : "pc-gen-counter muted"}>
              {generateScript.length} / {SCRIPT_MAX} 字
            </div>
            <Field label="首卡标题">
              <input type="text" placeholder="可选，留空用脚本首句" value={generateTitle} onChange={(e) => setGenerateTitle(e.target.value)} disabled={generating} />
            </Field>
            <Field label={T.wizard.projectName}>
              <input type="text" placeholder={T.wizard.phAutoName} value={projectName} onChange={(e) => setProjectName(e.target.value)} disabled={generating} />
            </Field>
            <div className="wizard-actions">
              {/* 空脚本不禁用按钮——点击走 validateGenerateForm 给出「请先粘贴脚本文本」提示（而非静默禁用）。 */}
              <button className="primary" onClick={onGenerate} disabled={generating || generateScript.length > SCRIPT_MAX}>
                {generating ? "生成中…" : "生成可编辑项目"}
              </button>
            </div>
            {generateScript.length > SCRIPT_MAX && <div className="muted">脚本超过 {SCRIPT_MAX} 字上限，请精简后再生成。</div>}
            {generating && (
              <div className="import-progress">
                <span className="spinner" /> 正在切句生成可编辑项目…
              </div>
            )}
            {generateFailure && <div className="import-fail">{generateFailure}</div>}

            {/* 待凭据的第二阶段（灰、不可点）：需先在 ⚙ 设置配置 LLM / 生成 provider。给 user 清楚预期。 */}
            <div className="pc-gen-locked">
              <div className="pc-gen-locked-head">
                <span className="pc-gen-locked-title">更强能力 · 需配置后解锁</span>
                <span className="pc-gen-locked-sub muted">以下功能需先在「⚙ 设置 · 配置中心」配置 大模型 / 生成服务，配置后解锁。</span>
              </div>
              <div className="pc-gen-locked-item">
                <span className="pc-gen-locked-name">从主题一句话自动扩写脚本</span>
                <span className="pc-gen-locked-tag">需配置 大模型服务</span>
              </div>
              <div className="pc-gen-locked-item">
                <span className="pc-gen-locked-name">自动生成卡片媒体（AI 图 / 视频）</span>
                <span className="pc-gen-locked-tag">需配置 生成服务</span>
              </div>
              <div className="pc-gen-locked-hint muted">去顶栏「⚙ 设置」配置 →</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
