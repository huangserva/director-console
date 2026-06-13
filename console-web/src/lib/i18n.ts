// Central Chinese strings for the console. User-visible English (recipe names
// from the API, catalog component purposes, wizard labels) is localized here so
// it's maintained in one place. Technical identifiers (component ids like
// TitleCard, prop keys like cornerLeft) stay as-is; their display labels are zh.

// recipe id → 中文 名称/描述（覆盖 API 返回的英文）
export const RECIPE_LABELS: Record<string, { name: string; description: string }> = {
  "existing-narrated-video": {
    name: "成片导入",
    description: "导入一段已配音的成片，自动识别字幕与转写，再打包成可编辑的 HyperFrames 场景。",
  },
  "digital-human-talking-head": {
    name: "数字人口播",
    description: "用脚本或主题生成数字人口播视频，再打包成可编辑的 HyperFrames 场景。",
  },
  "digital-human-product-introduction": {
    name: "数字人产品介绍",
    description: "用产品信息 + 真人/数字人源视频生成产品介绍口播，按产品化模板打包 HyperFrames。",
  },
};

export function recipeName(id: string, fallback: string): string {
  return RECIPE_LABELS[id]?.name ?? fallback;
}
export function recipeDescription(id: string, fallback: string): string {
  return RECIPE_LABELS[id]?.description ?? fallback;
}

// catalog component id → 中文 名称/用途说明
export const COMPONENT_LABELS: Record<string, { name: string; purpose: string }> = {
  StatsHero: { name: "开场数据卡", purpose: "开场数字/浏览器冲击序列，全程保留主讲人出镜（源视频、数据爆点、浏览器框、回切、标题）。" },
  TitleCard: { name: "标题卡", purpose: "深色蜂巢风标题转场，含眉标、主标题、副标题和金/蓝下划线堆叠。" },
  SplitTextPresenter: { name: "左右图文卡", purpose: "左信息面板 + 右主讲人窗口；支持课程拆分与定义面板，主讲人不被圆形画中画替换。" },
  ScreenWithPip: { name: "屏幕+画中画卡", purpose: "前景录屏/证据画面，叠一个移动的圆形主讲人/助理画中画。" },
  HeroAroll: { name: "主讲人特写卡", purpose: "满屏移动主讲人强调段，静音 DUIX 视频 + 主音轨收尾。" },
  StepCard: { name: "步骤卡", purpose: "短居中讲解标记卡，含小标题、大标题和三条紧凑要点。" },
  ProofMontage: { name: "证据快剪卡", purpose: "来自真实录屏/结果视频的快速证据/结果切片，无静态占位网格。" },
  SummaryCta: { name: "收尾 CTA 卡", purpose: "结尾干净的 A-roll 或拆分总结 CTA；主讲人面部清晰，文字精简不挡脸。" },
};

export function componentName(id: string | undefined, fallback?: string): string {
  if (!id) return fallback ?? "";
  return COMPONENT_LABELS[id]?.name ?? fallback ?? id;
}
export function componentPurpose(id: string | undefined, fallback: string): string {
  if (!id) return fallback;
  return COMPONENT_LABELS[id]?.purpose ?? fallback;
}

// 通用 UI 文案（wizard / 结果 / 校验等）
export const T = {
  wizard: {
    title: "新建项目",
    close: "关闭",
    pickRecipe: "选择一个流程查看它需要的输入。",
    loadingRecipes: "正在加载流程…",
    recommended: "推荐",
    notImplemented: "暂不可用",
    requiredInputs: "所需输入",
    required: "必填",
    notRunnable: "该流程暂不能在此运行，可查看它的输入与阶段。",
    browse: "浏览…",
    browsing: "选择中…",
    // 字段标签
    videoPath: "成片视频路径（绝对路径）",
    sourceVideo: "源视频路径（绝对路径，主讲人/人脸）",
    topic: "主题（或在下方填写脚本）",
    approvedScript: "脚本全文（或只在上方给主题）",
    voiceRef: "音色参考 wav（可选）",
    projectName: "项目名（可选）",
    productName: "产品名",
    productDesc: "产品描述",
    sellingPoints: "卖点",
    productMedia: "产品演示素材（可选，证据/演示视频）",
    offerCta: "报价 / 行动号召（可选）",
    addRow: "+ 添加",
    // 占位
    phVideo: "/Users/…/finished-video.mp4",
    phSource: "/Users/…/presenter.mp4",
    phTopic: "例如：MemOS CLI 跨进程共享记忆",
    phScript: "完整口播脚本…",
    phWav: "/Users/…/voice-ref.wav",
    phAutoName: "留空自动命名",
    phProductName: "例如：MemOS CLI",
    phProductDesc: "简短的产品描述…",
    phSellingPoint: "一条关键卖点",
    phMedia: "/Users/…/demo.mp4",
    phCta: "例如：今天免费试用",
    // 按钮 / 进度 / 失败
    createProject: "新建项目",
    importing: "导入中…",
    importProgress: "正在跑 ASR + 合成（~30s+），请稍候，别重复提交。",
    importFailed: "导入失败。",
    runRouteA: "运行数字人",
    running: "运行中…",
    routeAFailed: "数字人流程失败。",
    routeANeeds: "需要源视频路径，以及主题或脚本二选一。",
    runProductIntro: "运行产品介绍",
    productIntroFailed: "产品介绍失败。",
    productIntroNeeds: "需要源视频、产品名、描述，以及至少一条卖点。",
    pipelineProgress: "正在跑 TTS → 口型 → ASR → 合成（服务在线约 30s+），请稍候，别重复提交。",
    log: "日志",
  },
  common: {
    lintPass: "校验通过",
    lintFail: (n: number) => `${n} 个问题`,
    preview: "预览",
    openPreview: "打开预览",
    noPreviewUrl: "未返回预览地址。",
    remove: "删除",
  },
};

// 动画 motion-token id → 中文展示标签（存储值保留英文 id，仅展示中文）
export const MOTION_LABELS: Record<string, string> = {
  none: "无",
  fade: "淡入",
  "slide-up": "上滑",
  "slide-down": "下滑",
  "slide-left": "左滑",
  "slide-right": "右滑",
  scale: "缩放",
  pop: "弹出",
};
export function motionLabel(id: string): string {
  return MOTION_LABELS[id] ?? id;
}

// 字重 id → 中文
export const WEIGHT_LABELS: Record<string, string> = { regular: "常规", medium: "中等", bold: "加粗" };
export function weightLabel(id: string): string {
  return WEIGHT_LABELS[id] ?? id;
}

// 颜色字段键 → 中文
export const COLOR_LABELS: Record<string, string> = { accent: "强调色", bg: "背景色", text: "文字色" };
export function colorLabel(key: string): string {
  return COLOR_LABELS[key] ?? key;
}

// 渲染质量枚举 → 中文括注（值保留英文枚举）
export const QUALITY_LABELS: Record<string, string> = { draft: "草稿", standard: "标准", high: "高清" };
