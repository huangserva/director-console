import fs from "node:fs";
import path from "node:path";
import { renderCaption } from "../components/html.mjs";
import { renderScene } from "../components/registry.mjs";

const cssPath = new URL("../components/hyperframes-tech-talk.css", import.meta.url);

export function renderCompositionDocument(manifest, { timelineScript = "" } = {}) {
  const css = fs.readFileSync(cssPath, "utf8");
  const captions = manifest.captions || [];
  const scenes = manifest.scenes || [];
  const duration = manifest.duration ?? Math.max(...scenes.map((scene) => scene.start + scene.duration), 0);
  const audio = manifest.audio
    ? `<audio id="audio" src="${manifest.audio.src}" data-start="0" data-duration="${duration}" data-track-index="90" data-volume="1"></audio>`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <meta name="generator" content="hyperframes-composer" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${manifest.compositionId || "main"}" data-start="0" data-duration="${duration}" data-width="1920" data-height="1080">
      ${audio}
${scenes.map(renderScene).join("\n")}
${captions.map((caption, index) => renderCaption(caption, index)).join("\n")}
    </div>
    <script>
${timelineScript}
    </script>
  </body>
</html>`;
}
