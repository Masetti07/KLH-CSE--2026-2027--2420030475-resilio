import { Shape, Vector2 } from "three";
import type { Opening, Point, Wall } from "../types";
import { normalizedToWorld } from "./geometry";

// Correct only local doorway excursions backed by collinear wall faces on both
// sides of a detected gap. Ambiguous outlines and wall-supported concavities stay intact.
export function roomFloorFootprint(polygon: Point[], walls: Wall[], openings: Opening[]): Point[] {
  let outline = polygon;
  for (const door of openings) {
    if (door.probable_type !== "door" || door.width <= 0) continue;
    const host = walls.find((wall) => wall.id === door.wall_id);
    if (!host) continue;
    const horizontal = Math.abs(host.start_y - host.end_y) < 1e-6;
    if (!horizontal && Math.abs(host.start_x - host.end_x) >= 1e-6) continue;
    const u = (point: Point) => horizontal ? point.x : point.y;
    const v = (point: Point) => horizontal ? point.y : point.x;
    const line = horizontal ? host.start_y : host.start_x;
    const thickness = host.thickness;
    if (!(thickness > 0)) continue;
    const segments = walls.filter((wall) => Math.abs(v({ x: wall.start_x, y: wall.start_y }) - line) < 1e-6 && Math.abs(v({ x: wall.end_x, y: wall.end_y }) - line) < 1e-6)
      .map((wall) => ({ lo: Math.min(u({ x: wall.start_x, y: wall.start_y }), u({ x: wall.end_x, y: wall.end_y })), hi: Math.max(u({ x: wall.start_x, y: wall.start_y }), u({ x: wall.end_x, y: wall.end_y })) }));
    const center = u(door.position);
    const left = segments.filter((segment) => segment.hi < center).sort((a, b) => b.hi - a.hi)[0];
    const right = segments.filter((segment) => segment.lo > center).sort((a, b) => a.lo - b.lo)[0];
    if (!left || !right || right.lo - left.hi < door.width * .5 || right.lo - left.hi > door.width * 2) continue;
    const backed = (point: Point, segment: { lo: number; hi: number }) => u(point) >= segment.lo - 1e-6 && u(point) <= segment.hi + 1e-6 && Math.abs(v(point) - line) >= thickness * .2 && Math.abs(v(point) - line) <= thickness;
    // Use the nearest wall-backed anchors, leaving the rest of each edge intact.
    const leftAnchors = outline.map((point, index) => ({ point, index })).filter(({ point }) => backed(point, left)).sort((a, b) => u(b.point) - u(a.point));
    const rightAnchors = outline.map((point, index) => ({ point, index })).filter(({ point }) => backed(point, right)).sort((a, b) => u(a.point) - u(b.point));
    let corrected = false;
    for (const { index: a } of leftAnchors) for (const { index: b } of rightAnchors) {
      if (corrected) continue;
      const start = outline[a], end = outline[b];
      if (!backed(start, left) || !backed(end, right) || (v(start) - line) * (v(end) - line) <= 0 || Math.abs(v(start) - v(end)) > thickness * .25) continue;
      for (const direction of [1, -1]) {
        const indices: number[] = [];
        for (let index = (a + direction + outline.length) % outline.length; index !== b; index = (index + direction + outline.length) % outline.length) indices.push(index);
        if (!indices.length) continue;
        const face = (point: Point) => v(start) + (v(end) - v(start)) * (u(point) - u(start)) / (u(end) - u(start));
        const run = indices.map((index) => outline[index]);
        if (!run.every((point) => u(point) >= left.hi - door.width && u(point) <= right.lo + door.width && Math.abs(v(point) - face(point)) <= door.width * 1.5)) continue;
        if (!run.some((point) => Math.abs(v(point) - face(point)) > thickness * .75)) continue;
        // A perpendicular wall in this pocket could indicate a genuine room recess.
        const pocket = run.flatMap((point) => [point, horizontal ? { x: point.x, y: face(point) } : { x: face(point), y: point.y }]);
        const minX = Math.min(...pocket.map((point) => point.x)), maxX = Math.max(...pocket.map((point) => point.x));
        const minY = Math.min(...pocket.map((point) => point.y)), maxY = Math.max(...pocket.map((point) => point.y));
        if (walls.some((wall) => Math.abs(v({ x: wall.start_x, y: wall.start_y }) - v({ x: wall.end_x, y: wall.end_y })) > 1e-6 && Math.max(wall.start_x, wall.end_x) >= minX && Math.min(wall.start_x, wall.end_x) <= maxX && Math.max(wall.start_y, wall.end_y) >= minY && Math.min(wall.start_y, wall.end_y) <= maxY)) continue;
        const removed = new Set(indices);
        outline = outline.filter((_, index) => !removed.has(index));
        corrected = true;
        break;
      }
    }
  }
  return outline;
}

// Render the derived outline rather than its bounding box; never mutate the model.
// Unit coordinates retain the existing 0..1 floor texture mapping.
export function roomFloor(polygon: Point[], scale: number, walls: Wall[] = [], openings: Opening[] = []) {
  if (polygon.length < 3 || !polygon.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))) return null;
  const points = roomFloorFootprint(polygon, walls, openings).map((point) => normalizedToWorld(point, scale));
  const minX = Math.min(...points.map((point) => point.x)), maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z)), maxZ = Math.max(...points.map((point) => point.z));
  const width = maxX - minX, depth = maxZ - minZ;
  if (width <= 0 || depth <= 0) return null;
  return {
    shape: new Shape(points.map((point) => new Vector2((point.x - minX) / width, (maxZ - point.z) / depth))),
    width, depth,
    // The .035 slab retains the previous bottom (-.0025) and top (.0325).
    position: [minX, -.0025, maxZ] as [number, number, number],
  };
}
