import { describe, expect, it } from "vitest";
import { applyEdits, flattenEditable } from "./props";

describe("flattenEditable", () => {
  it("flattens string and number leaves with dotted paths", () => {
    const props = {
      stat: { label: "AGENT MEMORY", number: "7", title: "共享记忆实战" },
      duration: 18.48,
    };
    const fields = flattenEditable(props);
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f]));

    expect(byPath["stat.label"]).toMatchObject({ value: "AGENT MEMORY", type: "string" });
    expect(byPath["stat.number"]).toMatchObject({ value: "7", type: "string" });
    expect(byPath["duration"]).toMatchObject({ value: 18.48, type: "number" });
  });

  it("indexes string arrays as editable leaves but skips object arrays", () => {
    const props = {
      items: ["Chrome 登录态", "正文提取", "滚动加载"],
      cards: [{ icon: "✓", label: "验证解法" }],
    };
    const fields = flattenEditable(props);
    const paths = fields.map((f) => f.path);

    // string array → indexed leaves
    expect(paths).toContain("items.0");
    expect(paths).toContain("items.2");
    // object array → recurse into each object's leaves, not the array itself
    expect(paths).toContain("cards.0.label");
    expect(paths).toContain("cards.0.icon");
  });

  it("ignores booleans, null and empty containers", () => {
    const fields = flattenEditable({ blue: true, nada: null, empty: {} });
    expect(fields).toHaveLength(0);
  });
});

describe("applyEdits", () => {
  it("returns a new object with edited leaves, leaving the source untouched", () => {
    const props = { stat: { number: "7", title: "old" }, duration: 18.48 };
    const next = applyEdits(props, {
      "stat.title": "new title",
      duration: 20,
    });

    expect(next).toEqual({ stat: { number: "7", title: "new title" }, duration: 20 });
    // immutability: source unchanged
    expect(props.stat.title).toBe("old");
    expect(props.duration).toBe(18.48);
  });

  it("edits array elements by index path without dropping siblings", () => {
    const props = { items: ["a", "b", "c"] };
    const next = applyEdits(props, { "items.1": "B" });
    expect(next.items).toEqual(["a", "B", "c"]);
    expect(Array.isArray(next.items)).toBe(true);
  });

  it("coerces edited values to the original leaf type (number stays number)", () => {
    const props = { duration: 18.48 };
    const next = applyEdits(props, { duration: "20.5" });
    expect(next.duration).toBe(20.5);
    expect(typeof next.duration).toBe("number");
  });
});
