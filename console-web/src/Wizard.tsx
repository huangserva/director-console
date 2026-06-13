import { useState, type ReactNode } from "react";
import { chooseNativeFile, type Recipe, type RouteARunResult, type RouteBImportResult } from "./lib/api";
import { recipeDescription, recipeName, T } from "./lib/i18n";
import { StringListInput } from "./StringListInput";

// Recipes the wizard can actually run today, each with its own run form.
const ROUTE_B_RECIPE_ID = "existing-narrated-video";
const ROUTE_A_RECIPE_ID = "digital-human-talking-head";
const PRODUCT_INTRO_RECIPE_ID = "digital-human-product-introduction";
const RUNNABLE = new Set([ROUTE_B_RECIPE_ID, ROUTE_A_RECIPE_ID, PRODUCT_INTRO_RECIPE_ID]);

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
  onClose: () => void;
}) {
  const {
    recipes,
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
    onClose,
  } = props;

  // Which field's native picker is in flight (for spinner/disable).
  const [browsing, setBrowsing] = useState<string | null>(null);

  const selected = recipes.find((r) => r.id === selectedId) ?? null;
  const busy = importing || runningRouteA || runningProductIntro;
  const isRouteB = selected?.id === ROUTE_B_RECIPE_ID;
  const isRouteA = selected?.id === ROUTE_A_RECIPE_ID;
  const isProductIntro = selected?.id === PRODUCT_INTRO_RECIPE_ID;
  const runnable = selected ? RUNNABLE.has(selected.id) : false;
  const routeAReady = routeA.sourceVideoPath.trim() !== "" && (routeA.topic.trim() !== "" || routeA.approvedScript.trim() !== "");
  const productIntroReady =
    productIntro.sourceVideoPath.trim() !== "" &&
    productIntro.productName.trim() !== "" &&
    productIntro.productDescription.trim() !== "" &&
    productIntro.sellingPoints.some((s) => s.trim() !== "");

  // Native OS file dialog → fill the target field. `apply` decides how to use the result.
  const browse = async (
    field: string,
    kind: "video" | "wav",
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

      <div className="wizard-body">
        <div className="recipe-list">
          {recipes.length === 0 && !recipesError && <div className="empty">{T.wizard.loadingRecipes}</div>}
          {recipes.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === selectedId ? "recipe-card selected" : "recipe-card"}
              onClick={() => onSelect(r.id)}
            >
              <div className="recipe-card-head">
                <span className="recipe-name">{recipeName(r.id, r.name)}</span>
                {r.id === recommendedId && <span className="badge rec">{T.wizard.recommended}</span>}
                {!RUNNABLE.has(r.id) && <span className="badge m3">{T.wizard.notImplemented}</span>}
              </div>
              <div className="recipe-desc">{recipeDescription(r.id, r.description)}</div>
            </button>
          ))}
        </div>

        <div className="recipe-detail">
          {!selected && <div className="empty">{T.wizard.pickRecipe}</div>}
          {selected && (
            <>
              <h3>{recipeName(selected.id, selected.name)}</h3>
              <p className="recipe-detail-desc">{recipeDescription(selected.id, selected.description)}</p>

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

              {!runnable && <div className="banner warn">{T.wizard.notRunnable}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
