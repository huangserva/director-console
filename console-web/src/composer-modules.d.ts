// The composer ships plain .mjs without type declarations. We import its validator
// in tests to assert inserted scenes pass the real anti-drift rules. Minimal ambient
// types so tsc is happy without pulling the composer into the build.
declare module "*/manifest-rules.mjs" {
  export function validateManifest(
    manifest: unknown,
    opts?: { root?: string; manifestPath?: string; checkMedia?: boolean },
  ): string[];
  export function loadJson(filePath: string): unknown;
}

declare module "*/registry.mjs" {
  export function renderScene(scene: unknown): string;
  export const registry: Record<string, { id: string; sceneTypes: string[]; render: (scene: unknown) => string }>;
}
