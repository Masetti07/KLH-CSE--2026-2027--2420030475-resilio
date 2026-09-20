import type { DesignConfiguration, HomeProp, HomePropType, Point, Selection, Structure, Wall } from "../types";
import { wallAngle, worldScale } from "./geometry";
import { pointOnWall } from "./editState";

export const HOME_PROP_CATALOG: { type: HomePropType; label: string; placement: "room" | "wall"; icon: string }[] = [
  { type: "clock", label: "Clock", placement: "wall", icon: "◷" },
  { type: "painting", label: "Painting", placement: "wall", icon: "▧" },
  { type: "bed", label: "Bed", placement: "room", icon: "▤" },
  { type: "sofa", label: "Sofa", placement: "room", icon: "▱" },
  { type: "table", label: "Table", placement: "room", icon: "◯" },
  { type: "armchair", label: "Armchair", placement: "room", icon: "▢" },
  { type: "cupboard", label: "Cupboard", placement: "room", icon: "▥" },
  { type: "flower_vase", label: "Flower Vase", placement: "room", icon: "✿" },
];

export const PROP_DIMENSIONS: Record<HomePropType, { width: number; depth: number; height: number }> = {
  clock: { width: .48, depth: .12, height: .48 }, painting: { width: .9, depth: .1, height: .65 },
  bed: { width: 1.75, depth: 2.15, height: .85 }, sofa: { width: 2.05, depth: .95, height: .9 },
  table: { width: 1.25, depth: 1.25, height: .78 }, armchair: { width: .88, depth: .88, height: .95 },
  cupboard: { width: 1.4, depth: .58, height: 2.05 }, flower_vase: { width: .38, depth: .38, height: .85 },
};

const roomBounds = (room: Structure["rooms"][number]) => ({
  minX: Math.min(...room.polygon.map((point) => point.x)), maxX: Math.max(...room.polygon.map((point) => point.x)),
  minY: Math.min(...room.polygon.map((point) => point.y)), maxY: Math.max(...room.polygon.map((point) => point.y)),
});
const replaceProp = (configuration: DesignConfiguration, propId: string, update: (prop: HomeProp) => HomeProp): DesignConfiguration => ({
  ...configuration, props: (configuration.props ?? []).map((prop) => prop.id === propId ? update(prop) : prop),
});

