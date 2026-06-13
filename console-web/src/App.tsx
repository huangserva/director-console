import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  approveCheckpoint,
  compose,
  getCaptions,
  getManifest,
  getPackagingPlan,
  getProject,
  getRecipe,
  applyTemplate,
  importFromVideo,
  inspect,
  lint,
  chooseNativeFile,
  listManifests,
  listRecipes,
  listTemplates,
  ManifestValidationError,
  putPackagingPlan,
  recaptionProject,
  renderProject,
  runProductIntro,
  runRouteA,
  runStage,
  saveManifest,
  saveTemplate,
  WorkflowTransitionError,
  type ComposeResult,
  type InspectResult,
  type LintResult,
  type Manifest,
  type Recipe,
  type RouteARunResult,
  type RouteBImportResult,
  type RenderOptions,
  type RenderResult,
  type Scene,
  type TemplateSummary,
  type WorkflowRun,
} from "./lib/api";
import type { Layout } from "./lib/canvas-geometry";
import { parseCaptions, type Cue } from "./lib/captions";
import {
  clampDockHeight,
  deriveWorkflowSteps,
  DOCK_DEFAULT_PX,
  DOCK_EXPANDED_PX,
  type ImportSummary as ImportSummaryData,
} from "./lib/guidance";
import { fieldHint, fieldLabel, sceneRoleLabel } from "./lib/field-labels";
import { componentName, QUALITY_LABELS, T } from "./lib/i18n";
import { applyThemeToManifest, type Theme } from "./lib/themes";
import { CaptionsModal } from "./shell/CaptionsModal";
import { ImportSummary } from "./shell/ImportSummary";
import { StylePackModal } from "./shell/StylePackModal";
import { WorkflowStepper } from "./shell/WorkflowStepper";
import { patchAnimation, patchColor, patchFont, patchLayout } from "./lib/card-edit";
import { allowedSceneTypes, catalogVersion, getComponent, listCatalogComponents } from "./lib/catalog";
import {
  CARD_TYPE_MARKER,
  makeCardScene,
  manifestToPlan,
  type CardType,
  type LibraryFilter,
  type PackagingPlan,
  type PlanCard,
} from "./lib/packaging-plan";
import { resolveNav, type NavId, type RailTab } from "./lib/nav";
import { applyEdits, flattenEditable } from "./lib/props";
import { recommendRecipeId } from "./lib/recipes";
import {
  applyReflow,
  canDeleteScene,
  componentNeedsMedia,
  countUnboundMedia,
  deleteScene,
  listMediaSlots,
  makeNewScene,
  moveScene,
  sceneUnboundMediaCount,
} from "./lib/scene-templates";
import { splitClip, timelineEndMax } from "./lib/timeline-edit";
import { compact } from "./lib/string-list";
import { computeStageGates, type StageGate } from "./lib/workflow";
import { Canvas } from "./shell/Canvas";
import { ComponentLibrary } from "./shell/ComponentLibrary";
import { FourTrackTimeline } from "./shell/FourTrackTimeline";
import { Icon, type IconName } from "./shell/Icon";
import { Inspector, type InspectorTab } from "./shell/Inspector";
import { SmartStrip } from "./shell/SmartStrip";
import { TemplateLibrary, type TemplateStatus } from "./shell/TemplateLibrary";
import { Wizard, type ProductIntroValues, type RouteAValues } from "./Wizard";
import { WorkflowRunPanel } from "./WorkflowRunPanel";

type Busy =
  | null
  | "load"
  | "save"
  | "compose"
  | "lint"
  | "inspect"
  | "import"
  | "workflow"
  | "routeA"
  | "productIntro"
  | "template"
  | "render"
  | "recaption"
  | "saveCues"
  | "applyTheme";

const EMPTY_PRODUCT_INTRO: ProductIntroValues = {
  sourceVideoPath: "",
  productName: "",
  productDescription: "",
  sellingPoints: [""],
  productMedia: [],
  offerCta: "",
  voiceReference: "",
};

const NAV_ITEMS: { id: NavId; icon: IconName; label: string }[] = [
  { id: "import", icon: "import", label: "导入素材" },
  { id: "captions", icon: "captions", label: "字幕识别" },
  { id: "analyze", icon: "analyze", label: "分析视频" },
  { id: "style", icon: "style", label: "风格包" },
  { id: "package", icon: "spark", label: "智能包装" },
  { id: "validate", icon: "check", label: "校验" },
  { id: "export", icon: "export", label: "导出设置" },
];

const RAIL_TABS: { id: RailTab; icon: IconName; label: string }[] = [
  { id: "project", icon: "project", label: "项目" },
  { id: "assets", icon: "assets", label: "素材" },
  { id: "scenes", icon: "scenes", label: "场景" },
  { id: "library", icon: "library", label: "组件库" },
  { id: "styles", icon: "style", label: "风格库" },
  { id: "plan", icon: "plan", label: "方案" },
];

// P0 自由时间轴：scene → {start,duration} 跨度，喂给 timelineEndMax 算项目总时长。
const sceneSpan = (s: Scene) => ({ start: Number(s.start ?? 0), duration: Number(s.duration ?? 0) });

