# Director Packaging Console v2 — 实现方案

> 派单 `4d2241e8`（重派自 `53038f8a`）。只产出方案，不重写运行代码；orchestrator 先 review 再分阶段编排。
> 输入依据：`docs/design/SPEC.md`（用户权威 spec）、`docs/design/ui-decomposition.md`（照图逐区拆解）、
> `docs/design/director-packaging-console-ui-reference.png`（视觉基准）、现状 `console-web/` 全部、
> `hyperframes-composer/components/catalog.json`、`packages/protocol`、`packages/pipeline`。

---

## 0. TL;DR

现状 `console-web` 是「精简编辑器」：扁平 `scenes[]` + props 文本编辑 + 只读/拖拽时间条 + recipe 向导。
v2 spec 要把它升级成「组件化二次包装控制台」：**4 轨时间线 + 卡片实例 schema + 12 类组件库 + 画布拖拽 +
Inspector 4 tab + 智能方案条 + packaging-plan↔template 回环**。

核心判断：**不推翻 HyperFrames 引擎，也不丢弃现有 8 个 coarse 组件**。新增一层
`packaging-plan`（人类/Codex 可编辑的语义层）作为「编辑真相」，由一个新的
**`packaging-plan → manifest` generator** 投影到现有 composer manifest（保持 composer 引擎、catalog 防漂移、
registry 渲染、compose/lint/inspect 完全不动）。所有 v2 富字段（布局/字体/颜色/动画/校验态）落在 packaging-plan 卡片上，
generator 负责「降维」成 composer 认识的 `scenes[].props`。这样 v2 的视觉野心和现有「accepted 引擎」解耦演进。

分 6 个可独立验收阶段：**v2-P0 schema 锚点 → P1 4 轨数据投影 → P2 画布只读 → P3 Inspector 编辑 → P4 组件库拖入 → P5 template 回环**，逐条映射 spec 的 6 条验收。

---

## 1. 数据模型：从 manifest 到 packaging-plan + 4 轨

### 1.1 现状（事实，已读源码）

`hyperframes-composer` 的 manifest（`schemas/manifest.schema.json`，样本 `manifests/m1-acceptance.json`）：

```jsonc
{
  "compositionId": "string",
  "duration": 155.4,
  "audio": { "src": "...wav", "captions": "...json" },
  "output": "projects/x/index.html",
  "scenes": [
    {
      "id": "s001", "component": "TitleCard", "scene_type": "title_card",
      "start": 0.29, "duration": 15.7, "track": 10,
      "finePieces": ["StepPanel"], "props": { ... }
    }
  ]
}
```

- `scenes[]` 是**扁平串行序列**；`track` 是个数字（10/20/30…），现在只当排序提示用，**不是** spec 说的「4 类轨道」。
- 组件词汇 = `catalog.json` 的 8 个 coarse 组件（StatsHero/TitleCard/SplitTextPresenter/ScreenWithPip/HeroAroll/
  StepCard/ProofMontage/SummaryCta）+ 受控 fine pieces。`registry.mjs` 是真实渲染器，`compose.mjs` 把 manifest 渲成 HTML。
- `console-web/src/lib/scene-templates.ts` 已有：`defaultPropsFor`、`makeNewScene/insertScene/deleteScene`、
  `reflowTimeline`、`resizeSceneDuration`、`listMediaSlots`、`countUnboundMedia` —— 这些是 v2 卡片层的天然复用资产。

**关键缺口**：manifest 是「渲染器视角」的扁平场景，没有「视频/音频/字幕/卡片」分轨概念，也没有卡片的
布局/字体/颜色/动画/校验态富字段。spec 的 4 轨和卡片实例必须在 manifest **之上**新建一层。

### 1.2 v2 目标分层（新增 packaging-plan，保 manifest 当编译目标）

```
            ┌─────────────────────────────────────────────────┐
 编辑真相 →  │ packaging-plan.json  (4 轨 + 卡片实例 + 富字段)    │  ← WebUI / Codex 都编辑这一层
            └───────────────────┬─────────────────────────────┘
                                │  packaging-plan → manifest generator (新增, 纯函数)
                                ▼
 渲染目标 →  │ manifest.json (现有 composer 契约, 扁平 scenes[]) │  ← 引擎/catalog/registry/compose 不动
            └───────────────────┬─────────────────────────────┘
                                ▼
                        compose.mjs → index.html  (HyperFrames Studio 预览 / lint / inspect / render)
```

