import { describe, expect, it } from "vitest";
import { addItem, compact, removeItem, setItem } from "./string-list";

describe("string-list pure helpers", () => {
  it("addItem appends (default empty) without mutating", () => {
    const a = ["x"];
    expect(addItem(a)).toEqual(["x", ""]);
    expect(addItem(a, "y")).toEqual(["x", "y"]);
    expect(a).toEqual(["x"]); // immutable
  });

  it("removeItem drops by index", () => {
    expect(removeItem(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    expect(removeItem(["a"], 0)).toEqual([]);
    expect(removeItem(["a", "b"], 9)).toEqual(["a", "b"]); // out of range = no-op
  });

  it("setItem replaces one slot", () => {
    expect(setItem(["a", "b", "c"], 1, "B")).toEqual(["a", "B", "c"]);
    const src = ["a"];
    setItem(src, 0, "z");
    expect(src).toEqual(["a"]); // immutable
  });

  it("compact trims and drops empties", () => {
    expect(compact(["  a ", "", "  ", "b"])).toEqual(["a", "b"]);
    expect(compact([])).toEqual([]);
  });
});
