import { describe, expect, it } from "vitest";
import { breadcrumbs, entryIsVideo, isVideoName, joinPath, parentPath, splitEntries, type FsEntry } from "./fs-browse";

describe("video detection", () => {
  it("matches common video extensions case-insensitively", () => {
    expect(isVideoName("a.mp4")).toBe(true);
    expect(isVideoName("B.MOV")).toBe(true);
    expect(isVideoName("clip.webm")).toBe(true);
    expect(isVideoName("notes.txt")).toBe(false);
    expect(isVideoName("folder")).toBe(false);
  });
  it("trusts server isVideo, falls back to extension", () => {
    expect(entryIsVideo({ name: "x.dat", path: "/x.dat", type: "file", isVideo: true })).toBe(true);
    expect(entryIsVideo({ name: "x.mp4", path: "/x.mp4", type: "file" })).toBe(true);
    expect(entryIsVideo({ name: "d", path: "/d", type: "dir", isVideo: true })).toBe(false); // dirs never "video"
  });
});

describe("splitEntries — folders first, videos selectable, others counted", () => {
  const entries: FsEntry[] = [
    { name: "zeta.mp4", path: "/p/zeta.mp4", type: "file", isVideo: true },
    { name: "Alpha", path: "/p/Alpha", type: "dir" },
    { name: "readme.txt", path: "/p/readme.txt", type: "file", isVideo: false },
    { name: "beta", path: "/p/beta", type: "dir" },
    { name: "clip.mov", path: "/p/clip.mov", type: "file", isVideo: true },
    { name: "song.mp3", path: "/p/song.mp3", type: "file", isVideo: false },
  ];
  const split = splitEntries(entries);

  it("dirs sorted case-insensitively", () => {
    expect(split.dirs.map((d) => d.name)).toEqual(["Alpha", "beta"]);
  });
  it("videos sorted, only videos", () => {
    expect(split.videos.map((v) => v.name)).toEqual(["clip.mov", "zeta.mp4"]);
  });
  it("non-video files counted, not listed", () => {
    expect(split.otherCount).toBe(2); // readme.txt + song.mp3
  });
});

describe("parentPath — 上一级", () => {
  it("returns the POSIX parent", () => {
    expect(parentPath("/Users/x/dir")).toBe("/Users/x");
    expect(parentPath("/Users")).toBe("/");
  });
  it("root has no parent", () => {
    expect(parentPath("/")).toBeNull();
    expect(parentPath("")).toBeNull();
  });
  it("ignores trailing slashes", () => {
    expect(parentPath("/Users/x/")).toBe("/Users");
  });
});

describe("joinPath — 路径拼接", () => {
  it("joins dir + name as absolute", () => {
    expect(joinPath("/Users/x", "video.mp4")).toBe("/Users/x/video.mp4");
    expect(joinPath("/Users/x/", "video.mp4")).toBe("/Users/x/video.mp4");
  });
});

describe("breadcrumbs", () => {
  it("builds root-first crumbs with cumulative paths", () => {
    expect(breadcrumbs("/Users/x/dir")).toEqual([
      { name: "/", path: "/" },
      { name: "Users", path: "/Users" },
      { name: "x", path: "/Users/x" },
      { name: "dir", path: "/Users/x/dir" },
    ]);
  });
});
