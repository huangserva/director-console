// 画中画卡内容输入纯逻辑：数字人库选中后写进 manifest 的 media.pip 值，以及 screen 图片/视频判定。
import { describe, expect, it } from "vitest";
import { digitalHumanMediaPath } from "./api";
import { isImageMediaPath, MEDIA_PLACEHOLDER } from "./scene-templates";

describe("digitalHumanMediaPath — 数字人选中后写进 manifest 的值", () => {
  it("有 path（绝对路径）时直接用 path", () => {
    expect(digitalHumanMediaPath({ name: "小美", path: "/Users/x/dh/xiaomei.mp4", url: "/api/preview/media?path=%2Fother.mp4" })).toBe("/Users/x/dh/xiaomei.mp4");
  });
  it("只有 preview URL 时抽出 path 查询参数（解码）", () => {
    expect(digitalHumanMediaPath({ name: "Bob", url: "/api/preview/media?path=%2FUsers%2Fx%2Fdh%2Fbob.mp4" })).toBe("/Users/x/dh/bob.mp4");
  });
  it("URL 不是 preview 形式时退回 url 原值", () => {
    expect(digitalHumanMediaPath({ name: "n", url: "https://cdn.example/dh/n.mp4" })).toBe("https://cdn.example/dh/n.mp4");
  });
  it("path 为空白时回退到 url", () => {
    expect(digitalHumanMediaPath({ name: "n", path: "   ", url: "/api/preview/media?path=%2Fa.mp4" })).toBe("/a.mp4");
  });
});

describe("isImageMediaPath — screen 槽图片/视频判定", () => {
  it.each(["/a/b.png", "/a/b.JPG", "/x.jpeg", "/x.webp", "/x.gif", "/x.avif"])("%s 判为图片", (p) => {
    expect(isImageMediaPath(p)).toBe(true);
  });
  it.each(["/a/b.mp4", "/a/b.mov", "/a/b.webm"])("%s 判为视频（非图片）", (p) => {
    expect(isImageMediaPath(p)).toBe(false);
  });
  it("空 / 占位符判为非图片", () => {
    expect(isImageMediaPath("")).toBe(false);
    expect(isImageMediaPath(null)).toBe(false);
    expect(isImageMediaPath(MEDIA_PLACEHOLDER)).toBe(false);
  });
});
