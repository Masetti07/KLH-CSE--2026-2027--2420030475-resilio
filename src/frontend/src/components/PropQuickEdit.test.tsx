import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Structure } from "../types";
import { defaultDesignConfiguration } from "../utils/designState";
import { addHomeProp, FURNITURE_CATEGORIES, HOME_PROP_CATALOG, moveHomeProp, offsetWallProp, rotateHomeProp } from "../utils/homeProps";
import PropQuickEdit from "./PropQuickEdit";
import HomePropsPanel from "./HomePropsPanel";
import PropSymbols from "./PropSymbols";
import { GLB_FURNITURE, type GlbFurnitureType } from "../utils/glbFurniture";
import { FurnitureBoundary } from "./GlbFurniture";

const structure: Structure = { id: "p", source_dimensions: { width: 100, height: 100 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: 1,
  processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "manual", last_saved_at: null }, wall_height: 3,
  walls: [{ id: "wall", start_x: .1, start_y: .1, end_x: .9, end_y: .1, thickness: .02, confidence: 1 }],
  rooms: [{ id: "room", polygon: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }], name: "Room", type: null, confidence: 1 }], openings: [] };

describe("near-viewer prop controls", () => {
  it.each(Object.keys(GLB_FURNITURE) as GlbFurnitureType[])("offers %s with existing controls and a visible 2D symbol", (type) => {
    const { configuration, prop } = addHomeProp(defaultDesignConfiguration(structure), structure, { kind: "room", id: "room" }, type);
    const selection = { kind: "prop" as const, id: prop.id };
    const callbacks = { onChange: () => {}, onSelect: () => {} };
    const controls = renderToStaticMarkup(<PropQuickEdit structure={structure} configuration={configuration} selection={selection} {...callbacks} />);
    for (const label of ["Rotate Left", "Move prop left", "Delete"]) expect(controls).toContain(label);
    const symbols = renderToStaticMarkup(<svg><PropSymbols props={[prop]} structure={structure} selection={selection} interactive onSelect={() => {}} onPointerDown={() => {}} /></svg>);
    expect(symbols).toContain("<rect"); expect(symbols).toContain('role="button"'); expect(symbols).not.toContain("Kenney");
    const panel = renderToStaticMarkup(<HomePropsPanel structure={structure} configuration={configuration} selection={{ kind: "room", id: "room" }} onShow2D={() => {}} {...callbacks} />);
    for (const name of ["Bathroom Sink", "Bathtub", "Open Bookcase", "TV Cabinet", "Desk Chair"]) expect(panel).toContain(`Add ${name}`);
    for (const category of FURNITURE_CATEGORIES) expect(panel).toContain(`<h4>${category.replaceAll("&", "&amp;")}</h4>`);
    const label = HOME_PROP_CATALOG.find((item) => item.type === type)!.label;
    expect(panel).toContain(`Add ${label}`);
    expect(controls).toContain(`Selected: ${label}`);
    expect(controls).not.toContain("Kenney");
    expect(panel).not.toContain("Kenney");
    expect(panel).not.toContain("Furniture &amp; Decor");
    expect((panel.match(/<article /g) ?? []).length).toBe(32);
    for (const item of HOME_PROP_CATALOG) expect(panel.split(`Add ${item.label}</button>`)).toHaveLength(2);
  });

  it("isolates a failed model behind its local fallback", () => {
    const boundary = new FurnitureBoundary({ children: "model", fallback: "unavailable" });
    expect(boundary.render()).toBe("model");
    boundary.state = FurnitureBoundary.getDerivedStateFromError();
    expect(boundary.render()).toBe("unavailable");
    expect(new FurnitureBoundary({ children: "another model", fallback: "unavailable" }).render()).toBe("another model");
  });
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
