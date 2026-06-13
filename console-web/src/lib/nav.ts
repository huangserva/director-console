// v2 finishing cut: top-bar main-flow nav → real actions. The mapping itself is
// pure (id + context → what to do) so it can be unit-tested without the DOM; the
// App just executes the resolution (switch rail / open wizard / lint / compose /
// show a notice). Highlight follows the last-clicked nav id.

export type RailTab = "project" | "assets" | "scenes" | "library" | "styles" | "plan";
export type NavId = "import" | "captions" | "analyze" | "style" | "package" | "validate" | "export";

export interface NavResolution {
  /** Switch the left rail to this tab. */
  rail?: RailTab;
  /** Open the setup wizard (recipe / import). */
  openWizard?: boolean;
  /** Trigger lint (results land in the Inspector 校验 tab). */
  lint?: boolean;
  /** Trigger compose (HTML preview). */
  compose?: boolean;
  /** Pulse-highlight the subtitle track in the timeline (字幕识别). */
  highlightSubtitle?: boolean;
  /** Open the captions (字幕识别) panel. */
  openCaptions?: boolean;
  /** Open the style-pack (风格包) panel. */
  openStylePack?: boolean;
  /** Open the dedicated export settings panel. */
  openExportSettings?: boolean;
  /** Informational banner text (non-error). */
  notice?: string;
}

/**
 * Resolve a main-flow nav id to concrete actions, given light context.
 * Every id yields a visible reaction (panel switch / wizard / lint / compose /
 * notice) — never a no-op highlight.
 */
export function resolveNav(id: NavId, ctx: { hasCaptions: boolean }): NavResolution {
  switch (id) {
    case "import":
      return { openWizard: true, notice: "导入成片或源视频：在向导里走 成片导入 / 数字人 / 产品介绍。" };
    case "captions":
      return {
        openCaptions: true,
        highlightSubtitle: true,
        notice: ctx.hasCaptions
          ? "字幕识别：重新识别 / 逐句编辑字幕。"
          : "暂无字幕 — 可『重新识别字幕』生成，或先『导入素材』。",
      };
    case "analyze":
      return { openWizard: true, notice: "分析视频：在向导中按输入推荐流程，再触发对应流程。" };
    case "style":
      return { openStylePack: true };
    case "package":
      return { rail: "library", notice: "从「组件库」拖卡片到底部卡片轨道，或点击卡片插入。" };
    case "validate":
      return { lint: true, notice: "已触发校验，结果见右侧检视器的「校验」页。" };
    case "export":
      return { openExportSettings: true };
  }
}
