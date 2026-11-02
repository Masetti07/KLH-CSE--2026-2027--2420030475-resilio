import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Structure } from "../types";
import ThreeViewer from "./ThreeViewer";
import { ExtrudeGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import fixtures from "../utils/roomFloor.fixtures.json";
import boundaries from "../utils/roomFloor.boundaries.json";
import { roomFloor, roomFloorFootprint } from "../utils/roomFloor";
import { normalizedToWorld } from "../utils/geometry";
import { dropOpeningOnWall } from "../utils/editState";

const capture = vi.hoisted(() => ({ canvas: null as Record<string, any> | null }));
vi.mock("@react-three/fiber", () => ({
  Canvas: (props: Record<string, any>) => { capture.canvas = props; return null; },
  useFrame: vi.fn(), useThree: vi.fn(),
}));

const structure = {
  id: "viewer-test", wall_height: 3, walls: [], openings: [],
  rooms: [{ id: "room", polygon: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }] }],
} as unknown as Structure;
const props = { structure, selection: null, onSelect: vi.fn(), fullscreen: false, onToggleFullscreen: vi.fn() };

describe("3D viewer visual quality", () => {
  it.each([
    ["door", false], ["door", true], ["window", false], ["window", true],
  ] as const)("preserves %s placement, selection and dimensions on vertical=%s walls", (kind, vertical) => {
    const wall = { id: "wall", start_x: .2, start_y: .2, end_x: vertical ? .2 : .8, end_y: vertical ? .8 : .2, thickness: .02, confidence: 1 };
    const opening = { id: "opening", wall_id: wall.id, position: { x: vertical ? .2 : .5, y: vertical ? .5 : .2 }, width: .1, probable_type: kind, confidence: 1 };
    const otherWall = { ...wall, id: "previous-wall", start_x: vertical ? .1 : .7, end_x: vertical ? .9 : .7, start_y: vertical ? .7 : .1, end_y: vertical ? .7 : .9 };
    const original = { ...structure, walls: [wall, otherWall], openings: [{ ...opening, wall_id: otherWall.id, position: vertical ? { x: .5, y: .7 } : { x: .7, y: .5 } }] } as Structure;
    const model = dropOpeningOnWall(original, opening.id, opening.position, .02);
    expect(model.openings).toHaveLength(1);
    expect(model.openings[0].wall_id).toBe(wall.id);
    const before = JSON.stringify(model), onSelect = vi.fn();
    renderToStaticMarkup(<ThreeViewer {...props} structure={model} selection={{ kind: "opening", id: opening.id }} onSelect={onSelect} />);
    const scene = capture.canvas!.children as ReactElement<any>;
    const children = (scene.type as Function)(scene.props).props.children;
    const group = children.filter(Array.isArray).flat().find((child: any) => child?.key === "opening");
    const panels = group.props.children;
    expect(panels).toHaveLength(1);
    const [geometry, material, details] = panels[0].props.children;
    expect(geometry.props.args).toEqual([1, kind === "door" ? 2.1 : 1.1, .22]);
    expect(material.props.color).toBe("#ff8b30");
    expect(details.props).toMatchObject({ kind, width: 1, depth: .22, selected: true, sill: kind === "door" ? 0 : 1 });
    expect(group.props.rotation[1]).toBeCloseTo(vertical ? -Math.PI / 2 : 0);
    const point = normalizedToWorld(opening.position);
    expect(group.props.position).toEqual([point.x, kind === "door" ? 1.05 : 1.55, point.z]);
    const stopPropagation = vi.fn(); group.props.onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled(); expect(onSelect).toHaveBeenCalledWith({ kind: "opening", id: "opening" });
    expect(JSON.stringify(model)).toBe(before);
  });
  it.each(["NORMAL", "PERFORMANCE"] as const)("retains the %s rendering budget", (renderingQuality) => {
    const html = renderToStaticMarkup(<ThreeViewer {...props} renderingQuality={renderingQuality} />);
    const canvas = capture.canvas!;
    const normal = renderingQuality === "NORMAL";
    expect(canvas.shadows).toBe(normal ? "soft" : false);
    expect(canvas.dpr).toEqual(normal ? [1, 1.75] : 1);
    const scene = canvas.children as ReactElement<any>;
    const children = (scene.type as Function)(scene.props).props.children;
    const light = children.find((child: ReactElement) => child?.type === "directionalLight");
    expect(light.props.castShadow).toBe(normal);
    expect(light.props["shadow-mapSize-width"]).toBe(normal ? 1024 : 256);
    expect(light.props["shadow-camera-far"]).toBeGreaterThan(light.props.position[1]);
    const rooms = children.find((child: unknown) => Array.isArray(child) && child.length);
    expect(rooms[0].props.receiveShadow).toBe(normal);
    for (const label of ["Reset", "Top", "3D / Perspective", "Fullscreen 3D"]) expect(html).toContain(label);
  });

  it("keeps the unavailable renderer fallback free of a canvas", () => {
    capture.canvas = null;
    const html = renderToStaticMarkup(<ThreeViewer {...props} available={false} />);
    expect(html).toContain("3D rendering is temporarily unavailable");
    expect(capture.canvas).toBeNull();
  });
});

