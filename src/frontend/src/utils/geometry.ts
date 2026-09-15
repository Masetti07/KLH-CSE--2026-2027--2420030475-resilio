import type { Opening, Point, Structure, Wall } from "../types";

export const PLAN_SCALE = 10;
export const DEFAULT_WALL_THICKNESS = 0.12;

export type WorldPoint = { x: number; z: number };
export type ModelBounds = {
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
  width: number; height: number; depth: number;
  center: { x: number; y: number; z: number };
  radius: number;
};
export type CameraFrame = {
  position: [number, number, number];
  target: [number, number, number];
  minDistance: number;
  maxDistance: number;
  near: number;
  far: number;
};

export function normalizedToWorld(point: Point, scale = PLAN_SCALE): WorldPoint {
  return { x: (point.x - 0.5) * scale, z: (point.y - 0.5) * scale };
}

export function wallLength(wall: Wall, scale = PLAN_SCALE): number {
  return Math.hypot(wall.end_x - wall.start_x, wall.end_y - wall.start_y) * scale;
}

export function wallMidpoint(wall: Wall, scale = PLAN_SCALE): WorldPoint {
  return normalizedToWorld({ x: (wall.start_x + wall.end_x) / 2, y: (wall.start_y + wall.end_y) / 2 }, scale);
}

export function wallAngle(wall: Wall): number {
  return Math.atan2(wall.end_y - wall.start_y, wall.end_x - wall.start_x);
}

export function wallThickness(wall: Wall, scale = PLAN_SCALE): number {
  return Math.max(DEFAULT_WALL_THICKNESS, wall.thickness * scale);
}

export function openingTransform(opening: Opening, wall: Wall | undefined, scale = PLAN_SCALE) {
  const position = normalizedToWorld(opening.position, scale);
  return {
    ...position,
    width: opening.width * scale,
    angle: wall ? wallAngle(wall) : 0,
    sillHeight: opening.probable_type === "window" ? 1.0 : 0,
    height: opening.probable_type === "window" ? 1.1 : 2.1,
  };
}

export function modelBounds(structure: Structure, scale = PLAN_SCALE): ModelBounds {
  const points: WorldPoint[] = [];
  structure.walls.forEach((wall) => {
    points.push(normalizedToWorld({ x: wall.start_x, y: wall.start_y }, scale));
    points.push(normalizedToWorld({ x: wall.end_x, y: wall.end_y }, scale));
  });
  if (!points.length) structure.rooms.forEach((room) => room.polygon.forEach((point) => points.push(normalizedToWorld(point, scale))));
  if (!points.length) structure.openings.forEach((opening) => points.push(normalizedToWorld(opening.position, scale)));

  if (!points.length) {
    points.push(normalizedToWorld({ x: 0, y: 0 }, scale), normalizedToWorld({ x: 1, y: 1 }, scale));
  }
  let minX = Math.min(...points.map((point) => point.x));
  let maxX = Math.max(...points.map((point) => point.x));
  let minZ = Math.min(...points.map((point) => point.z));
  let maxZ = Math.max(...points.map((point) => point.z));
  const padding = Math.max(DEFAULT_WALL_THICKNESS, ...structure.walls.map((wall) => wallThickness(wall, scale))) / 2;
  minX -= padding; maxX += padding; minZ -= padding; maxZ += padding;
  if (maxX - minX < 0.5) { minX -= 0.25; maxX += 0.25; }
  if (maxZ - minZ < 0.5) { minZ -= 0.25; maxZ += 0.25; }
  const height = Math.max(0.5, structure.wall_height);
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const center = { x: (minX + maxX) / 2, y: height / 2, z: (minZ + maxZ) / 2 };
  return {
    minX, maxX, minY: 0, maxY: height, minZ, maxZ, width, height, depth, center,
    radius: Math.hypot(width, height, depth) / 2,
  };
}

export function cameraFrame(bounds: ModelBounds, aspect: number, mode: "top" | "perspective", fovDegrees = 42): CameraFrame {
  const safeAspect = Math.max(0.35, aspect);
  const verticalFov = fovDegrees * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const maxExtent = Math.max(bounds.width, bounds.height, bounds.depth);
  const minDistance = Math.max(0.45, maxExtent * 0.08);
  const maxDistance = Math.max(18, maxExtent * 6);
  const target: [number, number, number] = [bounds.center.x, mode === "top" ? 0 : bounds.height * 0.34, bounds.center.z];
  let distance: number;
  let position: [number, number, number];

  if (mode === "top") {
    const verticalFit = bounds.depth / (2 * Math.tan(verticalFov / 2));
    const horizontalFit = bounds.width / (2 * Math.tan(horizontalFov / 2));
    distance = Math.max(verticalFit, horizontalFit) * 1.18;
    position = [target[0], bounds.maxY + distance, target[2] + 0.001];
  } else {
    distance = (bounds.radius / Math.sin(limitingFov / 2)) * 1.28;
    const direction = { x: 1, y: 0.78, z: 1 };
    const length = Math.hypot(direction.x, direction.y, direction.z);
    position = [target[0] + distance * direction.x / length, target[1] + distance * direction.y / length, target[2] + distance * direction.z / length];
  }
  return { position, target, minDistance, maxDistance, near: Math.max(0.02, distance / 100), far: Math.max(100, distance + maxDistance * 2) };
}
