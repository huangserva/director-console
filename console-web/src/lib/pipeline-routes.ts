// v3-4 显式 pipeline tabs：把『先选能力路线，再进对应表单』做成可发现的路线定义。
// 纯数据 + 纯函数；UI（Wizard）按这里的定义渲染 tabs，复用各自既有表单与提交逻辑。

export type PipelineRouteKind = "import" | "routeA" | "productIntro" | "skill" | "generate" | "placeholder";

export interface PipelineRoute {
  id: string; // tab id（稳定，用于激活态）
  title: string; // 中文标题
  subtitle: string; // 一句话用途
  kind: PipelineRouteKind;
  recipeId: string | null; // recipe 驱动的路线带 recipe id；skill/占位为 null
  enabled: boolean; // 占位 tab 标灰不可点
}

// recipe id 常量（与后端 catalog 对齐；与 Wizard 既有提交逻辑一致）。
export const ROUTE_B_RECIPE_ID = "existing-narrated-video";
export const ROUTE_A_RECIPE_ID = "digital-human-talking-head";
export const PRODUCT_INTRO_RECIPE_ID = "digital-human-product-introduction";

export const PIPELINE_ROUTES: PipelineRoute[] = [
  {
    id: "import",
    title: "成片导入",
    subtitle: "已有成片 → 自动识别字幕 → 生成可编辑项目",
    kind: "import",
    recipeId: ROUTE_B_RECIPE_ID,
    enabled: true,
  },
  {
    id: "routeA",
    title: "数字人口播",
    subtitle: "脚本或主题 → 配音 → 数字人口播 → 可编辑项目",
    kind: "routeA",
    recipeId: ROUTE_A_RECIPE_ID,
    enabled: true,
  },
  {
    id: "productIntro",
    title: "数字人产品介绍",
    subtitle: "产品信息 → 产品向口播脚本 → 数字人 → 可编辑项目",
    kind: "productIntro",
    recipeId: PRODUCT_INTRO_RECIPE_ID,
    enabled: true,
  },
  {
    id: "skill",
    title: "打开 skill 产物",
    subtitle: "导入 skill 产出目录或入口 → 直接进四轨编辑",
    kind: "skill",
    recipeId: null,
    enabled: true,
  },
  {
    id: "auto",
    title: "一句话自动生成",
    subtitle: "粘一段脚本 → 自动切句成卡 → 可编辑项目（无需配置）",
    kind: "generate",
    recipeId: null,
    enabled: true,
  },
];

// 默认激活第一个可用路线。
export function defaultRouteId(routes: PipelineRoute[] = PIPELINE_ROUTES): string {
  return (routes.find((r) => r.enabled) ?? routes[0]).id;
}

export function findRoute(id: string, routes: PipelineRoute[] = PIPELINE_ROUTES): PipelineRoute | null {
  return routes.find((r) => r.id === id) ?? null;
}

// 占位/禁用 tab 不可点。
export function isRouteSelectable(route: PipelineRoute): boolean {
  return route.enabled && route.kind !== "placeholder";
}

// recipe 驱动路线 → recipe id；非 recipe 路线（skill/占位）→ null。
export function recipeIdForRoute(id: string, routes: PipelineRoute[] = PIPELINE_ROUTES): string | null {
  return findRoute(id, routes)?.recipeId ?? null;
}
