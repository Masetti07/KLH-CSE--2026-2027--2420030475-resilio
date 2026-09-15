import { describe, expect, it } from "vitest";
import type { Design, Structure } from "../types";
import { compareDesigns, defaultDesignConfiguration, floorMaterialPreset, orientationArrow, roomDisplayName, roomSemanticSummary, structureWithEffectiveWallHeight, updateRoomSemantic, wallMaterialPreset } from "./designState";
import { directionalZone, northAlignedPoint, structuralBounds } from "./orientation";

const structure: Structure = {
  id: "plan", source_dimensions: { width: 100, height: 100 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: .8,
  processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "automatic", last_saved_at: null }, wall_height: 3,
  walls: [{ id: "wall", start_x: .1, start_y: .1, end_x: .9, end_y: .1, thickness: .02, confidence: 1 }, { id: "wall-2", start_x: .1, start_y: .9, end_x: .9, end_y: .9, thickness: .02, confidence: 1 }],
  rooms: [{ id: "room", polygon: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }], name: null, type: null, confidence: 1 }],
  openings: [{ id: "door", wall_id: "wall", position: { x: .5, y: .1 }, width: .1, probable_type: "door", confidence: 1 }, { id: "window", wall_id: "wall-2", position: { x: .5, y: .9 }, width: .12, probable_type: "window", confidence: 1 }],
};

describe("design state", () => {
  it("creates renderer-independent defaults for every supported element", () => {
    const config = defaultDesignConfiguration(structure);
    expect(config.wall_appearances.wall.finish).toBe("paint");
    expect(config.floor_appearances.room.finish).toBe("neutral");
    expect(config.door_configurations.door.style).toBe("standard");
    expect(config.window_configurations.window.height).toBe(1.1);
    expect(config.orientation).toBeNull();
  });

  it("maps lightweight material presets to renderer values", () => {
    expect(wallMaterialPreset("concrete_style", "#aaaaaa")).toEqual({ color: "#aaaaaa", roughness: .98, metalness: 0 });
    expect(floorMaterialPreset("marble_style", "#ffffff").roughness).toBe(.24);
  });

  it("compares normalized design configurations", () => {
    const base = defaultDesignConfiguration(structure);
    const a: Design = { id: "a", plan_id: "plan", name: "A", configuration: base, latest_analysis: null, created_at: "", updated_at: "" };
    const changed = structuredClone(base); changed.wall_height = 4; changed.wall_appearances.wall.finish = "wood_panel";
    const b: Design = { ...a, id: "b", name: "B", configuration: changed };
    const rows = compareDesigns(a, b);
    expect(rows.find((row) => row.label === "Wall height")?.changed).toBe(true);
    expect(rows.find((row) => row.label === "Wall finishes")?.changed).toBe(true);
  });

  it("sends the active design wall height to renderer geometry", () => {
    const config = defaultDesignConfiguration(structure); config.wall_height = 4.5;
    expect(structureWithEffectiveWallHeight(structure, config).wall_height).toBe(4.5);
    config.wall_height = 2.5;
    expect(structureWithEffectiveWallHeight(structure, config).wall_height).toBe(2.5);
    expect(structure.wall_height).toBe(3);
  });

  it("updates room name and semantic type in one shared configuration", () => {
    const config = defaultDesignConfiguration(structure);
    const named = updateRoomSemantic(config, "room", { name: "Parents' Room", room_type: "master_bedroom" });
    expect(named.room_semantics.room).toEqual({ name: "Parents' Room", room_type: "master_bedroom" });
    expect(config.room_semantics.room.room_type).toBeNull();
  });

  it("uses custom names, friendly semantic labels, and room fallbacks for plan labels", () => {
    const config = defaultDesignConfiguration(structure);
    expect(roomDisplayName(config, structure.rooms[0], 0)).toBe("Room 1");
    config.room_semantics.room.room_type = "pooja_room";
    expect(roomDisplayName(config, structure.rooms[0], 0)).toBe("Pooja / Prayer Room");
    config.room_semantics.room.name = "Pooja Room";
    expect(roomDisplayName(config, structure.rooms[0], 0)).toBe("Pooja Room");
  });

  it("compares concise semantic room names instead of only assignment counts", () => {
    const config = defaultDesignConfiguration(structure);
    config.room_semantics.room = { name: "Prayer Room", room_type: "pooja_room" };
    expect(roomSemanticSummary(config)).toBe("Prayer Room");
    const designA: Design = { id: "a", plan_id: "plan", name: "A", configuration: defaultDesignConfiguration(structure), latest_analysis: null, created_at: "", updated_at: "" };
    const designB: Design = { ...designA, id: "b", configuration: config };
    const row = compareDesigns(designA, designB).find((item) => item.label === "Room assignments");
    expect(row).toMatchObject({ designA: "None assigned", designB: "Prayer Room", changed: true });
  });
});

describe("orientation mapping", () => {
  it("maps confirmed North directions without rotating structure", () => {
    expect(northAlignedPoint(1, .5, 90)).toEqual({ x: .5, y: 0 });
    expect(orientationArrow(270)).toBe("←");
  });

  it("calculates deterministic normalized zones", () => {
    const bounds = structuralBounds(structure);
    expect(directionalZone({ x: .5, y: .15 }, bounds, 0)).toBe("north");
    expect(directionalZone({ x: .85, y: .15 }, bounds, 0)).toBe("north_east");
    expect(directionalZone({ x: .5, y: .5 }, bounds, 0)).toBe("center");
  });
});
