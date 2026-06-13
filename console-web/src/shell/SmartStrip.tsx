// v2-P2: smart-plan strip — renders plan.segments as chips + the summary line
// "识别 N 片段 · 推荐 M 卡 · K 校验项". Read-only.
import { deriveSmartSegments, summarizePlan, type PackagingPlan } from "../lib/packaging-plan";
import { Icon } from "./Icon";

function fmtClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "··:··"; // segment without a numeric time
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function SmartStrip({ plan }: { plan: PackagingPlan }) {
  const sum = summarizePlan(plan);
  const segments = deriveSmartSegments(plan);

  return (
    <div className="pc-smartstrip">
      <div className="pc-segs">
        {segments.length === 0 ? (
          <div className="pc-seg-empty muted">智能方案待生成 — 运行分析或导入成片后，这里展示识别到的片段</div>
        ) : (
          segments.map((seg, i) => (
            <div key={seg.id} className={i === 0 ? "pc-seg active" : "pc-seg"}>
              <div className="pc-seg-title">{seg.label}</div>
              <div className="pc-seg-range">
                {fmtClock(seg.start)} – {fmtClock(seg.end)}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="pc-smartsum">
        <div className="pc-smartsum-h">
          <Icon name="spark" size={14} /> 智能方案
        </div>
        <div className="pc-smartsum-l">
          识别到 {sum.segmentCount} 个片段
          <br />
          推荐 {sum.recommendedCardCount} 张卡片
          <br />
          发现 {sum.validationCount} 个校验项
        </div>
      </div>
    </div>
  );
}
