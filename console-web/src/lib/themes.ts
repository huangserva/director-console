// v2 风格包: named style themes (pure frontend presets). Applying a theme writes
// color + font onto every card's props (reusing the P3 round-trip slots
// props.style.color / props.style.font), so a plan PUT + recompose restyles all
// cards uniformly.
import type { Manifest } from "./api";
import { patchColor, patchFont } from "./card-edit";

export interface Theme {
  id: string;
  name: string;
  accent: string;
  bg: string;
  text: string;
  titleSize: number;
  bodySize: number;
  weight: string;
}

export const THEMES: Theme[] = [
  { id: "dark-gold", name: "暗金科技", accent: "#e8b23a", bg: "#0d0f12", text: "#f2f4f7", titleSize: 34, bodySize: 17, weight: "bold" },
  { id: "clean", name: "简洁", accent: "#5a8fd8", bg: "#12151a", text: "#e6e8ec", titleSize: 30, bodySize: 16, weight: "medium" },
  { id: "vivid", name: "活力撞色", accent: "#ff5a7a", bg: "#161022", text: "#fdf0f4", titleSize: 36, bodySize: 18, weight: "bold" },
  { id: "calm", name: "沉稳商务", accent: "#3fae8e", bg: "#0e1614", text: "#eaf1ee", titleSize: 28, bodySize: 16, weight: "regular" },
];

export function getTheme(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

/** Apply a theme's color + font to every scene's props (immutable). */
export function applyThemeToManifest(manifest: Manifest, theme: Theme): Manifest {
  const color = { accent: theme.accent, bg: theme.bg, text: theme.text };
  const font = { titleSize: theme.titleSize, bodySize: theme.bodySize, weight: theme.weight };
  return {
    ...manifest,
    scenes: manifest.scenes.map((s) => ({
      ...s,
      props: patchColor(patchFont((s.props ?? {}) as Record<string, unknown>, font), color),
    })),
  };
}
