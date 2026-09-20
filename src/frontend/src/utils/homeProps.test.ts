import { describe, expect, it } from "vitest";
import type { Structure } from "../types";
import { defaultDesignConfiguration, reconcileDesignConfiguration } from "./designState";
import { addHomeProp, deleteHomeProp, HOME_PROP_CATALOG, homePropPosition, moveHomeProp, moveWallProp, offsetWallProp, PROP_DIMENSIONS, rotateHomeProp, wallInteriorSide, wallMountYaw, wallMoveControls } from "./homeProps";
import { newFileResetState } from "./sessionState";

const structure: Structure = {
  id: "plan", source_dimensions: { width: 100, height: 100 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: 1,
  processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "automatic", last_saved_at: null }, wall_height: 3,
  walls: [{ id: "wall", start_x: .1, start_y: .1, end_x: .9, end_y: .1, thickness: .02, confidence: 1 }],
  rooms: [{ id: "room", polygon: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }], name: "Room", type: null, confidence: 1 }], openings: [],
};

describe("home props", () => {
  it("offers exactly eight props in wall and room categories", () => {
    expect(HOME_PROP_CATALOG.map((item) => item.type)).toEqual(["clock", "painting", "bed", "sofa", "table", "armchair", "cupboard", "flower_vase"]);
    expect(HOME_PROP_CATALOG.filter((item) => item.placement === "wall")).toHaveLength(2);
    expect(Object.keys(PROP_DIMENSIONS).sort()).toEqual(HOME_PROP_CATALOG.map((item) => item.type).sort());
    expect(PROP_DIMENSIONS.bed.width).toBeGreaterThan(PROP_DIMENSIONS.flower_vase.width);
    expect(PROP_DIMENSIONS.sofa.width).toBeGreaterThan(PROP_DIMENSIONS.armchair.width);
  });

  it("adds movable furniture without changing structure or Vastu inputs", () => {
    const config = defaultDesignConfiguration(structure); const original = JSON.stringify(structure);
    const { configuration, prop } = addHomeProp(config, structure, { kind: "room", id: "room" }, "bed");
    expect(prop).toMatchObject({ room_id: "room", wall_id: null, position: { x: .5, y: .5 } });
    const moved = moveHomeProp(configuration, structure, prop.id, { x: 2, y: -1 });
    expect(moved.props?.[0].position).toEqual({ x: .9, y: .1 });
    expect(rotateHomeProp(moved, prop.id, -45).props?.[0].rotation).toBe(315);
    expect(moved.orientation).toBe(config.orientation);
    expect(moved.room_semantics).toEqual(config.room_semantics);
    expect(JSON.stringify(structure)).toBe(original);
    expect(deleteHomeProp(moved, prop.id).props).toEqual([]);
  });

  it("anchors wall decor and rejects a mismatched selection", () => {
    const config = defaultDesignConfiguration(structure);
    expect(() => addHomeProp(config, structure, { kind: "room", id: "room" }, "clock")).toThrow("Select a wall");
    const { configuration, prop } = addHomeProp(config, structure, { kind: "wall", id: "wall" }, "clock");
    expect(prop).toMatchObject({ placement_type: "wall", wall_id: "wall", room_id: null });
    expect(homePropPosition(prop, structure)).toEqual({ x: .5, y: .1 });
    const shifted = offsetWallProp(configuration, prop.id, .2);
    expect(homePropPosition(shifted.props![0], structure).x).toBeCloseTo(.66);
    expect(offsetWallProp(shifted, prop.id, 5).props![0].wall_offset).toBe(.9);
    const dragged = moveWallProp(configuration, structure, prop.id, { x: .7, y: .8 });
    expect(homePropPosition(dragged.props![0], structure).x).toBeCloseTo(.7);
    expect(homePropPosition(dragged.props![0], structure).y).toBeCloseTo(.1);
    const vertical = { ...structure, walls: [{ ...structure.walls[0], start_x: .2, end_x: .2, start_y: .1, end_y: .9 }] };
    const verticalDrag = moveWallProp(configuration, vertical, prop.id, { x: .8, y: .7 });
    expect(homePropPosition(verticalDrag.props![0], vertical).x).toBe(.2);
    expect(homePropPosition(verticalDrag.props![0], vertical).y).toBeCloseTo(.7);
  });

  it("recovers serialized props and removes stale associations", () => {
    const config = addHomeProp(defaultDesignConfiguration(structure), structure, { kind: "room", id: "room" }, "sofa").configuration;
    expect(reconcileDesignConfiguration(JSON.parse(JSON.stringify(config)), structure).props).toHaveLength(1);
    expect(reconcileDesignConfiguration(config, { ...structure, rooms: [] }).props).toEqual([]);
    expect(newFileResetState().designConfiguration).toBeNull();
  });

  it("faces wall decor into the room for every outer wall direction", () => {
    const walls = [
      { ...structure.walls[0], id: "top" },
      { ...structure.walls[0], id: "right", start_x: .9, start_y: .9, end_x: .9, end_y: .1 },
      { ...structure.walls[0], id: "bottom", start_x: .9, start_y: .9, end_x: .1, end_y: .9 },
      { ...structure.walls[0], id: "left", start_x: .1, start_y: .9, end_x: .1, end_y: .1 },
    ];
    const plan = { ...structure, walls };
    for (const wall of walls) {
      const yaw = wallMountYaw(plan, wall);
      const center = { x: (wall.start_x + wall.end_x) / 2, y: (wall.start_y + wall.end_y) / 2 };
      expect(Math.sin(yaw) * (.5 - center.x) + Math.cos(yaw) * (.5 - center.y)).toBeGreaterThan(0);
      expect([-1, 1]).toContain(wallInteriorSide(plan, wall));
    }
    expect(wallInteriorSide({ ...plan, rooms: [] }, walls[0])).toBe(1);
    const insideWall = { ...walls[0], id: "inside", start_y: .5, end_y: .5 };
    expect(wallInteriorSide({ ...plan, walls: [...walls, insideWall] }, insideWall)).toBe(1);
    expect(Number.isFinite(wallMountYaw({ ...plan, walls: [...walls, insideWall] }, insideWall))).toBe(true);
  });

  it("maps wall movement labels to visible directions even with reversed endpoints", () => {
    for (const [wall, expectedAxis] of [
      [structure.walls[0], "x"],
      [{ ...structure.walls[0], start_x: .9, end_x: .1 }, "x"],
      [{ ...structure.walls[0], start_x: .2, end_x: .2, end_y: .9 }, "y"],
      [{ ...structure.walls[0], start_x: .2, end_x: .2, start_y: .9, end_y: .1 }, "y"],
    ] as const) {
      const plan = { ...structure, walls: [wall] };
      const { configuration, prop } = addHomeProp(defaultDesignConfiguration(plan), plan, { kind: "wall", id: "wall" }, "painting");
      const [negative, positive] = wallMoveControls(wall);
      expect([negative.label, positive.label]).toEqual(expectedAxis === "x" ? ["Move Left", "Move Right"] : ["Move Up", "Move Down"]);
      const before = homePropPosition(prop, plan)[expectedAxis];
      expect(homePropPosition(offsetWallProp(configuration, prop.id, negative.amount).props![0], plan)[expectedAxis]).toBeLessThan(before);
      expect(homePropPosition(offsetWallProp(configuration, prop.id, positive.amount).props![0], plan)[expectedAxis]).toBeGreaterThan(before);
      expect(prop.wall_offset).toBe(.5);
    }
  });
});
