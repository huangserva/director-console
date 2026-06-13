# UI Audit Findings R2

Date: 2026-06-12

Viewport: `1452x900`

Harness:

- `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit/ui-audit-harness.mjs`

Artifacts:

- Screenshots: `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit-r2/*.png`
- Structured run result: `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit-r2/audit-results.json`

Run summary:

- 43 screenshots captured.
- Chrome console/runtime errors recorded by harness: 0.
- Page overflow detected by harness: 0 states.
- Three states used browser-session fetch overrides only:
  - `26-template-library-empty.png`: `/api/templates -> { templates: [] }`
  - `27-empty-no-manifest.png`: `/api/manifests -> { manifests: [] }`
  - `28-error-api-banner.png`: `/api/manifests -> 500`
- Vite was started temporarily on `127.0.0.1:5174`; console-api was already reachable on `127.0.0.1:4099`.

## R1 Regression Check

Status count: 9 fixed, 1 partially fixed, 2 not fixed, 0 regressed.

| R1 # | Status | Evidence |
| --- | --- | --- |
| 1. Product Introduction wizard submit below viewport | Fixed | `04b-wizard-product-introduction-bottom.png` shows `Run product intro` and validation copy in viewport after scrolling the modal body. |
| 2. Component-library categories do not change grid | Fixed | `12-library-category-开场.png`, `12-library-category-字幕.png`, and `12-library-category-CTA.png` each show one matching card instead of the same 8-card grid. |
| 3. Search field read-only / non-functional | Fixed | `12b-library-search-filter.png` shows typed query `字幕`, clear button, and a filtered single result `关键词字幕`. |
| 4. Canvas safe/grid/snap toggles static | Fixed | `17b-canvas-toggles-clicked.png` shows grid overlay after clicking toggles; the toggle state visibly changes. |
| 5. Top nav `字幕识别` does not start recognition flow | Not fixed as ASR | `20-topnav-captions.png` now highlights the subtitle track and explains current captions can be reviewed, but it still does not start an ASR recognition job. |
| 6. Top nav `风格包` lands in template library | Not fixed | `22-topnav-style.png` still shows `风格库 · 模板` with template save/apply controls, not a distinct style-pack selector/details state. |
| 7. Top nav `导出设置` does not open export settings | Partially fixed | `24-topnav-export.png` now opens the Plan export/render panel and exposes `预览 (HTML)` plus `渲染 MP4`; there is still no export-settings surface despite the nav label. |
| 8. Embedded preview iframe clipped in Plan panel | Fixed | `24-topnav-export.png` no longer auto-runs HTML preview or shows a clipped iframe. The export panel remains stable. |
| 9. Animation edits not connected to real rendering | Fixed | `14-inspector-animation.png` now says in/out animation is connected to real render and appears after saving/compose. |
| 10. Inspector text/value fields horizontally clipped | Fixed | `01-initial-m1-acceptance.png` keeps right-panel labels/values within the inspector column; no visible horizontal overflow. |
| 11. Empty manifest state shows editable-looking inspector | Fixed | `27-empty-no-manifest.png` shows a clean no-selection/no-project message instead of editable-looking form fields. |
| 12. Import notice persists across unrelated states | Fixed | `19-topnav-import.png` shows the import notice, but later nav states show their own state-specific notices instead of the import notice. |

## New Functional Findings

No new high/medium/low functional defects were found in R2. Remaining objective issues are the two unresolved R1 nav semantics plus one partial export-label mismatch listed above.

## Key Regression Screenshots

- Product intro submit visible: `.hive/artifacts/ui-audit-r2/04b-wizard-product-introduction-bottom.png`
- Component category changes: `.hive/artifacts/ui-audit-r2/12-library-category-CTA.png`
- Search filters: `.hive/artifacts/ui-audit-r2/12b-library-search-filter.png`
- Canvas grid/toggle overlay: `.hive/artifacts/ui-audit-r2/17b-canvas-toggles-clicked.png`
- MP4 render success: `.hive/artifacts/ui-audit-r2/24b-render-sample-text-mp4.png`

## Verification Notes

- `24b-render-sample-text-mp4.png` shows `MP4 渲染完成`, `打开 MP4`, `下载`, and an embedded `<video>` control for `sample-text`.
- Direct preview route check during audit returned `200 video/mp4` for `/api/preview/render/sample-text.mp4`.
- The harness was amended to wait for render success/failure before capturing the MP4 state, and to use a React-compatible controlled-input event path for the search box.
