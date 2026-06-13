import { describe, expect, it } from "vitest";
import { deepMergeProps, patchColor, patchFont, patchLayout } from "./card-edit";

describe("deepMergeProps — immutable deep merge", () => {
  it("creates intermediate objects for new nested fields", () => {
    const out = deepMergeProps({ title: "Hi" }, { style: { font: { weight: "bold" } } });
    expect(out).toEqual({ title: "Hi", style: { font: { weight: "bold" } } });
  });

  it("merges into existing nested objects without dropping siblings", () => {
    const base = { style: { font: { titleSize: 32 }, color: { accent: "#fff" } } };
    const out = deepMergeProps(base, { style: { font: { bodySize: 16 } } });
    expect(out.style).toEqual({ font: { titleSize: 32, bodySize: 16 }, color: { accent: "#fff" } });
  });

  it("does not mutate the input", () => {
    const base = { layout: { x: 1 } };
    const out = patchLayout(base, { x: 99 });
    expect(base.layout.x).toBe(1);
    expect((out.layout as { x: number }).x).toBe(99);
  });

  it("replaces arrays and scalars rather than merging", () => {
    const out = deepMergeProps({ items: ["a", "b"] }, { items: ["c"] });
    expect(out.items).toEqual(["c"]);
  });

  it("deletes a key when patched with undefined", () => {
    const out = deepMergeProps({ a: 1, b: 2 }, { b: undefined });
    expect(out).toEqual({ a: 1 });
  });
});

describe("field-specific patchers map to the round-trip slots", () => {
  it("patchLayout → props.layout", () => {
    expect(patchLayout(undefined, { x: 10, y: 20 })).toEqual({ layout: { x: 10, y: 20 } });
  });
  it("patchFont → props.style.font", () => {
    expect(patchFont(undefined, { weight: "bold" })).toEqual({ style: { font: { weight: "bold" } } });
  });
  it("patchColor → props.style.color, preserving existing font", () => {
    const base = { style: { font: { titleSize: 32 } } };
    expect(patchColor(base, { accent: "#e8b23a" })).toEqual({
      style: { font: { titleSize: 32 }, color: { accent: "#e8b23a" } },
    });
  });
});
