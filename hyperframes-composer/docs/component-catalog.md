# Component Catalog

This document is the human-facing index for `components/catalog.json`. The JSON file remains the machine-readable source of truth.

## Coarse Scene Components

Use coarse scene components by default. They are the stable API for new videos.

| Component | Layer | Scene type | Use for | Required props | Example |
| --- | --- | --- | --- | --- | --- |
| `StatsHero` | coarse scene | `hook_stat` | Opening stat/browser impact sequence where presenter stays visible through source video, punch-in, browser frame, return, and title beats. | `media.presenter`, `stat.label`, `stat.number`, `stat.unit`, `stat.title`, `titleBeat.title` | `s001` opening in `manifests/memos-v3.json` |
| `TitleCard` | coarse scene | `title_card` | Dark honeycomb title or chapter transition. | `cornerLeft`, `cornerName`, `kicker`, `title`, `subline` | Standalone chapter break between major ideas. |
| `SplitTextPresenter` | coarse scene | `concept_split` | Left information panel plus right presenter window. Supports `course` and `definition` variants. | `variant` plus variant-specific props | `s005-definition`, `s006-course` in `manifests/memos-v3.json` |
| `ScreenWithPip` | coarse scene | `screen_demo_pip` | Screen recording or proof surface with one moving circular presenter PIP. | `label`, `media.screen`, `media.pip` | `s002-screen`, `s003-screen`, `s004-screen` in `manifests/memos-v3.json` |
| `HeroAroll` | coarse scene | `aroll_emphasis` | Full-bleed presenter emphasis with minimal overlay. | `media.presenter` | Short presenter-only bridge when no screen or large card is needed. |
| `StepCard` | coarse scene | `step_card` | Short centered instructional marker. | `kicker`, `title`, `items` | `s003-step`, `s004-step` in `manifests/memos-v3.json` |
| `ProofMontage` | coarse scene | `proof_montage` | Fast proof/result cuts from real screen or result video. | `media.items` | A sequence of accepted result videos; no static placeholder grid. |
| `SummaryCta` | coarse scene | `summary_cta` | Final clean A-roll or minimal CTA with presenter face clear. | `media.presenter`, `chip`, `title`, `subline` | `s007-aroll` in `manifests/memos-v3.json` |

### Coarse Component Examples

`StatsHero`:

```json
{
  "scene_type": "hook_stat",
  "component": "StatsHero",
  "finePieces": ["OpeningSourceVideo", "OpeningStatPunch", "OpeningBrowserFrame"],
  "props": {
    "media": { "presenter": "assets/external-first390/production/duix-results/hf390_duix_intro_aroll_v3-r.mp4" },
    "stat": { "label": "AGENT MEMORY", "number": "7", "unit": "场", "title": "共享记忆实战" },
    "titleBeat": { "title": "Agent 记忆层" }
  }
}
```

`TitleCard`:

```json
{
  "scene_type": "title_card",
  "component": "TitleCard",
  "props": {
    "cornerLeft": "CHAPTER 02",
    "cornerName": "MEMOS CLI",
    "kicker": "NEXT",
    "title": "从经验到记忆",
    "subline": "把可复用结论沉淀下来"
  }
}
```

`SplitTextPresenter`:

```json
{
  "scene_type": "concept_split",
  "component": "SplitTextPresenter",
  "finePieces": ["CourseSplitPanel"],
  "props": {
    "variant": "course",
    "chip": "MULTIMAC",
    "kicker": "ONE MEMORY SPACE",
    "title": "多机同层记忆",
    "subline": "同一配置，同一记忆空间",
    "cards": [{ "icon": "AI", "label": "Codex 写入" }],
    "media": { "presenter": "assets/external-first390/production/duix-results/hf390_duix_multimac_presenter_v3-r.mp4" }
  }
}
```

`ScreenWithPip`:

```json
{
  "scene_type": "screen_demo_pip",
  "component": "ScreenWithPip",
  "finePieces": ["ScreenShell", "CircularPip", "ScanLine"],
  "props": {
    "label": "Codex 写入记忆",
    "media": {
      "screen": "assets/external-first390/assets/screen-fitted/s003.mp4",
      "pip": "assets/external-first390/production/duix-results/hf390_screen_codex_memos_add_plus_duix_pip_v3-r.mp4"
    }
  }
}
```

`HeroAroll`:

```json
{
  "scene_type": "aroll_emphasis",
  "component": "HeroAroll",
  "props": {
    "media": { "presenter": "assets/external-first390/production/duix-results/hf390_duix_intro_aroll_v3-r.mp4" }
  }
}
```

