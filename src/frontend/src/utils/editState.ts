import type { Opening, Point, Selection, Structure, Wall } from "../types";
import { PLAN_SCALE } from "./geometry";

export type HistoryState = { past: Structure[]; present: Structure | null; future: Structure[] };

export function cloneStructure(structure: Structure): Structure {
  return structuredClone(structure);
}

export function initialHistory(structure: Structure | null = null): HistoryState {
  return { past: [], present: structure ? cloneStructure(structure) : null, future: [] };
}

export function commitHistory(state: HistoryState, next: Structure): HistoryState {
  if (!state.present) return initialHistory(next);
  return { past: [...state.past.slice(-29), state.present], present: cloneStructure(next), future: [] };
}

export function undoHistory(state: HistoryState): HistoryState {
  if (!state.present || !state.past.length) return state;
  const previous = state.past[state.past.length - 1];
  return { past: state.past.slice(0, -1), present: cloneStructure(previous), future: [state.present, ...state.future] };
}

export function redoHistory(state: HistoryState): HistoryState {
  if (!state.present || !state.future.length) return state;
  const next = state.future[0];
  return { past: [...state.past, state.present], present: cloneStructure(next), future: state.future.slice(1) };
}

export function nextId(prefix: string, existing: { id: string }[]): string {
  let index = 1;
  const ids = new Set(existing.map((item) => item.id));
  while (ids.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

export function addWall(structure: Structure): { structure: Structure; selection: Selection } {
  const next = cloneStructure(structure);
  const wall: Wall = { id: nextId("manual-wall", next.walls), start_x: 0.35, start_y: 0.45, end_x: 0.65, end_y: 0.45, thickness: 0.015, confidence: 1 };
  next.walls.push(wall);
  return { structure: next, selection: { kind: "wall", id: wall.id } };
}

export type StraightOrientation = "horizontal" | "vertical";
export const metresPerNormalizedUnit = (structure: Structure): number => structure.physical_dimensions?.metres_per_normalized_unit ?? PLAN_SCALE;
export const wallLengthMetres = (structure: Structure, wall: Wall): number => Math.hypot(wall.end_x - wall.start_x, wall.end_y - wall.start_y) * metresPerNormalizedUnit(structure);
export const isStraightWall = (wall: Wall): boolean => wall.id.startsWith("straight-wall-");

export function addStraightWall(structure: Structure, lengthMetres: number, orientation: StraightOrientation): { structure: Structure; selection: Selection } {
  const normalizedLength = lengthMetres / metresPerNormalizedUnit(structure);
  if (!Number.isFinite(normalizedLength) || normalizedLength <= 0 || normalizedLength > .8) throw new Error(`Enter a length greater than 0 and at most ${(metresPerNormalizedUnit(structure) * .8).toFixed(1)} m.`);
  const next = cloneStructure(structure);
  const half = normalizedLength / 2;
  const wall: Wall = { id: nextId("straight-wall", next.walls), start_x: orientation === "horizontal" ? .5 - half : .5,
    start_y: orientation === "vertical" ? .5 - half : .5, end_x: orientation === "horizontal" ? .5 + half : .5,
    end_y: orientation === "vertical" ? .5 + half : .5, thickness: .015, confidence: 1 };
  next.walls.push(wall);
  return { structure: next, selection: { kind: "wall", id: wall.id } };
}

export function translateWall(structure: Structure, wallId: string, deltaX: number, deltaY: number): Structure {
  const next = cloneStructure(structure);
  const wall = next.walls.find((item) => item.id === wallId);
  if (!wall || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return next;
  const dx = Math.max(-Math.min(wall.start_x, wall.end_x), Math.min(1 - Math.max(wall.start_x, wall.end_x), deltaX));
  const dy = Math.max(-Math.min(wall.start_y, wall.end_y), Math.min(1 - Math.max(wall.start_y, wall.end_y), deltaY));
  wall.start_x += dx; wall.end_x += dx; wall.start_y += dy; wall.end_y += dy;
  return next;
}

export function deleteWall(structure: Structure, wallId: string): Structure {
  const next = cloneStructure(structure);
  next.walls = next.walls.filter((wall) => wall.id !== wallId);
  next.openings = next.openings.map((opening) => opening.wall_id === wallId ? { ...opening, wall_id: null } : opening);
  return next;
}

export function blankBoundary(structure: Structure) {
  const boundary = structure.walls.filter((wall) => wall.id.startsWith("boundary-"));
  if (!structure.physical_dimensions || boundary.length !== 4) return null;
  const xs = boundary.flatMap((wall) => [wall.start_x, wall.end_x]);
  const ys = boundary.flatMap((wall) => [wall.start_y, wall.end_y]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function addRoom(structure: Structure): { structure: Structure; selection: Selection } {
  const bounds = blankBoundary(structure);
  if (!bounds) throw new Error("Manual rooms are available for blank spaces with an exterior boundary.");
  const next = cloneStructure(structure);
  const width = (bounds.maxX - bounds.minX) * .28, depth = (bounds.maxY - bounds.minY) * .28;
  const shift = (next.rooms.length % 3 - 1) * .16;
  const x0 = Math.min(bounds.maxX - width, Math.max(bounds.minX, (bounds.minX + bounds.maxX - width) / 2 + shift * (bounds.maxX - bounds.minX)));
  const y0 = Math.min(bounds.maxY - depth, Math.max(bounds.minY, (bounds.minY + bounds.maxY - depth) / 2 + shift * (bounds.maxY - bounds.minY)));
  const id = nextId("manual-room", next.rooms);
  next.rooms.push({ id, polygon: [{ x: x0, y: y0 }, { x: x0 + width, y: y0 }, { x: x0 + width, y: y0 + depth }, { x: x0, y: y0 + depth }], name: null, type: null, confidence: 1 });
  return { structure: next, selection: { kind: "room", id } };
}

export function moveRoom(structure: Structure, roomId: string, delta: Point): Structure {
  const bounds = blankBoundary(structure); const room = structure.rooms.find((item) => item.id === roomId);
  if (!bounds || !room?.id.startsWith("manual-room-") || !Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return structure;
  const xs = room.polygon.map((point) => point.x), ys = room.polygon.map((point) => point.y);
  const dx = Math.max(bounds.minX - Math.min(...xs), Math.min(bounds.maxX - Math.max(...xs), delta.x));
  const dy = Math.max(bounds.minY - Math.min(...ys), Math.min(bounds.maxY - Math.max(...ys), delta.y));
  const next = cloneStructure(structure); next.rooms.find((item) => item.id === roomId)!.polygon = room.polygon.map((point) => ({ x: point.x + dx, y: point.y + dy }));
  return next;
}

export function resizeRoom(structure: Structure, roomId: string, corner: Point): Structure {
  const bounds = blankBoundary(structure); const room = structure.rooms.find((item) => item.id === roomId);
  if (!bounds || !room?.id.startsWith("manual-room-") || !Number.isFinite(corner.x) || !Number.isFinite(corner.y)) return structure;
  const x0 = Math.min(...room.polygon.map((point) => point.x)), y0 = Math.min(...room.polygon.map((point) => point.y));
  const x1 = Math.min(bounds.maxX, Math.max(x0 + .04, corner.x)), y1 = Math.min(bounds.maxY, Math.max(y0 + .04, corner.y));
  const next = cloneStructure(structure); next.rooms.find((item) => item.id === roomId)!.polygon = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  return next;
}

export function pointOnWall(wall: Wall, point: Point, width = 0): Point {
  const dx = wall.end_x - wall.start_x, dy = wall.end_y - wall.start_y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-8) return { x: wall.start_x, y: wall.start_y };
  const margin = Math.min(.49, width / (2 * Math.sqrt(lengthSquared)));
  const t = Math.max(margin, Math.min(1 - margin, ((point.x - wall.start_x) * dx + (point.y - wall.start_y) * dy) / lengthSquared));
  return { x: wall.start_x + t * dx, y: wall.start_y + t * dy };
}

export function addOpening(structure: Structure, wallId: string | null = null, type: Opening["probable_type"] = "unknown"): { structure: Structure; selection: Selection } {
  const next = cloneStructure(structure);
  const wall = next.walls.find((item) => item.id === wallId);
  const position = wall ? pointOnWall(wall, { x: (wall.start_x + wall.end_x) / 2, y: (wall.start_y + wall.end_y) / 2 }, .08) : { x: .5, y: .5 };
  const opening: Opening = { id: nextId("manual-opening", next.openings), wall_id: wall?.id ?? null, position, width: 0.08, probable_type: type, confidence: 1 };
  next.openings.push(opening);
  return { structure: next, selection: { kind: "opening", id: opening.id } };
}

export function validCoordinate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
