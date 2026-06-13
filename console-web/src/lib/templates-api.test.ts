import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTemplate, getTemplate, listTemplates, saveTemplate } from "./api";

// Exercise the v2-P5 template api functions against a mocked fetch, covering the
// 200 / 409 / 422 / 404 body-read paths (the contract verified live on :4099).
function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  (globalThis as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => vi.restoreAllMocks());

describe("listTemplates", () => {
  it("parses { templates: [...] }", async () => {
    mockFetch(200, { templates: [{ id: "a", name: "A", description: "d" }] });
    expect(await listTemplates()).toEqual([{ id: "a", name: "A", description: "d" }]);
  });
  it("tolerates a bare array", async () => {
    mockFetch(200, [{ id: "b", name: "B" }]);
    expect(await listTemplates()).toEqual([{ id: "b", name: "B" }]);
  });
});

describe("getTemplate unwraps { template }", () => {
  it("returns the inner template", async () => {
    mockFetch(200, { template: { id: "x", cardRules: [] } });
    expect(await getTemplate("x")).toEqual({ id: "x", cardRules: [] });
  });
});

describe("saveTemplate", () => {
  it("200 → { ok, templateId }", async () => {
    mockFetch(200, { ok: true, templateId: "t1", template: { id: "t1" } });
    expect(await saveTemplate("proj", { name: "t1" })).toEqual({ ok: true, templateId: "t1" });
  });
  it("409 → conflict flag (offer overwrite)", async () => {
    mockFetch(409, { ok: false, error: "already exists" });
    const r = await saveTemplate("proj", { name: "dup" });
    expect(r).toMatchObject({ ok: false, conflict: true });
    expect(r.error).toContain("already exists");
  });
  it("422 → failures surfaced", async () => {
    mockFetch(422, { error: "template validation failed", failures: ["bad rule"] });
    const r = await saveTemplate("proj", { name: "bad" });
    expect(r.ok).toBe(false);
    expect(r.failures).toEqual(["bad rule"]);
  });
});

describe("applyTemplate", () => {
  it("200 → { ok, manifestName }", async () => {
    mockFetch(200, { ok: true, name: "proj", manifestName: "proj" });
    expect(await applyTemplate("proj", "t1")).toEqual({ ok: true, manifestName: "proj" });
  });
  it("404 → ok:false with error (no throw)", async () => {
    mockFetch(404, { ok: false, error: "template not found" });
    const r = await applyTemplate("proj", "missing");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("not found");
  });
  it("422 → failures surfaced", async () => {
    mockFetch(422, { error: "apply failed", failures: ["x"] });
    const r = await applyTemplate("proj", "t1");
    expect(r.ok).toBe(false);
    expect(r.failures).toEqual(["x"]);
  });
});
