import type { DesignConfiguration, HomeProp, HomePropType, Point, Selection, Structure, Wall } from "../types";
import { wallAngle, worldScale } from "./geometry";
import { pointOnWall } from "./editState";

export const FURNITURE_CATEGORIES = ["Wall Decor", "Bedroom", "Living Room", "Kitchen & Dining", "Bathroom", "Study & Storage", "Decor & Accessories"] as const;

export const HOME_PROP_CATALOG: { type: HomePropType; label: string; placement: "room" | "wall"; icon: string; category: typeof FURNITURE_CATEGORIES[number] }[] = [
  { type: "clock", label: "Clock", placement: "wall", icon: "◷", category: "Wall Decor" },
  { type: "painting", label: "Painting", placement: "wall", icon: "▧", category: "Wall Decor" },
  { type: "bed", label: "Bed", placement: "room", icon: "▤", category: "Bedroom" },
  { type: "sofa", label: "Sofa", placement: "room", icon: "▱", category: "Living Room" },
  { type: "table", label: "Table", placement: "room", icon: "◯", category: "Kitchen & Dining" },
  { type: "armchair", label: "Armchair", placement: "room", icon: "▢", category: "Living Room" },
  { type: "cupboard", label: "Cupboard", placement: "room", icon: "▥", category: "Bedroom" },
  { type: "flower_vase", label: "Flower Vase", placement: "room", icon: "✿", category: "Decor & Accessories" },
  { type: "kenney_sink", label: "Bathroom Sink", placement: "room", icon: "▢", category: "Bathroom" },
  { type: "kenney_bathtub", label: "Bathtub", placement: "room", icon: "▱", category: "Bathroom" },
  { type: "kenney_bookcase", label: "Open Bookcase", placement: "room", icon: "▥", category: "Study & Storage" },
  { type: "kenney_tv_cabinet", label: "TV Cabinet", placement: "room", icon: "▤", category: "Living Room" },
  { type: "kenney_desk_chair", label: "Desk Chair", placement: "room", icon: "▢", category: "Study & Storage" },
  { type: "kenney_bed_bunk", label: "Bunk Bed", placement: "room", icon: "▢", category: "Bedroom" },
  { type: "kenney_side_table_drawers", label: "Side Table with Drawers", placement: "room", icon: "▢", category: "Bedroom" },
  { type: "kenney_lounge_design_sofa", label: "Design Sofa", placement: "room", icon: "▢", category: "Living Room" },
  { type: "kenney_lounge_chair", label: "Lounge Chair", placement: "room", icon: "▢", category: "Living Room" },
  { type: "kenney_lounge_sofa_long", label: "Long Lounge Sofa", placement: "room", icon: "▢", category: "Living Room" },
  { type: "kenney_table_coffee", label: "Coffee Table", placement: "room", icon: "▢", category: "Living Room" },
  { type: "kenney_kitchen_fridge", label: "Fridge", placement: "room", icon: "▢", category: "Kitchen & Dining" },
  { type: "kenney_kitchen_stove", label: "Stove", placement: "room", icon: "▢", category: "Kitchen & Dining" },
  { type: "kenney_kitchen_cabinet", label: "Kitchen Cabinet", placement: "room", icon: "▢", category: "Kitchen & Dining" },
  { type: "kenney_kitchen_bar", label: "Kitchen Bar", placement: "room", icon: "▢", category: "Kitchen & Dining" },
  { type: "kenney_table_round", label: "Round Table", placement: "room", icon: "▢", category: "Kitchen & Dining" },
  { type: "kenney_chair_modern_cushion", label: "Modern Cushioned Chair", placement: "room", icon: "▢", category: "Kitchen & Dining" },
  { type: "kenney_toilet", label: "Toilet", placement: "room", icon: "▢", category: "Bathroom" },
  { type: "kenney_shower", label: "Shower", placement: "room", icon: "▢", category: "Bathroom" },
  { type: "kenney_desk", label: "Desk", placement: "room", icon: "▢", category: "Study & Storage" },
  { type: "kenney_bookcase_closed", label: "Closed Bookcase", placement: "room", icon: "▢", category: "Study & Storage" },
  { type: "kenney_lamp_round_floor", label: "Round Floor Lamp", placement: "room", icon: "▢", category: "Decor & Accessories" },
  { type: "kenney_potted_plant", label: "Potted Plant", placement: "room", icon: "▢", category: "Decor & Accessories" },
  { type: "kenney_tv", label: "TV", placement: "room", icon: "▤", category: "Living Room" },
];


export const PROP_DIMENSIONS: Record<HomePropType, { width: number; depth: number; height: number }> = {
  clock: { width: .48, depth: .12, height: .48 }, painting: { width: .9, depth: .1, height: .65 },
  bed: { width: 1.75, depth: 2.15, height: .85 }, sofa: { width: 2.05, depth: .95, height: .9 },
  table: { width: 1.25, depth: 1.25, height: .78 }, armchair: { width: .88, depth: .88, height: .95 },
  cupboard: { width: 1.4, depth: .58, height: 2.05 }, flower_vase: { width: .38, depth: .38, height: .85 },
  kenney_sink: { width: .8, depth: .6, height: .9 }, kenney_bathtub: { width: 1.8, depth: .85, height: .65 },
  kenney_bookcase: { width: .9, depth: .4, height: 1.8 }, kenney_tv_cabinet: { width: 1.5, depth: .5, height: .65 },
  kenney_desk_chair: { width: .65, depth: .65, height: 1 },
  kenney_bed_bunk: { width: 1.15, depth: 2.2, height: 1.8 },
  kenney_side_table_drawers: { width: 0.75, depth: 0.45, height: 0.6 },
  kenney_lounge_design_sofa: { width: 2.4, depth: 0.95, height: 0.9 },
  kenney_lounge_chair: { width: 1, depth: 0.9, height: 0.95 },
  kenney_lounge_sofa_long: { width: 2.3, depth: 1.95, height: 1.1 },
  kenney_table_coffee: { width: 1.15, depth: 0.75, height: 0.45 },
  kenney_kitchen_fridge: { width: 0.85, depth: 0.65, height: 1.85 },
  kenney_kitchen_stove: { width: 0.9, depth: 0.9, height: 0.9 },
  kenney_kitchen_cabinet: { width: 0.85, depth: 0.9, height: 0.9 },
  kenney_kitchen_bar: { width: 1.2, depth: 0.6, height: 1.1 },
  kenney_table_round: { width: 1.5, depth: 1.7, height: 0.78 },
  kenney_chair_modern_cushion: { width: 0.5, depth: 0.5, height: 0.95 },
  kenney_toilet: { width: 0.65, depth: 0.9, height: 0.9 },
  kenney_shower: { width: 1.05, depth: 1.1, height: 2.05 },
  kenney_desk: { width: 1.45, depth: 0.8, height: 0.78 },
  kenney_bookcase_closed: { width: 0.9, depth: 0.55, height: 1.85 },
  kenney_lamp_round_floor: { width: 0.4, depth: 0.4, height: 1.75 },
  kenney_potted_plant: { width: 0.55, depth: 0.6, height: 1.3 },
  kenney_tv: { width: 1.25, depth: .3, height: .85 },
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