**为什么不直接把 4 轨塞进 manifest**：manifest 是 accepted 引擎契约（catalog 防漂移规则锁死了组件词汇与
fine-piece 父子关系）。把布局/字体/颜色/动画硬塞 manifest 会污染防漂移边界、且老 manifest 无法平滑迁移。
新增 packaging-plan 让「人类可调的语义」和「渲染器认识的结构」分离，正是 spec 第 5/6 条要的
（packaging-plan↔template 分离、HyperFrames 当引擎）。

### 1.3 packaging-plan.json 结构（v2 草案）

```jsonc
{
  "schemaVersion": "2026-06-12",
  "projectId": "string",
  "recipeId": "digital-human-product-introduction",
  "duration": 155.4,
  "source": {                              // 投影到 manifest.audio + 视频/音频轨
    "video": "projects/x/source.mp4",      // 主视频素材（presenter / 成片）
    "audio": "projects/x/audio/asr.wav",   // 主音频 = 定时真相（plan.md 已锁定）
    "captions": "projects/x/captions.json"
  },
  "tracks": {                              // ★ spec 第 1/2 条：只 4 类轨道
    "video":   [ <VideoClip> ],            // 通常 1 条铺满
    "audio":   [ <AudioClip> ],            // 原始音频/配音
    "subtitle":[ <SubtitleCue> ],          // 由 captions 投影，可微调
    "card":    [ <ComponentCard> ]         // ★ 所有图形/演示/PIP/品牌/CTA/对比/步骤/金句都在这条轨上
  },
  "segments": [                            // 智能方案条：识别到的片段（开场钩子/问题说明/…）
    { "id":"seg1", "label":"开场钩子", "start":0, "end":5, "recommendedCards":["chapter-title","keyword-caption"] }
  ],
  "templateRef": { "id":"...", "version":"..." } | null   // 本 plan 由哪个 template 生成（可空）
}
```

`VideoClip` / `AudioClip` / `SubtitleCue` 是窄结构（`{id,start,duration,src?/text?,visible,locked}`）；
**重点是 `ComponentCard`**（见 §1.4 + 附录 draft schema）。

### 1.4 component-card schema（spec 第 4 条：每张卡片 = 标准组件实例）

每张卡片含 spec 列举的 10 组字段。草案见**附录 A**，要点：

| 字段组 | 内容 | 投影到 manifest 的去向 |
|---|---|---|
| `type` | 12 类组件之一（见 §1.5）+ 映射到哪个 coarse `component`/`scene_type` | `scene.component` / `scene.scene_type` |
| `content` | `{title, subtitle, body, items[], chip, kicker}` | `scene.props.*`（按组件 requiredProps 填） |
| `media` | 媒体绑定槽（presenter/screen/pip/items[].src…）+ followTarget | `scene.props.media.*`（复用 `listMediaSlots` 规则） |
| `timeline` | `{track:"card", start, duration}` | `scene.start` / `scene.duration`（复用 `reflowTimeline`） |
| `layout` | `{x,y,w,h,safeAreaLock}` | **v2 富字段**：generator 暂存进 `scene.props.layout`（registry 忽略未知 props，不破坏渲染）；P3+ 接入 registry 才生效 |
| `font` | `{titleSize,bodySize,weight}` | 同上，`scene.props.style.font` |
| `color` | `{accent,bg,text}` / style-pack 引用 | `scene.props.style.color` |
| `graphics` | 图形/箭头/圈选/高亮元素列表 | `scene.props.graphics`（P4+） |
| `animation` | motion-token 引用 + in/out | `scene.props.animation`（P4+） |
| `validation` | `{status:"ok"|"warn"|"error", messages[]}` | **不入 manifest**，由 lint/`countUnboundMedia` 实时算 |

**演进策略**：`layout/font/color/graphics/animation` 这些「composer 还不渲染」的富字段，generator 在 P1-P3
阶段先**透传进 `scene.props` 的命名空间子树**（`registry.renderScene` 对未知 props 无副作用，已由 M4
render-contract-fix 验证），保证 manifest 始终能 compose；待 P4 再扩 registry 真正消费它们。这样 v2 富字段
能先在 WebUI 编辑/存储/套模板，渲染逐步跟上，不阻塞前几阶段验收。

