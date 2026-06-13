# Aether AI Script v2 Scene Map

目标：约 150s，7 场。仅脚本阶段，不配音、不 DUIX、不渲染。

| Scene | Time | scene_type | Component | Narration Goal | Visual Plan | Podcast Clip |
| --- | --- | --- | --- | --- | --- | --- |
| S001 | 0-20s | `hook_stat` | `StatsHero` | 开场点名极客公园「今夜科技谈」来源，用杯子例子建立“相关不等于因果”。 | 数字人开场；左侧节目来源与“相关 ≠ 因果”；HUD 卡显示 Pattern / Mechanism / Causality。 | `~/Downloads/outputs/clip1.mp4`：杯子例子，竖版窗口或短 punch-in。 |
| S002 | 20-43s | `concept_split` | `SplitTextPresenter` | 解释 LLM/VLA/Sora 在物理世界的客观边界：变量变化带来真实后果。 | 左侧 Physical AI needs causality；三卡：变量变化 / 动作失败 / 真实后果；右侧数字人。 | 不强制 B-roll；以数字人 + HUD 为主。 |
| S003 | 43-65s | `concept_split` | `SplitTextPresenter` | 拆解 scaling what：把 scaling 从抽象信仰变成模型、数据和机制的工程问题。 | 左侧两条斜率线：Blind scaling 0.2 / Causal scaling 0.8；标注“播客工程比喻”。 | 可不用切片，避免信息过密。 |
| S004 | 65-94s | `step_card` | `StepCard` | 展示 AI 三十年四代范式，建立“因果大模型”在技术史上的位置。 | StepCard 四条编号：相关性小模型 / 因果小模型 / 相关性大模型 / 因果大模型。 | `~/Downloads/outputs/clip4.mp4`：四代范式切片。 |
| S005 | 94-118s | `concept_split` | `SplitTextPresenter` | 解释“世界模型不等于抓住本质”，转入因果世界模型的能力。 | 左侧 World Model ≠ Mechanism；三卡：推演后果 / 找到根因 / 举一反三；右侧数字人。 | 可复用 `clip1.mp4` 定格帧作小卡，保持竖版比例。 |
| S006 | 118-138s | `concept_split` | `SplitTextPresenter` | 说明 Aether AI 定位：Perception 与 Control 之间的智能推理层。 | 左侧架构图：Perception → Aether AI Reasoning Layer → Control；三个问题卡 Why / Intervention / Recovery；右侧数字人。 | 不强制 B-roll。 |
| S007 | 138-154s | `summary_cta` | `SummaryCta` | 收束到下一代 AI 范式、三原则、slogan、节目和官网 CTA。 | 数字人全屏或右侧大窗；左侧 slogan；官网 aetherlabs.ai；节目来源卡。 | 可短露极客公园节目来源，不使用源字幕误转品牌。 |

## Display Copy Budget

- S001 标题：相关 ≠ 因果
- S002 标题：Physical AI needs causality
- S003 标题：Scaling what?
- S004 标题：FOUR AI PARADIGMS
- S005 标题：World Model ≠ Mechanism
- S006 标题：Reasoning Layer
- S007 标题：Causal World Models

## TTS Pronunciation Notes

- `AI` 口播喂入：`A I`
- `LLM` 口播喂入：`L L M`
- `VLA` 口播喂入：`V L A`
- `Aether AI` 口播喂入：`Aether A I`
- `V-JEPA` 口播喂入：`V JEPA`
- 屏幕显示保持正常英文拼写：`AI`、`LLM`、`VLA`、`Sora`、`Aether AI`、`V-JEPA`

## Compliance Notes

- 屏幕和字幕品牌统一：`Aether AI`。
- 人名统一：黄碧薇教授 / Prof. Biwei Huang。
- 对 LLM/VLA/Sora/LeCun/V-JEPA 只做客观技术语境描述，保持中性表达。
- 播客源稿中的误转品牌、人名误写和商业资本信息不进入口播或画面。
