import { esc, f, isImageMedia, renderCards, renderImage, renderVideo, required } from "./html.mjs";
import { richAnimationAttrs, richAttrs } from "./rich.mjs";

function sceneAttrs(scene, className, track) {
  return `id="${esc(scene.id)}" class="clip scene ${className}" data-memos-scene="${esc(scene.scene || scene.id)}" data-start="${f(scene.start)}" data-duration="${f(scene.duration)}" data-track-index="${Number(track ?? scene.track ?? 10)}"`;
}

function renderOpeningStat(scene) {
  const stat = required(scene.props.stat, `${scene.id}.props.stat`);
  const browser = required(scene.props.browser, `${scene.id}.props.browser`);
  const title = required(scene.props.titleBeat, `${scene.id}.props.titleBeat`);
  const media = required(scene.props.media, `${scene.id}.props.media`);
  const source = required(media.presenter, `${scene.id}.props.media.presenter`);
  const statStart = scene.parts?.stat?.start ?? scene.start + 0.705;
  const statDuration = scene.parts?.stat?.duration ?? 2.163;
  const browserStart = scene.parts?.browser?.start ?? scene.start + 2.539;
  const browserDuration = scene.parts?.browser?.duration ?? 5.909;
  const returnStart = scene.parts?.return?.start ?? scene.start + 8.448;
  const returnDuration = scene.parts?.return?.duration ?? Math.max(0.001, scene.duration - (returnStart - scene.start));
  const titleStart = scene.parts?.title?.start ?? scene.start + 9.781;
  const titleDuration = scene.parts?.title?.duration ?? 2.597;
  const icons = browser.icons || ["AI", "CC", "CLI", "MCP", "↻", "AI", "MEM", "⌘", "✓", "AI"];

  return `
      ${renderVideo({ id: `v-${scene.id}-opening`, className: "clip source-video", scene: scene.id, src: source, start: scene.start, duration: scene.duration, mediaStart: 0, track: 1 })}

      <div ${sceneAttrs({ ...scene, id: `${scene.id}-stat`, start: statStart, duration: statDuration }, "stat-scene", 2)}>
        <div class="corner-left">${esc(stat.cornerLeft || "")}</div>
        <div class="stat-pack">
          <div class="stat-shell"></div>
          <div class="stat-label">${esc(stat.label)}</div>
          <div class="stat-number">${esc(stat.number)}</div>
          <div class="stat-unit">${esc(stat.unit)}</div>
          <div class="stat-title">${esc(stat.title)}</div>
        </div>
      </div>

      <div ${sceneAttrs({ ...scene, id: `${scene.id}-browser`, start: browserStart, duration: browserDuration }, "browser-overlay", 3)}>
        <div class="browser-stage">
          <div class="traffic"><span></span><span></span></div>
          <div class="done-pill">${esc(browser.done || "Done")}</div>
          <div class="browser-video-card">
            ${renderVideo({ id: `v-${scene.id}-browser-card`, src: source, start: browserStart, duration: browserDuration, mediaStart: browser.mediaStart ?? browserStart })}
          </div>
          <div class="icon-cloud">${icons.map((icon) => `<span>${esc(icon)}</span>`).join("")}</div>
        </div>
      </div>

      ${renderVideo({ id: `v-${scene.id}-return`, className: "clip source-video", scene: scene.id, src: source, start: returnStart, duration: returnDuration, mediaStart: returnStart - scene.start, track: 4 })}

      <div ${sceneAttrs({ ...scene, id: `${scene.id}-title`, start: titleStart, duration: titleDuration }, "title-scene", 5)}>
        <div class="corner-left">${esc(title.cornerLeft || "")}</div>
        <div class="corner-name">${esc(title.cornerName || "")}</div>
        <div class="title-block">
          <div class="title-kicker">${esc(title.kicker || "")}</div>
          <div class="main-title">${esc(title.title || "")}</div>
          <div class="title-sub">${esc(title.subline || "")}</div>
        </div>
        <div class="underline-stack"><i></i><i></i></div>
      </div>`;
}

