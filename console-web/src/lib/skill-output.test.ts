// 打开 skill 产物 API 客户端：容错抽取项目名（name / project.name / projectId / …）+ 失败处理。
// 桩 fetch 穿透真实 req() 路径（不污染生产代码），覆盖和 @全栈工程师锁定的契约多种返回 shape。
import { afterEach, describe, expect, it, vi } from "vitest";
import { openSkillOutput } from "./api";

function stubFetch(status: number, body: unknown) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(text, { status, headers: { "content-type": "application/json" } })));
}

afterEach(() => vi.unstubAllGlobals());

describe("openSkillOutput — 容错抽取项目名", () => {
  it("{ok:true,name} → name", async () => {
    stubFetch(200, { ok: true, name: "skill-proj-1" });
    expect(await openSkillOutput("/abs/skill-out")).toEqual({ ok: true, name: "skill-proj-1" });
  });
  it("{ok:true,project:{name}} → project.name", async () => {
    stubFetch(200, { ok: true, project: { name: "proj-from-project" } });
    expect(await openSkillOutput("/abs/x")).toEqual({ ok: true, name: "proj-from-project" });
  });
  it("{ok:true,projectId} → projectId", async () => {
    stubFetch(200, { ok: true, projectId: "proj-id-9" });
    expect(await openSkillOutput("/abs/x")).toEqual({ ok: true, name: "proj-id-9" });
  });
  it("{ok:false,error} → 透传 error", async () => {
    stubFetch(400, { ok: false, error: "unrecognized skill output" });
    expect(await openSkillOutput("/abs/x")).toEqual({ ok: false, error: "unrecognized skill output" });
  });
  it("ok:true 但无任何项目名 → 友好错误", async () => {
    stubFetch(200, { ok: true });
    const r = await openSkillOutput("/abs/x");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("项目名");
  });
  it("HTTP 500 无 ok 字段 → 失败带状态", async () => {
    stubFetch(500, "boom");
    const r = await openSkillOutput("/abs/x");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("500");
  });
  it("带 projectName 时一并发送（不报错）", async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true, name: "named" }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    expect(await openSkillOutput("/abs/x", "my-name")).toEqual({ ok: true, name: "named" });
    const init = f.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ skillOutputPath: "/abs/x", projectName: "my-name" });
  });
});
