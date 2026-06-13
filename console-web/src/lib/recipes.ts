import type { Recipe } from "./api";

/**
 * Recommend a recipe from the available input types. We pick the recipe whose
 * REQUIRED inputs are all satisfiable by the inputs the operator already has,
 * preferring the one with the fewest required inputs (the most directly runnable).
 *
 * In practice: with only a video path available, the video-only Route B recipe
 * (`existing-narrated-video`, 1 required input) wins over the digital-human recipe
 * (video + script, 2 required inputs). Returns null when nothing is satisfiable.
 */
export function recommendRecipeId(recipes: Recipe[], availableTypes: Set<string>): string | null {
  const satisfiable = recipes
    .map((recipe) => ({
      id: recipe.id,
      required: recipe.inputRequirements.filter((input) => input.required !== false),
    }))
    .filter((entry) => entry.required.every((input) => availableTypes.has(input.type)));

  if (satisfiable.length === 0) return null;
  satisfiable.sort((a, b) => a.required.length - b.required.length);
  return satisfiable[0].id;
}