function renderScreenWithPip(scene) {
  const props = scene.props;
  const media = required(props.media, `${scene.id}.props.media`);
  const screenId = props.screenVideoId || `v-${scene.id}-screen`;
  const pipId = props.pipVideoId || `v-${scene.id}-pip`;
  const scanId = props.scan?.id || `scan-${scene.scene || scene.id}`;
  const screenMedia = isImageMedia(media.screen)
    ? renderImage({ id: screenId, src: media.screen, start: scene.start, duration: scene.duration, mediaStart: props.mediaStart ?? 0 })
    : renderVideo({ id: screenId, src: media.screen, start: scene.start, duration: scene.duration, mediaStart: props.mediaStart ?? 0 });
  return `
      <div ${sceneAttrs(scene, "screen-proof", scene.track ?? 20)}>
        <div class="screen-label">${esc(props.label)}</div>
        <div class="screen-shell">${screenMedia}</div>
        <div class="circle-pip">${renderVideo({ id: pipId, src: media.pip, start: scene.start, duration: scene.duration, mediaStart: props.pipMediaStart ?? props.mediaStart ?? 0 })}</div>
      </div>
      ${props.scan ? `<div id="${esc(scanId)}" class="clip scan-local" data-memos-scene="${esc(scene.scene || scene.id)}" data-start="${f(props.scan.start)}" data-duration="${f(props.scan.duration)}" data-track-index="${Number(props.scan.track ?? (scene.track ?? 20) + 1)}"></div>` : ""}`;
}

function renderTitleCard(scene) {
  const props = scene.props;
  return `
      <div ${sceneAttrs(scene, "title-scene", scene.track ?? 10)}>
        <div class="corner-left">${esc(props.cornerLeft || "")}</div>
        <div class="corner-name">${esc(props.cornerName || "")}</div>
        <div class="title-block"${richAttrs(scene, "primary")}>
          <div class="title-kicker">${esc(props.kicker || "")}</div>
          <div class="main-title">${esc(props.title || "")}</div>
          <div class="title-sub">${esc(props.subline || "")}</div>
        </div>
        <div class="underline-stack"><i></i><i></i></div>
      </div>`;
}

function renderStepCard(scene) {
  const props = scene.props;
  return `
      <div ${sceneAttrs(scene, "step-scene", scene.track ?? 24)}>
        <div class="step-wrap">
          <div class="step-panel"${richAttrs(scene, "primary")}>
            <div class="step-kicker">${esc(props.kicker)}</div>
            <div class="step-title">${esc(props.title)}</div>
            <div class="step-list">${(props.items || []).map((item) => `<div class="step-item">${esc(item)}</div>`).join("")}</div>
          </div>
        </div>
      </div>`;
}

function renderDefinitionPanel(panel) {
  const videoId = panel.videoId || `v-${panel.kind}-presenter`;
  return `
        <div class="def-panel ${esc(panel.kind)}">
          <div class="def-frame"></div>
          <div class="def-kicker">${esc(panel.kicker)}</div>
          <div class="def-title"><span class="gold">${esc(panel.gold)}</span>${esc(panel.title)}</div>
          <div class="def-sub">${esc(panel.subline)}</div>
          <div class="def-stack-row">${(panel.cards || []).map((card) => `<div class="def-code"><i>${esc(card.icon)}</i>${esc(card.label)}</div>`).join("")}</div>
          <div class="def-callout">line</div>
          ${panel.flow ? `<div class="def-flow-line ab"></div><div class="def-flow-line bc"></div>${panel.flow.map((node, index) => `<div class="def-flow-node ${["a", "b", "c"][index] || ""}">${esc(node)}</div>`).join("")}` : ""}
          <div class="def-presenter">${renderVideo({ id: videoId, src: panel.media.presenter, start: panel.start, duration: panel.duration, mediaStart: panel.mediaStart ?? 0, extra: " data-layout-allow-overflow" })}</div>
        </div>`;
}

function renderSplitTextPresenter(scene) {
  const props = scene.props;
  if (props.variant === "definition") {
    return `
      <div ${sceneAttrs(scene, "", scene.track ?? 30)}>
        <div class="corner-name">${esc(props.cornerName || "")}</div>
        ${(props.panels || []).map(renderDefinitionPanel).join("")}
      </div>`;
  }

  const media = required(props.media, `${scene.id}.props.media`);
  return `
      <div ${sceneAttrs(scene, "", scene.track ?? 40)}>
        <div class="corner-name">${esc(props.cornerName || "")}</div>
        <div class="course-layout" data-layout-allow-overflow>
          <div class="course-chip">${esc(props.chip)}</div>
          <div class="course-heading"><span>${esc(props.kicker)}</span>${esc(props.title)}</div>
          <div class="course-cards">${renderCards(props.cards || [])}</div>
          <div class="course-line"></div>
        </div>
        <div class="course-presenter">${renderVideo({ id: `v-${scene.id}-course-presenter`, className: "course-video", src: media.presenter, start: scene.start, duration: scene.duration, mediaStart: props.mediaStart ?? 0, extra: " data-layout-allow-overflow" })}</div>
      </div>`;
}