export default function App() {
  const [manifests, setManifests] = useState<string[]>([]);
  const [name, setName] = useState<string>("");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [plan, setPlan] = useState<PackagingPlan | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // v2 shell navigation.
  const [railTab, setRailTab] = useState<RailTab>("library");
  const [libCategory, setLibCategory] = useState<LibraryFilter>("all");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("props");
  const [activeNav, setActiveNav] = useState<NavId>("package");
  const [notice, setNotice] = useState<string | null>(null);
  const [highlightSubtitle, setHighlightSubtitle] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // v2 nav features: captions panel, style-pack panel, export options.
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [captionsReloadKey, setCaptionsReloadKey] = useState(0);
  const [stylePackOpen, setStylePackOpen] = useState(false);
  const [exportSettingsOpen, setExportSettingsOpen] = useState(false);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({});

  // ③ 时间线 dock 可拉伸：高度持久化到 localStorage，跨刷新保留。web-only（指针事件）。
  const [dockHeight, setDockHeight] = useState<number>(() => {
    if (typeof localStorage === "undefined") return DOCK_DEFAULT_PX;
    const raw = Number(localStorage.getItem("pc-dock-height"));
    return Number.isFinite(raw) && raw > 0 ? clampDockHeight(raw, typeof window !== "undefined" ? window.innerHeight : 900) : DOCK_DEFAULT_PX;
  });
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem("pc-dock-height", String(dockHeight));
  }, [dockHeight]);
  // 拖分隔条：按下记录起点高度，move 时按位移反向加减并 clamp，up 解绑。
  const startDockResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = dockHeight;
      const onMove = (ev: PointerEvent) => {
        const delta = startY - ev.clientY; // 上拖 → 增高
        setDockHeight(clampDockHeight(startH + delta, window.innerHeight));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [dockHeight],
  );
  // 双击：在默认/展开高度间切换。
  const toggleDock = useCallback(() => {
    setDockHeight((h) => clampDockHeight(h >= DOCK_EXPANDED_PX - 1 ? DOCK_DEFAULT_PX : DOCK_EXPANDED_PX, window.innerHeight));
  }, []);

  // 核心编辑 C：源视频播放。App 持有 <video> ref（在 Canvas 渲染），时间线 ▶/⏸/seek 直接操作它。
  // 播放状态/秒数从 video 事件回流，驱动播放头与时间码。previewMode 切换画布编辑↔预览。
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      setPreviewMode(true); // 播放时自动切到预览，让用户看到画面
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);
  const seekTo = useCallback((sec: number) => {
    const v = videoRef.current;
    const t = Math.max(0, sec);
    setPlayTime(t);
    if (v && Number.isFinite(v.duration)) v.currentTime = Math.min(t, v.duration || t);
    else if (v) v.currentTime = t;
  }, []);
  const togglePreviewMode = useCallback(() => setPreviewMode((p) => !p), []);
  // 切换项目时复位播放，避免旧视频状态泄漏到新项目。
  useEffect(() => {
    setPlaying(false);
    setPlayTime(0);
    setPreviewMode(false);
  }, [name]);

  // 合成预览：轨道可见性提升到 App（👁 隐藏在预览里真生效），由 FourTrackTimeline 与 Canvas 共享。
  const [hiddenTracks, setHiddenTracks] = useState<Set<string>>(new Set());
  const toggleTrackHidden = useCallback((key: string) => {
    setHiddenTracks((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);
  useEffect(() => setHiddenTracks(new Set()), [name]); // 换项目复位可见性

  // 合成预览：字幕 cue（带 text+时间）独立于 plan 加载，供预览叠加层按 currentTime 显示当前句。
  const [cues, setCues] = useState<Cue[]>([]);
  const captionsSrc = plan?.source.captions ?? null;
  useEffect(() => {
    let alive = true;
    if (!captionsSrc) {
      setCues([]);
      return;
    }
    getCaptions(captionsSrc)
      .then((raw) => alive && setCues(parseCaptions(raw)))
      .catch(() => alive && setCues([]));
    return () => {
      alive = false;
    };
  }, [captionsSrc, captionsReloadKey]);

  // 字幕条选中（时间线点字幕条）。改文本的 onEditCueText 在 onSaveCues 之后定义（见下，避免捕获过期 onSaveCues）。
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);

  // 剪映式全轨道选中：视频/音频轨片段选中（卡片用 selectedId、字幕用 selectedCueId）。三者互斥。
  const [selectedClip, setSelectedClip] = useState<{ kind: "video" | "audio"; id: string } | null>(null);
  // 统一选中入口：选卡片 / 选轨道片段时清掉另一种，保证 Inspector 只显示一类。
  const selectCard = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedClip(null);
    setSelectedCueId(null);
  }, []);
  const selectTrackClip = useCallback((kind: "video" | "audio", id: string) => {
    setSelectedClip({ kind, id });
    setSelectedId(null);
    setSelectedCueId(null);
  }, []);
  useEffect(() => setSelectedClip(null), [name]); // 换项目复位

  // 播放跟随：预览播放中，Inspector 自动选中当前播放到的卡片（让属性面板跟着播放头走）。
  // 仅播放时生效；暂停/scrub 不抢用户的手动选择（用户可随时点别的卡）。
  useEffect(() => {
    if (!previewMode || !playing || !plan) return;
    const active = plan.tracks.card.find((c) => c.timeline.start <= playTime && playTime < c.timeline.start + c.timeline.duration);
    if (active && active.id !== selectedId) setSelectedId(active.id);
  }, [previewMode, playing, playTime, plan, selectedId]);

  // UI-fix #12: a transient notice auto-clears so it doesn't persist across
  // unrelated states. Manual × still works.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // UI-fix #5: the subtitle-track highlight pulse is transient.
  useEffect(() => {
    if (!highlightSubtitle) return;
    const t = setTimeout(() => setHighlightSubtitle(false), 2600);
    return () => clearTimeout(t);
  }, [highlightSubtitle]);

  const closeTopModals = useCallback(() => {
    setPreviewOpen(false);
    setCaptionsOpen(false);
    setStylePackOpen(false);
    setExportSettingsOpen(false);
  }, []);
  const openCaptionsPanel = useCallback(() => {
    closeTopModals();
    setCaptionsOpen(true);
  }, [closeTopModals]);
  const openStylePackPanel = useCallback(() => {
    closeTopModals();
    setStylePackOpen(true);
  }, [closeTopModals]);
  const openExportSettingsPanel = useCallback(() => {
    closeTopModals();
    setExportSettingsOpen(true);
  }, [closeTopModals]);
  const openPreviewPanel = useCallback(() => {
    closeTopModals();
    setPreviewOpen(true);
  }, [closeTopModals]);

  useEffect(() => {
    if (!previewOpen && !captionsOpen && !stylePackOpen && !exportSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTopModals();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [captionsOpen, closeTopModals, exportSettingsOpen, previewOpen, stylePackOpen]);

  const [lintResult, setLintResult] = useState<LintResult | null>(null);
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);
  const [composeResult, setComposeResult] = useState<ComposeResult | null>(null);
  const [composeWarnCount, setComposeWarnCount] = useState<number | null>(null);
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummaryData | null>(null);

  // Setup wizard + Route B import flow.
  const [showWizard, setShowWizard] = useState(false);
  const [videoPath, setVideoPath] = useState("");
  const [projectName, setProjectName] = useState("");
  const [importFailure, setImportFailure] = useState<RouteBImportResult | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesError, setRecipesError] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [routeA, setRouteA] = useState<RouteAValues>({ sourceVideoPath: "", topic: "", approvedScript: "", voiceReference: "" });
  const [routeAFailure, setRouteAFailure] = useState<RouteARunResult | null>(null);
  const [productIntro, setProductIntro] = useState<ProductIntroValues>(EMPTY_PRODUCT_INTRO);
  const [productIntroFailure, setProductIntroFailure] = useState<RouteARunResult | null>(null);

  // Workflow-run view (M2).
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null);
  const [workflowProject, setWorkflowProject] = useState<string | null>(null);
  const [workflowFailures, setWorkflowFailures] = useState<string[] | null>(null);
  const [workflowRecipe, setWorkflowRecipe] = useState<Recipe | null>(null);

  const insertableComponents = useMemo(() => listCatalogComponents(), []);
  const [insertComponentId, setInsertComponentId] = useState<string>(() => listCatalogComponents()[0]?.id ?? "");

  // v2-P5 template loop.
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateStatus, setTemplateStatus] = useState<TemplateStatus | null>(null);
  const emptyPlan = useMemo<PackagingPlan>(
    () => ({
      schemaVersion: "2026-06-12",
      projectId: null,
      recipeId: null,
      duration: 60,
      source: { video: null, audio: null, captions: null },
      tracks: { video: [], audio: [], subtitle: [], card: [] },
      segments: [],
      templateRef: null,
    }),
    [],
  );
  const visiblePlan = plan ?? emptyPlan;
  // 核心编辑 C：源视频可播放 URL，由 @全栈工程师 经 GET packaging-plan 放在 plan.source.videoUrl。
  // 为空时播放/预览优雅降级（按钮禁用 + 提示），不报错。
  const videoUrl = visiblePlan.source.videoUrl ?? null;
  const visibleScenes = manifest?.scenes ?? [];

  useEffect(() => {
    listManifests()
      .then((names) => {
        setManifests(names);
        if (names.length && !name) setName(names[0]);
      })
      .catch((e) => {
        setError("无法加载项目，请重试或检查本地服务。");
        setErrorDetails(String(e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadManifest = useCallback(async (n: string) => {
    if (!n) return;
    setBusy("load");
    setError(null);
    setErrorDetails(null);
    setComposeResult(null);
    setLintResult(null);
    setInspectResult(null);
    try {
      const m = await getManifest(n);
      setManifest(m);
      setSelectedId(m.scenes[0]?.id ?? null);
      setDirty(false);
      // v2-P2 plan source: prefer the live P1 endpoint; fall back to deriving the
      // plan client-side from the manifest (manifestToPlan) until P1 lands. This
      // is the single reconciliation point — everything downstream reads `plan`.
      const live = await getPackagingPlan(n).catch(() => null);
      setPlan((live as unknown as PackagingPlan) ?? manifestToPlan(m));
    } catch (e) {
      setManifest(null);
      setPlan(null);
      setError("无法加载项目，请重试或检查本地服务。");
      setErrorDetails(String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (name) loadManifest(name);
  }, [name, loadManifest]);

  // v2-P5: load the template library once on mount (best-effort).
  const refreshTemplates = useCallback(async () => {
    try {
      setTemplates(await listTemplates());
    } catch {
      /* template list is best-effort; failure leaves the list empty */
    }
  }, []);
  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const selectedScene: Scene | undefined = useMemo(
    () => manifest?.scenes.find((s) => s.id === selectedId),
    [manifest, selectedId],
  );
  const selectedCard: PlanCard | null = useMemo(
    () => plan?.tracks.card.find((c) => c.id === selectedId) ?? null,
    [plan, selectedId],
  );

  const mediaSlots = useMemo(() => (selectedScene ? listMediaSlots(selectedScene) : []), [selectedScene]);
  const fields = useMemo(() => {
    if (!selectedScene) return [];
    const mediaPaths = new Set(mediaSlots.map((s) => s.path));
    // Hide media slots (own section) and the internal card-type marker.
    return flattenEditable(selectedScene.props ?? {}).filter(
      (f) => !mediaPaths.has(f.path) && f.path !== CARD_TYPE_MARKER,
    );
  }, [selectedScene, mediaSlots]);

  const unboundSceneIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of manifest?.scenes ?? []) if (sceneUnboundMediaCount(s) > 0) ids.add(s.id);
    return ids;
  }, [manifest]);

  // Keep the plan's card-track in sync with manifest edits so the read-only shell
  // (canvas/timeline/inspector) reflects the current manifest. Derived-only; if a
  // live plan was loaded we still re-derive on edits (P3 will PUT the plan instead).
  useEffect(() => {
    if (!manifest) return;
    setPlan((prev) => {
      const next = manifestToPlan(manifest, { recipeId: prev?.recipeId ?? null, segments: prev?.segments });
      // 核心编辑 C：source.videoUrl 是 live packaging-plan 提供的播放地址，manifest 派生不含它。
      // 任意编辑（删除/重排/改时长）都会触发本 effect 重新派生，必须把它带过来，否则视频/播放会丢失。
      if (prev?.source.videoUrl) next.source.videoUrl = prev.source.videoUrl;
      // 同理：card.mediaUrls（画中画 screen/pip 可服务 URL，服务端 getPackagingPlan 补）manifest 派生不含，
      // 按 id 把上一份 plan 的 mediaUrls 带过来，否则编辑后画中画预览的真视频会丢。
      if (prev) {
        const prevUrls = new Map(prev.tracks.card.map((c) => [c.id, c.mediaUrls]));
        for (const c of next.tracks.card) {
          const mu = prevUrls.get(c.id);
          if (mu) c.mediaUrls = mu;
        }
      }
      return next;
    });
  }, [manifest]);

  const updateScene = (id: string, mutate: (scene: Scene) => Scene) => {
    setManifest((prev) => (prev ? { ...prev, scenes: prev.scenes.map((s) => (s.id === id ? mutate(s) : s)) } : prev));
    setDirty(true);
  };

  const onFieldChange = (path: string, value: string) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (s) => ({ ...s, props: applyEdits(s.props ?? {}, { [path]: value }) }));
  };

  // StatsHero 图标列表（browser.icons）增删改：整组替换 props.browser.icons，保留 browser 其它字段。
  const onStatsIconsChange = (icons: string[]) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (s) => {
      const props = (s.props ?? {}) as Record<string, unknown>;
      const browser = (props.browser ?? {}) as Record<string, unknown>;
      return { ...s, props: { ...props, browser: { ...browser, icons } } };
    });
  };

  // 媒体绑定：原生文件选择器选一个 mp4 → 把绝对路径写进 card.props.media.<slot>（落 manifest + dirty 持久）。
  const onBindMedia = async (slotPath: string) => {
    setError(null);
    try {
      const res = await chooseNativeFile("video");
      if (res.canceled) return;
      if (res.ok && res.path) onFieldChange(slotPath, res.path);
      else if (res.error) {
        setError("选择视频失败，请重试或检查本地服务。");
        setErrorDetails(res.error);
      }
    } catch (e) {
      setError("选择视频失败，请重试或检查本地服务。");
      setErrorDetails(String(e));
    }
  };

  const onSceneTypeChange = (value: string) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (s) => ({ ...s, scene_type: value }));
  };

  // P0 自由时间轴：新卡片追加到时间线末端（不 reflow，保留现有卡片的自由位置/间隙）。
  const appendSceneAtEnd = (prev: Manifest, newScene: Scene): Manifest => {
    const end = timelineEndMax([prev.scenes.map(sceneSpan)], 0);
    const placed = { ...newScene, start: end };
    const scenes = [...prev.scenes, placed];
    return { ...prev, scenes, duration: Math.max(timelineEndMax([scenes.map(sceneSpan)], 1), prev.duration || 0) };
  };

  const onInsertScene = () => {
    if (!manifest || !insertComponentId) return;
    setError(null);
    setErrorDetails(null);
    const newScene = makeNewScene(insertComponentId, {
      afterScene: selectedScene ?? manifest.scenes[manifest.scenes.length - 1] ?? null,
      existingIds: manifest.scenes.map((s) => s.id),
    });
    setManifest((prev) => (prev ? appendSceneAtEnd(prev, newScene) : prev));
    setSelectedId(newScene.id);
    setDirty(true);
  };

  // v2-P4 + P0 自由时间轴：从组件库插入一张卡片，追加到时间线末端（不 reflow）。引擎路径同 M4，
  // 仍过真实 validateManifest（PUT 时）。落点细化（拖到某时间）由后续 P1 处理；P0 先保证不破坏自由位置。
  const onInsertCard = (cardType: CardType, afterId?: string | null) => {
    if (!manifest) return;
    setError(null);
    setErrorDetails(null);
    const anchorId = afterId ?? selectedId;
    const afterScene =
      (anchorId ? manifest.scenes.find((s) => s.id === anchorId) : null) ??
      manifest.scenes[manifest.scenes.length - 1] ??
      null;
    const newScene = makeCardScene(cardType, { afterScene, existingIds: manifest.scenes.map((s) => s.id) });
    setManifest((prev) => (prev ? appendSceneAtEnd(prev, newScene) : prev));
    setSelectedId(newScene.id);
    setDirty(true);
  };

  // Delete a card. Defaults to the selected scene (Inspector button / keyboard),
  // or an explicit id (timeline hover-× / right-click menu). Reuses deleteScene +
  // canDeleteScene (the "keep ≥1 scene" guard) — no duplicate delete logic.
  const onDeleteScene = (sceneId?: string) => {
    if (!manifest) return;
    if (!canDeleteScene(manifest)) return;
    const removedId = sceneId ?? selectedScene?.id;
    if (!removedId) return;
    const idx = manifest.scenes.findIndex((s) => s.id === removedId);
    if (idx < 0) return;
    // P0 自由时间轴：删除不 reflow，保留其余卡片的自由位置/间隙；总时长按 max 重算（不低于原值）。
    const next = deleteScene(manifest, removedId);
    const duration = Math.max(timelineEndMax([next.scenes.map(sceneSpan)], 1), 0);
    setManifest({ ...next, duration: duration || manifest.duration });
    setSelectedId(next.scenes[Math.max(0, idx - 1)]?.id ?? next.scenes[0]?.id ?? null);
    setDirty(true);
  };

  const onMoveScene = (sceneId: string, direction: "up" | "down") => {
    setManifest((prev) => (prev ? applyReflow({ ...prev, scenes: moveScene(prev.scenes, sceneId, direction) }) : prev));
    setDirty(true);
  };

  // P0-2 自由移动：把卡片 start 改到落点时间（吸附/防重叠已在时间线组件算好），不 reflow 其它卡片。
  const onMoveCard = (sceneId: string, start: number) => {
    setManifest((prev) => {
      if (!prev) return prev;
      const scenes = prev.scenes.map((s) => (s.id === sceneId ? { ...s, start: Number(start.toFixed(3)) } : s));
      return { ...prev, scenes, duration: Math.max(timelineEndMax([scenes.map(sceneSpan)], 1), prev.duration || 0) };
    });
    setSelectedId(sceneId);
    setDirty(true);
  };

  // P0-3 左右 trim：直接落 start+duration（时间线组件已 clamp 最小时长/防重叠），不 reflow。
  const onTrimCard = (sceneId: string, span: { start: number; duration: number }) => {
    setManifest((prev) => {
      if (!prev) return prev;
      const scenes = prev.scenes.map((s) => (s.id === sceneId ? { ...s, start: Number(span.start.toFixed(3)), duration: Number(span.duration.toFixed(3)) } : s));
      return { ...prev, scenes, duration: Math.max(timelineEndMax([scenes.map(sceneSpan)], 1), prev.duration || 0) };
    });
    setSelectedId(sceneId);
    setDirty(true);
  };

  // 剪映式分割：在播放头时间把当前选中片段切两段（调用 splitClip）。
  //  · 卡片 → 切两个 scene（落 manifest，持久化）。
  //  · 视频/音频 → 切两个 plan 轨道 clip（带 mediaStart，供数据侧 composer 分段消费）。
  // 播放头不在所选片段范围内则提示不执行。
  const onSplitAtPlayhead = useCallback(() => {
    const t = playTime;
    if (selectedClip && plan && manifest) {
      const arr = plan.tracks[selectedClip.kind];
      const c = arr.find((x) => x.id === selectedClip.id);
      if (!c) return;
      if (!(t > c.start && t < c.start + c.duration)) {
        setNotice("播放头不在所选片段范围内，无法分割。");
        return;
      }
      const parts = splitClip(c, t);
      if (parts.length < 2) {
        setNotice("播放头不在所选片段范围内，无法分割。");
        return;
      }
      // 落 manifest（而非仅 plan 内存）：写 source.videoClips / audio.clips 多段，重派生时 manifestToPlan 不合并。
      const nextClips = arr.flatMap((x) => (x.id === c.id ? parts : [x]));
      const toManifestClip = (x: (typeof nextClips)[number]) => ({ id: x.id, src: x.src ?? null, start: x.start, duration: x.duration, mediaStart: x.mediaStart ?? 0 });
      const mClips = nextClips.map(toManifestClip);
      const m = manifest as Manifest & { source?: Record<string, unknown>; audio?: Record<string, unknown> };
      const next: Manifest =
        selectedClip.kind === "video"
          ? ({ ...m, source: { ...(m.source ?? {}), videoClips: mClips } } as Manifest)
          : ({ ...m, audio: { ...(m.audio ?? {}), clips: mClips } } as Manifest);
      setManifest(next);
      setSelectedClip({ kind: selectedClip.kind, id: parts[0].id });
      setDirty(true);
      setNotice(`已在 ${t.toFixed(2)}s 处分割${selectedClip.kind === "video" ? "视频" : "音频"}片段（已落 manifest）。`);
      return;
    }
    if (selectedScene && manifest) {
      const start = Number(selectedScene.start ?? 0);
      const dur = Number(selectedScene.duration ?? 0);
      if (!(t > start && t < start + dur)) {
        setNotice("播放头不在所选卡片范围内，无法分割。");
        return;
      }
      const [a, b] = splitClip({ ...selectedScene } as Scene & { start: number; duration: number }, t) as Scene[];
      delete (b as { mediaStart?: number }).mediaStart; // 卡片 scene 无源媒体入点，去掉 split 带出的字段
      const scenes = manifest.scenes.flatMap((s) => (s.id === selectedScene.id ? [a, b] : [s]));
      setManifest({ ...manifest, scenes, duration: Math.max(timelineEndMax([scenes.map(sceneSpan)], 1), manifest.duration || 0) });
      setSelectedId(a.id);
      setDirty(true);
      setNotice(`已在 ${t.toFixed(2)}s 处分割卡片。`);
      return;
    }
    setNotice("先选中一个片段，再在播放头处分割。");
  }, [playTime, selectedClip, plan, selectedScene, manifest]);

  // 核心编辑 A：选中卡片后按 Delete/Backspace 删除（在输入框/下拉/可编辑区内不触发）。
  // web-only console（直接用 DOM 事件，与 Canvas/时间线一致）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (busy !== null) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selectedId) return;
        e.preventDefault();
        onDeleteScene();
      } else if (e.key === "s" || e.key === "S") {
        // 剪映式：在播放头处分割选中片段
        if (!selectedId && !selectedClip) return;
        e.preventDefault();
        onSplitAtPlayhead();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedClip, busy, manifest, onSplitAtPlayhead]);

  // v2-P3: rich-field edits (canvas drag + Inspector) write to the scene's props
  // subtree where the plan/manifest round-trip expects them (props.layout /
  // props.style.{font,color} / props.animation). Editing the manifest re-derives
  // the plan, so canvas/inspector reflect the change immediately.
  const onLayoutChange = (patch: Partial<Layout> | Record<string, unknown>) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (s) => ({ ...s, props: patchLayout(s.props ?? {}, patch as Record<string, unknown>) }));
  };
  const onFontChange = (patch: Record<string, unknown>) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (s) => ({ ...s, props: patchFont(s.props ?? {}, patch) }));
  };
  const onColorChange = (patch: Record<string, unknown>) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (s) => ({ ...s, props: patchColor(s.props ?? {}, patch) }));
  };
  const onAnimationChange = (patch: Record<string, unknown>) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (s) => ({ ...s, props: patchAnimation(s.props ?? {}, patch) }));
  };

  // v2-P3 persistence: prefer PUT /packaging-plan (P1 projects it to the manifest
  // server-side); fall back to PUT /manifests when the endpoint is absent. Both
  // persist the same manifest, so compose/lint/inspect (which read the saved
  // manifest file) work either way. 422 surfaces failures via ManifestValidationError.
  const persist = async () => {
    if (!manifest) return;
    const currentPlan = plan ?? manifestToPlan(manifest);
    const res = await putPackagingPlan(name, currentPlan);
    if (!res.saved) await saveManifest(name, manifest);
    setDirty(false);
  };

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setErrorDetails(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ManifestValidationError) {
        setLintResult({ ok: false, failures: e.failures });
        setError(`保存被拦截 — manifest 有 ${e.failures.length} 个校验问题（见右侧「校验」）。`);
        setInspectorTab("validation");
      } else if (e instanceof WorkflowTransitionError) {
        setWorkflowFailures(e.failures);
        setError(`工作流状态切换被拒 — ${e.failures.length} 个问题。`);
      } else {
        setError("操作失败，请重试或检查本地服务。");
        setErrorDetails(String(e));
      }
    } finally {
      setBusy(null);
    }
  };

  const onSave = () => run("save", persist);

  const onCompose = (force = false) => {
    if (!force && manifest) {
      const unbound = countUnboundMedia(manifest);
      if (unbound > 0) {
        setComposeWarnCount(unbound);
        return;
      }
    }
    setComposeWarnCount(null);
    run("compose", async () => {
      if (dirty) await persist();
      setDirty(false);
      setComposeResult(await compose(name));
      setRailTab("plan"); // surface the preview iframe in the plan hub
    });
  };

  const onLint = () =>
    run("lint", async () => {
      if (dirty) await persist();
      setDirty(false);
      setLintResult(await lint(name));
      setInspectorTab("validation");
    });

  const onInspect = () =>
    run("inspect", async () => {
      if (dirty) await persist();
      setDirty(false);
      setInspectResult(await inspect(name));
      setRailTab("plan");
    });

  const onImport = () =>
    run("import", async () => {
      setImportFailure(null);
      const result = await importFromVideo(videoPath.trim(), projectName.trim() || undefined);
      if (!result.ok || !result.manifestName) {
        setImportFailure(result);
        setError(result.stderr ? "导入失败（详情见下）。" : "导入失败。");
        return;
      }
      const names = await listManifests();
      setManifests(names);
      setShowWizard(false);
      setVideoPath("");
      setProjectName("");
      setName(result.manifestName);
      // Block 1: build the post-import summary (scenes / captions / duration) so
      // the import is never silent — drop the operator onto a visible result.
      try {
        const m = await getManifest(result.manifestName);
        let captionCount = 0;
        const capSrc = (m.audio as { captions?: string } | undefined)?.captions;
        if (capSrc) captionCount = parseCaptions(await getCaptions(capSrc)).length;
        setImportSummary({
          name: result.manifestName,
          scenes: m.scenes.length,
          captions: captionCount,
          durationSec: Number(m.duration ?? 0),
        });
      } catch {
        setImportSummary({ name: result.manifestName, scenes: result.scenes ?? 0, captions: 0, durationSec: 0 });
      }
      try {
        const view = await getProject(result.manifestName);
        if (view.workflowRun) {
          setWorkflowRun(view.workflowRun);
          setWorkflowProject(view.name);
          setWorkflowFailures(null);
          const recipe = recipes.find((r) => r.id === view.workflowRun!.recipeId);
          setWorkflowRecipe(recipe ?? (await getRecipe(view.workflowRun.recipeId).catch(() => null)));
        }
      } catch {
        /* workflow view is best-effort */
      }
    });

  const enterWorkflowFromResult = async (result: RouteARunResult) => {
    setManifests(await listManifests());
    setShowWizard(false);
    setRailTab("plan");
    if (result.workflowRun) {
      setWorkflowRun(result.workflowRun);
      setWorkflowProject(result.name ?? null);
      setWorkflowFailures(null);
      const recipe =
        recipes.find((r) => r.id === result.workflowRun!.recipeId) ??
        (await getRecipe(result.workflowRun.recipeId).catch(() => null));
      setWorkflowRecipe(recipe);
    }
    if (result.manifestName) setName(result.manifestName);
  };

  const onRunRouteA = () =>
    run("routeA", async () => {
      setRouteAFailure(null);
      const result = await runRouteA({
        sourceVideoPath: routeA.sourceVideoPath.trim(),
        topic: routeA.topic.trim() || undefined,
        approvedScript: routeA.approvedScript.trim() || undefined,
        voiceReference: routeA.voiceReference.trim() || undefined,
        name: projectName.trim() || undefined,
      });
      if (!result.ok) {
        setRouteAFailure(result);
        setError(result.stderr ? "数字人流程失败（详情见下）。" : "数字人流程失败。");
        return;
      }
      setRouteA({ sourceVideoPath: "", topic: "", approvedScript: "", voiceReference: "" });
      setProjectName("");
      await enterWorkflowFromResult(result);
    });

  const onRunProductIntro = () =>
    run("productIntro", async () => {
      setProductIntroFailure(null);
      const media = compact(productIntro.productMedia);
      const result = await runProductIntro({
        sourceVideoPath: productIntro.sourceVideoPath.trim(),
        productName: productIntro.productName.trim(),
        productDescription: productIntro.productDescription.trim(),
        sellingPoints: compact(productIntro.sellingPoints),
        productMedia: media.length ? media : undefined,
        offerCta: productIntro.offerCta.trim() || undefined,
        voiceReference: productIntro.voiceReference.trim() || undefined,
        name: projectName.trim() || undefined,
      });
      if (!result.ok) {
        setProductIntroFailure(result);
        setError(result.stderr ? "产品介绍失败（详情见下）。" : "产品介绍失败。");
        return;
      }
      setProductIntro(EMPTY_PRODUCT_INTRO);
      setProjectName("");
      await enterWorkflowFromResult(result);
    });

  const openWizard = () => {
    setShowWizard(true);
    setImportFailure(null);
    setRouteAFailure(null);
    setProductIntroFailure(null);
    if (recipes.length === 0) {
      listRecipes()
        .then((list) => {
          setRecipes(list);
          setRecipesError(null);
          setSelectedRecipeId((prev) => prev ?? list.find((r) => r.id === "existing-narrated-video")?.id ?? list[0]?.id ?? null);
        })
        .catch((e) => setRecipesError(`Cannot load recipes: ${String(e)}`));
    }
  };

  const recommendedRecipeId = useMemo(() => {
    const types = new Set<string>();
    if (videoPath.trim()) types.add("video");
    return recommendRecipeId(recipes, types);
  }, [recipes, videoPath]);

  const onRunStage = (stageId: string) =>
    run("workflow", async () => {
      if (!workflowProject) return;
      const wr = await runStage(workflowProject, stageId, { action: "run" });
      setWorkflowRun(wr);
      setWorkflowFailures(null);
    });

  const onApproveCheckpoint = (checkpointId: string) =>
    run("workflow", async () => {
      if (!workflowProject) return;
      const wr = await approveCheckpoint(workflowProject, checkpointId);
      setWorkflowRun(wr);
      setWorkflowFailures(null);
    });

  // v2-P5: save the current project's plan as a reusable template (#5).
  const onSaveTemplate = (body: { name: string; description: string; overwrite: boolean }) =>
    run("template", async () => {
      if (!name) return;
      setTemplateStatus(null);
      if (dirty) await persist(); // capture the latest edits in the template
      const result = await saveTemplate(name, body);
      if (!result.ok) {
        setTemplateStatus({
          kind: result.conflict ? "conflict" : "error",
          text: result.error ?? result.failures?.join("; ") ?? "保存模板失败",
        });
        if (result.failures?.length) setLintResult({ ok: false, failures: result.failures });
        return;
      }
      setTemplateStatus({ kind: "ok", text: `已另存为模板：${result.templateId}` });
      await refreshTemplates();
    });

  // v2-P5: apply a template to the current project (#6) — the server rewrites the
  // project's plan/manifest; reload so canvas/timeline/Inspector refresh.
  const onApplyTemplate = (templateId: string) =>
    run("template", async () => {
      if (!name) return;
      setTemplateStatus(null);
      const result = await applyTemplate(name, templateId);
      if (!result.ok) {
        setTemplateStatus({ kind: "error", text: result.error ?? result.failures?.join("; ") ?? "套用模板失败" });
        if (result.failures?.length) {
          setLintResult({ ok: false, failures: result.failures });
          setInspectorTab("validation");
        }
        return;
      }
      setTemplateStatus({ kind: "ok", text: `已套用模板 ${templateId}，方案已重写` });
      await loadManifest(result.manifestName ?? name);
    });

  const stageGates = useMemo(() => {
    if (!workflowRun) return {};
    const dependsOnById: Record<string, string[]> = {};
    const labelById: Record<string, string> = {};
    if (workflowRecipe) {
      for (const s of workflowRecipe.stages) {
        dependsOnById[s.id] = s.dependsOn ?? [];
        labelById[s.id] = s.name;
      }
    } else {
      for (const s of workflowRun.stages) {
        dependsOnById[s.id] = s.dependsOn ?? [];
        labelById[s.id] = s.recipeStageId;
      }
    }
    return computeStageGates(workflowRun.stages.map((s) => ({ id: s.id, status: s.status })), dependsOnById, labelById);
  }, [workflowRun, workflowRecipe]);

  // v2 finishing cut: top-bar main-flow nav → real actions (pure resolver in
  // lib/nav). Every item produces a visible reaction; highlight follows the click.
  const onNav = (id: NavId) => {
    setActiveNav(id);
    const r = resolveNav(id, { hasCaptions: !!plan?.source.captions });
    if (r.rail) setRailTab(r.rail);
    if (r.openWizard) openWizard();
    if (r.notice) setNotice(r.notice);
    if (r.lint) onLint();
    if (r.compose) onCompose();
    if (r.highlightSubtitle) setHighlightSubtitle(true);
    if (r.openCaptions) openCaptionsPanel();
    if (r.openStylePack) openStylePackPanel();
    if (r.openExportSettings) openExportSettingsPanel();
  };

  // 字幕识别: re-run ASR, then reload so the subtitle track + cues refresh.
  const onRecaption = () =>
    run("recaption", async () => {
      const result = await recaptionProject(name);
      if (!result.ok) {
        setError(`重新识别字幕失败（${result.stage ?? "recaption"}）${result.stderr ? " — 见 banner" : ""}`);
        if (result.stderr) setLintResult({ ok: false, failures: [result.stderr] });
        return;
      }
      await loadManifest(name);
      setCaptionsReloadKey((k) => k + 1);
      setNotice(`字幕已重新识别（${result.captionCount ?? "?"} 条）。`);
    });

  // 字幕逐句编辑落盘。服务端 inlineSubtitleCues 读「字幕轨首个 clip 的 cues 数组」写 captions.json，
  // 故必须把整批 cue 作为单条字幕 clip 的 `cues` 字段送出（不是每 cue 一个 clip）。
  const onSaveCues = (cues: Cue[]) =>
    run("saveCues", async () => {
      if (!plan) return;
      const head = plan.tracks.subtitle[0];
      const subtitleClip = {
        id: head?.id ?? "subtitle-main",
        track: "subtitle" as const,
        src: head?.src ?? plan.source.captions ?? null,
        start: head?.start ?? 0,
        duration: head?.duration ?? plan.duration,
        cues: cues.map((c) => ({ start: c.start, end: c.end, text: c.text })),
      };
      const nextPlan = { ...plan, tracks: { ...plan.tracks, subtitle: [subtitleClip] } } as unknown as typeof plan;
      const res = await putPackagingPlan(name, nextPlan);
      if (!res.saved) setNotice("字幕已记录到本地 plan（当前服务端 PUT 端点不可用）。");
      else setNotice("字幕已保存写入 captions.json。");
    });

  // 直接改某条字幕文本：先更新本地 cues（UI 立刻反映），再走 onSaveCues 持久化（PUT → 服务端按字幕轨 cue 写 captions.json）。
  // 普通函数（每次 render 重建，捕获最新 onSaveCues/plan/name），避免 useCallback 空依赖捕获过期闭包。
  const onEditCueText = (cueId: string, text: string) => {
    const next = cues.map((c) => (c.id === cueId ? { ...c, text } : c));
    setCues(next);
    onSaveCues(next);
  };

  // 风格包: write a theme's color+font to every card, persist, ready to recompose.
  const onApplyTheme = (theme: Theme) =>
    run("applyTheme", async () => {
      if (!manifest) return;
      const next = applyThemeToManifest(manifest, theme);
      setManifest(next);
      setDirty(false);
      const nextPlan = manifestToPlan(next, { recipeId: plan?.recipeId ?? null, segments: plan?.segments });
      const res = await putPackagingPlan(name, nextPlan);
      if (!res.saved) await saveManifest(name, next);
      setStylePackOpen(false);
      setNotice(`已套用风格包「${theme.name}」到全部卡片 — 重新「预览/渲染」查看统一风格。`);
    });

  // 渲染 (gold): real MP4 render (compose → render). Persist latest edits first so
  // the render reflects them; surface success (MP4 link/preview) or failure stderr.
  const onRender = () =>
    run("render", async () => {
      setRenderResult(null);
      setNotice(null);
      if (dirty) await persist();
      const result = await renderProject(name, renderOptions);
      setRenderResult(result);
      setRailTab("plan");
      if (!result.ok) {
        setError(`渲染失败（${result.stage ?? "render"}）— 见「方案」面板的 stderr。`);
      }
    });

  // Block 2: high-level workflow steps (导入→字幕→包装→校验→渲染) for the top-bar stepper.
  const workflowSteps = useMemo(
    () =>
      deriveWorkflowSteps({
        hasManifest: !!manifest,
        hasCaptions: !!plan?.source.captions,
        hasScenes: (manifest?.scenes.length ?? 0) > 0,
        linted: lintResult?.ok === true,
        rendered: renderResult?.ok === true,
      }),
    [manifest, plan, lintResult, renderResult],
  );

  const component = getComponent(selectedScene?.component);
  const sceneTypes = allowedSceneTypes(selectedScene?.component);
  const sceneTypeIllegal =
    selectedScene?.scene_type && sceneTypes.length > 0 && !sceneTypes.includes(selectedScene.scene_type);

  // 开场数据卡（StatsHero）专属友好表单：按 registry.mjs renderOpeningStat 的真实结构给字段（中文 label + 一句
  // 说明），写裸 prop 路径的活儿（stat.label / browser.done / titleBeat.kicker…）藏在背后，编辑实时反映到画布。
  // 这是「真正定义 + 真实字段」的样板，供其它 11 个组件照此扩展。
  const statsHeroForm: ReactNode = (() => {
    if (!selectedScene || selectedScene.component !== "StatsHero") return null;
    const props = (selectedScene.props ?? {}) as Record<string, unknown>;
    const stat = (props.stat ?? {}) as Record<string, unknown>;
    const browser = (props.browser ?? {}) as Record<string, unknown>;
    const titleBeat = (props.titleBeat ?? {}) as Record<string, unknown>;
    const icons = Array.isArray(browser.icons) ? (browser.icons as unknown[]).map((x) => String(x)) : [];
    const str = (v: unknown) => (v == null ? "" : String(v));
    const TextField = ({ path, label, hint, value, type }: { path: string; label: string; hint: string; value: string; type?: "number" }) => (
      <label className="prop-field">
        <span className="prop-path" title={hint}>
          {label}
          <span className="pc-field-hint muted">{hint}</span>
        </span>
        <input type={type === "number" ? "number" : "text"} step={type === "number" ? "any" : undefined} value={value} onChange={(e) => onFieldChange(path, e.target.value)} />
      </label>
    );
    return (
      <div className="props pc-comp-form">
        <div className="panel-title">数据块</div>
        <TextField path="stat.cornerLeft" label="角标" hint="左上角的小角标文字" value={str(stat.cornerLeft)} />
        <TextField path="stat.label" label="标签" hint="数字上方的小标题（如 增长）" value={str(stat.label)} />
        <TextField path="stat.number" label="数字" hint="核心大数字（如 38），入场会弹大强调" value={str(stat.number)} />
        <TextField path="stat.unit" label="单位" hint="数字后的单位（如 % / 个 / 倍）" value={str(stat.unit)} />
        <TextField path="stat.title" label="统计标题" hint="数字下方说明这组数据的含义（如 转化提升）" value={str(stat.title)} />

        <div className="panel-title">浏览器框</div>
        <TextField path="browser.done" label="完成标" hint="浏览器框右上角的完成提示（如 完成）" value={str(browser.done)} />
        <div className="prop-field pc-icons-field">
          <span className="prop-path" title="浏览器框里逐个揭示的小图标标签">
            图标列表
            <span className="pc-field-hint muted">浏览器框里逐个揭示的小图标，可增删</span>
          </span>
          <div className="pc-icons-list">
            {icons.map((icon, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 图标按位置编辑，索引即身份。
              <div className="pc-icon-row" key={i}>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => {
                    const next = icons.slice();
                    next[i] = e.target.value;
                    onStatsIconsChange(next);
                  }}
                />
                <button type="button" className="clear-btn" title="删除该图标" onClick={() => onStatsIconsChange(icons.filter((_, j) => j !== i))}>
                  删除
                </button>
              </div>
            ))}
            <button type="button" className="pc-btn ghost pc-icon-add" onClick={() => onStatsIconsChange([...icons, "新图标"])}>
              + 添加图标
            </button>
          </div>
        </div>

        <div className="panel-title">标题块</div>
        <TextField path="titleBeat.kicker" label="眉标" hint="主标题上方的小字（如 开场）" value={str(titleBeat.kicker)} />
        <TextField path="titleBeat.title" label="主标题" hint="数据卡收尾的大标题（如 标题节拍）" value={str(titleBeat.title)} />
        <TextField path="titleBeat.subline" label="副标题" hint="主标题下方一句话点题" value={str(titleBeat.subline)} />
      </div>
    );
  })();

  // The props-era editor body — reused as the Inspector 属性 tab 底子.
  const attributesNode: ReactNode = !selectedScene ? (
    <div className="pc-note muted">在时间线或场景列表选中一张卡片以编辑其内容。</div>
  ) : (
    <>
      <div className="pc-field-row">
        <label className="pc-ro-field">
          组件
          <input value={`${componentName(selectedScene.component)}（${selectedScene.component}）`} readOnly />
        </label>
        <label className="pc-ro-field">
          场景类型 <span className="pc-raw-type" title={`原始类型 ${selectedScene.scene_type ?? ""}`}>{sceneRoleLabel(selectedScene.component)}</span>
          {sceneTypes.length > 0 ? (
            <select value={selectedScene.scene_type ?? ""} onChange={(e) => onSceneTypeChange(e.target.value)}>
              {!sceneTypes.includes(selectedScene.scene_type ?? "") && (
                <option value={selectedScene.scene_type}>{selectedScene.scene_type}（不在词汇表）</option>
              )}
              {sceneTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <input value={selectedScene.scene_type ?? ""} readOnly />
          )}
        </label>
      </div>
      {sceneTypeIllegal && (
        <div className="banner warn">
          场景类型「{selectedScene.scene_type}」不适用于 {componentName(selectedScene.component)} — 允许：{sceneTypes.join(", ")}
        </div>
      )}

      {mediaSlots.length > 0 && (
        <div className="media-binds">
          <div className="panel-title">
            媒体绑定 ({mediaSlots.length})
            {mediaSlots.some((s) => !s.bound) && (
              <span className="unbound-tag">{mediaSlots.filter((s) => !s.bound).length} 未绑定</span>
            )}
          </div>
          {mediaSlots.map((slot) => {
            const isScreen = slot.path.endsWith("screen");
            const isPip = slot.path.endsWith("pip") || slot.path.endsWith("pip2");
            const hint = isScreen ? "内容 / 讲解视频（底层大画面）" : isPip ? "数字人口播视频（右下角圆形小窗）" : "视频素材";
            const fname = slot.bound ? slot.value.split(/[\\/]/).pop() || slot.value : "";
            return (
              <div className={slot.bound ? "media-slot" : "media-slot unbound"} key={slot.path}>
                <span className="prop-path">
                  {slot.path}
                  {!slot.bound && <span className="unbound-dot" title="unbound">●</span>}
                </span>
                <span className="media-slot-hint muted">{hint}</span>
                {slot.bound ? <span className="media-slot-file" title={slot.value}>已绑：{fname}</span> : <span className="media-slot-file muted">未绑定</span>}
                <span className="media-slot-actions">
                  <button className="pc-btn ghost" onClick={() => onBindMedia(slot.path)} disabled={busy !== null}>
                    {slot.bound ? "替换视频" : "绑定视频"}
                  </button>
                  <button className="clear-btn" title="解除绑定" onClick={() => onFieldChange(slot.path, "")} disabled={slot.value === ""}>
                    解除绑定
                  </button>
                </span>
                {/* 备用：手动粘贴绝对路径（与「绑定视频」同一写入路径），无原生对话框时也能绑。 */}
                <input
                  className="media-slot-input"
                  type="text"
                  placeholder="或粘贴视频绝对路径"
                  value={slot.bound ? slot.value : ""}
                  onChange={(e) => onFieldChange(slot.path, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      {statsHeroForm ?? (
        <div className="props">
          <div className="panel-title">文本字段（{fields.length}）</div>
          {fields.length === 0 && <div className="empty">该卡片无可编辑文本。</div>}
          {fields.map((f) => (
            <label className="prop-field" key={f.path}>
              {/* R5-S1: Chinese business label; raw key kept in tooltip / data-field. */}
              <span className="prop-path" title={`${fieldHint(f.path) ?? ""}（字段 ${f.path}）`.trim()} data-field={f.path}>
                {fieldLabel(f.path)}
              </span>
              <input
                type={f.type === "number" ? "number" : "text"}
                value={String(f.value)}
                step={f.type === "number" ? "any" : undefined}
                onChange={(e) => onFieldChange(f.path, e.target.value)}
              />
            </label>
          ))}
        </div>
      )}

      <div className="actions">
        <button className="primary" onClick={onSave} disabled={busy !== null || !dirty}>
          {busy === "save" ? "保存中…" : dirty ? "保存" : "已保存"}
        </button>
        <button
          className="danger"
          onClick={() => onDeleteScene()}
          disabled={busy !== null || !manifest || !canDeleteScene(manifest)}
          title={manifest && !canDeleteScene(manifest) ? "至少保留一个场景" : "删除该场景"}
        >
          删除卡片
        </button>
      </div>
    </>
  );

  const validationNode: ReactNode = (
    <ResultsPanel manifestName={name} lintResult={lintResult} inspectResult={inspectResult} composeResult={null} />
  );

  // 选中的视频/音频轨片段 → Inspector 只读信息面板（类型 / 源文件名 / 时长 / 入点）。
  const selectedTrackClipObj = selectedClip ? visiblePlan.tracks[selectedClip.kind].find((c) => c.id === selectedClip.id) ?? null : null;
  const clipInfoNode: ReactNode = selectedTrackClipObj
    ? (() => {
        const c = selectedTrackClipObj;
        const fname = String(c.src ?? "").split(/[\\/]/).pop() || "（无源文件）";
        const kindLabel = selectedClip?.kind === "video" ? "视频轨片段" : "音频轨片段";
        return (
          <>
            <h4>片段信息</h4>
            <div className="pc-kv"><span className="pc-k">类型</span><span className="pc-vv">{kindLabel}</span></div>
            <div className="pc-kv"><span className="pc-k">源文件</span><span className="pc-vv pc-clip-src" title={String(c.src ?? "")}>{fname}</span></div>
            <div className="pc-kv"><span className="pc-k">时长</span><span className="pc-vv">{Number(c.duration).toFixed(2)}s</span></div>
            <div className="pc-kv"><span className="pc-k">时间轴入点</span><span className="pc-vv">{Number(c.start).toFixed(2)}s</span></div>
            {c.mediaStart != null && <div className="pc-kv"><span className="pc-k">源媒体入点</span><span className="pc-vv">{Number(c.mediaStart).toFixed(2)}s</span></div>}
            <div className="pc-note muted">选中片段后按 S 在播放头处分割。</div>
            <div className="actions">
              <button className="primary" onClick={() => onSave()} disabled={busy !== null || !dirty}>
                {busy === "save" ? "保存中…" : dirty ? "保存" : "已保存"}
              </button>
            </div>
          </>
        );
      })()
    : null;

  return (
    <div className="pc-console">
      {/* 1. 顶栏 */}
      <header className="pc-topbar">
        <div className="pc-brand">
          <span className="pc-hex">
            <Icon name="hex" size={20} />
          </span>
          Director 包装工作台 <span className="pc-v">v2</span>
        </div>
        <nav className="pc-mainnav">
          {NAV_ITEMS.map((it) => (
            <button
              key={it.id}
              type="button"
              className={it.id === activeNav ? "pc-navitem active" : "pc-navitem"}
              onClick={() => onNav(it.id)}
              disabled={busy !== null}
            >
              <Icon name={it.icon} size={15} />
              {it.label}
            </button>
          ))}
        </nav>
        <div className="pc-proj">
          <select className="pc-projname" value={name} onChange={(e) => setName(e.target.value)} disabled={busy !== null}>
            {manifests.length === 0 && <option value="">（无项目）</option>}
            {manifests.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button className="pc-btn ghost" onClick={() => onCompose()} disabled={busy !== null || !manifest}>
            预览
          </button>
          <button className="pc-btn gold" onClick={onRender} disabled={busy !== null || !manifest} title="渲染 MP4（compose → render，约十几秒）">
            {busy === "render" ? "渲染中…" : "渲染"}
          </button>
        </div>
      </header>

      {/* Block 2: workflow stepper strip directly under the top bar. */}
      <WorkflowStepper steps={workflowSteps} />

      {/* Block 1: post-import summary + next-step guidance (closable). */}
      {importSummary && (
        <ImportSummary
          summary={importSummary}
          onCaptions={() => onNav("captions")}
          onPackage={() => onNav("package")}
          onPreview={() => onCompose()}
          onRender={() => onRender()}
          onClose={() => setImportSummary(null)}
        />
      )}

      {showWizard && (
        <Wizard
          recipes={recipes}
          recipesError={recipesError}
          recommendedId={recommendedRecipeId}
          selectedId={selectedRecipeId}
          onSelect={setSelectedRecipeId}
          videoPath={videoPath}
          setVideoPath={setVideoPath}
          projectName={projectName}
          setProjectName={setProjectName}
          importing={busy === "import"}
          onImport={onImport}
          importFailure={importFailure}
          routeA={routeA}
          onRouteAChange={(field, value) => setRouteA((prev) => ({ ...prev, [field]: value }))}
          runningRouteA={busy === "routeA"}
          onRunRouteA={onRunRouteA}
          routeAFailure={routeAFailure}
          productIntro={productIntro}
          onProductIntroChange={(field, value) => setProductIntro((prev) => ({ ...prev, [field]: value }))}
          runningProductIntro={busy === "productIntro"}
          onRunProductIntro={onRunProductIntro}
          productIntroFailure={productIntroFailure}
          onClose={() => setShowWizard(false)}
        />
      )}

      {error && <ErrorBanner message={error} details={errorDetails} onDismiss={() => { setError(null); setErrorDetails(null); }} />}
      {notice && (
        <div className="pc-noticebar">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} title="dismiss">
            ×
          </button>
        </div>
      )}

      {/* 工作区 */}
      <div className="pc-workspace">
        {/* 左竖排 6 tab */}
        <div className="pc-leftrail">
          {RAIL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === railTab ? "pc-railtab active" : "pc-railtab"}
              onClick={() => setRailTab(t.id)}
            >
              <Icon name={t.icon} size={18} />
              {t.label}
            </button>
          ))}
        </div>

        {/* 左面板（随 tab 切换） */}
        <div className="pc-leftpanel">
          {railTab === "library" && (
            <ComponentLibrary
              activeCategory={libCategory}
              onSelectCategory={setLibCategory}
              onInsert={(cardType) => onInsertCard(cardType)}
              canInsert={!!manifest && busy === null}
            />
          )}
          {railTab === "scenes" && (
            <ScenesPanel
              manifest={manifest}
              selectedId={selectedId}
              unboundSceneIds={unboundSceneIds}
              busy={busy !== null}
              onSelect={setSelectedId}
              onMove={onMoveScene}
              insertableComponents={insertableComponents}
              insertComponentId={insertComponentId}
              setInsertComponentId={setInsertComponentId}
              onInsert={onInsertScene}
            />
          )}
          {railTab === "plan" && (
            <PlanPanel
              busy={busy}
              onNewProject={openWizard}
              onCompose={() => onCompose()}
              onLint={onLint}
              onInspect={onInspect}
              hasManifest={!!manifest}
              workflowRun={workflowRun}
              workflowProject={workflowProject}
              stageGates={stageGates}
              workflowBusy={busy === "workflow"}
              workflowFailures={workflowFailures}
              onRunStage={onRunStage}
              onApproveCheckpoint={onApproveCheckpoint}
              onCloseWorkflow={() => {
                setWorkflowRun(null);
                setWorkflowProject(null);
                setWorkflowFailures(null);
                setWorkflowRecipe(null);
              }}
              composeResult={composeResult}
              composeWarnCount={composeWarnCount}
              onComposeAnyway={() => onCompose(true)}
              onDismissWarn={() => setComposeWarnCount(null)}
              manifestName={name}
              onRender={onRender}
              onOpenPreview={openPreviewPanel}
              canPreview={!!composeResult?.ok && !!composeResult?.previewUrl}
              renderResult={renderResult}
              renderOptions={renderOptions}
              setRenderOptions={setRenderOptions}
            />
          )}
          {railTab === "styles" && (
            <TemplateLibrary
              templates={templates}
              currentProject={manifest ? name : null}
              canEdit={!!manifest && busy === null}
              busy={busy === "template"}
              status={templateStatus}
              onRefresh={refreshTemplates}
              onSave={onSaveTemplate}
              onApply={onApplyTemplate}
            />
          )}
          {(railTab === "project" || railTab === "assets") && (
            <PlaceholderPanel tab={railTab} catalogVersion={catalogVersion} onNewProject={openWizard} manifest={manifest} name={name} />
          )}
        </div>

        {/* 中央列 */}
        <div className="pc-center">
          <Canvas
            card={selectedCard}
            editable={!!selectedScene && busy === null}
            onLayoutChange={onLayoutChange}
            videoUrl={videoUrl}
            previewMode={previewMode}
            onTogglePreviewMode={togglePreviewMode}
            videoRef={videoRef}
            onVideoTime={setPlayTime}
            onPlayStateChange={setPlaying}
            cards={visiblePlan.tracks.card}
            selectedId={selectedId}
            cues={cues}
            hiddenTracks={hiddenTracks}
            playTime={playTime}
            playing={playing}
            onSelect={selectCard}
          />
          <SmartStrip plan={visiblePlan} />
        </div>

        {/* 右 Inspector */}
        <Inspector
          tab={inspectorTab}
          onTab={setInspectorTab}
          card={selectedClip ? null : selectedCard}
          clipInfo={clipInfoNode}
          component={component}
          attributes={attributesNode}
          validation={validationNode}
          editable={!!selectedScene && busy === null}
          onLayoutChange={onLayoutChange}
          onFontChange={onFontChange}
          onColorChange={onColorChange}
          onAnimationChange={onAnimationChange}
        />
      </div>

      {/* ③ 工作区与时间线之间的可拖分隔条：上下拖改 dock 高度，双击在默认/展开间切换。 */}
      <div
        className="pc-dock-resize"
        role="separator"
        aria-orientation="horizontal"
        title="拖动调整时间线高度 · 双击切换展开"
        onPointerDown={startDockResize}
        onDoubleClick={toggleDock}
      />

      {/* 底部四轨时间线 */}
      <FourTrackTimeline
        plan={visiblePlan}
        scenes={visibleScenes}
        selectedId={selectedId}
        unboundIds={unboundSceneIds}
        onSelect={selectCard}
        selectedClipId={selectedClip?.id ?? null}
        onSelectClip={selectTrackClip}
        onSplit={onSplitAtPlayhead}
        canSplit={!!(selectedId || selectedClip)}
        onMoveCard={manifest && busy === null ? onMoveCard : undefined}
        onTrimCard={manifest && busy === null ? onTrimCard : undefined}
        onDropCard={manifest && busy === null ? onInsertCard : undefined}
        onDeleteScene={manifest && busy === null ? onDeleteScene : undefined}
        hiddenTracks={hiddenTracks}
        onToggleTrackHidden={toggleTrackHidden}
        cues={cues}
        selectedCueId={selectedCueId}
        onSelectCue={setSelectedCueId}
        onEditCueText={onEditCueText}
        highlightSubtitle={highlightSubtitle}
        heightPx={dockHeight}
        playing={playing}
        playTime={playTime}
        onTogglePlay={videoUrl ? togglePlay : undefined}
        onSeek={videoUrl ? seekTo : undefined}
      />

      {/* UI-fix #6: usable preview — open the compose HTML in a large scaled modal. */}
      {previewOpen && composeResult?.previewUrl && (
        <div className="pc-modal-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="pc-modal pc-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pc-modal-head">
              <span>预览 · {name}</span>
              <a className="pc-preview-open" href={composeResult.previewUrl} target="_blank" rel="noreferrer">
                新窗口打开 ↗
              </a>
              <button className="pc-modal-close" onClick={() => setPreviewOpen(false)} title="关闭">
                ×
              </button>
            </div>
            <div className="pc-preview-scroll">
              <iframe className="pc-preview-frame" title="preview" src={composeResult.previewUrl} />
            </div>
          </div>
        </div>
      )}

      <CaptionsModal
        open={captionsOpen}
        projectName={name}
        subtitleSrc={plan?.tracks.subtitle[0]?.src ?? null}
        recaptioning={busy === "recaption"}
        savingCues={busy === "saveCues"}
        reloadKey={captionsReloadKey}
        onRecaption={onRecaption}
        onSaveCues={onSaveCues}
        onClose={() => setCaptionsOpen(false)}
      />

      <StylePackModal
        open={stylePackOpen}
        applying={busy === "applyTheme"}
        hasManifest={!!manifest}
        onApply={onApplyTheme}
        onClose={() => setStylePackOpen(false)}
      />

      {exportSettingsOpen && (
        <ExportSettingsModal
          busy={busy}
          hasManifest={!!manifest}
          options={renderOptions}
          setOptions={setRenderOptions}
          onClose={() => setExportSettingsOpen(false)}
          onPreview={() => onCompose()}
          onRender={onRender}
        />
      )}
    </div>
  );
}

// ── Left-panel: 场景 list (read-only selection + existing M4 reorder/insert) ──
function ScenesPanel(props: {
  manifest: Manifest | null;
  selectedId: string | null;
  unboundSceneIds: Set<string>;
  busy: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  insertableComponents: { id: string }[];
  insertComponentId: string;
  setInsertComponentId: (id: string) => void;
  onInsert: () => void;
}) {
  const { manifest, selectedId, unboundSceneIds, busy, onSelect, onMove } = props;
  return (
    <div className="pc-scenes">
      <div className="pc-panelhead">场景 {manifest ? `(${manifest.scenes.length})` : ""}</div>
      <ul className="pc-scenelist">
        {manifest?.scenes.map((s, i) => (
          <li key={s.id} className={s.id === selectedId ? "pc-scene active" : "pc-scene"} onClick={() => onSelect(s.id)}>
            <div className="pc-scene-reorder">
              <button className="pc-reorder" disabled={busy || i === 0} onClick={(e) => { e.stopPropagation(); onMove(s.id, "up"); }}>▲</button>
              <button className="pc-reorder" disabled={busy || i === (manifest?.scenes.length ?? 0) - 1} onClick={(e) => { e.stopPropagation(); onMove(s.id, "down"); }}>▼</button>
            </div>
            <div className="pc-scene-main">
              {/* R5-M3: semantic role name as the primary title; id + raw type secondary grey. */}
              <div className="pc-scene-id">
                {sceneRoleLabel(s.component)} {i + 1}
                {unboundSceneIds.has(s.id) && <span className="pc-unbound" title="有未绑定媒体">⚠ {sceneUnboundMediaCount(s)}</span>}
              </div>
              <div className="pc-scene-meta" title={`${s.id} · ${s.scene_type}`}>
                <span className="muted">{s.id}</span>
                <span className="muted">{s.scene_type}</span>
              </div>
            </div>
          </li>
        ))}
        {!manifest && <li className="pc-note muted">未加载项目。</li>}
      </ul>
      {manifest && (
        <div className="pc-add-scene">
          <div className="pc-sectlabel">添加组件</div>
          <select value={props.insertComponentId} onChange={(e) => props.setInsertComponentId(e.target.value)} disabled={busy}>
            {props.insertableComponents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
                {componentNeedsMedia(c.id) ? " · 需媒体" : ""}
              </option>
            ))}
          </select>
          <button onClick={props.onInsert} disabled={busy || !props.insertComponentId}>
            插入{selectedId ? "（选中之后）" : "（末尾）"}
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorBanner(props: { message: string; details: string | null; onDismiss: () => void }) {
  return (
    <div className="pc-errorbar">
      <span>{props.message}</span>
      {props.details && (
        <details>
          <summary>查看详情</summary>
          <pre>{props.details}</pre>
        </details>
      )}
      <button type="button" onClick={props.onDismiss} title="关闭">
        ×
      </button>
    </div>
  );
}

function ExportOptionsFields(props: {
  options: RenderOptions;
  setOptions: (o: RenderOptions) => void;
  disabled: boolean;
}) {
  const opt = props.options;
  const setOpt = (patch: Partial<RenderOptions>) => props.setOptions({ ...opt, ...patch });
  return (
    <div className="pc-export-opts">
      <label>
        分辨率
        <select value="1920x1080" disabled title="HyperFrames 当前仅支持 1920×1080 输出">
          <option value="1920x1080">1920×1080</option>
        </select>
        <span className="pc-export-reason">当前渲染器仅支持该分辨率</span>
      </label>
      <label>
        帧率
        <select value={opt.fps ?? ""} disabled={props.disabled} onChange={(e) => setOpt({ fps: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">默认</option>
          {[24, 25, 30, 60].map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </label>
      <label>
        质量
        <select
          value={opt.quality ?? ""}
          disabled={props.disabled}
          onChange={(e) => setOpt({ quality: (e.target.value || undefined) as RenderOptions["quality"] })}
        >
          <option value="">默认</option>
          {(["draft", "standard", "high"] as const).map((q) => (
            <option key={q} value={q}>
              {QUALITY_LABELS[q]}（{q}）
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ExportSettingsModal(props: {
  busy: Busy;
  hasManifest: boolean;
  options: RenderOptions;
  setOptions: (o: RenderOptions) => void;
  onClose: () => void;
  onPreview: () => void;
  onRender: () => void;
}) {
  const disabled = props.busy !== null;
  return (
    <div className="pc-modal-overlay" onClick={props.onClose}>
      <div className="pc-modal pc-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pc-modal-head">
          <span>导出设置</span>
          <button className="pc-modal-close" onClick={props.onClose} title="关闭">
            ×
          </button>
        </div>
        <div className="pc-export-modal-body">
          <p className="pc-note muted">设置会用于下一次 MP4 渲染；HTML 预览仍使用当前合成结果。</p>
          <ExportOptionsFields options={props.options} setOptions={props.setOptions} disabled={disabled} />
          <div className="pc-plan-actions pc-export-modal-actions">
            <button onClick={props.onPreview} disabled={disabled || !props.hasManifest}>
              {props.busy === "compose" ? "合成中…" : "预览 HTML"}
            </button>
            <button className="primary" onClick={props.onRender} disabled={disabled || !props.hasManifest}>
              {props.busy === "render" ? "渲染中…" : "渲染 MP4"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Left-panel: 方案 hub — preserves all M1-M5 ops (new project / recipe runs /
// workflow run view / compose-lint-inspect / preview). ──
function PlanPanel(props: {
  busy: Busy;
  onNewProject: () => void;
  onCompose: () => void;
  onLint: () => void;
  onInspect: () => void;
  hasManifest: boolean;
  workflowRun: WorkflowRun | null;
  workflowProject: string | null;
  stageGates: Record<string, StageGate>;
  workflowBusy: boolean;
  workflowFailures: string[] | null;
  onRunStage: (id: string) => void;
  onApproveCheckpoint: (id: string) => void;
  onCloseWorkflow: () => void;
  composeResult: ComposeResult | null;
  composeWarnCount: number | null;
  onComposeAnyway: () => void;
  onDismissWarn: () => void;
  manifestName: string;
  onRender: () => void;
  onOpenPreview: () => void;
  canPreview: boolean;
  renderResult: RenderResult | null;
  renderOptions: RenderOptions;
  setRenderOptions: (o: RenderOptions) => void;
}) {
  const { busy } = props;
  const rendering = busy === "render";
  const render = props.renderResult;
  return (
    <div className="pc-plan">
      <div className="pc-panelhead">方案</div>
      <div className="pc-plan-actions">
        <button className="primary" onClick={props.onNewProject} disabled={busy !== null && busy !== "import"}>
          + 新建项目
        </button>
        <button onClick={props.onLint} disabled={busy !== null || !props.hasManifest}>
          {busy === "lint" ? "校验中…" : "校验"}
        </button>
        <button onClick={props.onInspect} disabled={busy !== null || !props.hasManifest}>
          {busy === "inspect" ? "检视中…" : "检视"}
        </button>
      </div>

      {/* 导出 / 渲染: HTML preview + real MP4 render. Resolution is fixed at
          1920×1080 (the only render preset the backend supports — other sizes 422);
          only fps/quality are sent. */}
      <div className="pc-sectlabel">
        <span>导出 / 渲染</span>
        <span className="muted">1920×1080 固定 · 可选帧率/质量</span>
      </div>
      <ExportOptionsFields options={props.renderOptions} setOptions={props.setRenderOptions} disabled={busy !== null} />
      <div className="pc-plan-actions">
        <button onClick={props.onCompose} disabled={busy !== null || !props.hasManifest}>
          {busy === "compose" ? "合成中…" : "预览 (HTML)"}
        </button>
        <button className="primary" onClick={props.onRender} disabled={busy !== null || !props.hasManifest}>
          {rendering ? "渲染中…" : "渲染 MP4"}
        </button>
        <button onClick={props.onOpenPreview} disabled={!props.canPreview}>
          打开大图预览
        </button>
      </div>
      {rendering && (
        <div className="import-progress">
          <span className="spinner" /> 渲染 MP4 中（~十几秒）— 请稍候，别重复点。
        </div>
      )}
      {render && render.ok && render.previewUrl && (
        <div className="banner ok-banner pc-render-ok">
          <div>✓ MP4 渲染完成（{render.name ?? props.manifestName}）。</div>
          <div className="pc-render-links">
            <a href={render.previewUrl} target="_blank" rel="noreferrer">打开 MP4 ↗</a>
            <a href={render.previewUrl} download>
              下载
            </a>
          </div>
          <video className="pc-render-video" src={render.previewUrl} controls preload="metadata" />
        </div>
      )}
      {render && !render.ok && (
        <div className="banner warn">
          渲染失败（阶段：{render.stage ?? "render"}）
          {render.stderr && <pre className="bad">{render.stderr}</pre>}
          {render.logPath && <div className="muted">日志：{render.logPath}</div>}
        </div>
      )}

      {props.composeWarnCount !== null && (
        <div className="banner warn compose-warn">
          {props.composeWarnCount} 个媒体槽未绑定 — 预览可能缺素材。
          <div className="compose-warn-actions">
            <button onClick={props.onComposeAnyway} disabled={busy !== null}>仍然合成</button>
            <button onClick={props.onDismissWarn} disabled={busy !== null}>取消</button>
          </div>
        </div>
      )}

      {props.workflowRun && props.workflowProject && (
        <WorkflowRunPanel
          projectName={props.workflowProject}
          run={props.workflowRun}
          gates={props.stageGates}
          busy={props.workflowBusy}
          failures={props.workflowFailures}
          onRunStage={props.onRunStage}
          onApproveCheckpoint={props.onApproveCheckpoint}
          onClose={props.onCloseWorkflow}
        />
      )}

      <ResultsPanel manifestName={props.manifestName} lintResult={null} inspectResult={null} composeResult={props.composeResult} />
    </div>
  );
}

// R5-M2: project / assets panels carry real metadata instead of placeholder copy.
function PlaceholderPanel({
  tab,
  catalogVersion,
  onNewProject,
  manifest,
  name,
}: {
  tab: RailTab;
  catalogVersion: string;
  onNewProject: () => void;
  manifest: Manifest | null;
  name: string;
}) {
  // Collect bound media (real paths, not TODO placeholders) across all scenes.
  const media: { scene: string; path: string; slot: string }[] = [];
  for (const s of manifest?.scenes ?? []) {
    for (const slot of listMediaSlots(s)) if (slot.bound) media.push({ scene: s.id, path: slot.value, slot: slot.path });
  }
  const fmtDur = (d: number | undefined) => {
    const t = Math.max(0, Math.round(Number(d ?? 0)));
    return `${Math.floor(t / 60)}分${String(t % 60).padStart(2, "0")}秒`;
  };

  if (tab === "project") {
    return (
      <div className="pc-placeholder">
        <div className="pc-panelhead">项目</div>
        {!manifest ? (
          <div className="pc-meta-empty">
            <div className="pc-note muted">未加载项目。</div>
            <button className="primary" onClick={onNewProject}>+ 新建项目</button>
          </div>
        ) : (
          <>
            <dl className="pc-meta">
              <div><dt>项目名</dt><dd className="pc-tpl-id">{name}</dd></div>
              <div><dt>场景数</dt><dd>{manifest.scenes.length} 个</dd></div>
              <div><dt>总时长</dt><dd>{fmtDur(manifest.duration)}</dd></div>
              <div><dt>画面尺寸</dt><dd>1920 × 1080</dd></div>
              <div><dt>已绑定素材</dt><dd>{media.length} 个</dd></div>
            </dl>
            <button className="primary" onClick={onNewProject}>+ 新建项目</button>
            <div className="pc-note muted" style={{ marginTop: 12 }}>组件词汇表 {catalogVersion}</div>
          </>
        )}
      </div>
    );
  }

  // assets
  return (
    <div className="pc-placeholder">
      <div className="pc-panelhead">素材 {manifest ? `(${media.length})` : ""}</div>
      {media.length === 0 ? (
        <div className="pc-meta-empty">
          <div className="pc-note muted">{manifest ? "当前项目暂无已绑定素材。" : "未加载项目。"}</div>
          <button className="primary" onClick={onNewProject}>导入素材</button>
        </div>
      ) : (
        <ul className="pc-asset-list">
          {media.map((m, i) => {
            const ext = (m.path.split(".").pop() || "").toLowerCase();
            const kind = ["mp4", "mov", "webm", "m4v", "mkv", "avi"].includes(ext) ? "视频" : ["wav", "mp3", "m4a", "aac"].includes(ext) ? "音频" : ["png", "jpg", "jpeg", "webp"].includes(ext) ? "图片" : "素材";
            return (
              <li className="pc-asset" key={i} title={m.path}>
                <span className={`pc-asset-kind kind-${kind}`}>{kind}</span>
                <span className="pc-asset-name">{m.path.split("/").pop()}</span>
                <span className="muted pc-asset-scene">{m.scene}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ResultsPanel(props: {
  manifestName: string;
  lintResult: LintResult | null;
  inspectResult: InspectResult | null;
  composeResult: ComposeResult | null;
}) {
  const { manifestName, lintResult, inspectResult, composeResult } = props;
  if (!lintResult && !inspectResult && !composeResult) return null;

  return (
    <div className="results">
      {lintResult && (
        <section>
          <div className="panel-title">
            校验{" "}
            {lintResult.ok ? <span className="ok">✓ {T.common.lintPass}</span> : <span className="bad">✗ {T.common.lintFail(lintResult.failures.length)}</span>}
          </div>
          {lintResult.failures.length > 0 && (
            <ul className="failures">
              {lintResult.failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {inspectResult && (
        <section>
          <div className="panel-title">
            检视 · {inspectResult.name ?? manifestName} {inspectResult.ok ? <span className="ok">✓</span> : <span className="bad">✗</span>}
          </div>
          {inspectResult.output && <pre>{inspectResult.output}</pre>}
          {!inspectResult.ok && inspectResult.stderr && <pre className="bad">{inspectResult.stderr}</pre>}
        </section>
      )}

      {composeResult && (
        <section>
          <div className="panel-title">预览 {composeResult.ok ? <span className="ok">✓</span> : <span className="bad">✗</span>}</div>
          {composeResult.output && <pre className="compose-log">{composeResult.output}</pre>}
          {!composeResult.ok && composeResult.stderr && <pre className="bad">{composeResult.stderr}</pre>}
          {composeResult.ok && composeResult.previewUrl ? (
            <>
              <a href={composeResult.previewUrl} target="_blank" rel="noreferrer">
                {T.common.openPreview} ↗ {composeResult.previewUrl}
              </a>
              <iframe className="preview" title="preview" src={composeResult.previewUrl} />
            </>
          ) : composeResult.ok ? (
            <div className="empty">{T.common.noPreviewUrl}</div>
          ) : null}
        </section>
      )}
    </div>
  );
}
