import { describe, expect, it } from "vitest";
import { isEditAllowed } from "./edit-gate";

// Serious-1: 卡片/Inspector 编辑只在「无阻塞操作」或「正在 recaption」时放行。
// 其它 busy（save/compose/render/template/load/...）必须禁止 mutate manifest，
// 否则服务端改写/渲染中 UI 还能改 → render 用旧版 / save 中又 dirty 的竞态。
describe("isEditAllowed — 编辑层门控（与 editGateOpen 同义）", () => {
  it("allows editing when idle (busy=null)", () => {
    expect(isEditAllowed(null)).toBe(true);
  });

  it("allows editing during recaption (long ASR, B14 不冻结编辑)", () => {
    expect(isEditAllowed("recaption")).toBe(true);
  });

  it("blocks editing during every server-mutating / loading busy state", () => {
    for (const b of ["load", "save", "compose", "lint", "inspect", "import", "workflow", "routeA", "productIntro", "template", "render", "saveCues", "applyTheme", "openSkill"]) {
      expect(isEditAllowed(b), `busy=${b} should block editing`).toBe(false);
    }
  });
});
