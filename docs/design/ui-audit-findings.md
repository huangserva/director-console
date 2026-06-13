# UI Audit Findings

Date: 2026-06-12

Viewport: `1452x900`

Harness:

- `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit/ui-audit-harness.mjs`

Artifacts:

- Screenshots: `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit/*.png`
- Structured run result: `/Users/huangzongning/development/paseo/creative/.hive/artifacts/ui-audit/audit-results.json`

Run summary:

- 39 screenshots captured.
- Chrome console/runtime errors recorded by harness: 0.
- Page overflow detected by harness: 0 states.
- Two states used fetch-only mocks for coverage without mutating project data:
  - `26-template-library-empty.png`: `/api/templates -> { templates: [] }`
  - `27-empty-no-manifest.png`: `/api/manifests -> { manifests: [] }`
  - `28-error-api-banner.png`: `/api/manifests -> 500`

## Coverage

| State | Screenshot |
| --- | --- |
| Initial editor + `m1-acceptance` | `.hive/artifacts/ui-audit/01-initial-m1-acceptance.png` |
| Wizard Existing Narrated Video | `.hive/artifacts/ui-audit/02-wizard-existing-narrated-video.png` |
| Wizard Digital Human Talking Head | `.hive/artifacts/ui-audit/03-wizard-digital-human-talking-head.png` |
| Wizard Product Introduction | `.hive/artifacts/ui-audit/04-wizard-product-introduction.png` |
| File picker modal | `.hive/artifacts/ui-audit/05-file-picker-modal.png` |
| Left tab Project | `.hive/artifacts/ui-audit/06-left-tab-project.png` |
| Left tab Assets | `.hive/artifacts/ui-audit/07-left-tab-assets.png` |
| Left tab Scenes | `.hive/artifacts/ui-audit/08-left-tab-scenes.png` |
| Left tab Component Library | `.hive/artifacts/ui-audit/09-left-tab-library.png` |
| Left tab Style/Template Library | `.hive/artifacts/ui-audit/10-left-tab-styles-template-with-template.png` |
| Left tab Plan | `.hive/artifacts/ui-audit/11-left-tab-plan.png` |
| Component library categories | `.hive/artifacts/ui-audit/12-library-category-*.png` |
| Inspector Properties | `.hive/artifacts/ui-audit/13-inspector-props.png` |
| Inspector Animation | `.hive/artifacts/ui-audit/14-inspector-animation.png` |
| Inspector Validation | `.hive/artifacts/ui-audit/15-inspector-validation.png` |
| Inspector History | `.hive/artifacts/ui-audit/16-inspector-history.png` |
| Canvas selected card + handles/toggles | `.hive/artifacts/ui-audit/17-canvas-selected-handles-safe-grid-snap.png` |
| Four-track timeline + smart strip | `.hive/artifacts/ui-audit/18-four-track-timeline-smart-strip.png` |
| Top nav Import | `.hive/artifacts/ui-audit/19-topnav-import.png` |
| Top nav Captions | `.hive/artifacts/ui-audit/20-topnav-captions.png` |
| Top nav Analyze | `.hive/artifacts/ui-audit/21-topnav-analyze.png` |
| Top nav Style Pack | `.hive/artifacts/ui-audit/22-topnav-style.png` |
| Top nav Validate | `.hive/artifacts/ui-audit/23-topnav-validate.png` |
| Top nav Export | `.hive/artifacts/ui-audit/24-topnav-export.png` |
| Template library with template | `.hive/artifacts/ui-audit/25-template-library-with-template.png` |
| Template library empty | `.hive/artifacts/ui-audit/26-template-library-empty.png` |
| Empty/no manifest | `.hive/artifacts/ui-audit/27-empty-no-manifest.png` |
| API error banner | `.hive/artifacts/ui-audit/28-error-api-banner.png` |

## Functional Findings

### High