### 1.5 组件库 12 类 → 现有 8 coarse 组件的映射

spec 第 3 条要 12 类「包装组件」（面向用户的卡片语义）。现有 catalog 是 8 个「渲染 coarse 组件」（引擎视角）。
**12 类是 UI 词汇，8 个是引擎词汇**，靠 card.type → component 的映射表桥接（不新增引擎组件即可起步）：

| # | 12 类（UI/spec） | 映射 coarse component | scene_type | 起步状态 |
|---|---|---|---|---|
| 1 | 开场 | StatsHero / TitleCard | hook_stat / title_card | ✅ 现成 |
| 2 | 字幕（关键词字幕卡） | CaptionLine (fine) / TitleCard | — | ✅ 走 subtitle 轨 + fine piece |
| 3 | 产品展示（产品亮点卡） | StatsHero / StepCard | hook_stat / step_card | ✅ 现成 |
| 4 | 讲解演示（演示标注卡） | ScreenWithPip | screen_demo_pip | ✅ 现成 |
| 5 | 对比（左右对比卡） | SplitTextPresenter | concept_split | ✅ 现成(variant) |
| 6 | 画中画卡 | ScreenWithPip (CircularPip) | screen_demo_pip | ✅ 现成 |
| 7 | 数据证明卡 | StatsHero / ProofMontage | hook_stat / proof_montage | ✅ 现成 |
| 8 | 信息结构 | StepCard / SplitTextPresenter | step_card / concept_split | ✅ 现成 |
| 9 | MV 节奏（节奏歌词卡） | ProofMontage / HeroAroll | proof_montage / aroll_emphasis | ⚠️ 近似，P4 可专门做 |
| 10 | 转场 | （新）轨道级 transition | — | 🆕 P4+ 引擎扩展 |
| 11 | 品牌元素 | TitleCard / SummaryCta | title_card / summary_cta | ⚠️ 近似 |
| 12 | CTA | SummaryCta | summary_cta | ✅ 现成 |

**结论**：12 类里 9 类能直接映射到现有 8 coarse 组件（零引擎改动即可起步）；转场(10)、MV 节奏(9)、品牌(11)
是后续引擎扩展点，P0-P3 用近似映射 + 校验标注「降级渲染」处理，不阻塞。映射表落 `component-registry/` 一个
JSON（`cardType → {component, scene_type, defaultPropsFn}`），UI 和 generator 共读一份。

### 1.6 现有 scenes[] → 卡片轨道的迁移

现有 manifest 的 `scenes[]` 是一串 coarse 场景。导入 packaging-plan 时（Route A/B 跑完拿到 manifest）：
- 每个 `scene` → 一张 `ComponentCard`（`card.timeline = {track:"card", start, duration}`，`card.type` 反查映射表，
  `content/media` 从 `scene.props` 回填）。
- `manifest.audio.src/captions` → `tracks.video[0]` + `tracks.audio[0]` + `tracks.subtitle[]`（captions 投影）。
- 反向（plan → manifest）走 generator。**双向是有损-可控的**：富字段(layout/font/…)只在 plan 侧，manifest 侧用
  命名空间子树承载，round-trip 不丢。提供 `manifestToPlan(manifest)` + `planToManifest(plan)` 一对纯函数（在
  `console-web/src/lib/` 或新 `packages/packaging-plan`），TDD 覆盖 round-trip 等价。

---

## 2. UI 组件树（逐块标 复用 / 新建）

目标 5 区（见 reference png + ui-decomposition）。逐块对现状 `console-web/src/App.tsx`（单文件 ~870 行）标注：

