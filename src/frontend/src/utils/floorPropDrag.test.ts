import { describe, expect, it, vi } from "vitest";
import { Group, PerspectiveCamera } from "three";
import { constrainFloorDrag, createFloorPropDrag, insideDragRoom, safeDragPolygon } from "./floorPropDrag";

const square = [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }];
const concave = [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .4 }, { x: .4, y: .4 }, { x: .4, y: .9 }, { x: .1, y: .9 }];

function setup(top = false, enabled = true) {
  const host = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    ownerDocument: { defaultView: host },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000 }),
    setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn(),
  });
  const camera = new PerspectiveCamera(45, 1, .01, 100);
  camera.position.set(0, 10, top ? 0 : 10);
  if (top) camera.up.set(0, 0, -1);
  camera.lookAt(0, .04, 0); camera.updateMatrixWorld();
  const controls = { enabled }, commit = vi.fn();
  const drag = createFloorPropDrag({ canvas: canvas as unknown as HTMLCanvasElement, camera, controls, scale: 10, commit });
  const dispose = drag.connect();
  const group = new Group(); group.position.set(0, .04, 0);
  const pointer = { button: 0, pointerId: 1, clientX: 500, clientY: 500, pointerType: "mouse" };
  const emit = (type: string, values = {}, target: EventTarget = host) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), pointer, values));
  const start = (polygon = square) => drag.start(pointer, "prop-1", group, { x: .5, y: .5 }, polygon);
  return { host, canvas, camera, controls, commit, drag, dispose, group, pointer, emit, start };
}

describe("safe concave room constraints", () => {
  it("rejects absent, nonfinite, degenerate and self-crossing polygons", () => {
    expect(safeDragPolygon(square)).toBe(true); expect(safeDragPolygon(concave)).toBe(true);
    for (const polygon of [[], square.slice(0, 2), [square[0], square[0], square[2]], [square[0], square[2], square[1], square[3]], [{ x: NaN, y: 0 }, ...square]]) expect(safeDragPolygon(polygon)).toBe(false);
  });
  it("stops at concave boundaries even when the target is inside the other arm", () => {
    const from = { x: .8, y: .3 }, to = { x: .3, y: .8 };
    expect(insideDragRoom(to, concave)).toBe(true);
    const result = constrainFloorDrag(from, to, concave);
    expect(result.y).toBeLessThan(.4); expect(result.x).toBeGreaterThan(.69);
    expect(insideDragRoom(result, concave)).toBe(true);
    expect(constrainFloorDrag(from, { x: NaN, y: 0 }, concave)).toBe(from);
  });
  it("allows an existing edge-positioned prop to move inward, while blocking outward movement", () => {
    const from = { x: .9, y: .5 };
    expect(constrainFloorDrag(from, { x: .8, y: .5 }, square)).toEqual({ x: .8, y: .5 });
    expect(constrainFloorDrag(from, { x: 1, y: .5 }, square)).toEqual(from);
  });
});

describe("floor drag lifecycle", () => {
  it.each([false, true])("previews on the plane and commits once on release (top=%s)", (top) => {
    const s = setup(top);
    expect(s.start()).toBe(true); expect(s.controls.enabled).toBe(false);
    s.emit("pointermove", { clientX: 550 }); s.emit("pointermove", { clientX: 600 });
    expect(s.group.position.x).toBeGreaterThan(0); expect(s.group.position.y).toBe(.04);
    expect(s.commit).not.toHaveBeenCalled();
    s.emit("pointerup"); s.emit("pointerup");
    expect(s.controls.enabled).toBe(true); expect(s.commit).toHaveBeenCalledTimes(1);
    expect(s.commit.mock.calls[0][0]).toBe("prop-1");
    expect(insideDragRoom(s.commit.mock.calls[0][1], square)).toBe(true);
    expect(s.group.position.toArray()).toEqual([0, .04, 0]);
    s.dispose();
  });
  it.each(["pointercancel", "pointerleave", "lostpointercapture", "blur", "unmount", "outside"])("restores orbit and cancels on %s", (reason) => {
    const s = setup(); s.start(); s.emit("pointermove", { clientX: 550 });
    if (reason === "unmount") s.dispose();
    else if (reason === "outside") s.emit("pointermove", { clientX: 1100 });
    else s.emit(reason, {}, ["pointerleave", "lostpointercapture"].includes(reason) ? s.canvas : s.host);
    expect(s.controls.enabled).toBe(true); expect(s.commit).not.toHaveBeenCalled();
    expect(s.group.position.toArray()).toEqual([0, .04, 0]);
    s.emit("pointerup"); expect(s.commit).not.toHaveBeenCalled(); s.dispose();
  });
  it("ignores other pointers, right drag, touch, unsafe rooms and click-only gestures", () => {
    const s = setup();
    for (const event of [{ ...s.pointer, button: 2 }, { ...s.pointer, pointerType: "touch" }]) expect(s.drag.start(event, "id", s.group, { x: .5, y: .5 }, square)).toBe(false);
    expect(s.start([])).toBe(false); expect(s.controls.enabled).toBe(true);
    s.start(); s.emit("pointermove", { pointerId: 2, clientX: 700 }); s.emit("pointerup", { pointerId: 2 });
    expect(s.controls.enabled).toBe(false); expect(s.group.position.x).toBe(0);
    s.emit("pointerup"); expect(s.commit).not.toHaveBeenCalled(); s.dispose();
  });
  it("suppresses the ending click but leaves the next gesture and wheel alone", () => {
    const s = setup(false, false); const clicked = vi.fn(), wheel = vi.fn();
    s.canvas.addEventListener("click", clicked); s.canvas.addEventListener("wheel", wheel);
    s.start(); s.emit("pointermove", { clientX: 550 }); s.emit("pointerup");
    s.emit("click", {}, s.canvas); expect(clicked).not.toHaveBeenCalled();
    expect(s.controls.enabled).toBe(false);
    s.emit("pointerdown", {}, s.canvas); s.emit("click", {}, s.canvas); s.emit("wheel", {}, s.canvas);
    expect(clicked).toHaveBeenCalledTimes(1); expect(wheel).toHaveBeenCalledTimes(1); s.dispose();
  });
  it("preserves grab offset and recovers if pointer capture fails", () => {
    const s = setup(true);
    expect(s.drag.start({ ...s.pointer, clientX: 520 }, "id", s.group, { x: .5, y: .5 }, square)).toBe(true);
    s.emit("pointermove", { clientX: 520 }); expect(s.group.position.x).toBeCloseTo(0);
    s.dispose();
    const broken = setup(); broken.canvas.setPointerCapture.mockImplementation(() => { throw new Error("capture lost"); });
    expect(broken.start()).toBe(false); expect(broken.controls.enabled).toBe(true); broken.dispose();
  });
  it("keeps the ending click suppressed when a committed design replaces the controller", () => {
    const s = setup(); s.dispose();
    const clickGuard = { current: false };
    const options = { canvas: s.canvas as unknown as HTMLCanvasElement, camera: s.camera, controls: s.controls, scale: 10, clickGuard, commit: vi.fn() };
    const first = createFloorPropDrag(options); const disconnect = first.connect();
    first.start(s.pointer, "id", s.group, { x: .5, y: .5 }, square);
    s.emit("pointermove", { clientX: 550 }); s.emit("pointerup"); disconnect();
    const second = createFloorPropDrag(options); const dispose = second.connect();
    const clicked = vi.fn(); s.canvas.addEventListener("click", clicked);
    s.emit("click", {}, s.canvas); expect(clicked).not.toHaveBeenCalled();
    dispose();
  });
});
