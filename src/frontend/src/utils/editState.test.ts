import { describe, expect, it } from "vitest";
import { addOpening, addRoom, addStraightWall, addWall, commitHistory, deleteWall, initialHistory, moveRoom, pointOnWall, redoHistory, resizeRoom, translateWall, undoHistory, validCoordinate, wallLengthMetres } from "./editState";
import type { Structure } from "../types";
import { defaultDesignConfiguration } from "./designState";

const structure: Structure = {
  id: "plan", source_dimensions: { width: 100, height: 100 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: 0.8,
  processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} },
  editing_metadata: { revision: 0, modified_by: "automatic", last_saved_at: null }, wall_height: 3,
  walls: [], rooms: [], openings: [],
};

describe("structural edit state", () => {
  it("adds walls and openings to cloned structures", () => {
    const withWall = addWall(structure);
    const withOpening = addOpening(withWall.structure, withWall.structure.walls[0].id);
    expect(structure.walls).toHaveLength(0);
    expect(withOpening.structure.walls).toHaveLength(1);
    expect(withOpening.structure.openings[0].wall_id).toBe(withWall.structure.walls[0].id);
  });

  it("clears opening associations when deleting a wall", () => {
    const withWall = addWall(structure).structure;
    const withOpening = addOpening(withWall, withWall.walls[0].id).structure;
    expect(deleteWall(withOpening, withWall.walls[0].id).openings[0].wall_id).toBeNull();
  });

  it("supports undo and redo", () => {
    const first = initialHistory(structure);
    const second = commitHistory(first, addWall(structure).structure);
    expect(undoHistory(second).present?.walls).toHaveLength(0);
    expect(redoHistory(undoHistory(second)).present?.walls).toHaveLength(1);
  });

  it("rejects non-finite and out-of-bounds coordinates", () => {
    expect(validCoordinate(Number.NaN)).toBe(false);
    expect(validCoordinate(Number.POSITIVE_INFINITY)).toBe(false);
    expect(validCoordinate(-0.1)).toBe(false);
    expect(validCoordinate(1.1)).toBe(false);
    expect(validCoordinate(0.5)).toBe(true);
  });

  it("creates horizontal and vertical straight walls at the requested approximate metre length", () => {
    const physical = { ...structure, physical_dimensions: { width_m: 10, depth_m: 8, metres_per_normalized_unit: 12.5 } };
    for (const orientation of ["horizontal", "vertical"] as const) {
      const wall = addStraightWall(physical, 3, orientation).structure.walls[0];
      expect(wall.id).toMatch(/^straight-wall-/);
      expect(wallLengthMetres(physical, wall)).toBeCloseTo(3);
      expect(orientation === "horizontal" ? wall.start_y === wall.end_y : wall.start_x === wall.end_x).toBe(true);
    }
    expect(() => addStraightWall(physical, 20, "horizontal")).toThrow();
    expect(() => addStraightWall(physical, Number.NaN, "horizontal")).toThrow();
  });

  it("moves a straight wall without changing its endpoints' separation", () => {
    const added = addStraightWall(structure, 3, "horizontal");
    const before = added.structure.walls[0];
    const after = translateWall(added.structure, before.id, .1, .2).walls[0];
    expect(after.start_x - before.start_x).toBeCloseTo(.1);
    expect(after.end_x - before.end_x).toBeCloseTo(.1);
    expect(after.start_y - before.start_y).toBeCloseTo(.2);
    expect(after.end_y - before.end_y).toBeCloseTo(.2);
    expect(after.end_x - after.start_x).toBeCloseTo(before.end_x - before.start_x);
    expect(after.start_y).toBeCloseTo(after.end_y);
  });

  it("adds an editable room inside a blank boundary using the shared structure model", () => {
    const blank: Structure = { ...structure, physical_dimensions: { width_m: 10.2, depth_m: 8, metres_per_normalized_unit: 12.75 }, wall_height: 3,
      walls: [{ id: "boundary-1", start_x: .1, start_y: .18627, end_x: .9, end_y: .18627, thickness: .012, confidence: 1 }, { id: "boundary-2", start_x: .9, start_y: .18627, end_x: .9, end_y: .81373, thickness: .012, confidence: 1 }, { id: "boundary-3", start_x: .9, start_y: .81373, end_x: .1, end_y: .81373, thickness: .012, confidence: 1 }, { id: "boundary-4", start_x: .1, start_y: .81373, end_x: .1, end_y: .18627, thickness: .012, confidence: 1 }] };
    const added = addRoom(blank); const room = added.structure.rooms[0];
    expect(room.id).toMatch(/^manual-room-/);
    expect(defaultDesignConfiguration(added.structure).room_semantics[room.id]).toEqual({ name: null, room_type: null });
    const moved = moveRoom(added.structure, room.id, { x: 10, y: 10 }).rooms[0];
    expect(Math.max(...moved.polygon.map((point) => point.x))).toBeCloseTo(.9);
    expect(Math.max(...moved.polygon.map((point) => point.y))).toBeCloseTo(.81373);
    const resized = resizeRoom(added.structure, room.id, { x: 2, y: 2 }).rooms[0];
    expect(Math.max(...resized.polygon.map((point) => point.x))).toBeCloseTo(.9);
    expect(Math.max(...resized.polygon.map((point) => point.y))).toBeCloseTo(.81373);
    expect(() => addRoom(structure)).toThrow();
  });

  it("adds door and window at the selected wall midpoint and constrains dragging to each wall", () => {
    const horizontal = { id: "h", start_x: .1, start_y: .2, end_x: .9, end_y: .2, thickness: .02, confidence: 1 };
    const vertical = { ...horizontal, id: "v", start_x: .7, start_y: .1, end_x: .7, end_y: .9 };
    const walls = { ...structure, walls: [horizontal, vertical] };
    const door = addOpening(walls, "h", "door").structure.openings[0];
    const window = addOpening(walls, "v", "window").structure.openings[0];
    expect(door).toMatchObject({ wall_id: "h", probable_type: "door", position: { x: .5, y: .2 } });
    expect(window).toMatchObject({ wall_id: "v", probable_type: "window", position: { x: .7, y: .5 } });
    expect(pointOnWall(horizontal, { x: .95, y: .8 }, .08)).toMatchObject({ y: .2 });
    expect(pointOnWall(horizontal, { x: .95, y: .8 }, .08).x).toBeLessThan(.9);
    expect(pointOnWall(vertical, { x: .2, y: .7 }, .08)).toMatchObject({ x: .7 });
    expect(pointOnWall(vertical, { x: .2, y: .7 }, .08).y).toBeCloseTo(.7);
  });
});
