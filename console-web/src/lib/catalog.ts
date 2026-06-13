// The locked component vocabulary, imported straight from the composer so the
// editor constrains scene_type to exactly what the renderer accepts. Through M2 we
// only edited text; M4 adds inserting whole scenes, still only from this catalog.
import catalog from "../../../hyperframes-composer/components/catalog.json";

export interface CatalogComponent {
  id: string;
  sceneTypes: string[];
  purpose: string;
  requiredProps?: string[];
}

const components: CatalogComponent[] = (catalog as any).coarseSceneComponents ?? [];

const byId = new Map(components.map((c) => [c.id, c]));

export function getComponent(id: string | undefined): CatalogComponent | undefined {
  return id ? byId.get(id) : undefined;
}

/** Allowed scene_type values for a given component id (empty if unknown). */
export function allowedSceneTypes(componentId: string | undefined): string[] {
  return getComponent(componentId)?.sceneTypes ?? [];
}

/** Every coarse-scene component the catalog allows (the insertable component vocabulary). */
export function listCatalogComponents(): CatalogComponent[] {
  return components;
}

export const catalogVersion: string = (catalog as any).version ?? "unknown";