```
<App>                                            ❖ 重构：现单文件，拆成 layout shell + 区组件
├─ <TopBar>                                      🆕 新建
│   ├─ <Brand/>                                  🆕  （现有 header.brand 可改造）
│   ├─ <MainFlowNav/> 导入素材/字幕识别/分析/风格包/✦智能包装/✓校验/导出  🆕 (wizard 的 recipe 概念升级)
│   └─ <ProjectActions/> 项目名 + 预览(描边) + 渲染(金实心)  ♻️ 复用 compose/inspect/render 调用
├─ <LeftRail>                                    🆕 竖排 6 tab：项目/素材/场景/组件库/风格库/方案
│   └─ <LeftPanel> (按选中 tab 切换)
│       ├─ <ComponentLibraryPanel/> 当前 tab     🆕 搜索框 + 12 类 chip + 推荐卡片 2 列网格(可拖)
│       │     ← 复用 catalog.ts::listCatalogComponents + 新 cardType 映射表
│       ├─ <ProjectPanel/> / <AssetPanel/> / <ScenePanel/>  ♻️ ScenePanel 可包现有场景列表(aside.scenes)
│       ├─ <StyleLibraryPanel/> 风格库          🆕 style-pack 列表 (P5)
│       └─ <PlanPanel/> 方案                     ♻️ 包现有 Wizard + WorkflowRunPanel
├─ <Canvas>                                       🆕 中央画布（最大新建块）
│   ├─ <CanvasToolbar/> 光标/抓手/缩放/适配% | 16:9/安全区/网格/吸附  🆕
│   ├─ <PresenterLayer/> 灰色数字人剪影位          🆕
│   ├─ <CardLayer/> 选中卡片浮在 presenter 上 + 四角金色手柄(拖拽改 x/y/w/h)  🆕
│   └─ <CanvasHint/> 「这一段适合加入产品亮点和演示标注」  ♻️ 复用 segment.recommendedCards
├─ <Inspector>                                    ❖ 升级：现 editor 的 props/media 段 → 4 tab
│   ├─ tab 属性  ♻️ 复用 props.ts(flattenEditable/applyEdits) + media-binds 段(listMediaSlots)
│   │            🆕 增 布局(x/y/w/h/安全区锁) + 字体(字号/字重) + 颜色 字段
│   ├─ tab 动画  🆕 motion-token 选择 + in/out (P4)
│   ├─ tab 校验  ♻️ 复用 lint/inspect + countUnboundMedia，列 validation.messages
│   └─ tab 历史  🆕 编辑历史/undo (P3+，可后置)
├─ <SmartPlanStrip/> 画布下方智能方案条           🆕 片段卡(开场钩子 00:00-00:05…) + 「识别 N 片段/推荐 M 卡/N 校验」
│     ← 复用 packaging-plan.segments + workflow.ts 的 needs-review/校验聚合
└─ <TimelineDock>                                 ❖ 升级：现 TimelineBar 单轨 → 4 轨
    ├─ <TimelineHeader/> 时间码 + ⏮▶⏭ + 吸附 + 渲染区间  🆕
    └─ <FourTrackTimeline/>                        ❖ 由 TimelineBar.tsx 扩展
        ├─ 视频轨(蓝, 铺满)  / 音频轨(绿)            🆕 轨头 👁可见/🔒锁
        ├─ 字幕轨(蓝描边块)                          🆕
        └─ 卡片轨(开场/产品亮点金/演示标注紫/收尾金)  ♻️ 复用 TimelineBar 的块渲染/拖拽改时长/选中/unbound 角标
```

**复用资产清单**（已存在，v2 直接吃）：
- `lib/scene-templates.ts`：卡片增删/默认 props/reflow/resize/媒体槽 → 卡片轨核心逻辑。
- `lib/props.ts`：flatten/apply → Inspector 属性 tab 内容编辑。
- `lib/workflow.ts`：依赖门禁/needs-review/SERVICE_UNAVAILABLE → 校验 tab + 智能方案条汇总。
- `lib/catalog.ts` / `lib/recipes.ts`：组件词汇 + 推荐 → 组件库面板。
- `TimelineBar.tsx`：块渲染 + 拖拽改时长 + unbound 角标 → 4 轨里的卡片轨。
- `Wizard.tsx` / `WorkflowRunPanel.tsx`：双入口跑 recipe + 状态 → 方案 tab + 主流程 nav。
- `api.ts`：所有 compose/lint/inspect/route-a/route-b/product-intro 调用 → 预览/渲染/校验按钮。

**纯新建**（无现成）：TopBar、LeftRail(6 tab 壳)、Canvas 全套（toolbar/presenter/card 拖拽/hint）、
Inspector 的 布局/字体/颜色/动画 字段、SmartPlanStrip、4 轨时间线的 视频/音频/字幕 三轨 + 轨头可见/锁。

