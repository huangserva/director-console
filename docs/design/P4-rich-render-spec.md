# P4 Rich Render Spec

Date: 2026-06-12

Scope: v2-P4 implementation blueprint for making `hyperframes-composer` render packaging-plan rich fields that are already projected into manifest scene props by `planToManifest()`:

- `card.layout -> scene.props.layout`
- `card.font -> scene.props.style.font`
- `card.color -> scene.props.style.color`
- `card.animation -> scene.props.animation`
- `card.graphics -> scene.props.graphics`

This document is intentionally implementation-ready but not implementation code.

## Current Render Path

`packages/packaging-plan/src/index.mjs` is the compiler layer:

1. `manifestToPlan()` extracts rich fields from `scene.props.layout`, `scene.props.style.font`, `scene.props.style.color`, `scene.props.graphics`, and `scene.props.animation`.
2. `planToManifest()` writes rich fields back into the same props namespaces.
3. `planToManifest()` validates only catalog component id and legal `scene_type`; it does not render rich fields.

`hyperframes-composer/scripts/compose.mjs` loads a manifest, optionally loads `manifest.audio.captions`, calls `renderCompositionDocument()`, and writes HTML.

`hyperframes-composer/blocks/composition-shell.mjs` injects the full CSS file, emits a fixed `#root`:

```html
<div id="root" data-width="1920" data-height="1080">
```

The shell then renders each scene with `renderScene(scene)` and the timeline script from `components/timelines.mjs`.

`hyperframes-composer/components/registry.mjs` is the true renderer. Unknown props currently have no effect because render functions read only known props.

## Registry Inventory

### Shared HTML

`sceneAttrs(scene, className, track)` emits:

- `id`
- classes: `clip scene ${className}`
- `data-memos-scene`
- `data-start`
- `data-duration`
- `data-track-index`

Most scene roots are absolute, full-frame `.scene` elements with background and pseudo-elements. Video is emitted through `renderVideo()`, which sets `muted playsinline`, `data-start`, `data-duration`, and `data-media-start`.

### `StatsHero`

Function: `renderOpeningStat(scene)`.

Required props:

- `props.media.presenter`
- `props.stat`
- `props.browser`
- `props.titleBeat`

DOM shape:

- Full presenter source video: `v-${scene.id}-opening`, class `source-video`
- Stat overlay root: `${scene.id}-stat`, class `stat-scene`
  - `.corner-left`
  - `.stat-pack`
  - `.stat-shell`
  - `.stat-label`
  - `.stat-number`
  - `.stat-unit`
  - `.stat-title`
- Browser overlay root: `${scene.id}-browser`, class `browser-overlay`
  - `.browser-stage`
  - `.traffic`
  - `.done-pill`
  - `.browser-video-card`
  - `.icon-cloud`
- Return presenter video: `v-${scene.id}-return`, class `source-video`
- Title overlay root: `${scene.id}-title`, class `title-scene`
  - `.corner-left`
  - `.corner-name`
  - `.title-block`
  - `.title-kicker`
  - `.main-title`
  - `.title-sub`
  - `.underline-stack`

Animation today: `components/timelines.mjs` has hard-coded GSAP animation for `#${stats.id}-stat`, `#${stats.id}-browser`, and `#${stats.id}-title`.

### `ScreenWithPip`

Function: `renderScreenWithPip(scene)`.

Used props:

- `props.label`
- `props.media.screen`
- `props.media.pip`
- `props.screenVideoId`
- `props.pipVideoId`
- `props.mediaStart`
- `props.pipMediaStart`
- `props.scan`

DOM shape:

- Scene root class `screen-proof`
- `.screen-label`
- `.screen-shell` with screen video
- `.circle-pip` with PIP video
- Optional `.scan-local` clip when `props.scan` exists

Animation today: `screenTimeline()` in `timelines.mjs` animates `.screen-shell`, `.screen-label`, `.circle-pip`, and scan line.

### `TitleCard`

Function: `renderTitleCard(scene)`.

Used props:

- `cornerLeft`
- `cornerName`
- `kicker`
- `title`
- `subline`

DOM shape:

- Root class `title-scene`
- `.corner-left`
- `.corner-name`
- `.title-block`
- `.title-kicker`
- `.main-title`
- `.title-sub`
- `.underline-stack`

Animation today: no generic TitleCard timeline except StatsHero's internal title beat.

### `StepCard`

Function: `renderStepCard(scene)`.

Used props:

- `kicker`
- `title`
- `items[]`

DOM shape:

- Root class `step-scene`
- `.step-wrap`
- `.step-panel`
- `.step-kicker`
- `.step-title`
- `.step-list`
- `.step-item`

Animation today: hard-coded GSAP for `.step-panel`, `.step-kicker`, `.step-title`, and `.step-item`.

### `SplitTextPresenter`

Function: `renderSplitTextPresenter(scene)`.

Variant `definition`:

- Used props: `cornerName`, `panels[]`
- Panel DOM from `renderDefinitionPanel(panel)`:
  - `.def-panel.${panel.kind}`
  - `.def-frame`
  - `.def-kicker`
  - `.def-title`
  - `.def-sub`
  - `.def-stack-row`
  - `.def-code`
  - `.def-callout`
  - optional `.def-flow-line` / `.def-flow-node`
  - `.def-presenter` video

Variant `course`:

- Used props: `cornerName`, `chip`, `kicker`, `title`, `cards[]`, `media.presenter`, `mediaStart`
- DOM:
  - Root scene
  - `.corner-name`
  - `.course-layout`
  - `.course-chip`
  - `.course-heading`
  - `.course-cards`
  - `.course-line`
  - `.course-presenter` video

Animation today: hard-coded GSAP for both `definition` panels and `course` layout/presenter.

### `SummaryCta`

Function: `renderSummaryCta(scene)`.

Used props:

- `media.presenter`
- `mediaStart`
- `chip`
- `title`
- `subline`

DOM shape:

- Clean A-roll video: `v-${scene.id}-aroll-video`, class `clean-aroll-video`
- Overlay root classes `clean-aroll clean-aroll-overlay`
- `.clean-aroll-vignette`
- `.clean-aroll-copy`
- `.clean-chip`
- `.clean-title`
- `.clean-sub`

Animation today: hard-coded GSAP for `.clean-aroll-copy`, `.clean-title`, and video scale.

### `HeroAroll`

Function: `renderHeroAroll(scene)`.

Used props:

- `media.presenter`
- `mediaStart`

DOM shape:

- Root classes `clean-aroll`
- Presenter video class `clean-aroll-video`

Animation today: none specific.

### `ProofMontage`

Function: `renderProofMontage(scene)`.

Used props:

- `props.media.items[]`, each item object with `src`, `start`, `duration`, `mediaStart`, `label`

DOM shape:

- Root class `proof-montage`
- `.proof-grid`
- `.proof-card`
- video
- `.proof-label`

Animation today: none specific.

## Safe Injection Design

Do not splice arbitrary user values into class names or raw CSS text. Normalize rich fields into a small allow-list and emit only inline CSS custom properties plus a single fixed marker class.

Recommended helper in `registry.mjs` or a sibling module:

```js
richAttrs(scene, target = "root")
```

Output only when rich fields are present:

```html
data-rich-render="1" style="--hf-accent:#d4af37;--hf-text:#ffffff;--hf-bg:#07090d;--hf-font-size:70px;--hf-font-weight:900"
```

No rich fields means `richAttrs()` returns an empty string. This preserves byte-level HTML output for all existing manifests when fields are absent.

### Color

Input path:

```json
props.style.color = {
  "accent": "#d4af37",
  "bg": "#07090d",
  "text": "#ffffff"
}
```

Normalize:

- Accept only hex colors, `rgb(...)`, `rgba(...)`, or known safe CSS color keywords if needed.
- Prefer hex-only for first cut.
- Drop invalid values silently with a diagnostic in tests, not at render time.

Emit:

- `--hf-accent`
- `--hf-bg`
- `--hf-text`

CSS bridge:

```css
[data-rich-render="1"] .main-title,
[data-rich-render="1"] .step-title,
[data-rich-render="1"] .clean-title { color: var(--hf-accent, currentColor); }

[data-rich-render="1"] .title-sub,
[data-rich-render="1"] .step-item,
[data-rich-render="1"] .clean-sub { color: var(--hf-text, currentColor); }
```

