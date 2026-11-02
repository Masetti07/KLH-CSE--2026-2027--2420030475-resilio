import { Box3, Group, Mesh, Vector3, type Object3D } from "three";
import type { HomePropType } from "../types";

export const GLB_FURNITURE = {
  kenney_sink: "bathroomSink.glb",
  kenney_bathtub: "bathtub.glb",
  kenney_bookcase: "bookcaseOpen.glb",
  kenney_tv_cabinet: "cabinetTelevision.glb",
  kenney_desk_chair: "chairDesk.glb",
  kenney_bed_bunk: "bedBunk.glb",
  kenney_side_table_drawers: "sideTableDrawers.glb",
  kenney_lounge_design_sofa: "loungeDesignSofa.glb",
  kenney_lounge_chair: "loungeChair.glb",
  kenney_lounge_sofa_long: "loungeSofaLong.glb",
  kenney_table_coffee: "tableCoffee.glb",
  kenney_kitchen_fridge: "kitchenFridge.glb",
  kenney_kitchen_stove: "kitchenStove.glb",
  kenney_kitchen_cabinet: "kitchenCabinet.glb",
  kenney_kitchen_bar: "kitchenBar.glb",
  kenney_table_round: "tableRound.glb",
  kenney_chair_modern_cushion: "chairModernCushion.glb",
  kenney_toilet: "toilet.glb",
  kenney_shower: "shower.glb",
  kenney_desk: "desk.glb",
  kenney_bookcase_closed: "bookcaseClosed.glb",
  kenney_lamp_round_floor: "lampRoundFloor.glb",
  kenney_potted_plant: "pottedPlant.glb",
  kenney_tv: "televisionModern.glb",
} as const;
export type GlbFurnitureType = keyof typeof GLB_FURNITURE;
export const isGlbFurniture = (type: HomePropType): type is GlbFurnitureType => Object.hasOwn(GLB_FURNITURE, type);

// Clone transforms and mesh flags; cached geometry/materials remain shared and unmodified.
export function normalizeFurniture(source: Object3D, dimensions: { width: number; height: number; depth: number }, performance: boolean): Group {
  const clone = source.clone(true);
  const bounds = new Box3().setFromObject(clone);
  const size = bounds.getSize(new Vector3());
  if (bounds.isEmpty() || ![size.x, size.y, size.z].every((value) => Number.isFinite(value) && value > 0)) throw new Error("Furniture has invalid bounds.");
  const scale = Math.min(dimensions.width / size.x, dimensions.height / size.y, dimensions.depth / size.z);
  const center = bounds.getCenter(new Vector3());
  const offset = new Group();
  offset.position.set(-center.x, -bounds.min.y, -center.z);
  offset.add(clone);
  const root = new Group();
  root.scale.setScalar(scale);
  root.add(offset);
  clone.traverse((object) => { if (object instanceof Mesh) { object.castShadow = !performance; object.receiveShadow = !performance; } });
  return root;
}