1. `[04-wizard-product-introduction] Product Introduction wizard submit controls are below the 1452x900 viewport.`
   - Phenomenon: the `Project name` field is cut at the bottom of the screenshot and the `Run product intro` action is not visible. The harness did not detect page-level scroll, so this can make the recipe impossible to run at the target audit viewport.
   - Severity: High.

### Medium

2. `[12-library-category-*] Component-library category chips do not change the recommended card grid.`
   - Phenomenon: selecting `开场`, `CTA`, `品牌元素`, `转场`, etc. changes only the active chip; the visible `推荐卡片` grid remains the same 8 cards. Categories with no matching visible cards still look selected.
   - Severity: Medium.

3. `[09-left-tab-library] Component-library search field is visible but read-only / non-functional.`
   - Phenomenon: the UI shows `搜索包装组件`, but the underlying input is read-only and no search/filter behavior is available.
   - Severity: Medium.

4. `[17-canvas-selected-handles-safe-grid-snap] Canvas toggles look interactive but are not buttons.`
   - Phenomenon: `安全区`, `网格`, and `吸附` are rendered as toggle-like pills. In the current UI they are static spans with no click interaction; `网格` also does not toggle the grid overlay in the captured state.
   - Severity: Medium.

5. `[20-topnav-captions] Top nav "字幕识别" does not start a recognition flow.`
   - Phenomenon: clicking it only switches/points to scenes/captions and shows a notice. No caption-recognition action, job state, or wizard field is started.
   - Severity: Medium.

6. `[22-topnav-style] Top nav "风格包" lands in the template library, not a style-pack UI.`
   - Phenomenon: the visible panel is `风格库 · 模板` with template save/apply controls. There is no style-pack selector or style-pack details state.
   - Severity: Medium.

7. `[24-topnav-export] Top nav "导出设置" does not open export settings.`
   - Phenomenon: clicking export triggers an HTML compose/preview path and a notice saying real MP4 rendering is not connected. No export settings surface is shown.
   - Severity: Medium.

8. `[24-topnav-export] Embedded preview iframe is clipped in the Plan panel.`
   - Phenomenon: after compose, the preview in the narrow left panel shows only a cropped portion of the 1920x1080 composition; the visible title is cut off. The `open preview` link exists, but the embedded preview itself is not usable for inspection.
   - Severity: Medium.

9. `[14-inspector-animation] Animation controls record values but state that true rendering is not connected.`
   - Phenomenon: the tab has in/out controls, but the panel copy says `motion-token 真渲染在 P4 接入；此处先记录到 plan card`. Until P4 is complete, the UI can suggest animation edits that do not affect output.
   - Severity: Medium.

### Low

10. `[01-initial-m1-acceptance] Inspector text/value fields are horizontally clipped in the right panel.`
    - Phenomenon: long `purpose` text and prop values such as `cornerLeft`, `title`, and `subline` are visibly truncated by the right panel width. This makes content verification harder even when editing works.
    - Severity: Low.

11. `[27-empty-no-manifest] Empty project state still shows editable-looking Inspector sections.`
    - Phenomenon: with no manifest loaded, the right Inspector still displays layout/font/color fields and placeholder values, even though there is no selected card. Inputs appear disabled, but the panel does not collapse to a clean empty state.
    - Severity: Low.

12. `[19-topnav-import] Top notice persists across later unrelated states until manually dismissed.`
    - Phenomenon: after opening the import wizard, the yellow notice remains visible through component library and other tab screenshots unless the user dismisses it.
    - Severity: Low.

## Remaining Audit Limits

- The harness did not mutate project files to manufacture additional data states. Template-empty and manifest-empty states were produced with fetch mocks in the browser session only.
- The audit does not judge visual aesthetics; it only records objective observable behavior and functional gaps.
- The harness did not perform drag/drop mutations or save operations. Later repair waves can extend it with explicit mutation-safe fixtures if needed.