Low-risk target components for color first:

- `TitleCard`
- `StepCard`
- `SummaryCta`
- `HeroAroll` overlay wrappers

High-risk components:

- `StatsHero`, because multiple nested beats share one scene but are rendered as multiple roots.
- `SplitTextPresenter`, because variants and panels use many specialized selectors.

### Font

Input path:

```json
props.style.font = {
  "size": 70,
  "weight": 900,
  "family": "Arial"
}
```

Normalize:

- `size`: number, clamp to a component-specific range. Example: 16-120 px.
- `weight`: allow 400, 500, 600, 700, 800, 900, 950.
- `family`: avoid first cut unless there is a known local/web-safe allow-list; use current `Arial` default if absent.

Emit:

- `--hf-font-size`
- `--hf-font-weight`
- optionally `--hf-font-family`

CSS bridge:

```css
[data-rich-render="1"] .main-title,
[data-rich-render="1"] .step-title,
[data-rich-render="1"] .clean-title {
  font-size: var(--hf-font-size, inherit);
  font-weight: var(--hf-font-weight, inherit);
}
```

Do not apply font-size to root scenes. Apply to text leaves only, otherwise layout can shift in unexpected nested containers.

### Layout

Input path:

```json
props.layout = {
  "x": 120,
  "y": 126,
  "w": 1190,
  "h": 690,
  "anchor": "top-left",
  "safeAreaLock": true
}
```

Coordinate system:

- Treat `x/y/w/h` as canonical 1920x1080 composition coordinates.
- The current shell is fixed at 1920x1080, so no runtime scaling is needed inside composer today.
- If a future preview viewport scales the whole root, the root transform should scale everything uniformly; do not separately convert each layout.

Canvas conversion formula if a non-1920 preview must map pointer edits back to manifest coordinates:

```text
manifestX = (previewX - rootLeft) / renderedRootWidth * 1920
manifestY = (previewY - rootTop) / renderedRootHeight * 1080
manifestW = previewW / renderedRootWidth * 1920
manifestH = previewH / renderedRootHeight * 1080
```

Do not make every `.scene` root `left/top/width/height`. Scene roots must remain full-frame to preserve clip timing, backgrounds, captions, scans, and media overlays.

Safe layout injection point:

- Add a wrapper around the component's main card/content sub-tree, not the scene root.
- Example targets:
  - `TitleCard`: `.title-block`
  - `StepCard`: `.step-panel`
  - `SummaryCta`: `.clean-aroll-copy`
  - `ProofMontage`: `.proof-grid`
  - `ScreenWithPip`: `.screen-shell` or `.circle-pip`, but only when the layout target is explicit

Recommended shape for first layout-capable implementation:

```json
props.layout = {
  "target": "primary",
  "x": 500,
  "y": 380,
  "w": 760,
  "h": 220
}
```

Render only if `target` is a known allow-listed target for the component. This prevents a generic layout field from accidentally moving presenter media or face-safe overlays.

CSS:

```css
[data-rich-layout="primary"] {
  left: var(--hf-x);
  top: var(--hf-y);
  width: var(--hf-w);
  min-height: var(--hf-h);
}
```

Risk:

- Existing components already depend heavily on absolute coordinates, pseudo-elements, CSS variables, and GSAP transforms.
- A naive root-level absolute layout will break safe areas and background coverage.
- Layout should be delayed until font/color have landed and visual regression gates are in place.

### Animation

Input path:

```json
props.animation = {
  "in": "fade-up",
  "out": "fade",
  "duration": 0.35,
  "ease": "power3.out"
}
```

Current animation is not CSS-driven; it is generated in `components/timelines.mjs` as hard-coded GSAP selectors per component.

Safe design:

1. Add an allow-list:
   - `fade`
   - `fade-up`
   - `slide-left`
   - `scale-soft`
2. Add a `renderRichAnimation(scene)` branch in `renderTimelineScript()`.
3. Only apply generic animation to components that do not already have hard-coded animation in that same target, or apply it as a replacement behind an explicit `props.animation.overrideDefault === true`.

