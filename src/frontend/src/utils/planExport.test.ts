import { describe, expect, it } from "vitest";
import type { Structure } from "../types";
import { planExportSvg } from "./planExport";

const plan: Structure = { id: "p", source_dimensions: { width: 100, height: 100 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: 1,
  processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "manual", last_saved_at: null }, wall_height: 3,
  physical_dimensions: { width_m: 10.2, depth_m: 8, metres_per_normalized_unit: 12.75 },
  walls: [{ id: "wall", start_x: .1, start_y: .2, end_x: .9, end_y: .2, thickness: .01, confidence: 1 }],
  rooms: [{ id: "room", polygon: [{ x: .2, y: .3 }, { x: .4, y: .3 }, { x: .4, y: .5 }, { x: .2, y: .5 }], name: "Living & Study", type: "living_room", confidence: 1 }],
  openings: [{ id: "door", wall_id: "wall", position: { x: .3, y: .2 }, width: .08, probable_type: "door", confidence: 1 }, { id: "window", wall_id: "wall", position: { x: .7, y: .2 }, width: .08, probable_type: "window", confidence: 1 }] };

describe("clean plan export", () => {
  it("serializes current walls, rooms, door, window, and dimensions without editor UI", () => {
    const svg = planExportSvg(plan);
    expect(svg).toContain("10.2 m × 8 m");
    expect(svg).toContain("Living &amp; Study");
    expect(svg).toContain("<polygon");
    expect(svg).toContain("#865837");
    expect(svg).toContain("#327b9b");
    for (const unwanted of ["endpoint-handle", "Vastu", "Inspector", "prop-quick-edit", "selected"]) expect(svg).not.toContain(unwanted);
  });
});
