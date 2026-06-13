# Director Packaging Console — 目标 Spec（用户 2026-06-12 提供，权威）

> 这是用户给的权威方向（v2 准绳）。视觉基准见 `director-packaging-console-ui-reference.png`（原 `index.html` 在用户 Windows 机器 `C:\Users\longk\Documents\口播智能剪辑\director-packaging-console-ui\index.html`，本机无，照图复刻）。

## 系统定位
组件化**视频二次包装系统**（不是普通视频编辑器）。双入口：
- **入口 A — Codex 导演脑**：读 skill `director-codex-hyperframes-video`，自动分析视频→生成包装方案→生成 HyperFrames composition→校验→渲染。
- **入口 B — WebUI 控制台**：用户查看/调整包装方案（组件卡片、字幕、时间线、样式、动画、渲染设置）。
- **回环要求**：WebUI 调整后可另存为**新模板**；Codex skill 后续可调用这些模板自动包装新视频。

## 统一底层协议
project.json / transcript.json / scene-plan.json / packaging-plan.json /
component-card.schema.json / component-registry/ / template.json / style-pack.json /
motion-token.json / hyperframes-generator

## 核心设计
1. **时间线只 4 类轨道**：视频 / 音频 / 字幕 / 卡片。
2. 图形/演示/画中画/品牌/CTA/对比/步骤/金句等**都是「卡片轨道」上的卡片实例**，不再拆独立轨道。
3. **组件库 12 类**：开场 / 字幕 / 产品展示 / 讲解演示 / 对比 / 画中画 / 数据证明 / 信息结构 / MV节奏 / 转场 / 品牌元素 / CTA。
4. **每张卡片 = 标准组件实例**，含：类型 / 内容 / 媒体绑定 / 布局 / 字体 / 颜色 / 图形 / 动画 / 时间线 / 校验状态。
5. **packaging-plan 与 template 必须分开**：
   - packaging-plan = 某个具体视频的包装结果（具体时间点/文案/素材）。
   - template = 可复用包装方法（抽象出场景类型/卡片规则/布局策略/动效策略）。
6. **HyperFrames = 合成与渲染引擎**：packaging-plan → HyperFrames index.html；预览=HyperFrames Studio；校验=lint/inspect；输出=render。
7. **Codex skill = 导演脑**：分析视频类型→分析字幕/语义/节奏→选模板→生成 scene-plan→生成 packaging-plan→调 generator→校验修复→渲染。
8. **WebUI = 控制台**：读 project/transcript/scene-plan/packaging-plan→展示画布/组件库/Inspector/四轨时间线→人工调卡片→保存方案→另存模板→调预览/校验/渲染接口。

## 推荐开发顺序
1. 读当前 WebUI + director skill。
2. 建项目目录结构。
3. 定义 JSON schema：project / transcript / scene-plan / packaging-plan / component-card / template / style-pack。
4. component-registry 第一批卡片：标题卡 / 关键词字幕卡 / 产品亮点卡 / 演示标注卡 / 左右对比卡 / 画中画卡 / 数据证明卡 / CTA 卡。
5. packaging-plan → HyperFrames HTML generator。
6. 本地 API：读项目 / 存 packaging-plan / 存模板 / 从模板生成方案 / 生成 HyperFrames / lint / inspect / render。
7. WebUI 从静态页升级为可操作页。
8. director skill 接入这些 schema 和模板（Codex 自动生产 + 读 WebUI 存的新模板）。

## 验收目标
1. Codex 基于一个视频自动生成 packaging-plan。
2. WebUI 打开并编辑该 packaging-plan。
3. WebUI 修改后重新生成 HyperFrames composition。
4. HyperFrames 可预览/lint/inspect/render。
5. WebUI 把当前方案另存为模板。
6. Codex skill 调用该新模板处理另一个视频。
