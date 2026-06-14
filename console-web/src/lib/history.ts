// v3-3 任务历史：纯函数 + 类型。后端 history.json 每条 = 一次 import/套模板/渲染/字幕识别/回滚 的快照。
// UI（Inspector 历史 tab）按这里的映射渲染；与后端契约对齐（GET history / detail / restore）。
import { cardTypeLabel, type PackagingPlan } from "./packaging-plan";

export type HistoryKind = "import" | "apply-template" | "render" | "recaption" | "restore";

export interface HistoryValidation {
  ok: boolean;
  failures?: string[];
}

export interface HistoryEntry {
  id: string;
  ts: string; // ISO
  kind: string; // HistoryKind，但保留 string 以向前兼容未知 kind
  params?: Record<string, unknown>;
  planSnapshotRef?: string | null;
  artifacts?: Record<string, unknown>;
  validation?: HistoryValidation;
  result?: Record<string, unknown>;
}

export interface HistoryListResult {
  ok: boolean;
  name?: string;
  entries?: HistoryEntry[];
  error?: string;
}

export interface HistoryDetailResult {
  ok: boolean;
  name?: string;
  entry?: HistoryEntry;
  plan?: PackagingPlan | null;
  error?: string;
}

export interface HistoryRestoreResult {
  ok: boolean;
  name?: string;
  manifestName?: string;
  historyEntry?: HistoryEntry;
  error?: string;
  failures?: string[];
}

const KIND_LABELS: Record<string, string> = {
  import: "导入",
  "apply-template": "套模板",
  render: "渲染",
  recaption: "字幕识别",
  restore: "回滚",
};

export function historyKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

// 时间显示：直接从 ISO 串截取，避免 Date/时区不确定性（也便于确定性测试）。
// 2026-06-14T13:25:09.000Z → 2026-06-14 13:25
export function formatHistoryTime(ts: string): string {
  if (typeof ts !== "string" || ts.length < 16) return ts ?? "";
  return ts.slice(0, 16).replace("T", " ");
}

export interface HistoryBadge {
  tone: "ok" | "bad" | "muted";
  label: string;
}

export function historyValidationBadge(validation: HistoryValidation | undefined): HistoryBadge {
  if (!validation) return { tone: "muted", label: "—" };
  if (validation.ok) return { tone: "ok", label: "通过" };
  const n = validation.failures?.length ?? 0;
  return { tone: "bad", label: n > 0 ? `失败 · ${n} 项` : "失败" };
}

function basename(p: string): string {
  const parts = String(p).split(/[\\/]/);
  return parts[parts.length - 1] || String(p);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

// 参数摘要：按 kind 给一句人读摘要。`label` 是中文文案；`id` 是技术标识（模板 id / 条目 id /
// 文件名），UI 渲染进 <code>（i18n 扫描会剔除技术标识，与 scene-id/recipe-id 同处理）。
export interface ParamsSummary {
  label: string;
  id?: string;
}
export function historyParamsSummary(entry: HistoryEntry): ParamsSummary {
  const p = entry.params ?? {};
  switch (entry.kind) {
    case "apply-template": {
      const id = str(p.templateId);
      return id ? { label: "模板", id } : { label: "套用模板" };
    }
    case "restore": {
      const id = str(p.restoredEntryId);
      return id ? { label: "回滚自", id } : { label: "回滚快照" };
    }
    case "import": {
      const src = str(p.videoPath) ?? str(p.sourcePath) ?? str(p.source);
      return src ? { label: "导入", id: basename(src) } : { label: "导入素材" };
    }
    case "recaption":
      return { label: "重新识别字幕" };
    case "render":
      return { label: "渲染 MP4" };
    default:
      return { label: "" };
  }
}

export interface HistoryArtifact {
  kind: "mp4" | "manifest" | "plan" | "captions";
  label: string;
  path: string;
  downloadable: boolean;
}

// 产物：从 artifacts 抽可展示项；mp4 标记可下载/打开。
export function historyArtifacts(entry: HistoryEntry): HistoryArtifact[] {
  const a = (entry.artifacts ?? {}) as Record<string, unknown>;
  const out: HistoryArtifact[] = [];
  const mp4 = str(a.mp4Path);
  if (mp4) out.push({ kind: "mp4", label: "MP4 成片", path: mp4, downloadable: true });
  const captions = str(a.captionsPath);
  if (captions) out.push({ kind: "captions", label: "字幕", path: captions, downloadable: false });
  const manifest = str(a.manifestPath);
  if (manifest) out.push({ kind: "manifest", label: "清单", path: manifest, downloadable: false });
  const planPath = str(a.planPath);
  if (planPath) out.push({ kind: "plan", label: "方案", path: planPath, downloadable: false });
  return out;
}

export function hasDownloadableArtifact(entry: HistoryEntry): boolean {
  return historyArtifacts(entry).some((x) => x.downloadable);
}

// 绝对媒体路径 → 浏览器可打开/下载的 URL（经 Vite /api 代理到 console-api 的 /preview/media，
// 支持 mp4/mov/webm…）。仅 mp4 产物用得上（downloadable=true）。
export function mediaPreviewHref(absPath: string): string {
  return `/api/preview/media?path=${encodeURIComponent(absPath)}`;
}

export interface SnapshotSummary {
  scenes: number;
  durationSec: number;
  cardTypes: { label: string; count: number }[];
}

// 快照摘要：从 plan 算 场景数 / 时长 / 卡片类型分布（保留首次出现顺序）。
export function snapshotSummary(plan: PackagingPlan | null): SnapshotSummary {
  const cards = plan?.tracks?.card;
  if (!plan || !Array.isArray(cards)) return { scenes: 0, durationSec: 0, cardTypes: [] };
  const counts = new Map<string, number>();
  for (const c of cards) {
    const label = cardTypeLabel(c.type);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return {
    scenes: cards.length,
    durationSec: Number(plan.duration ?? 0),
    cardTypes: [...counts.entries()].map(([label, count]) => ({ label, count })),
  };
}
