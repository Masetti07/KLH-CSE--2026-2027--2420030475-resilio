import { afterEach, describe, expect, it, vi } from "vitest";
import { MATERIAL_PATTERN_SPECS, createProceduralTexture, textureRepeat } from "./materialTextures";

afterEach(() => vi.unstubAllGlobals());

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

  it("keeps painted and mineral surfaces matte and nonmetallic", () => {
    expect(MATERIAL_PATTERN_SPECS.paint.roughness).toBeGreaterThanOrEqual(.8);
    for (const finish of ["paint", "tile", "marble_style"] as const) {
      expect(MATERIAL_PATTERN_SPECS[finish].metalness).toBe(0);
    }
  });

  it("draws fine mortar and grout at the existing texture resolution", () => {
    for (const finish of ["brick_style", "tile"] as const) {
      const context = { fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), lineWidth: 0 };
      const canvas = { width: 0, height: 0, getContext: () => context };
      vi.stubGlobal("document", { createElement: () => canvas });
      const texture = createProceduralTexture(finish, "#e8e1d4", 4, 3);
      expect(texture).not.toBeNull();
      expect([canvas.width, canvas.height]).toEqual([128, 128]);
      expect(context.lineWidth).toBeLessThanOrEqual(2);
      expect(context.stroke).toHaveBeenCalled();
      texture?.dispose();
    }
  });

  it("falls back to a plain material without a canvas context", () => {
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
    expect(createProceduralTexture("tile", "#e8e1d4", 4, 3)).toBeNull();
    expect(createProceduralTexture("paint", "#eee9de", 4, 3)).toBeNull();
  });
});
