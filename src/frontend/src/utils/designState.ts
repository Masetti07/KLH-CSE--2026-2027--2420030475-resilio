import type { Design, DesignConfiguration, FloorFinish, Orientation, RoomSemantic, RoomType, Structure, WallFinish } from "../types";

export const WALL_FINISHES: { value: WallFinish; label: string }[] = [
  { value: "paint", label: "Paint" }, { value: "wood_panel", label: "Wood Panel" },
  { value: "brick_style", label: "Brick Style" }, { value: "concrete_style", label: "Concrete Style" },
];
export const FLOOR_FINISHES: { value: FloorFinish; label: string }[] = [
  { value: "wood", label: "Wood" }, { value: "tile", label: "Tile" }, { value: "marble_style", label: "Marble Style" },
  { value: "concrete", label: "Concrete" }, { value: "neutral", label: "Neutral" },
];
export const ROOM_TYPES: { value: RoomType; label: string }[] = [
  ["living_room", "Living Room"], ["kitchen", "Kitchen"], ["master_bedroom", "Master Bedroom"],
  ["bedroom", "Bedroom"], ["bathroom", "Bathroom"], ["dining", "Dining Room"], ["study", "Study"],
  ["pooja_room", "Pooja / Prayer Room"], ["entrance", "Entrance"], ["utility", "Utility"], ["other", "Other"],
].map(([value, label]) => ({ value: value as RoomType, label }));

export function defaultDesignConfiguration(structure: Structure): DesignConfiguration {
  return {
    wall_height: structure.wall_height,
    wall_appearances: Object.fromEntries(structure.walls.map((wall) => [wall.id, { color: "#eee9de", finish: "paint" }])),
    floor_appearances: Object.fromEntries(structure.rooms.map((room) => [room.id, { color: "#e8e1d4", finish: "neutral" }])),
    door_configurations: Object.fromEntries(structure.openings.filter((opening) => opening.probable_type === "door").map((opening) => [opening.id, { color: "#8b4d28", width: opening.width, style: "standard" }])),
    window_configurations: Object.fromEntries(structure.openings.filter((opening) => opening.probable_type === "window").map((opening) => [opening.id, { color: "#67b9dc", width: opening.width, height: 1.1, style: "standard" }])),
    room_semantics: Object.fromEntries(structure.rooms.map((room) => [room.id, { name: room.name, room_type: room.type }])),
    orientation: null,
  };
}

export function cloneConfiguration(configuration: DesignConfiguration): DesignConfiguration {
  return structuredClone(configuration);
}

export function structureWithEffectiveWallHeight(structure: Structure, configuration: DesignConfiguration | null | undefined): Structure {
  return configuration ? { ...structure, wall_height: configuration.wall_height } : structure;
}

export function updateRoomSemantic(configuration: DesignConfiguration, roomId: string, changes: Partial<RoomSemantic>): DesignConfiguration {
  const next = cloneConfiguration(configuration);
  const current = next.room_semantics[roomId] ?? { name: null, room_type: null as RoomType | null };
  next.room_semantics[roomId] = { ...current, ...changes };
  return next;
}

export function roomTypeLabel(roomType: RoomType | null | undefined): string {
  return ROOM_TYPES.find((option) => option.value === roomType)?.label ?? "Unassigned";
}

export function roomDisplayName(configuration: DesignConfiguration | null | undefined, room: Structure["rooms"][number], index: number): string {
  const semantic = configuration?.room_semantics[room.id];
  return semantic?.name?.trim() || (semantic?.room_type ? roomTypeLabel(semantic.room_type) : "") || room.name?.trim() || (room.type ? roomTypeLabel(room.type) : "") || `Room ${index + 1}`;
}

export function roomSemanticSummary(configuration: DesignConfiguration): string {
  const labels = Object.values(configuration.room_semantics)
    .filter((semantic) => semantic.room_type)
    .map((semantic) => semantic.name?.trim() || roomTypeLabel(semantic.room_type));
  if (!labels.length) return "None assigned";
  const counts = labels.reduce<Record<string, number>>((result, label) => ({ ...result, [label]: (result[label] ?? 0) + 1 }), {});
  const compact = Object.entries(counts).map(([label, count]) => count > 1 ? `${label} ×${count}` : label);
  return compact.length > 6 ? `${compact.slice(0, 6).join(", ")} +${compact.length - 6} more` : compact.join(", ");
}