// Captured from the local sample processor and one_bedroom starter factory.
// Expected changes are limited to independently identified doorway contour runs.
describe.each(Object.entries(fixtures))("room floor boundaries: %s", (_name, rooms) => {
  it.each(rooms)("keeps selection and ray hits inside $id's polygon", (room) => {
    const onSelect = vi.fn();
    const model = { ...structure, rooms, ...boundaries[_name as keyof typeof boundaries] } as unknown as Structure;
    const before = JSON.stringify(model);
    renderToStaticMarkup(<ThreeViewer {...props} structure={model} selection={{ kind: "room", id: room.id }} onSelect={onSelect} />);
    const scene = capture.canvas!.children as ReactElement<any>;
    const children = (scene.type as Function)(scene.props).props.children;
    const floors = children.find((child: unknown) => Array.isArray(child) && child.length);
    expect(floors).toHaveLength(4);
    for (let index = 0; index < floors.length; index++) {
      const material = floors[index].props.children[1];
      expect(material.props.selected).toBe(rooms[index].id === room.id);
      expect(material.props.color).toBe("#e8e1d4");
    }
    const floor = floors[rooms.indexOf(room)];
    expect(floor.props.children[0].type).toBe("extrudeGeometry");
    const geometry = new ExtrudeGeometry(...floor.props.children[0].props.args as [any, any]);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...floor.props.position as [number, number, number]);
    mesh.rotation.set(...floor.props.rotation as [number, number, number]);
    mesh.scale.set(...floor.props.scale as [number, number, number]);
    mesh.updateMatrixWorld(true);
    const retained = _name === "sample_compact_2bed" ? ({ "room-2": [0, 1, 2, 3, 5], "room-3": [1, 2, 3, 4, 5], "room-4": [0, 1, 2, 3, 5] } as Record<string, number[]>)[room.id] : undefined;
    const polygon = retained ? retained.map((index) => room.polygon[index]) : room.polygon;
    expect(roomFloorFootprint(room.polygon, model.walls, model.openings)).toEqual(polygon);
    const inside = (x: number, y: number) => {
      let result = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) result = !result;
      }
      return result;
    };
    // Sample the whole plan, including adjacent rooms and the old bounding-box excess.
    for (let x = .105; x < .91; x += .02) for (let y = .107; y < .91; y += .02) {
      const world = normalizedToWorld({ x, y });
      const hits = new Raycaster(new Vector3(world.x, 10, world.z), new Vector3(0, -1, 0)).intersectObject(mesh);
      expect(hits.length > 0, `${room.id} at ${x},${y}`).toBe(inside(x, y));
      if (hits.length) expect(hits[0].point.y).toBeCloseTo(.0325);
    }
    const stopPropagation = vi.fn();
    floor.props.onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({ kind: "room", id: room.id });
    expect(JSON.stringify(model)).toBe(before);
    geometry.dispose(); material.dispose();
  });
});

describe("room floor conversion", () => {
  const sample = boundaries.sample_compact_2bed as unknown as Pick<Structure, "walls" | "openings">;
  const area = (points: { x: number; y: number }[]) => Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - point.y * next.x;
  }, 0)) / 2;

  it("preserves genuine L-shaped geometry and area away from a doorway", () => {
    const polygon = [{ x: .46, y: .51 }, { x: .69, y: .51 }, { x: .69, y: .65 }, { x: .57, y: .65 }, { x: .57, y: .87 }, { x: .46, y: .87 }];
    const derived = roomFloorFootprint(polygon, sample.walls, sample.openings);
    expect(derived).toBe(polygon);
    expect(area(derived)).toBeCloseTo(.23 * .14 + .11 * .22);
  });

  it("preserves a real wall-backed doorway recess instead of flattening every concavity", () => {
    const polygon = [{ x: .45625, y: .483824 }, { x: .557292, y: .483824 }, { x: .57, y: .42 }, { x: .616667, y: .483824 }, { x: .9, y: .483824 }, { x: .9, y: .12 }, { x: .45625, y: .12 }];
    const walls = [...sample.walls, { ...sample.walls[0], id: "recess-wall", start_x: .57, end_x: .57, start_y: .42, end_y: .483824 }];
    const derived = roomFloorFootprint(polygon, walls, sample.openings.filter((opening) => opening.id === "opening-5"));
    expect(derived).toBe(polygon);
    expect(area(derived)).toBe(area(polygon));
  });

  it("leaves ambiguous boundaries and non-door openings unchanged", () => {
    const polygon = fixtures.sample_compact_2bed[2].polygon;
    expect(roomFloorFootprint(polygon, sample.walls.filter((wall) => wall.id !== "wall-5"), sample.openings)).toBe(polygon);
    expect(roomFloorFootprint(polygon, sample.walls, sample.openings.map((opening) => ({ ...opening, probable_type: "window" })))).toBe(polygon);
    expect(roomFloorFootprint(polygon, [], [])).toBe(polygon);
  });

  it("preserves physical scale and does not expand a small room to a minimum box", () => {
    const polygon = [{ x: .5, y: .5 }, { x: .501, y: .5 }, { x: .501, y: .502 }, { x: .5, y: .502 }];
    const floor = roomFloor(polygon, 20)!;
    expect(floor.width).toBeCloseTo(.02); expect(floor.depth).toBeCloseTo(.04);
    expect(floor.position).toEqual([0, -.0025, expect.closeTo(.04)]);
    for (const point of floor.shape.getPoints()) {
      expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(1);
    }
  });

  it("omits incomplete or invalid outlines safely", () => {
    expect(roomFloor([], 10)).toBeNull();
    expect(roomFloor([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }], 10)).toBeNull();
    expect(roomFloor([{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 1, y: 2 }], 10)).toBeNull();
  });
});
