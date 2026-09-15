import { describe, expect, it } from "vitest";
import { addOpening, addWall, commitHistory, deleteWall, initialHistory, redoHistory, undoHistory, validCoordinate } from "./editState";
import type { Structure } from "../types";

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
});
