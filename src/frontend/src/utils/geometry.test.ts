import { describe, expect, it } from "vitest";
import { cameraFrame, modelBounds, normalizedToWorld, openingTransform, wallAngle, wallLength, wallMidpoint } from "./geometry";
import type { Opening, Structure, Wall } from "../types";

const wall: Wall = { id: "wall-1", start_x: 0.1, start_y: 0.2, end_x: 0.9, end_y: 0.2, thickness: 0.02, confidence: 0.8 };

describe("normalized 2D to Three.js conversion", () => {
  it("maps plan center to the world origin", () => {
    expect(normalizedToWorld({ x: 0.5, y: 0.5 })).toEqual({ x: 0, z: 0 });
  });

  it("calculates wall length, midpoint, and angle", () => {
    expect(wallLength(wall)).toBeCloseTo(8);
    expect(wallMidpoint(wall)).toEqual({ x: 0, z: -3 });
    expect(wallAngle(wall)).toBeCloseTo(0);
  });

  it("transforms openings using their associated wall", () => {
    const opening: Opening = { id: "opening-1", wall_id: wall.id, position: { x: 0.5, y: 0.2 }, width: 0.1, probable_type: "window", confidence: 0.7 };
    expect(openingTransform(opening, wall)).toMatchObject({ x: 0, z: -3, width: 1, angle: 0, sillHeight: 1, height: 1.1 });
  });
});

function sampleStructure(id: string, inset: number, wallHeight: number): Structure {
  const walls: Wall[] = [
    { ...wall, id: `${id}-north`, start_x: inset, start_y: inset, end_x: 1 - inset, end_y: inset },
    { ...wall, id: `${id}-east`, start_x: 1 - inset, start_y: inset, end_x: 1 - inset, end_y: 1 - inset },
    { ...wall, id: `${id}-south`, start_x: 1 - inset, start_y: 1 - inset, end_x: inset, end_y: 1 - inset },
    { ...wall, id: `${id}-west`, start_x: inset, start_y: 1 - inset, end_x: inset, end_y: inset },
  ];
  return {
    id, source_dimensions: { width: 1200, height: 900 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: .8,
    processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} },
    editing_metadata: { revision: 0, modified_by: "automatic", last_saved_at: null },
    wall_height: wallHeight, walls, rooms: [], openings: [],
  };
}

describe.each([
  ["sample_simple_1bed", .12, 2.6],
  ["sample_compact_2bed", .07, 3.0],
  ["sample_family_house", .025, 3.8],
])("adaptive camera framing for %s", (id, inset, height) => {
  it("centers model bounds and produces usable top and perspective distances", () => {
    const bounds = modelBounds(sampleStructure(id, inset, height));
    const perspective = cameraFrame(bounds, 16 / 9, "perspective");
    const top = cameraFrame(bounds, 16 / 9, "top");
    expect(perspective.target[0]).toBeCloseTo(bounds.center.x);
    expect(perspective.target[2]).toBeCloseTo(bounds.center.z);
    expect(top.position[0]).toBeCloseTo(bounds.center.x);
    expect(top.position[2]).toBeCloseTo(bounds.center.z, 2);
    expect(perspective.maxDistance).toBeGreaterThan(perspective.minDistance);
    expect(top.position[1]).toBeGreaterThan(bounds.maxY);
    expect(perspective.near).toBeGreaterThan(0);
    expect(perspective.far).toBeGreaterThan(perspective.position[1]);
  });
});
