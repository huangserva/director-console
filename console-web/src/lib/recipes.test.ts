import { describe, expect, it } from "vitest";
import type { Recipe } from "./api";
import { recommendRecipeId } from "./recipes";

const existingNarrated: Recipe = {
  id: "existing-narrated-video",
  name: "Existing Narrated Video",
  description: "",
  inputRequirements: [{ id: "source-video", type: "video", required: true, description: "" }],
  stages: [],
  recommendedComponents: [],
};

const digitalHuman: Recipe = {
  id: "digital-human-talking-head",
  name: "Digital Human Talking Head",
  description: "",
  inputRequirements: [
    { id: "presenter-video", type: "video", required: true, description: "" },
    { id: "script-or-topic", type: "text", required: true, description: "" },
  ],
  stages: [],
  recommendedComponents: [],
};

const recipes = [digitalHuman, existingNarrated]; // order shouldn't matter

describe("recommendRecipeId", () => {
  it("recommends the video-only recipe when only a video path is available", () => {
    expect(recommendRecipeId(recipes, new Set(["video"]))).toBe("existing-narrated-video");
  });

  it("recommends the recipe whose required inputs are fully satisfiable, preferring fewest", () => {
    // both satisfiable → fewer required inputs wins
    expect(recommendRecipeId(recipes, new Set(["video", "text"]))).toBe("existing-narrated-video");
  });

  it("returns null when no recipe is fully satisfiable", () => {
    expect(recommendRecipeId(recipes, new Set([]))).toBeNull();
    expect(recommendRecipeId(recipes, new Set(["text"]))).toBeNull();
  });

  it("returns null for an empty recipe list", () => {
    expect(recommendRecipeId([], new Set(["video"]))).toBeNull();
  });
});