First cut:

- Do not override existing `StatsHero`, `ScreenWithPip`, `StepCard`, `SplitTextPresenter`, or `SummaryCta` timelines by default.
- Add animation support only for `TitleCard`, `HeroAroll`, and `ProofMontage`, where generic motion has lower conflict risk.

Later cut:

- Component-specific animation hooks such as:
  - `props.animation.title`
  - `props.animation.items`
  - `props.animation.presenter`
- These can map to selectors with known ownership.

## Preserve Existing Rendering

Hard requirement: when rich fields are absent, rendered HTML and visual output must stay unchanged.

Implementation rules:

1. `richAttrs()` returns `""` when no rich fields exist.
2. Do not alter class names, DOM order, existing `data-*` attributes, or default CSS rules for rich-field-empty scenes.
3. New CSS selectors must be gated by `[data-rich-render="1"]` or `[data-rich-layout]`.
4. New timeline code must add no GSAP lines unless `props.animation` exists.
5. `manifest-rules.mjs` catalog validation should remain compatible. Add rich-field validation as non-breaking checks only after renderer semantics are fixed.

Regression lessons from M4:

- `validateManifest()` is not enough. It previously allowed defaults that later failed real render.
- Every new default or mapped card type must pass `renderCompositionDocument()`.
- High-risk components need a true `compose.mjs` smoke because the failure can appear only after full document/timeline generation.

## Phased Implementation Recommendation

### P4a: Rich field plumbing with zero default drift

Do first.

- Add sanitizer/helper for font/color custom properties.
- Add no-op tests proving manifests without rich fields render byte-identical HTML before/after helper insertion.
- Add fixture manifest with one rich `TitleCard` and one rich `StepCard`; assert HTML contains `data-rich-render="1"` and CSS variables.
- Do not implement layout or animation yet.

Risk: low.

### P4b: Font and color render for text-first components

Do second.

Components:

- `TitleCard`
- `StepCard`
- `SummaryCta`
- `HeroAroll` if only tinting overlay/copy is needed

Assertions:

- Rich field appears in generated HTML.
- CSS variable values are sanitized.
- Existing `sample-text`, `m1-acceptance`, `memos-v3` compose output is unchanged when no rich fields exist.
- 12 card types still render through real registry path.

Risk: moderate-low. Text size can still overflow, so test with bounded sizes.

### P4c: Component-specific layout targets

Do after P4b and only with visual tests.

- Support `props.layout.target`.
- Allow-list targets per component.
- Never apply layout to `.scene` root by default.
- Add visual/pixel regression for default output and screenshot/bounding-box tests for rich layout.

Risk: high.

### P4d: Animation hooks

Do after layout or in parallel only for components with no existing timeline.

- Start with `TitleCard`, `HeroAroll`, `ProofMontage`.
- Add only allow-listed motion names.
- Avoid overriding existing timeline-heavy components until there is a component-specific animation contract.

Risk: high, because current GSAP selectors are hard-coded and can conflict with generic animation.

## 12 Card Type Coverage

Current mapping:

| Card type | Component | Scene type | P4 recommendation |
| --- | --- | --- | --- |
| `opening` | `StatsHero` | `hook_stat` | Delay rich layout/animation; font/color only after simpler components |
| `caption` | `TitleCard` | `title_card` | First-class P4a/P4b target |
| `product-highlight` | `StepCard` | `step_card` | First-class P4a/P4b target |
| `demo-annotation` | `ScreenWithPip` | `screen_demo_pip` | Color/font for label only; layout later by target |
| `comparison` | `SplitTextPresenter` | `concept_split` | Defer layout; font/color needs variant-specific selectors |
| `pip` | `ScreenWithPip` | `screen_demo_pip` | Same as demo-annotation |
| `data-proof` | `ProofMontage` | `proof_montage` | Animation later; color/font for labels safe |
| `info-structure` | `StepCard` | `step_card` | First-class P4a/P4b target |
| `mv-rhythm` | `HeroAroll` | `aroll_emphasis` | Use existing component plus animation hook first |
| `transition` | `TitleCard` | `title_card` | Use existing component plus rich fields; no new component now |
| `brand` | `TitleCard` | `title_card` | Use existing component plus rich color/font first |
| `cta` | `SummaryCta` | `summary_cta` | Color/font safe; layout later |

