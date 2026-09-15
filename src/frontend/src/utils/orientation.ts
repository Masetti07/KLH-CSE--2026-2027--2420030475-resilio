import type { DirectionalZone, Orientation, Point, Structure } from "../types";

export type NormalizedBounds = { minX: number; maxX: number; minY: number; maxY: number };

export function structuralBounds(structure: Structure): NormalizedBounds {
  const points: Point[] = structure.walls.flatMap((wall) => [{ x: wall.start_x, y: wall.start_y }, { x: wall.end_x, y: wall.end_y }]);
  if (!points.length) points.push(...structure.rooms.flatMap((room) => room.polygon));
  if (!points.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  const minX = Math.min(...points.map((point) => point.x)), maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y)), maxY = Math.max(...points.map((point) => point.y));
  return maxX - minX < 1e-6 || maxY - minY < 1e-6 ? { minX: 0, maxX: 1, minY: 0, maxY: 1 } : { minX, maxX, minY, maxY };
}

export function northAlignedPoint(x: number, y: number, orientation: Orientation): Point {
  if (orientation === 0) return { x, y };
  if (orientation === 90) return { x: y, y: 1 - x };
  if (orientation === 180) return { x: 1 - x, y: 1 - y };
  return { x: 1 - y, y: x };
}

export function directionalZone(point: Point, bounds: NormalizedBounds, orientation: Orientation): DirectionalZone {
  const local = northAlignedPoint((point.x - bounds.minX) / (bounds.maxX - bounds.minX), (point.y - bounds.minY) / (bounds.maxY - bounds.minY), orientation);
  const h = local.x < 1 / 3 ? "west" : local.x > 2 / 3 ? "east" : "center";
  const v = local.y < 1 / 3 ? "north" : local.y > 2 / 3 ? "south" : "center";
  const zones: Record<string, DirectionalZone> = { west_north: "north_west", center_north: "north", east_north: "north_east", west_center: "west", center_center: "center", east_center: "east", west_south: "south_west", center_south: "south", east_south: "south_east" };
  return zones[`${h}_${v}`];
}
