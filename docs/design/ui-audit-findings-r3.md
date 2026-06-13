# UI Audit Findings R3

Date: 2026-06-13

Viewport: `1452x900`

Harness:

- `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit/ui-audit-harness.mjs`

Artifacts:

- Screenshots: `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit-r3/*.png`
- Structured run result: `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit-r3/audit-results.json`

Run summary:

- 46 screenshots captured.
- Chrome console/runtime errors recorded by harness: 0.
- Page overflow detected by harness: 0 states.
- Vite was started temporarily on `127.0.0.1:5174`; console-api was reachable on `127.0.0.1:4099`.

## R2 Remaining Nav Items

| R2 item | R3 status | Evidence |
| --- | --- | --- |
| `字幕识别` should be a true captions function | True function | `20-topnav-captions.png` opens `字幕识别 · m1-acceptance`, shows `重新识别字幕`, `保存字幕`, and `78 条字幕`. `20b-topnav-captions-edit.png` shows an edited cue value in the first cue input. |
| `风格包` should be a true style-pack function | Selector true; apply not executed under read-only audit | `22-topnav-style.png` opens `风格包 · 命名主题`, shows 4 theme cards and `套用到全部卡片` buttons. The audit did not click apply because the task constrained this run to read-only/screenshots and apply persists plan/manifest changes. |
| `导出设置` should expose export settings | UI true, render path not fully functional | `24-topnav-export.png` shows `分辨率`, `帧率`, and `质量` selectors. `24c-topnav-export-options-set.png` shows `1280x720 / 30 / draft` selected. However, rendering with these options fails; see new High finding. |

## New Functional Findings

### High

1. `[24d-render-export-options-failure] Export settings are visible but parameterized MP4 render fails.`
   - Phenomenon: after setting `分辨率=1280x720`, `帧率=30`, and `质量=draft`, clicking `渲染 MP4` shows `渲染失败 (stage: render)`.
   - Screenshot: `.hive/artifacts/ui-audit-r3/24d-render-export-options-failure.png`
   - Log: `/Users/huangzongning/development/director-console/apps/console-api/logs/2026-06-12T23-40-48-455Z-render.log`
   - Key stderr: `Not a directory: /Users/huangzongning/development/director-console/hyperframes-composer/1280`
   - Command shown in log includes `--width 1280 --height 720 --output render/m1-acceptance.mp4`, so the failure is in the render CLI/options path, not the UI merely missing controls.
   - Severity: High because the new `导出设置` function is not actually usable for non-default render options.

## Confirmed Working States

- Captions modal opens and loads 78 cues: `.hive/artifacts/ui-audit-r3/20-topnav-captions.png`
- Caption cue fields are editable in-browser: `.hive/artifacts/ui-audit-r3/20b-topnav-captions-edit.png`
- Style-pack modal shows 4 themes and apply buttons: `.hive/artifacts/ui-audit-r3/22-topnav-style.png`
- Export settings selectors are visible: `.hive/artifacts/ui-audit-r3/24-topnav-export.png`
- Export settings can be changed in the UI: `.hive/artifacts/ui-audit-r3/24c-topnav-export-options-set.png`
- Default `sample-text` MP4 render still succeeds after refreshing back to default export options: `.hive/artifacts/ui-audit-r3/24b-render-sample-text-mp4.png`
- Direct preview route during audit returned `200 video/mp4` for `/api/preview/render/sample-text.mp4`.

## Verdict

v2 is not yet a full-function green build. The main editor, captions modal, style-pack selector, export options UI, and default MP4 render are usable, but parameterized export render fails. Full acceptance should wait until export options successfully produce an MP4.

## Audit Limits

- The style-pack apply button was not clicked because applying a theme persists changes and this dispatch explicitly constrained the run to read-only/screenshots.
- The captions modal edit was not saved for the same reason; the audit verified the editable cue UI, not persistent save behavior.
