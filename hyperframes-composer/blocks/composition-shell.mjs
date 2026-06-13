import fs from "node:fs";
import path from "node:path";
import { renderAudio, renderCaption, renderVideo } from "../components/html.mjs";
import { renderScene } from "../components/registry.mjs";

const cssPath = new URL("../components/hyperframes-tech-talk.css", import.meta.url);

export function renderCompositionDocument(manifest, { timelineScript = "" } = {}) {
  const css = fs.readFileSync(cssPath, "utf8");
  const captions = manifest.captions || [];
  const scenes = manifest.scenes || [];
  const clipEnd = (clip) => (typeof clip.start === "number" && typeof clip.duration === "number" ? clip.start + clip.duration : 0);
  const duration =
    manifest.duration ??
    Math.max(
      ...scenes.map((scene) => scene.start + scene.duration),
      ...(manifest.source?.videoClips || []).map(clipEnd),
      ...(manifest.audio?.clips || []).map(clipEnd),
      0,
    );
  const audioClips = Array.isArray(manifest.audio?.clips) && manifest.audio.clips.length > 0 ? manifest.audio.clips : null;
  const audio = audioClips
    ? audioClips
        .map((clip, index) =>
          renderAudio({
            id: `audio-${index}`,
            src: clip.src ?? manifest.audio.src,
            start: clip.start,
            duration: clip.duration,
            mediaStart: clip.mediaStart ?? 0,
            track: 90 + index,
            volume: clip.volume ?? 1,
          }),
        )
        .join("\n      ")
    : manifest.audio
      ? `<audio id="audio" src="${manifest.audio.src}" data-start="0" data-duration="${duration}" data-track-index="90" data-volume="1"></audio>`
      : "";
  const sourceVideoClips =
    Array.isArray(manifest.source?.videoClips) && manifest.source.videoClips.length > 0
      ? manifest.source.videoClips
      : manifest.source?.video
        ? [{ id: "source-video-background-layer", src: manifest.source.video, start: 0, duration, mediaStart: 0 }]
        : [];
  const sourceVideo =
    sourceVideoClips.length > 0
      ? `\n      ${sourceVideoClips
          .map((clip, index) =>
            renderVideo({
              id: sourceVideoClips.length === 1 ? "source-video-background-layer" : `source-video-background-layer-${index}`,
              className: "clip source-video source-video-background",
              src: clip.src ?? manifest.source.video,
              start: clip.start,
              duration: clip.duration,
              mediaStart: clip.mediaStart ?? 0,
              track: clip.track ?? index,
            }),
          )
          .join("\n      ")}`
      : "";
  const sourceVideoAttr = sourceVideo ? ` data-has-source-video="1"` : "";

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
    <div id="root" data-composition-id="${manifest.compositionId || "main"}" data-start="0" data-duration="${duration}" data-width="1920" data-height="1080"${sourceVideoAttr}>${sourceVideo}
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