---

## 3. API / generator 影响

### 3.1 新增：packaging-plan ↔ manifest generator（核心新件）

- **建议落 `packages/`**（新 `packages/packaging-plan` 或并入 protocol），纯函数 + Zod/JSON-schema 校验：
  - `planToManifest(plan): Manifest` —— 4 轨投影回扁平 `scenes[]`（卡片轨 → scenes，video/audio/subtitle →
    `manifest.audio` + caption 文件），富字段进命名空间子树。
  - `manifestToPlan(manifest): PackagingPlan` —— 反向，给「Route A/B 跑完 → 进编辑器」用。
  - round-trip TDD：`planToManifest(manifestToPlan(m))` 在 manifest 字段上等价。
- **复用现有 compose/lint/inspect**：generator 产出的 manifest 仍走 `compose.mjs`/`manifest-rules.mjs`/registry，
  **引擎零改动**。spec 第 6 条「HyperFrames 当引擎」由此满足。

### 3.2 console-api 新端点（建议，待 orchestrator 拍板）

沿用现有 RESTish 风格（`apps/console-api/src/server.mjs`）：

| 端点 | 作用 | 复用 |
|---|---|---|
| `GET /projects/:name/packaging-plan` | 读 plan（无则 `manifestToPlan` 现有 manifest 现造） | 现 manifest 读取 |
| `PUT /projects/:name/packaging-plan` | 存 plan + 自动 `planToManifest` 落 manifest + 校验 | 复用现 PUT /manifests 校验/原子写 |
| `GET /templates` / `GET /templates/:id` | 列/读 template | 仿 `/recipes` |
| `POST /templates` | 从当前 plan **另存模板**（抽象掉具体时间点/文案/素材） | spec 验收第 5 条 |
| `POST /projects/:name/apply-template` | 用 template + 新视频生成新 plan | spec 验收第 6 条 |
| `POST /compose/:name` / `/lint` / `/inspect` | **不变** | 现成 |

- `PUT /packaging-plan` 内部：plan → manifest → 复用现有 `manifest-rules.mjs` 校验 → 原子发布
  `manifests/:name.json`（复用 M1 的 temp+rename）。校验失败回 `422 {error, failures}`（现有契约）。
- **协议向后兼容**：新端点是「新 feature 能力」，老 client 不调用即不受影响；plan 缺失时 `manifestToPlan` 现造，
  保证老项目（只有 manifest）也能在 v2 UI 打开（CLAUDE.md 的协议向后兼容契约）。

### 3.3 template / style-pack / motion-token（spec 统一协议补全）

- `template.json`：抽象「场景类型序列 + 卡片规则 + 布局策略 + 动效策略」，**不含**具体文案/时间点/素材路径。
- `style-pack.json`：颜色/字体 token 集（深色金高亮主题先做一个 default）。
- `motion-token.json`：动效 token（in/out/emphasis）。
- 这三者 P5 才需要全功能；P0-P4 用内联默认 + 单一 default style-pack 占位即可。

### 3.4 Codex 导演脑入口（spec 入口 A，本刀只标接口面）

Codex skill `director-codex-hyperframes-video` 后续读同一套 schema：分析视频 → 选 template → 生成 scene-plan →
生成 **packaging-plan**（而非直接 manifest）→ 调 generator → compose/lint/inspect/render。本刀不实现，只确认
「Codex 与 WebUI 共用 packaging-plan + template 作为交换格式」是回环的锚点（spec 第 9 条回环要求）。

---

## 4. 分阶段 build order（每阶段可独立验收）