## Transition / MV Rhythm / Brand Components

Recommendation: do not add new catalog components in the first P4 rich-render pass.

### Transition

Use `TitleCard` plus:

- `props.style.color`
- `props.style.font`
- later `props.animation`

Only add a dedicated `TransitionCard` if users need transition-specific fine pieces or timing behavior that cannot be represented by `TitleCard`.

### MV Rhythm

Use `HeroAroll` for now. It already maps to full-bleed presenter/media emphasis. Add animation hooks later for simple beat motion.

Add a dedicated `MvRhythm` component only if it needs multi-clip beat grids, synchronized cuts, or music-reactive visuals. Those are not just rich fields.

### Brand

Use `TitleCard` for brand statements first. Brand is primarily typography/color/token work; rich font/color can cover the first usable layer.

Add a dedicated `BrandCard` only when there are locked brand layout systems, logos, safe zones, or legal/identity constraints that need catalog validation.

## Test Strategy

### Unit-level renderer tests

Add tests near composer or packaging-plan that import the real renderer:

```js
renderCompositionDocument(manifest)
```

Assertions:

- All 12 card types from `applyTemplate -> planToManifest -> renderCompositionDocument()` render without throwing.
- Rich fields produce expected attributes:
  - `data-rich-render="1"`
  - `--hf-accent`
  - `--hf-text`
  - `--hf-bg`
  - `--hf-font-size`
  - `--hf-font-weight`
- Invalid color/font values are dropped or clamped.
- No rich fields means no `data-rich-render` and no added inline style.

### No-drift tests

For existing manifests:

- `hyperframes-composer/manifests/sample-text.json`
- `hyperframes-composer/manifests/m1-acceptance.json`
- `hyperframes-composer/manifests/memos-v3.json`

Test:

1. Render HTML before the implementation branch or keep a fixture snapshot.
2. Render after implementation.
3. Assert exact HTML equality when rich fields are absent.

If exact equality is too brittle because generator metadata changes, assert:

- same DOM node count;
- no `data-rich-render` attributes;
- same scene root attrs;
- same timeline script lines.

### Compose smoke

Run targeted commands:

```bash
cd hyperframes-composer
npm run validate:manifest -- manifests/sample-text.json
npm run compose -- manifests/sample-text.json
```

Add a synthetic rich manifest under test fixtures, not production manifests, and run compose against it.

### Visual tests

Needed before layout/animation:

- Playwright or browser screenshot at 1920x1080.
- Bounding-box assertions for rich layout target.
- Pixel diff or perceptual screenshot compare for no-rich default scenes.

### Catalog drift tests

Keep existing catalog validations:

- 12 card types map only to catalog coarse components and legal scene types.
- All default props pass real render, not just schema.
- Existing compose tests stay green.

## Maximum Risk

The largest risk is generic layout on top of existing absolute-positioned, timeline-animated DOM. Many components already use fixed positions, CSS variables, pseudo-elements, and GSAP transforms. Applying `x/y/w/h` to the wrong root can break face-safe areas, captions, screen/PIP positions, or existing animation paths.

Mitigation:

- Ship font/color first.
- Gate layout by explicit `layout.target`.
- Never move `.scene` roots.
- Add real renderer and visual no-drift tests before layout or animation.

## Implementation Checklist For Full-Stack

1. Add rich-field sanitizer/helper that returns empty string for absent rich fields.
2. Add helper tests for absent, valid, invalid, and clamped values.
3. Attach helper only to safe text subtrees for `TitleCard` and `StepCard`.
4. Add CSS under `[data-rich-render="1"]`.
5. Add no-drift render tests for existing manifests.
6. Add 12-card real-render regression.
7. Add rich manifest fixture and assert generated HTML.
8. Only then expand to `SummaryCta`, `HeroAroll`, `ProofMontage` labels.
9. Design `layout.target` allow-list and visual tests before moving any boxes.
10. Design animation allow-list in `timelines.mjs` and avoid timeline-heavy components until explicit override semantics exist.
