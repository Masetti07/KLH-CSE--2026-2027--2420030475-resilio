import { describe, expect, it } from "vitest";
import { MATERIAL_PATTERN_SPECS, textureRepeat } from "./materialTextures";

describe("procedural material mappings", () => {
  it("maps every wall preset to a distinct appearance specification", () => {
    const finishes = ["paint", "brick_style", "wood_panel", "concrete_style"] as const;
    expect(new Set(finishes.map((finish) => JSON.stringify(MATERIAL_PATTERN_SPECS[finish]))).size).toBe(finishes.length);
  });

  it("maps every floor preset to a distinct appearance specification", () => {
    const finishes = ["wood", "tile", "marble_style", "concrete", "neutral"] as const;
    expect(new Set(finishes.map((finish) => JSON.stringify(MATERIAL_PATTERN_SPECS[finish]))).size).toBe(finishes.length);
  });

  it("repeats patterns more often on longer surfaces without sub-unit repeats", () => {
    expect(textureRepeat("brick_style", 8, 3)[0]).toBeGreaterThan(textureRepeat("brick_style", 2, 3)[0]);
    expect(textureRepeat("wood", .1, .1)).toEqual([1, 1]);
  });
});
