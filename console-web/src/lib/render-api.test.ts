import { afterEach, describe, expect, it, vi } from "vitest";
import { renderProject } from "./api";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  (globalThis as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  return fn;
}
afterEach(() => vi.restoreAllMocks());

describe("renderProject — real MP4 render", () => {
  it("200 → { ok, previewUrl, mp4Path }", async () => {
    mockFetch(200, {
      ok: true,
      name: "sample-text",
      code: 0,
      stage: "render",
      mp4Path: "/abs/render/sample-text.mp4",
      previewUrl: "/api/preview/render/sample-text.mp4",
    });
    const r = await renderProject("sample-text");
    expect(r.ok).toBe(true);
    expect(r.previewUrl).toBe("/api/preview/render/sample-text.mp4");
    expect(r.stage).toBe("render");
  });

  it("render-stage failure surfaces stage + stderr (not faked success)", async () => {
    mockFetch(200, { ok: false, stage: "render", code: 1, stderr: "ffmpeg blew up", logPath: "/l.log" });
    const r = await renderProject("sample-text");
    expect(r.ok).toBe(false);
    expect(r.stage).toBe("render");
    expect(r.stderr).toContain("ffmpeg");
  });

  it("compose-stage failure carries through", async () => {
    mockFetch(200, { ok: false, stage: "compose", code: 2, stderr: "bad manifest" });
    const r = await renderProject("x");
    expect(r.ok).toBe(false);
    expect(r.stage).toBe("compose");
  });

  it("5xx with no usable body still returns ok:false (no throw)", async () => {
    mockFetch(500, "");
    const r = await renderProject("x");
    expect(r.ok).toBe(false);
    expect(r.stderr).toContain("500");
  });

  it("sends only the supported params (fps/quality), never width/height", async () => {
    const fn = mockFetch(200, { ok: true, previewUrl: "/api/preview/render/x.mp4" });
    await renderProject("x", { fps: 30, quality: "draft" });
    const init = (fn.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ fps: 30, quality: "draft" });
    expect(body.width).toBeUndefined();
    expect(body.height).toBeUndefined();
  });

  it("no options → no request body (backend defaults)", async () => {
    const fn = mockFetch(200, { ok: true });
    await renderProject("x");
    const init = (fn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.body).toBeUndefined();
  });
});