export function reconcileDesignConfiguration(configuration: DesignConfiguration, structure: Structure): DesignConfiguration {
  const next = cloneConfiguration(configuration);
  structure.walls.forEach((wall) => { next.wall_appearances[wall.id] ??= { color: "#eee9de", finish: "paint" }; });
  structure.rooms.forEach((room) => {
    next.floor_appearances[room.id] ??= { color: "#e8e1d4", finish: "neutral" };
    next.room_semantics[room.id] ??= { name: room.name, room_type: room.type };
  });
  structure.openings.forEach((opening) => {
    if (opening.probable_type === "door") next.door_configurations[opening.id] ??= { color: "#8b4d28", width: opening.width, style: "standard" };
    if (opening.probable_type === "window") next.window_configurations[opening.id] ??= { color: "#67b9dc", width: opening.width, height: 1.1, style: "standard" };
  });
  const wallIds = new Set(structure.walls.map((item) => item.id)); const roomIds = new Set(structure.rooms.map((item) => item.id)); const openingIds = new Set(structure.openings.map((item) => item.id));
  Object.keys(next.wall_appearances).forEach((id) => { if (!wallIds.has(id)) delete next.wall_appearances[id]; });
  [next.floor_appearances, next.room_semantics].forEach((record) => Object.keys(record).forEach((id) => { if (!roomIds.has(id)) delete record[id]; }));
  [next.door_configurations, next.window_configurations].forEach((record) => Object.keys(record).forEach((id) => { if (!openingIds.has(id)) delete record[id]; }));
  return next;
}

export function wallMaterialPreset(finish: WallFinish, color: string) {
  const values = {
    paint: { roughness: .72, metalness: 0 }, wood_panel: { roughness: .58, metalness: 0 },
    brick_style: { roughness: .92, metalness: 0 }, concrete_style: { roughness: .98, metalness: 0 },
  }[finish];
  return { color, ...values };
}

export function floorMaterialPreset(finish: FloorFinish, color: string) {
  const values = {
    wood: { roughness: .62, metalness: 0 }, tile: { roughness: .35, metalness: .04 }, marble_style: { roughness: .24, metalness: .03 },
    concrete: { roughness: .94, metalness: 0 }, neutral: { roughness: .88, metalness: 0 },
  }[finish];
  return { color, ...values };
}

function summarize(values: string[]): string {
  const counts = values.reduce<Record<string, number>>((result, value) => ({ ...result, [value]: (result[value] ?? 0) + 1 }), {});
  return Object.entries(counts).map(([value, count]) => `${value.replaceAll("_", " ")} (${count})`).join(", ") || "None";
}

export type ComparisonRow = { label: string; designA: string; designB: string; changed: boolean };

export function compareDesigns(a: Design, b: Design): ComparisonRow[] {
  const aScore = a.latest_analysis?.score_label ?? "Not analyzed";
  const bScore = b.latest_analysis?.score_label ?? "Not analyzed";
  const values: [string, string, string][] = [
    ["Wall height", `${a.configuration.wall_height.toFixed(1)} units`, `${b.configuration.wall_height.toFixed(1)} units`],
    ["Wall finishes", summarize(Object.values(a.configuration.wall_appearances).map((item) => item.finish)), summarize(Object.values(b.configuration.wall_appearances).map((item) => item.finish))],
    ["Floor finishes", summarize(Object.values(a.configuration.floor_appearances).map((item) => item.finish)), summarize(Object.values(b.configuration.floor_appearances).map((item) => item.finish))],
    ["Door styles", Object.values(a.configuration.door_configurations).map((item) => item.style).join(", ") || "None", Object.values(b.configuration.door_configurations).map((item) => item.style).join(", ") || "None"],
    ["Window styles", Object.values(a.configuration.window_configurations).map((item) => item.style).join(", ") || "None", Object.values(b.configuration.window_configurations).map((item) => item.style).join(", ") || "None"],
    ["Room assignments", roomSemanticSummary(a.configuration), roomSemanticSummary(b.configuration)],
    ["North orientation", orientationLabel(a.configuration.orientation), orientationLabel(b.configuration.orientation)],
    ["Traditional rule match score", aScore, bScore],
  ];
  return values.map(([label, designA, designB]) => ({ label, designA, designB, changed: designA !== designB }));
}

export function orientationLabel(orientation: Orientation | null): string {
  return orientation === null ? "Not confirmed" : `${orientation}° · North ${orientationArrow(orientation)}`;
}

export function orientationArrow(orientation: Orientation | null): string {
  return orientation === 0 ? "↑" : orientation === 90 ? "→" : orientation === 180 ? "↓" : orientation === 270 ? "←" : "?";
}
