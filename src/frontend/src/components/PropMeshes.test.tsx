import { describe, expect, it, vi } from "vitest";
import { Group, PerspectiveCamera } from "three";
import type { DesignConfiguration, HomeProp, Structure } from "../types";
import { HOME_PROP_CATALOG } from "../utils/homeProps";
import PropMeshes from "./PropMeshes";

const capture = vi.hoisted(() => ({ start: vi.fn(() => true) }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useMemo: (factory: () => unknown) => factory(), useRef: (current: unknown) => ({ current }), useEffect: vi.fn() }));
vi.mock("@react-three/fiber", () => ({ useThree: () => ({ camera: new PerspectiveCamera(), gl: { domElement: {} }, controls: { enabled: true } }) }));
vi.mock("../utils/floorPropDrag", () => ({ createFloorPropDrag: () => ({ start: capture.start, connect: vi.fn() }) }));

const structure = { id: "plan", wall_height: 3, walls: [{ id: "wall", start_x: .1, start_y: .1, end_x: .9, end_y: .1, thickness: .02 }], openings: [], rooms: [{ id: "room", polygon: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }] }] } as unknown as Structure;
const prop = (type: HomeProp["type"], wall = false): HomeProp => ({ id: "prop-1", type, placement_type: wall ? "wall" : "room", room_id: wall ? null : "room", wall_id: wall ? "wall" : null, position: { x: .5, y: .5 }, rotation: 0, wall_offset: .5 });
function render(item: HomeProp, writable = true) {
  capture.start.mockClear();
  const onSelect = vi.fn();
  const element = PropMeshes({ structure, design: { props: [item] } as DesignConfiguration, selection: null, onSelect, performance: false, onDesignChange: writable ? vi.fn() : undefined });
  const group = element.props.children[0];
  const event = { button: 0, eventObject: new Group(), nativeEvent: { preventDefault: vi.fn() }, stopPropagation: vi.fn() };
  return { group, onSelect, event };
}

describe("floor prop drag wiring", () => {
  it.each(HOME_PROP_CATALOG.filter((item) => item.placement === "room"))("selects and starts dragging $label", ({ type }) => {
    const { group, event, onSelect } = render(prop(type));
    group.props.onPointerDown(event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({ kind: "prop", id: "prop-1" });
    expect(capture.start).toHaveBeenCalledWith(event.nativeEvent, "prop-1", event.eventObject, { x: .5, y: .5 }, structure.rooms[0].polygon);
    expect(group.props.position[1]).toBe(.04);
  });
  it.each(["clock", "painting"] as const)("keeps wall-mounted %s click selection and excludes it from dragging", (type) => {
    const { group, event, onSelect } = render(prop(type, true));
    group.props.onPointerDown(event); expect(capture.start).not.toHaveBeenCalled();
    group.props.onClick(event); expect(onSelect).toHaveBeenCalledWith({ kind: "prop", id: "prop-1" });
  });
  it("does not drag read-only views or consume right-pointer gestures", () => {
    const readonly = render(prop("bed"), false); readonly.group.props.onPointerDown(readonly.event);
    expect(capture.start).not.toHaveBeenCalled();
    const right = render(prop("bed")); right.group.props.onPointerDown({ ...right.event, button: 2 });
    expect(capture.start).not.toHaveBeenCalled(); expect(right.event.stopPropagation).not.toHaveBeenCalled();
  });
});
