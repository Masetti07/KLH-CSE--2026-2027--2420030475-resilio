import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Structure } from "../types";
import { defaultDesignConfiguration } from "../utils/designState";
import { addHomeProp, moveHomeProp, offsetWallProp, rotateHomeProp } from "../utils/homeProps";
import PropQuickEdit from "./PropQuickEdit";

const structure: Structure = { id: "p", source_dimensions: { width: 100, height: 100 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: 1,
  processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "manual", last_saved_at: null }, wall_height: 3,
  walls: [{ id: "wall", start_x: .1, start_y: .1, end_x: .9, end_y: .1, thickness: .02, confidence: 1 }],
  rooms: [{ id: "room", polygon: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }], name: "Room", type: null, confidence: 1 }], openings: [] };

describe("near-viewer prop controls", () => {
  it("exposes the room controls and uses the shared configuration helpers", () => {
    const { configuration, prop } = addHomeProp(defaultDesignConfiguration(structure), structure, { kind: "room", id: "room" }, "sofa");
    const html = renderToStaticMarkup(<PropQuickEdit structure={structure} configuration={configuration} selection={{ kind: "prop", id: prop.id }} onChange={() => {}} onSelect={() => {}} />);
    for (const label of ["Selected: Sofa", "Rotate Left", "Rotate Right", "Move prop left", "Delete"]) expect(html).toContain(label);
    expect(rotateHomeProp(configuration, prop.id, 45).props![0].rotation).toBe(45);
    expect(moveHomeProp(configuration, structure, prop.id, { x: .6, y: .5 }).props![0].position.x).toBe(.6);
  });
  it("exposes wall-only controls and hides when nothing is selected", () => {
    const { configuration, prop } = addHomeProp(defaultDesignConfiguration(structure), structure, { kind: "wall", id: "wall" }, "clock");
    const html = renderToStaticMarkup(<PropQuickEdit structure={structure} configuration={configuration} selection={{ kind: "prop", id: prop.id }} onChange={() => {}} onSelect={() => {}} />);
    expect(html).toContain("Move Left"); expect(html).toContain("Move Right"); expect(html).not.toContain("Rotate Left");
    expect(offsetWallProp(configuration, prop.id, .1).props![0].wall_offset).toBe(.6);
    expect(renderToStaticMarkup(<PropQuickEdit structure={structure} configuration={configuration} selection={null} onChange={() => {}} onSelect={() => {}} />)).toBe("");
  });
  it("shows vertical movement controls for wall decor on a vertical wall", () => {
    const vertical = { ...structure, walls: [{ ...structure.walls[0], end_x: .1, end_y: .9 }] };
    const { configuration, prop } = addHomeProp(defaultDesignConfiguration(vertical), vertical, { kind: "wall", id: "wall" }, "painting");
    const html = renderToStaticMarkup(<PropQuickEdit structure={vertical} configuration={configuration} selection={{ kind: "prop", id: prop.id }} onChange={() => {}} onSelect={() => {}} />);
    expect(html).toContain("Move Up"); expect(html).toContain("Move Down");
    expect(html).not.toContain("Move Left"); expect(html).not.toContain("Move Right");
  });
});