`StepCard`:

```json
{
  "scene_type": "step_card",
  "component": "StepCard",
  "finePieces": ["StepPanel"],
  "props": {
    "kicker": "STEP 01",
    "title": "先写入",
    "items": ["Chrome 登录态", "正文提取", "滚动加载"]
  }
}
```

`ProofMontage`:

```json
{
  "scene_type": "proof_montage",
  "component": "ProofMontage",
  "props": {
    "media": {
      "items": [{ "src": "assets/external-first390/assets/screen-fitted/s003.mp4", "label": "写入成功" }]
    }
  }
}
```

`SummaryCta`:

```json
{
  "scene_type": "summary_cta",
  "component": "SummaryCta",
  "finePieces": ["CleanArollOverlay"],
  "props": {
    "chip": "TRY MEMOS CLI",
    "title": "让 Agent 互学",
    "subline": "同一层长期记忆",
    "media": { "presenter": "assets/external-first390/production/duix-results/hf390_duix_final_cta_v3-r.mp4" }
  }
}
```

## Controlled Fine Pieces

Fine pieces are not free-floating components. They are controlled parts that may only be used inside their parent scene component.

| Fine piece | Layer | Parent component(s) | Role | Example |
| --- | --- | --- | --- | --- |
| `OpeningSourceVideo` | controlled fine piece | `StatsHero` | Full presenter video beats in the opening. | `s001` full-screen source and return clips. |
| `OpeningStatPunch` | controlled fine piece | `StatsHero` | Short stat punch-in, kept off the presenter face. | `s001` 7-scene stat card. |
| `OpeningBrowserFrame` | controlled fine piece | `StatsHero` | Browser/window framing beat with icon cloud and proof layer. | `s001` Memory browser frame. |
| `CourseSplitPanel` | controlled fine piece | `SplitTextPresenter` | Course-style left text and right presenter panel. | `s006-course`. |
| `QuestionMapPanel` | controlled fine piece | `SplitTextPresenter` | Question map structure from first120. | Use only when the scene intent matches a question map. |
| `DefinitionPanel` | controlled fine piece | `SplitTextPresenter` | Definition text/card/presenter panel. | `s005-definition` open/stack panels. |
| `DefinitionFlowOverlay` | controlled fine piece | `SplitTextPresenter` | Flow nodes and connector lines for definition scenes. | `s005-definition` flow beat. |
| `DefinitionCreatePanel` | controlled fine piece | `SplitTextPresenter` | Create-memory definition panel. | Accepted first120 definition create beat. |
| `DefinitionOneSentencePanel` | controlled fine piece | `SplitTextPresenter`, `ScreenWithPip` | One-sentence goal panel. | Accepted first120 one-sentence beat. |
| `ScreenShell` | controlled fine piece | `ScreenWithPip` | Screen frame and label. | `s002-screen`. |
| `CircularPip` | controlled fine piece | `ScreenWithPip` | The single circular talking-head helper. | `s002-screen` bottom-right PIP. |
| `StepPanel` | controlled fine piece | `StepCard` | Step marker layout. | `s003-step`. |
| `ScanLine` | controlled fine piece | `ScreenWithPip` | Screen scan/wipe line. | `scan-s002`, `scan-s003`, `scan-s004`. |
| `CleanArollOverlay` | controlled fine piece | `SummaryCta`, `HeroAroll` | Minimal final presenter overlay. | `s007-aroll`. |
| `CaptionLine` | controlled fine piece | `global` | Burned-in subtitles. | `cap-*` clips generated from ASR captions. |

## Text Budgets

The validator enforces display-copy budgets based on the first120 accepted layout:

- Chip labels: short tags only.
- English kicker: one compact line.
- Chinese title: one large line whenever possible.
- Subline: one compact line.
- Card labels: short noun phrases.

Narration and captions are separate. Do not shorten the master audio or ASR captions just to fit a display title. Change only the screen display props.

## Adding A Component

Do not add a component during render.

1. Document the source scene and accepted frame.
2. Add the component or fine piece to `components/catalog.json`.
3. Add schema/required props.
4. Add DOM in `components/registry.mjs`.
5. Add CSS/motion in `components/hyperframes-tech-talk.css` and `components/timelines.mjs`.
6. Add validator coverage when the component carries drift risk.
7. Run catalog, registry, validator, manifest, lint, inspect, render, and frame review.
