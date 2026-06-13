export function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function f(value) {
  return Number(value).toFixed(3);
}

export function required(value, label) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`missing required prop: ${label}`);
  }
  return value;
}

export function renderVideo({ id, className, src, start, duration, mediaStart = 0, track, extra = "", scene }) {
  const idAttr = id ? ` id="${esc(id)}"` : "";
  const classAttr = className ? ` class="${esc(className)}"` : "";
  const sceneAttr = scene ? ` data-memos-scene="${esc(scene)}"` : "";
  const trackAttr = track === undefined ? "" : ` data-track-index="${Number(track)}"`;
  return `<video${idAttr}${classAttr}${sceneAttr} src="${esc(required(src, "video.src"))}" muted playsinline data-start="${f(required(start, "video.start"))}" data-duration="${f(required(duration, "video.duration"))}" data-media-start="${f(mediaStart)}"${trackAttr}${extra}></video>`;
}

export function renderAudio({ id, src, start, duration, mediaStart = 0, track = 90, volume = 1 }) {
  const idAttr = id ? ` id="${esc(id)}"` : "";
  return `<audio${idAttr} src="${esc(required(src, "audio.src"))}" data-start="${f(required(start, "audio.start"))}" data-duration="${f(required(duration, "audio.duration"))}" data-media-start="${f(mediaStart)}" data-track-index="${Number(track)}" data-volume="${Number(volume)}"></audio>`;
}

export function renderCards(cards = [], className = "course-card") {
  return cards
    .map((card) => {
      const blue = card.blue ? " blue" : "";
      return `<div class="${className}"><div class="card-icon${blue}">${esc(card.icon || "")}</div><div class="course-small">${esc(card.small || "")}</div><div class="course-big${blue}">${esc(card.label || card.big || "")}</div></div>`;
    })
    .join("");
}

export function renderCaption(caption, index, className = "caption-line") {
  return `<div id="cap-${index}" class="clip ${className}" data-start="${f(caption.start)}" data-duration="${f(caption.end - caption.start)}" data-track-index="${900 + index}"><span>${esc(caption.text)}</span></div>`;
}
