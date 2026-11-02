import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { Euler, Vector3 } from "three";
import OpeningDetails from "./OpeningDetails";

function meshes(element: any): ReactElement<any>[] {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap(meshes);
  return [...(element.type === "mesh" ? [element] : []), ...meshes(element.props?.children)];
}

describe("procedural opening details", () => {
  it.each(["door", "window"] as const)("keeps %s trim separated from both faces of the original mesh", (kind) => {
    const details = meshes(OpeningDetails({ kind, width: .9, height: 2.1, depth: .2, sill: 1, selected: false }));
    const trim = details.filter((mesh) => ["jamb--1", "jamb-1", "header", "bottom-frame"].includes(mesh.props.name));
    expect(trim).toHaveLength(kind === "door" ? 6 : 8);
    for (const mesh of trim) {
      const [width, height, depth] = mesh.props.children[0].props.args;
      const [x, y, z] = mesh.props.position;
      expect(Math.abs(x) + width / 2).toBeLessThanOrEqual(.45 + 1e-9);
      expect(Math.abs(y) + height / 2).toBeLessThanOrEqual(1.05 + 1e-9);
      expect(Math.abs(z) - depth / 2).toBeGreaterThan(.1);
    }
  });
  it.each([0, Math.PI / 2])("keeps handles on opposite wall faces at yaw %s", (yaw) => {
    const details = meshes(OpeningDetails({ kind: "door", width: .9, height: 2.1, depth: .2, sill: 0, selected: false }));
    const handles = details.filter((mesh) => mesh.props.name === "door-knob");
    expect(handles).toHaveLength(2);
    const normal = new Vector3(0, 0, 1).applyEuler(new Euler(0, yaw, 0));
    const sides = handles.map((mesh) => new Vector3(...mesh.props.position as [number, number, number]).applyEuler(new Euler(0, yaw, 0)).dot(normal));
    expect(sides[0]).toBeLessThan(-.1); expect(sides[1]).toBeGreaterThan(.1);
  });
  it("mirrors double-door handles and leaves floor-to-ceiling glass without a below-floor sill", () => {
    const handle = meshes(OpeningDetails({ kind: "door", width: .5, height: 2.1, depth: .2, sill: 0, selected: false, handleSide: -1 })).find((mesh) => mesh.props.name === "door-knob")!;
    expect(handle.props.position[0]).toBeLessThan(0);
    const standard = meshes(OpeningDetails({ kind: "window", width: 1, height: 1.1, depth: .2, sill: 1, selected: false }));
    const fullHeight = meshes(OpeningDetails({ kind: "window", width: 1, height: 2.5, depth: .2, sill: 0, selected: false }));
    expect(standard.some((mesh) => mesh.props.name === "window-sill")).toBe(true);
    expect(fullHeight.some((mesh) => mesh.props.name === "window-sill")).toBe(false);
  });
  it("keeps details finite for narrow openings and follows selection highlighting", () => {
    const details = meshes(OpeningDetails({ kind: "window", width: .14, height: .2, depth: .14, sill: 1, selected: true }));
    for (const mesh of details) {
      expect(mesh.props.children[0].props.args.every((value: number) => Number.isFinite(value) && value > 0)).toBe(true);
      expect(mesh.props.children[1].props.color).toBe("#ff8b30");
    }
  });
});
