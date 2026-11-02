import { Plane, Raycaster, Vector2, Vector3, type Camera, type Group } from "three";
import type { Point } from "../types";

const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const delta = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const finite = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
const onEdge = (p: Point, a: Point, b: Point) => Math.abs(cross(delta(p, a), delta(b, a))) < 1e-10 && (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 1e-10;
const intersects = (a: Point, b: Point, c: Point, d: Point) => {
  const ab = delta(b, a), cd = delta(d, c);
  const denominator = cross(ab, cd);
  if (Math.abs(denominator) < 1e-12) return onEdge(a, c, d) || onEdge(b, c, d) || onEdge(c, a, b) || onEdge(d, a, b);
  const t = cross(delta(c, a), cd) / denominator, u = cross(delta(c, a), ab) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

export function safeDragPolygon(polygon: Point[]): boolean {
  if (polygon.length < 3 || !polygon.every(finite)) return false;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-9) return false;
    area += cross(a, b);
    for (let j = i + 2; j < polygon.length; j++) {
      if (i === 0 && j === polygon.length - 1) continue;
      if (intersects(a, b, polygon[j], polygon[(j + 1) % polygon.length])) return false;
    }
  }
  return Math.abs(area) > 1e-10;
}

export function insideDragRoom(point: Point, polygon: Point[]): boolean {
  if (!finite(point)) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (onEdge(point, a, b)) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Stop before the first boundary crossing, including across a concave notch.
export function constrainFloorDrag(from: Point, to: Point, polygon: Point[]): Point {
  if (!finite(to) || !insideDragRoom(from, polygon)) return from;
  const movement = delta(to, from);
  let limit = 1;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], edge = delta(polygon[(i + 1) % polygon.length], a);
    const denominator = cross(movement, edge);
    if (Math.abs(denominator) < 1e-12) continue;
    const t = cross(delta(a, from), edge) / denominator, u = cross(delta(a, from), movement) / denominator;
    if (t <= 1e-9 && insideDragRoom({ x: from.x + movement.x * 1e-5, y: from.y + movement.y * 1e-5 }, polygon)) continue;
    if (t >= 0 && t <= limit && u >= 0 && u <= 1) limit = Math.max(0, t - 1e-7);
  }
  const result = { x: from.x + movement.x * limit, y: from.y + movement.y * limit };
  return insideDragRoom(result, polygon) ? result : from;
}

type Pointer = Pick<PointerEvent, "button" | "pointerId" | "clientX" | "clientY" | "pointerType">;
type Options = { canvas: HTMLCanvasElement; camera: Camera; controls: { enabled: boolean } | null; scale: number; commit: (id: string, point: Point) => void; clickGuard?: { current: boolean } };

// Transient mesh preview only. The existing design callback receives one release commit.
export function createFloorPropDrag({ canvas, camera, controls, scale, commit, clickGuard = { current: false } }: Options) {
  const host = canvas.ownerDocument.defaultView!;
  const raycaster = new Raycaster();
  let active: { id: string; pointerId: number; group: Group; origin: Vector3; position: Point; initial: Point; offset: Point; polygon: Point[]; enabled: boolean } | null = null;
  const planePoint = (event: Pick<PointerEvent, "clientX" | "clientY">, height: number): Point | null => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    raycaster.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hit = raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -height), new Vector3());
    return hit ? { x: hit.x / scale + .5, y: hit.z / scale + .5 } : null;
  };
  const finish = (save: boolean) => {
    const drag = active;
    if (!drag) return;
    active = null;
    drag.group.position.copy(drag.origin);
    if (controls) controls.enabled = drag.enabled;
    if (canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    if (save && Math.hypot(drag.position.x - drag.initial.x, drag.position.y - drag.initial.y) > 1e-6) commit(drag.id, drag.position);
  };
  const move = (event: PointerEvent) => {
    if (!active || event.pointerId !== active.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { finish(false); return; }
    event.stopImmediatePropagation();
    event.preventDefault();
    const point = planePoint(event, active.origin.y);
    if (!point) return;
    active.position = constrainFloorDrag(active.position, { x: point.x + active.offset.x, y: point.y + active.offset.y }, active.polygon);
    active.group.position.x = (active.position.x - .5) * scale;
    active.group.position.z = (active.position.y - .5) * scale;
  };
  const up = (event: PointerEvent) => { if (active?.pointerId === event.pointerId && event.button === 0) finish(true); };
  const cancel = (event?: PointerEvent) => { if (!event || event.pointerId === active?.pointerId) finish(false); };
  const click = (event: MouseEvent) => { if (clickGuard.current) { clickGuard.current = false; event.stopImmediatePropagation(); } };
  const down = () => { clickGuard.current = false; };
  const blur = () => finish(false);
  return {
    connect() {
      canvas.addEventListener("pointerdown", down, true);
      canvas.addEventListener("click", click, true);
      host.addEventListener("pointermove", move, { capture: true, passive: false });
      host.addEventListener("pointerup", up, true);
      host.addEventListener("pointercancel", cancel, true);
      canvas.addEventListener("pointerleave", cancel);
      canvas.addEventListener("lostpointercapture", cancel);
      host.addEventListener("blur", blur);
      return () => {
        finish(false);
        canvas.removeEventListener("pointerdown", down, true);
        canvas.removeEventListener("click", click, true);
        host.removeEventListener("pointermove", move, true);
        host.removeEventListener("pointerup", up, true);
        host.removeEventListener("pointercancel", cancel, true);
        canvas.removeEventListener("pointerleave", cancel);
        canvas.removeEventListener("lostpointercapture", cancel);
        host.removeEventListener("blur", blur);
      };
    },
    start(event: Pointer, id: string, group: Group, initial: Point, polygon: Point[]) {
      if (event.button !== 0 || event.pointerType !== "mouse" || active || !controls || !(scale > 0) || !safeDragPolygon(polygon) || !insideDragRoom(initial, polygon)) return false;
      const point = planePoint(event, group.position.y);
      if (!point) return false;
      active = { id, pointerId: event.pointerId, group, origin: group.position.clone(), initial, position: initial, offset: delta(initial, point), polygon, enabled: controls.enabled };
      controls.enabled = false;
      clickGuard.current = true;
      try { canvas.setPointerCapture(event.pointerId); } catch { finish(false); return false; }
      return true;
    },
  };
}
