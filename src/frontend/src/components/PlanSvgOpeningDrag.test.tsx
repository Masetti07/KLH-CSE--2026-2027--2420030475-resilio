import { describe, expect, it, vi } from "vitest";
import PlanSvg from "./PlanSvg";
import type { Structure } from "../types";

const state = vi.hoisted(() => ({ drag: { current: null as any }, preview: null as any }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useRef: () => state.drag, useState: () => [state.preview, (value: unknown) => { state.preview = value; }] }));
const wall = { id: "h", start_x: .1, start_y: .2, end_x: .9, end_y: .2, thickness: .02, confidence: 1 };
const structure = { id: "plan", wall_height: 3, processing_metadata: { pipeline_version: "test" }, walls: [wall, { ...wall, id: "v", start_x: .8, end_x: .8, start_y: .1, end_y: .9 }], rooms: [], openings: [{ id: "opening", wall_id: "h", position: { x: .4, y: .2 }, width: .1, probable_type: "door", confidence: 1 }] } as unknown as Structure;
function find(element: any, key: string): any {
  if (Array.isArray(element)) return element.map((child) => find(child, key)).find(Boolean);
  if (!element || typeof element !== "object") return null;
  return element.key === key ? element : find(element.props?.children, key);
}
function setup(width = 1000) {
  state.drag.current = null; state.preview = null;
  const onChange = vi.fn(), onSelect = vi.fn();
  const svg = { getBoundingClientRect: () => ({ left: 0, top: 0, width, height: 1000 }), setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() };
  const render = () => PlanSvg({ structure, editable: true, onChange, onSelect });
  const begin = find(render(), "opening");
  begin.props.onPointerDown({ button: 0, pointerId: 1, currentTarget: { ownerSVGElement: svg }, stopPropagation: vi.fn() });
  const event = (x: number, y: number) => ({ pointerId: 1, currentTarget: svg, clientX: x + (width - 1000) / 2, clientY: y });
  return { onChange, onSelect, render, event };
}
describe("2D opening drag transaction", () => {
  it("previews reassignment without committing, then saves exactly once on release", () => {
    const s = setup(); s.render().props.onPointerMove(s.event(790, 600));
    expect(state.preview.snap.wallId).toBe("v"); expect(s.onChange).not.toHaveBeenCalled();
    expect(find(s.render(), "opening").props.transform).toBe("translate(800 600) rotate(90)");
    s.render().props.onPointerUp(s.event(790, 600));
    expect(s.onChange).toHaveBeenCalledTimes(1); expect(s.onChange.mock.calls[0][0].openings[0].wall_id).toBe("v");
    expect(state.preview).toBeNull(); expect(state.drag.current).toBeNull();
  });
  it.each(["onPointerUp", "onPointerCancel", "onPointerLeave", "onLostPointerCapture"])("cancels an invalid/interrupted drop via %s", (handler) => {
    const s = setup(); s.render().props.onPointerMove(s.event(790, 600));
    s.render().props[handler](s.event(500, 500));
    expect(s.onChange).not.toHaveBeenCalled(); expect(state.preview).toBeNull();
    expect(find(s.render(), "opening").props.transform).toBe("translate(400 200) rotate(0)");
  });
  it("handles letterboxed views and ignores another pointer's release", () => {
    const s = setup(1400); s.render().props.onPointerMove(s.event(790, 600));
    expect(state.preview.snap.wallId).toBe("v");
    s.render().props.onPointerUp({ ...s.event(790, 600), pointerId: 2 }); expect(s.onChange).not.toHaveBeenCalled();
    s.render().props.onPointerUp(s.event(790, 600)); expect(s.onChange).toHaveBeenCalledTimes(1);
  });
});
