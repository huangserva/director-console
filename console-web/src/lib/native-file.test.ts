import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseNativeFile } from "./api";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  (globalThis as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  return fn;
}
afterEach(() => vi.restoreAllMocks());

describe("chooseNativeFile — native OS dialog", () => {
  it("single video → { ok, path }", async () => {
    mockFetch(200, { ok: true, path: "/Users/x/clip.mp4" });
    expect(await chooseNativeFile("video")).toEqual({ ok: true, path: "/Users/x/clip.mp4" });
  });

  it("multiple → { ok, paths }", async () => {
    const fn = mockFetch(200, { ok: true, paths: ["/a.mp4", "/b.mp4"] });
    const r = await chooseNativeFile("video", true);
    expect(r.paths).toEqual(["/a.mp4", "/b.mp4"]);
    // sends kind + multiple in the body
    const init = (fn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ kind: "video", multiple: true });
  });

  it("canceled → { ok:false, canceled:true } (caller does nothing)", async () => {
    mockFetch(200, { ok: false, canceled: true });
    const r = await chooseNativeFile("wav");
    expect(r.ok).toBe(false);
    expect(r.canceled).toBe(true);
  });

  it("error / 5xx no body → ok:false (no throw)", async () => {
    mockFetch(500, "");
    const r = await chooseNativeFile("video");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("500");
  });
});
