import type { Opening, Selection, Structure, Wall } from "../types";

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

export function deleteWall(structure: Structure, wallId: string): Structure {
  const next = cloneStructure(structure);
  next.walls = next.walls.filter((wall) => wall.id !== wallId);
  next.openings = next.openings.map((opening) => opening.wall_id === wallId ? { ...opening, wall_id: null } : opening);
  return next;
}

export function addOpening(structure: Structure, wallId: string | null = null): { structure: Structure; selection: Selection } {
  const next = cloneStructure(structure);
  const opening: Opening = { id: nextId("manual-opening", next.openings), wall_id: wallId, position: { x: 0.5, y: 0.5 }, width: 0.08, probable_type: "unknown", confidence: 1 };
  next.openings.push(opening);
  return { structure: next, selection: { kind: "opening", id: opening.id } };
}

export function validCoordinate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
