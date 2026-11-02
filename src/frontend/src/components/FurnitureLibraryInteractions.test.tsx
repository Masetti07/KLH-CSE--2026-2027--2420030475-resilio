import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignConfiguration, Selection, Structure } from "../types";
import FurnitureLibrary from "./FurnitureLibrary";
import HomePropsPanel from "./HomePropsPanel";

const hooks = vi.hoisted(() => ({ value: undefined as unknown, refs: [] as any[], cursor: 0, effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [hooks.value === undefined ? initial : hooks.value, (value: unknown) => { hooks.value = value; }],
  useRef: () => { const index = hooks.cursor++; return hooks.refs[index] ??= { current: { focus: vi.fn() } }; },
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));
const structure = { id: "plan", walls: [{ id: "wall", start_x: .1, start_y: .1, end_x: .9, end_y: .1 }], rooms: [{ id: "room", polygon: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }] }], openings: [] } as unknown as Structure;
const configuration = { props: [] } as unknown as DesignConfiguration;
const text = (value: any): string => Array.isArray(value) ? value.map(text).join("") : typeof value === "string" ? value : "";
function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== "object") return [];
  return [element, ...nodes(element.props?.children)];
}
const button = (tree: any, label: string) => nodes(tree).find((node) => node.type === "button" && text(node.props.children) === label);
beforeEach(() => { hooks.value = undefined; hooks.refs = []; hooks.cursor = 0; hooks.effects = []; vi.stubGlobal("window", new EventTarget()); });
afterEach(() => vi.unstubAllGlobals());

describe("Furniture Library interactions", () => {
  it("opens/closes without changing workspace data, focuses Close, and restores trigger focus on Escape", () => {
    const props = { structure, configuration, selection: { kind: "room", id: "room" } as Selection, onSelect: vi.fn(), onChange: vi.fn(), onShow2D: vi.fn() };
    const render = () => { hooks.cursor = 0; hooks.effects = []; return FurnitureLibrary(props); };
    const initial = render(); button(initial, "Furniture Library").props.onClick();
    const opened = render();
    expect(button(opened, "Furniture Library").props["aria-expanded"]).toBe(true);
    const dialog = nodes(opened).find((node) => node.props.role === "dialog");
    expect(dialog.props["aria-modal"]).toBe("false");
    const panel = nodes(opened).find((node) => node.type === HomePropsPanel);
    expect(panel.props.configuration).toBe(configuration); expect(panel.props.selection).toBe(props.selection);
    expect(panel.props.onChange).toBe(props.onChange); expect(panel.props.library).toBe(true);
    const cleanup = hooks.effects[0]()!;
    expect(hooks.refs[1].current.focus).toHaveBeenCalledWith({ preventScroll: true });
    window.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" }));
    expect(hooks.value).toBe(false); expect(hooks.refs[0].current.focus).toHaveBeenCalledWith({ preventScroll: true });
    if (typeof cleanup === "function") cleanup();
    expect(props.onChange).not.toHaveBeenCalled(); expect(props.onSelect).not.toHaveBeenCalled(); expect(props.onShow2D).not.toHaveBeenCalled();
    expect(nodes(render()).some((node) => node.props.role === "dialog")).toBe(false);
  });
  it("provides a clear close button and supports toggling the trigger", () => {
    const props = { structure, configuration, selection: null, onSelect: vi.fn(), onChange: vi.fn(), onShow2D: vi.fn() };
    hooks.value = true;
    const tree = FurnitureLibrary(props);
    nodes(tree).find((node) => node.props["aria-label"] === "Close Furniture Library").props.onClick();
    expect(hooks.value).toBe(false);
    hooks.value = true; hooks.cursor = 0;
    button(FurnitureLibrary(props), "Furniture Library").props.onClick(); expect(hooks.value).toBe(false);
  });
  it.each([["Add TV", "room", "room", "kenney_tv"], ["Add Clock", "wall", "wall", "clock"]] as const)("uses the original add transaction for %s", (label, kind, id, type) => {
    const props = { structure, configuration, selection: { kind, id } as Selection, onSelect: vi.fn(), onChange: vi.fn(), onShow2D: vi.fn(), library: true };
    const tree = HomePropsPanel(props); const add = button(tree, label);
    expect(add.props.disabled).toBe(false); add.props.onClick();
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange.mock.calls[0][0].props[0]).toMatchObject({ type, placement_type: kind });
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "prop", id: "prop-1" });
    expect(configuration.props).toEqual([]); expect(props.onShow2D).not.toHaveBeenCalled();
  });
  it("keeps validation feedback and does not commit when the selected room no longer exists", () => {
    const props = { structure, configuration, selection: { kind: "room", id: "missing" } as Selection, onSelect: vi.fn(), onChange: vi.fn(), onShow2D: vi.fn(), library: true };
    button(HomePropsPanel(props), "Add TV").props.onClick();
    const alert = nodes(HomePropsPanel(props)).find((node) => node.props.role === "alert");
    expect(alert.props.children).toContain("no longer available");
    expect(props.onChange).not.toHaveBeenCalled(); expect(props.onSelect).not.toHaveBeenCalled();
  });
});
