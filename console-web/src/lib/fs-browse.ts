// v2 UX: pure helpers for the server-backed file picker. The backend /fs/list
// returns absolute paths per entry; these helpers handle display partitioning,
// video detection, breadcrumbs, and parent/join fallbacks (used when the server
// omits `parent`, and unit-testable without HTTP).

export const VIDEO_EXTS = [".mp4", ".mov", ".webm", ".m4v", ".mkv", ".avi"];

export interface FsEntry {
  name: string;
  path: string;
  type: "dir" | "file";
  isVideo?: boolean;
  size?: number;
}

/** Extension-based video check (fallback when the server doesn't set isVideo). */
export function isVideoName(name: string): boolean {
  const lower = name.toLowerCase();
  return VIDEO_EXTS.some((ext) => lower.endsWith(ext));
}

/** Trust the server's isVideo flag; fall back to the extension. */
export function entryIsVideo(entry: FsEntry): boolean {
  return entry.type === "file" && (entry.isVideo ?? isVideoName(entry.name));
}

export interface SplitEntries {
  dirs: FsEntry[];
  videos: FsEntry[];
  /** Count of non-video files hidden from the list (shown as a muted note). */
  otherCount: number;
}

/**
 * Partition a directory listing for display: folders first (navigable), then
 * video files (selectable); non-video files are counted but not listed. Each
 * group sorted case-insensitively by name.
 */
export function splitEntries(entries: FsEntry[]): SplitEntries {
  const byName = (a: FsEntry, b: FsEntry) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const dirs = entries.filter((e) => e.type === "dir").sort(byName);
  const videos = entries.filter((e) => entryIsVideo(e)).sort(byName);
  const otherCount = entries.filter((e) => e.type === "file" && !entryIsVideo(e)).length;
  return { dirs, videos, otherCount };
}

/** POSIX parent of an absolute path. Root ("/") has no parent (returns null). */
export function parentPath(path: string): string | null {
  if (!path || path === "/") return null;
  const trimmed = path.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  return trimmed.slice(0, idx);
}

/** Join a directory and a child name into an absolute path. */
export function joinPath(dir: string, name: string): string {
  if (!dir) return name;
  return `${dir.replace(/\/+$/, "")}/${name}`;
}

export interface Crumb {
  name: string;
  path: string;
}

/** Breadcrumb segments for an absolute path, root-first. */
export function breadcrumbs(path: string): Crumb[] {
  if (!path) return [];
  const segs = path.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ name: "/", path: "/" }];
  let acc = "";
  for (const seg of segs) {
    acc = `${acc}/${seg}`;
    crumbs.push({ name: seg, path: acc });
  }
  return crumbs;
}
