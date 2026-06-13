// Pure helpers for editing a scene's `props` without inventing structure.
//
// M0 only lets the operator edit existing text fields (titles, labels,
// numbers, list items). We never add or remove keys, so the safe model is:
// flatten every string/number leaf to a dotted path, render one input each,
// then write the edited values back onto a deep clone at the same paths.

export type LeafType = "string" | "number";

export interface EditableField {
  /** Dotted path into props, e.g. "stat.title" or "items.0". */
  path: string;
  value: string | number;
  type: LeafType;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Walk props and collect every editable leaf (string or number). String and
 * number array elements become indexed leaves (`items.0`); objects (including
 * objects inside arrays) are recursed into. Booleans/null/undefined and empty
 * containers are skipped — they are not free-text editable in M0.
 */
export function flattenEditable(props: unknown, prefix = ""): EditableField[] {
  const out: EditableField[] = [];

  const visit = (value: unknown, path: string) => {
    if (typeof value === "string" || typeof value === "number") {
      out.push({ path, value, type: typeof value === "number" ? "number" : "string" });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, path ? `${path}.${i}` : String(i)));
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        visit(child, path ? `${path}.${key}` : key);
      }
    }
    // booleans, null, undefined → not editable, skip
  };

  visit(props, prefix);
  return out;
}

const clone = <T>(value: T): T =>
  // structuredClone is available in Node 17+ and all modern browsers.
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

/**
 * Apply a map of dotted-path → new value onto a deep clone of `props`.
 * The original object is never mutated. Each edited value is coerced to the
 * type of the existing leaf, so a numeric field stays a number after editing.
 */
export function applyEdits<T>(props: T, edits: Record<string, string | number>): T {
  const next = clone(props) as unknown as Record<string, unknown> | unknown[];

  for (const [path, raw] of Object.entries(edits)) {
    const keys = path.split(".");
    let cursor: any = next;
    for (let i = 0; i < keys.length - 1; i++) {
      cursor = cursor?.[keys[i]];
      if (cursor == null) break;
    }
    if (cursor == null) continue;
    const leaf = keys[keys.length - 1];
    const existing = cursor[leaf];
    cursor[leaf] = typeof existing === "number" ? Number(raw) : raw;
  }

  return next as unknown as T;
}
