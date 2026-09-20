import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Structure } from "../types";
import { addOpening, addRoom } from "../utils/editState";
import PlanSvg from "./PlanSvg";
import StructureInspector from "./StructureInspector";

const blank: Structure = { id: "blank", source_dimensions: { width: 1000, height: 1000 }, normalized_dimensions: { width: 1, height: 1 }, physical_dimensions: { width_m: 10.2, depth_m: 8, metres_per_normalized_unit: 12.75 }, overall_confidence: 1,
  processing_metadata: { pipeline_version: "starter-1", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "manual", last_saved_at: null }, wall_height: 3,
  walls: [{ id: "boundary-1", start_x: .1, start_y: .18, end_x: .9, end_y: .18, thickness: .012, confidence: 1 }, { id: "boundary-2", start_x: .9, start_y: .18, end_x: .9, end_y: .82, thickness: .012, confidence: 1 }, { id: "boundary-3", start_x: .9, start_y: .82, end_x: .1, end_y: .82, thickness: .012, confidence: 1 }, { id: "boundary-4", start_x: .1, start_y: .82, end_x: .1, end_y: .18, thickness: .012, confidence: 1 }], rooms: [], openings: [] };
const callbacks = { onSelect: () => {}, onChange: () => {} };

describe("blank plan Structure controls", () => {
  it("offers manual room creation and wall-specific door/window actions", () => {
    const html = renderToStaticMarkup(<StructureInspector structure={blank} selection={{ kind: "wall", id: "boundary-1" }} editable {...callbacks} />);
    for (const label of ["Add Room", "Add Door", "Add Window"]) expect(html).toContain(label);
    expect(html).not.toContain("+ Add opening");
  });
  it("renders an editable room and recognizable door/window segments", () => {
    const room = addRoom(blank).structure;
    const withDoor = addOpening(room, "boundary-1", "door").structure;
    const withWindow = addOpening(withDoor, "boundary-2", "window").structure;
    const selected = withWindow.rooms[0].id;
    const plan = renderToStaticMarkup(<PlanSvg structure={withWindow} editable selection={{ kind: "room", id: selected }} {...callbacks} />);
    expect(plan).toContain("Resize room");
    expect(plan).toContain("<path");
    expect(plan).toContain("#1689be");
    const inspector = renderToStaticMarkup(<StructureInspector structure={withWindow} selection={{ kind: "room", id: selected }} editable {...callbacks} />);
    expect(inspector).toContain("Room name"); expect(inspector).toContain("Room type"); expect(inspector).toContain("Delete room");
  });
});
