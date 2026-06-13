// Tiny pure helpers for a controlled add/remove list of strings (e.g. selling
// points, optional media paths). Immutable — each returns a new array.

export function addItem(list: string[], value = ""): string[] {
  return [...list, value];
}

export function removeItem(list: string[], index: number): string[] {
  return list.filter((_, i) => i !== index);
}

export function setItem(list: string[], index: number, value: string): string[] {
  return list.map((v, i) => (i === index ? value : v));
}

/** Trim and drop empties — what gets sent to the API. */
export function compact(list: string[]): string[] {
  return list.map((v) => v.trim()).filter((v) => v !== "");
}
