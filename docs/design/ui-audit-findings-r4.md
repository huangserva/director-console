# UI Audit Findings R4

Date: 2026-06-13

Viewport: `1452x900`

Harness:

- `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit/ui-audit-harness.mjs`

Artifacts:

- Screenshots: `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit-r4/*.png`
- Structured result: `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit-r4/audit-results.json`

Run summary:

- 46 screenshots captured.
- Harness console/runtime errors: 0.
- Page overflow states: 0.
- `/fs/choose-native` was fetch-overridden in browser only to avoid blocking on the real macOS file dialog.
- Vite was started temporarily on `127.0.0.1:5174`; console-api was reachable on `127.0.0.1:4099`.

## R4 Focus Checks

### Wizard i18n / Layout

Status: mostly OK.

- `02-wizard-existing-narrated-video.png`: recipe names, descriptions, fields, required markers, and submit button are Chinese. Layout is clean; no visible clipping.
- `03-wizard-digital-human-talking-head.png`: form labels and action button are Chinese; no overlap or clipping. `MemOS CLI` and `wav` remain as allowed technical/example terms.
- `04-wizard-product-introduction.png` and `04b-wizard-product-introduction-bottom.png`: long product form scrolls internally; bottom action `运行产品介绍` is visible and not occluded.
- Remaining visible English inside the wizard itself is limited to allowed product/technical terms such as `HyperFrames`, `MemOS CLI`, and `wav`.

### Native File Choose

Status: OK under mock.

- Screenshot: `.hive/artifacts/ui-audit-r4/05-file-picker-modal.png`
- Evidence: clicking `浏览…` calls the mocked `/fs/choose-native` path and fills `/Users/demo/x.mp4` into the path input.
- The old in-app browser file-list modal is not present: no `选择视频文件`, `上一级`, directory list, or hidden non-video-file count appears in the state.

### Previous Regression Checks

Status: no R1/R2 regression observed in the covered screenshots.

- Product intro submit remains visible.
- Component category/search filtering remains visible.
- Canvas grid/toggle overlay still works.
- Captions modal still opens with cue list.
- Style-pack modal still opens with four themes.
- Default `sample-text` MP4 render succeeds: `.hive/artifacts/ui-audit-r4/24b-render-sample-text-mp4.png`

## English Residuals

Allowed/ignored in this audit:

- Technical identifiers and prop keys: `TitleCard`, `title_card`, `cornerLeft`, `style.font.titleSize`, etc.
- Project/component/media terms explicitly allowed by dispatch or context: `MemOS`, `CLI`, `HyperFrames`, `wav`, `draft`, `standard`, `high`, `HTML`, `MP4`.
- Manifest/demo content that belongs to the loaded project rather than UI chrome is listed separately below.

User-facing UI residuals:

| State | English residual |
| --- | --- |
| `02` / `03` / `04` / `19` wizard/top notice | `Route B` / `Route A` in the notice text `导入成片或源视频：在向导里走 Route B 导入 / Route A 数字人 / 产品介绍。` |
| `06-left-tab-project.png` | `recipe` in `项目元信息（recipe / 工作流）面板`; `catalog` in `catalog 2026-06-10` |
| `11-left-tab-plan.png`, `24-topnav-export.png` | Buttons `Lint` and `Inspect` |
| `14-inspector-animation.png` | Animation option values `none`, and text `in / out` + `compose` |
| `22-topnav-style.png` | Help text contains `compose` and `color/font` |
| Component library cards | `CTA` and `Logo` appear in card/category copy (`CTA 卡`, `Logo / 定位 / 品牌信息`) |

Project/demo content residuals visible in canvas or preview:

- `Auto scene plan` on the selected card in `m1-acceptance`.
- `M0 editable manifest`, `Text-only preview`, `No external media required`, `Live HTML output`, `Ready for web shell` in `sample-text` preview/render states.

## New / Remaining Functional Issues

### Medium

1. `[24-topnav-export] Export settings no longer provide a resolution dropdown.`
   - Expected by R4 dispatch: `分辨率/帧率/质量 下拉`.
   - Observed: `分辨率` is rendered as fixed text `1920x1080（固定）`; only `帧率` and `质量` are selectable.
   - Screenshot: `.hive/artifacts/ui-audit-r4/24-topnav-export.png`
   - Severity: Medium, because the settings surface exists and the previous parameterized-render failure no longer appears as a visible failure in this run, but the requested resolution control is absent.

2. `[global-i18n] Several user-facing English labels remain after the full-Chinese pass.`
   - See English residual table above.
   - Severity: Medium, because the user explicitly called out mixed Chinese/English as unacceptable.

## Verdict

R4 improves the main wizard and native-file-picker experience materially, but it is not a clean full-Chinese closeout yet. The wizard forms are acceptable, native browse is on the correct path, and default render still works; remaining blockers are user-facing English residuals and the missing resolution dropdown in export settings.