| 阶段 | 内容 | 独立验收 | 映射 spec 验收 |
|---|---|---|---|
| **v2-P0** schema 锚点 | 定 `packaging-plan.schema.json` + `component-card.schema.json` + cardType↔component 映射表 + `manifestToPlan/planToManifest` 纯函数 + round-trip 测试。**纯 packages，零 UI。** | round-trip 测试绿；现有 manifest 能无损转 plan 再转回 | 打底（无直接验收，支撑 1-6） |
| **v2-P1** 4 轨投影 + plan API | console-api 加 `GET/PUT /packaging-plan`（plan↔manifest，复用现有校验/原子写）。`GET` 对老项目现造 plan。 | 对一个现有 manifest：GET plan 出 4 轨结构；PUT 改 plan 后 manifest 重新 compose 通过 | ③ WebUI 改后重新生成 composition |
| **v2-P2** 画布 + 4 轨只读 | UI shell 重构（TopBar/LeftRail/Canvas/Inspector/SmartPlanStrip/TimelineDock 骨架）；4 轨时间线**只读**渲染 plan；画布显示选中卡片(浮 presenter 上，先不可拖)；智能方案条按 segments 渲染。 | 打开 Route A/B 产物 → 看到 4 轨 + 画布卡片 + 片段条，数据真实 | ② WebUI 打开并展示 packaging-plan |
| **v2-P3** Inspector 编辑 + 卡片轨编辑 | Inspector 4 tab 可编辑(属性/校验复用现有，布局/字体/颜色新增)；画布四角手柄拖拽改 x/y/w/h；卡片轨复用 TimelineBar 拖拽改时长/reflow；编辑 → PUT plan → 重 compose。 | 改卡片文案/布局/时长 → 保存 → 重新 compose 出 HTML，可在 HyperFrames Studio 预览 | ②③④ 编辑 + 重新生成 + 预览/lint/inspect |
| **v2-P4** 组件库拖入 + 富渲染 | 组件库 12 类面板 + 推荐卡片网格，拖入卡片轨(复用 insertScene+映射表)；扩 registry 消费 layout/font/color/animation 富字段(降级渲染收尾)；转场/MV/品牌专门组件。 | 从组件库拖一张新卡到时间线 → 出现在画布 → compose 含该卡 | ①③④ 富包装生成 + 渲染 |
| **v2-P5** template 回环 | `POST /templates` 另存模板（抽象化）；`/apply-template` 套到新视频；风格库 tab；Codex skill 读 template。 | WebUI 当前方案另存模板 → 对另一视频 apply 出新 plan | ⑤⑥ 另存模板 + 模板复用 |

每阶段独立可 demo、可回报、可被 orchestrator 切成更细的「刀」。P0/P1 是纯 packages/API（可与 P2 UI 并行）。

### spec 6 条验收的覆盖确认
1. Codex 自动生成 packaging-plan → P0(schema) + P4(富) + P5(Codex 读 template)。
2. WebUI 打开编辑 packaging-plan → **P2**（展示）+ **P3**（编辑）。
3. WebUI 改后重新生成 composition → **P1**(generator) + **P3**（编辑触发）。
4. 可预览/lint/inspect/render → P3（复用现有 compose/lint/inspect，引擎不动）。
5. 另存模板 → **P5**。
6. Codex 调新模板处理另一视频 → **P5** + Codex skill 接线（本仓库外协同）。

---

## 5. gap-to-current + 风险

### 5.1 Gap（现状 → v2）
1. **数据**：扁平 `scenes[]` → 4 轨 + 卡片实例富 schema。**靠新增 packaging-plan 层 + generator 弥合，引擎不动。**
2. **UI**：左场景列表+props 编辑+单轨时间条 → 5 区控制台（画布/组件库/Inspector 4 tab/4 轨/方案条）。**最大工作量。**
3. **组件**：8 coarse 引擎组件 → 12 类 UI 组件库。**9/12 可直接映射，3 类(转场/MV/品牌)后置扩展。**
4. **回环**：无 → packaging-plan↔template 分离 + 另存/套用 + Codex 复用。**P5。**
5. **富渲染**：registry 只渲文本/媒体 → 需消费 layout/font/color/animation。**P4 收尾，前期透传不渲染。**

### 5.2 风险
- **R1 范围爆炸成完整 NLE**：spec 明确「不是普通视频编辑器」「时间线只 4 类轨道」。守住——卡片轨是唯一富轨，
  不做多视频轨/关键帧曲线/混音台。plan.md 已列此 risk。
- **R2 富字段 round-trip 丢失**：layout/font/… 只在 plan，manifest 用命名空间子树承载。靠 P0 round-trip 测试守门。
- **R3 引擎漂移**：catalog 防漂移规则锁死组件词汇。generator 必须只产 catalog 内组件；12 类→8 的映射表是唯一
  扩词汇入口，新引擎组件须先过 catalog/registry 验证（M4 render-contract-fix 的教训：默认 props 必须过真实 render）。
