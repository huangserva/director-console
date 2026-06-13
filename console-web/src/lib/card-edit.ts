// v2-P3 · immutable deep-merge for writing structured card fields (layout /
// font / color) back into a scene's props. applyEdits() only rewrites EXISTING
// scalar leaves; these rich fields may not exist yet, so we need a merge that
// creates intermediate objects. Plain objects merge recursively; arrays and
// scalars replace. Never mutates the input.
//
// Mapping to the plan/manifest round-trip (P0):
//   card.layout            ↔ scene.props.layout
//   card.font              ↔ scene.props.style.font
//   card.color             ↔ scene.props.style.color
// So a layout edit is { layout: {...} }, a font edit { style: { font: {...} } }.

type Obj = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function deepMergeProps<T extends Obj>(base: T | undefined, patch: Obj): T {
  const out: Obj = isPlainObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete out[key];
    } else if (isPlainObject(value)) {
      out[key] = deepMergeProps(isPlainObject(out[key]) ? (out[key] as Obj) : undefined, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/** Patch a layout sub-object onto props (creating props.layout if absent). */
export function patchLayout(props: Obj | undefined, layout: Obj): Obj {
  return deepMergeProps(props, { layout });
}

/** Patch props.style.font. */
export function patchFont(props: Obj | undefined, font: Obj): Obj {
  return deepMergeProps(props, { style: { font } });
}

/** Patch props.style.color. */
export function patchColor(props: Obj | undefined, color: Obj): Obj {
  return deepMergeProps(props, { style: { color } });
}

/** Patch props.animation { in, out }. */
export function patchAnimation(props: Obj | undefined, animation: Obj): Obj {
  return deepMergeProps(props, { animation });
}
