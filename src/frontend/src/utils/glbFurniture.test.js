import { readFileSync } from "node:fs";
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { GLTFLoader } from "three-stdlib";
import { describe, expect, it } from "vitest";
import { GLB_FURNITURE, normalizeFurniture } from "./glbFurniture";
import { PROP_DIMENSIONS } from "./homeProps";

describe("optional local furniture", () => {
  it("registers 24 distinct local assets", () => {
    expect(Object.keys(GLB_FURNITURE)).toHaveLength(24);
    expect(new Set(Object.values(GLB_FURNITURE)).size).toBe(24);
  });
  it.each(Object.keys(GLB_FURNITURE))("loads and floor-aligns the actual %s asset without mutating it", async (type) => {
    const bytes = readFileSync(new URL(`../../public/assets/furniture/${GLB_FURNITURE[type]}`, import.meta.url));
    const data = new Uint8Array(bytes).buffer;
    // Ensure models cannot introduce external resource requests.
    const jsonLength = new DataView(data).getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, jsonLength)));
    expect(json.skins ?? []).toHaveLength(0);
    for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])]) expect(resource.uri).toBeUndefined();
    const { scene } = await new GLTFLoader().parseAsync(data, "");
    const before = scene.toJSON();
    for (const performance of [false, true]) {
      const object = normalizeFurniture(scene, PROP_DIMENSIONS[type], performance);
      const bounds = new Box3().setFromObject(object);
      const size = bounds.getSize(new Vector3());
      const center = bounds.getCenter(new Vector3());
      expect(bounds.min.y).toBeCloseTo(0);
      expect(center.x).toBeCloseTo(0); expect(center.z).toBeCloseTo(0);
      const target = PROP_DIMENSIONS[type];
      expect(size.x).toBeLessThanOrEqual(target.width + 1e-6);
      expect(size.y).toBeLessThanOrEqual(target.height + 1e-6);
      expect(size.z).toBeLessThanOrEqual(target.depth + 1e-6);
      expect(Math.max(size.x / target.width, size.y / target.height, size.z / target.depth)).toBeCloseTo(1);
      const originalMeshes = [];
      scene.traverse((node) => { if (node instanceof Mesh) originalMeshes.push(node); });
      let index = 0;
      object.traverse((node) => { if (node instanceof Mesh) {
        expect(node.material).toBe(originalMeshes[index++].material);
        expect(node.castShadow).toBe(!performance); expect(node.receiveShadow).toBe(!performance);
      } });
      expect(scene.toJSON()).toEqual(before);
    }
  });

  it("rejects empty or flat models so the per-prop boundary can show its fallback", () => {
    expect(() => normalizeFurniture(new Group(), PROP_DIMENSIONS.kenney_sink, false)).toThrow("invalid bounds");
    expect(() => normalizeFurniture(new Mesh(new BoxGeometry(0, 1, 1), new MeshStandardMaterial()), PROP_DIMENSIONS.kenney_sink, false)).toThrow("invalid bounds");
  });
});
