import { describe, expect, it } from "vitest";
import {
  defaultRouteId,
  findRoute,
  isRouteSelectable,
  PIPELINE_ROUTES,
  recipeIdForRoute,
} from "./pipeline-routes";

describe("PIPELINE_ROUTES — v3-4 显式能力路线 tabs 定义", () => {
  it("has the 5 routes in order: 成片导入 / 数字人口播 / 数字人产品介绍 / 打开 skill 产物 / 占位", () => {
    expect(PIPELINE_ROUTES.map((r) => r.id)).toEqual(["import", "routeA", "productIntro", "skill", "auto"]);
  });
  it("each route has a 中文 title + 一句话 subtitle", () => {
    for (const r of PIPELINE_ROUTES) {
      expect(r.title.trim().length).toBeGreaterThan(0);
      expect(r.subtitle.trim().length).toBeGreaterThan(0);
      expect(/[一-鿿]/.test(r.title)).toBe(true); // 标题含中文（"skill" 这类专名可保留）
      expect(/[一-鿿]/.test(r.subtitle)).toBe(true);
    }
  });
  it("recipe-backed routes carry the correct recipeId", () => {
    expect(recipeIdForRoute("import")).toBe("existing-narrated-video");
    expect(recipeIdForRoute("routeA")).toBe("digital-human-talking-head");
    expect(recipeIdForRoute("productIntro")).toBe("digital-human-product-introduction");
    expect(recipeIdForRoute("skill")).toBeNull(); // 非 recipe 路线
    expect(recipeIdForRoute("auto")).toBeNull();
  });
  it("the 'auto' route is the enabled v3-5 一句话自动生成 (no-credential 粘脚本)", () => {
    const auto = findRoute("auto")!;
    expect(auto.kind).toBe("generate");
    expect(auto.enabled).toBe(true);
  });
});

describe("defaultRouteId — 默认激活第一个可用路线", () => {
  it("returns the first enabled route id (import)", () => {
    expect(defaultRouteId()).toBe("import");
  });
});

describe("isRouteSelectable — 真实路线可点（v3-5 起全部启用）", () => {
  it("returns true for every current route incl. the now-enabled 'auto'", () => {
    expect(isRouteSelectable(findRoute("auto")!)).toBe(true);
    expect(isRouteSelectable(findRoute("import")!)).toBe(true);
    expect(isRouteSelectable(findRoute("skill")!)).toBe(true);
  });
});

describe("findRoute", () => {
  it("finds by id, null when absent", () => {
    expect(findRoute("routeA")?.title).toBe("数字人口播");
    expect(findRoute("nope")).toBeNull();
  });
});
