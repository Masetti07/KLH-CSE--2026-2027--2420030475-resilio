import { Component, Suspense, useMemo, type ReactNode } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { GLB_FURNITURE, normalizeFurniture, type GlbFurnitureType } from "../utils/glbFurniture";
import { PROP_DIMENSIONS } from "../utils/homeProps";

function Placeholder({ type, failed = false }: { type: GlbFurnitureType; failed?: boolean }) {
  const size = PROP_DIMENSIONS[type];
  return <group>
    <mesh position={[0, size.height / 2, 0]}><boxGeometry args={[size.width, size.height, size.depth]} /><meshStandardMaterial color="#9b9487" wireframe /></mesh>
    <Html position={[0, size.height + .15, 0]} center><span role="status" style={{ whiteSpace: "nowrap", background: "#fff", color: "#333", padding: "2px 5px", fontSize: 12, pointerEvents: "none" }}>{failed ? "Model unavailable" : "Loading furniture…"}</span></Html>
  </group>;
}

export class FurnitureBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function LoadedFurniture({ type, performance }: { type: GlbFurnitureType; performance: boolean }) {
  // Only selected/placed models are requested; no preload or external decoders.
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}assets/furniture/${GLB_FURNITURE[type]}`, false, false);
  const object = useMemo(() => normalizeFurniture(scene, PROP_DIMENSIONS[type], performance), [scene, type, performance]);
  return <primitive object={object} dispose={null} />;
}

export default function GlbFurniture({ type, performance }: { type: GlbFurnitureType; performance: boolean }) {
  return <FurnitureBoundary key={type} fallback={<Placeholder type={type} failed />}>
    <Suspense fallback={<Placeholder type={type} />}><LoadedFurniture type={type} performance={performance} /></Suspense>
  </FurnitureBoundary>;
}