function renderSummaryCta(scene) {
  const props = scene.props;
  const media = required(props.media, `${scene.id}.props.media`);
  return `
      ${renderVideo({ id: `v-${scene.id}-aroll-video`, className: "clip clean-aroll-video", scene: scene.id, src: media.presenter, start: scene.start, duration: scene.duration, mediaStart: props.mediaStart ?? 0, track: scene.track ?? 50 })}
      <div ${sceneAttrs(scene, "clean-aroll clean-aroll-overlay", (scene.track ?? 50) + 1)}>
        <div class="clean-aroll-vignette"></div>
        <div class="clean-aroll-copy"${richAttrs(scene, "primary")}>
          <div class="clean-chip">${esc(props.chip)}</div>
          <div class="clean-title">${esc(props.title)}</div>
          <div class="clean-sub">${esc(props.subline)}</div>
        </div>
      </div>`;
}

function renderHeroAroll(scene) {
  const props = scene.props;
  const media = required(props.media, `${scene.id}.props.media`);
  const rich = richAttrs(scene, "primary");
  const hasCopy = props.chip || props.title || props.subline;
  return `
      <div ${sceneAttrs(scene, "clean-aroll", scene.track ?? 10)}>
        ${renderVideo({ id: `v-${scene.id}-hero`, className: "clean-aroll-video", src: media.presenter, start: scene.start, duration: scene.duration, mediaStart: props.mediaStart ?? 0 })}
        ${
          rich && hasCopy
            ? `<div class="clean-aroll-copy clean-aroll-hero-copy"${rich}>
          ${props.chip ? `<div class="clean-chip">${esc(props.chip)}</div>` : ""}
          ${props.title ? `<div class="clean-title">${esc(props.title)}</div>` : ""}
          ${props.subline ? `<div class="clean-sub">${esc(props.subline)}</div>` : ""}
        </div>`
            : ""
        }
      </div>`;
}

function renderProofMontage(scene) {
  const props = scene.props;
  const items = required(props.media?.items, `${scene.id}.props.media.items`);
  return `
      <div ${sceneAttrs(scene, "proof-montage", scene.track ?? 10)}>
        <div class="proof-grid"${richAnimationAttrs(scene)}>
          ${items
            .map((item, index) => `<div class="proof-card">${renderVideo({ id: `v-${scene.id}-proof-${index + 1}`, src: item.src, start: item.start ?? scene.start, duration: item.duration ?? scene.duration, mediaStart: item.mediaStart ?? 0 })}<div class="proof-label">${esc(item.label || "")}</div></div>`)
            .join("")}
        </div>
      </div>`;
}

export const registry = {
  StatsHero: { id: "StatsHero", sceneTypes: ["hook_stat"], render: renderOpeningStat },
  TitleCard: { id: "TitleCard", sceneTypes: ["title_card"], render: renderTitleCard },
  SplitTextPresenter: { id: "SplitTextPresenter", sceneTypes: ["concept_split"], render: renderSplitTextPresenter },
  ScreenWithPip: { id: "ScreenWithPip", sceneTypes: ["screen_demo_pip"], render: renderScreenWithPip },
  HeroAroll: { id: "HeroAroll", sceneTypes: ["aroll_emphasis"], render: renderHeroAroll },
  StepCard: { id: "StepCard", sceneTypes: ["step_card"], render: renderStepCard },
  ProofMontage: { id: "ProofMontage", sceneTypes: ["proof_montage"], render: renderProofMontage },
  SummaryCta: { id: "SummaryCta", sceneTypes: ["summary_cta"], render: renderSummaryCta },
};

export function renderScene(scene) {
  const entry = registry[scene.component];
  if (!entry) throw new Error(`unknown component ${scene.component}`);
  return entry.render(scene);
}