function pointInRoom(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function wallInteriorSide(structure: Structure, wall: Wall): 1 | -1 {
  const dx = wall.end_x - wall.start_x, dy = wall.end_y - wall.start_y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-8) return 1;
  const midpoint = { x: (wall.start_x + wall.end_x) / 2, y: (wall.start_y + wall.end_y) / 2 };
  const normal = { x: -dy / length, y: dx / length };
  const distance = Math.max(.008, wall.thickness * .8);
  const sample = (sign: number): Point => ({ x: midpoint.x + normal.x * distance * sign, y: midpoint.y + normal.y * distance * sign });
  const coverage = (point: Point) => structure.rooms.filter((room) => pointInRoom(point, room.polygon)).length;
  const plus = coverage(sample(1)), minus = coverage(sample(-1));
  if (plus !== minus) return plus > minus ? 1 : -1;
  const centers = structure.rooms.map((room) => ({ x: room.polygon.reduce((sum, point) => sum + point.x, 0) / room.polygon.length, y: room.polygon.reduce((sum, point) => sum + point.y, 0) / room.polygon.length }));
  const nearest = centers.sort((a, b) => Math.hypot(a.x - midpoint.x, a.y - midpoint.y) - Math.hypot(b.x - midpoint.x, b.y - midpoint.y))[0];
  const points = structure.walls.flatMap((item) => [{ x: item.start_x, y: item.start_y }, { x: item.end_x, y: item.end_y }]);
  const interior = nearest ?? (points.length ? { x: (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2, y: (Math.min(...points.map((point) => point.y)) + Math.max(...points.map((point) => point.y))) / 2 } : midpoint);
  const direction = (interior.x - midpoint.x) * normal.x + (interior.y - midpoint.y) * normal.y;
  return direction < -1e-8 ? -1 : 1;
}

export function wallMountYaw(structure: Structure, wall: Wall): number {
  return -wallAngle(wall) + (wallInteriorSide(structure, wall) === -1 ? Math.PI : 0);
}

export function wallMoveControls(wall: Wall | undefined): [{ label: string; amount: number }, { label: string; amount: number }] {
  if (!wall || Math.abs(wall.end_x - wall.start_x) >= Math.abs(wall.end_y - wall.start_y)) {
    const direction = !wall || wall.end_x >= wall.start_x ? 1 : -1;
    return [{ label: "Move Left", amount: -.1 * direction }, { label: "Move Right", amount: .1 * direction }];
  }
  const direction = wall.end_y >= wall.start_y ? 1 : -1;
  return [{ label: "Move Up", amount: -.1 * direction }, { label: "Move Down", amount: .1 * direction }];
}

export function addHomeProp(configuration: DesignConfiguration, structure: Structure, selection: Selection, type: HomePropType): { configuration: DesignConfiguration; prop: HomeProp } {
  const catalogue = HOME_PROP_CATALOG.find((item) => item.type === type)!;
  if (!selection || selection.kind !== catalogue.placement) throw new Error(`Select a ${catalogue.placement} before adding ${catalogue.label}.`);
  const room = catalogue.placement === "room" ? structure.rooms.find((item) => item.id === selection.id) : undefined;
  const wall = catalogue.placement === "wall" ? structure.walls.find((item) => item.id === selection.id) : undefined;
  if (catalogue.placement === "room" && !room || catalogue.placement === "wall" && !wall) throw new Error("The selected structural element is no longer available.");
  const existing = new Set((configuration.props ?? []).map((item) => item.id));
  let counter = 1; while (existing.has(`prop-${counter}`)) counter++;
  const bounds = room ? roomBounds(room) : null;
  const position: Point = bounds ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
    : { x: (wall!.start_x + wall!.end_x) / 2, y: (wall!.start_y + wall!.end_y) / 2 };
  const prop: HomeProp = { id: `prop-${counter}`, type, placement_type: catalogue.placement, room_id: room?.id ?? null, wall_id: wall?.id ?? null, position, rotation: 0, wall_offset: .5 };
  return { configuration: { ...configuration, props: [...(configuration.props ?? []), prop] }, prop };
}

export function homePropPosition(prop: HomeProp, structure: Structure): Point {
  if (prop.placement_type !== "wall") return prop.position;
  const wall = structure.walls.find((item) => item.id === prop.wall_id);
  return wall ? { x: wall.start_x + (wall.end_x - wall.start_x) * prop.wall_offset, y: wall.start_y + (wall.end_y - wall.start_y) * prop.wall_offset } : prop.position;
}

export function roomPropScale(prop: HomeProp, structure: Structure): number {
  if (prop.placement_type !== "room") return 1;
  const room = structure.rooms.find((item) => item.id === prop.room_id);
  if (!room) return 1;
  const bounds = roomBounds(room); const size = PROP_DIMENSIONS[prop.type];
  const scale = worldScale(structure);
  return Math.min(1, Math.max(.05, .78 * (bounds.maxX - bounds.minX) * scale / size.width), Math.max(.05, .78 * (bounds.maxY - bounds.minY) * scale / size.depth));
}

export function moveHomeProp(configuration: DesignConfiguration, structure: Structure, propId: string, point: Point): DesignConfiguration {
  return replaceProp(configuration, propId, (prop) => {
    if (prop.placement_type !== "room" || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return prop;
    const room = structure.rooms.find((item) => item.id === prop.room_id);
    if (!room) return prop;
    const bounds = roomBounds(room);
    return { ...prop, position: { x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)), y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)) } };
  });
}

export function rotateHomeProp(configuration: DesignConfiguration, propId: string, degrees: number): DesignConfiguration {
  return replaceProp(configuration, propId, (prop) => prop.placement_type === "room" ? { ...prop, rotation: ((prop.rotation + degrees) % 360 + 360) % 360 } : prop);
}
export function offsetWallProp(configuration: DesignConfiguration, propId: string, amount: number): DesignConfiguration {
  return replaceProp(configuration, propId, (prop) => prop.placement_type === "wall" ? { ...prop, wall_offset: Math.min(.9, Math.max(.1, prop.wall_offset + amount)) } : prop);
}
export function moveWallProp(configuration: DesignConfiguration, structure: Structure, propId: string, point: Point): DesignConfiguration {
  return replaceProp(configuration, propId, (prop) => {
    if (prop.placement_type !== "wall") return prop;
    const wall = structure.walls.find((item) => item.id === prop.wall_id);
    if (!wall || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return prop;
    const snapped = pointOnWall(wall, point);
    const dx = wall.end_x - wall.start_x, dy = wall.end_y - wall.start_y;
    const offset = Math.abs(dx) >= Math.abs(dy) ? (snapped.x - wall.start_x) / dx : (snapped.y - wall.start_y) / dy;
    return { ...prop, wall_offset: Math.max(.1, Math.min(.9, offset)) };
  });
}
export function deleteHomeProp(configuration: DesignConfiguration, propId: string): DesignConfiguration {
  return { ...configuration, props: (configuration.props ?? []).filter((prop) => prop.id !== propId) };
}