- **R4 画布坐标系 ↔ 渲染坐标系**：画布 x/y/w/h（编辑像素）vs HyperFrames 实际布局（CSS/safe-area）需定义换算与
  安全区约束，否则「画布所见 ≠ 渲染所得」。建议 P2 先定 16:9 基准画布 + 安全区 token，P3 拖拽再落地换算。
- **R5 字幕轨 ↔ 主音频定时真相**：plan.md 已锁「主音频为定时真相，改音频必重跑 ASR」。字幕轨可微调展示，但
  时间真相来自 captions；不允许在字幕轨自由拖动到与音频脱节。
- **R6 reference 原始 index.html 不在本机**（在用户 Windows 机器），只能照 png 复刻。视觉细节(精确间距/动效)需
  P2/P3 落地时与用户对一次，挂 open-question 若有歧义。

---

## 附录 A — draft component-card.schema.json（锚点，非最终）

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Director Packaging Component Card",
  "type": "object",
  "required": ["id", "type", "timeline"],
  "properties": {
    "id": { "type": "string" },
    "type": {                                  // 12 类之一
      "enum": ["opening","caption","product-highlight","demo-annotation","comparison",
               "pip","data-proof","info-structure","mv-rhythm","transition","brand","cta"]
    },
    "engine": {                                // 投影目标（cardType↔coarse 映射的快照）
      "type": "object",
      "properties": { "component": {"type":"string"}, "scene_type": {"type":"string"},
                      "finePieces": {"type":"array","items":{"type":"string"}} }
    },
    "content": {
      "type": "object",
      "properties": {
        "chip": {"type":"string"}, "kicker": {"type":"string"},
        "title": {"type":"string"}, "subtitle": {"type":"string"},
        "body": {"type":"string"}, "items": {"type":"array","items":{"type":"string"}}
      }
    },
    "media": {                                 // 复用 listMediaSlots 的槽语义
      "type": "object",
      "properties": {
        "presenter": {"type":"string"}, "screen": {"type":"string"},
        "pip": {"type":"string"}, "items": {"type":"array"},
        "followTarget": {"type":"string"}      // 「跟随对象=画面主体」
      }
    },
    "timeline": {
      "type": "object",
      "required": ["track","start","duration"],
      "properties": {
        "track": {"const":"card"},
        "start": {"type":"number","minimum":0},
        "duration": {"type":"number","exclusiveMinimum":0}
      }
    },
    "layout":   { "type":"object", "properties": {                  // v2 富字段
      "x":{"type":"number"},"y":{"type":"number"},"w":{"type":"number"},"h":{"type":"number"},
      "safeAreaLock":{"type":"boolean"} } },
    "font":     { "type":"object", "properties": {
      "titleSize":{"type":"number"},"bodySize":{"type":"number"},"weight":{"type":"string"} } },
    "color":    { "type":"object", "properties": {
      "accent":{"type":"string"},"bg":{"type":"string"},"text":{"type":"string"},
      "stylePackRef":{"type":"string"} } },
    "graphics": { "type":"array", "items": {"type":"object"} },     // 箭头/圈选/高亮
    "animation":{ "type":"object", "properties": {
      "in":{"type":"string"},"out":{"type":"string"},"motionTokenRef":{"type":"string"} } },
    "validation": {                             // 运行期算出，不入 manifest
      "type":"object",
      "properties": { "status":{"enum":["ok","warn","error"]},
                      "messages":{"type":"array","items":{"type":"string"}} }
    }
  }
}
```

`video/audio/subtitle` 轨条目 schema 从略（窄结构 `{id,start,duration,src?|text?,visible,locked}`）；
`packaging-plan.schema.json` 顶层包 `source/tracks/segments/templateRef`（见 §1.3）。

---

## 决策记号
- **D1**：新增 packaging-plan 语义层，manifest 降级为编译目标，HyperFrames 引擎/catalog/registry 不动。
  （理由：spec 第 5/6 条要求 plan↔template 分离 + 引擎复用；避免污染 catalog 防漂移边界。）→ 已起草 ADR。
- **D2**：12 类 UI 组件靠 cardType↔8 coarse 映射表桥接，零引擎改动起步，转场/MV/品牌后置。
- 两者建议 orchestrator review 后落 `.hive/decisions/`。
```
