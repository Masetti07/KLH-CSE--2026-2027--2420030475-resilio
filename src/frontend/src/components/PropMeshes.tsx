import type { DesignConfiguration, HomePropType, Selection, Structure } from "../types";
import { RoundedBox } from "@react-three/drei";
import { normalizedToWorld, wallThickness, worldScale } from "../utils/geometry";
import { homePropPosition, roomPropScale, wallMountYaw } from "../utils/homeProps";

type ShapeProps = { type: HomePropType; performance: boolean };
const Box = ({ at, size, color, performance, radius = 0 }: { at: [number, number, number]; size: [number, number, number]; color: string; performance: boolean; radius?: number }) => radius
  ? <RoundedBox position={at} args={size} radius={Math.min(radius, Math.min(...size) / 2 - .005)} smoothness={2} castShadow={!performance} receiveShadow={!performance}><meshStandardMaterial color={color} roughness={.78} /></RoundedBox>
  : <mesh position={at} castShadow={!performance} receiveShadow={!performance}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.68} /></mesh>;
const Cylinder = ({ at, radius, height, color, performance, sides = 16 }: { at: [number, number, number]; radius: number; height: number; color: string; performance: boolean; sides?: number }) => <mesh position={at} castShadow={!performance}><cylinderGeometry args={[radius, radius, height, sides]} /><meshStandardMaterial color={color} roughness={.65} /></mesh>;

function Shape({ type, performance }: ShapeProps) {
  switch (type) {
    case "bed": return <>
      <Box at={[0, .19, 0]} size={[1.75, .28, 2.15]} color="#875f45" performance={performance} />
      <Box at={[0, .4, 0]} size={[1.62, .18, 2.02]} color="#f4ead9" performance={performance} radius={.08} />
      <Box at={[0, .67, -.99]} size={[1.75, .36, .16]} color="#76513d" performance={performance} />
      <Box at={[0, .52, .38]} size={[1.58, .12, 1.12]} color="#809b8c" performance={performance} radius={.08} />
      {[-.42, .42].map((x) => <Box key={x} at={[x, .54, -.67]} size={[.62, .12, .34]} color="#fff8ee" performance={performance} radius={.08} />)}
    </>;
    case "sofa": return <>
      <Box at={[0, .39, 0]} size={[2.05, .36, .95]} color="#b79b80" performance={performance} radius={.08} />
      <Box at={[0, .67, -.38]} size={[2.05, .44, .20]} color="#9e8269" performance={performance} radius={.08} />
      {[-.94, .94].map((x) => <Box key={x} at={[x, .54, 0]} size={[.18, .4, .95]} color="#a88b71" performance={performance} radius={.07} />)}
      {[-.48, .48].map((x) => <Box key={x} at={[x, .61, .13]} size={[.84, .12, .58]} color="#d1baa0" performance={performance} radius={.08} />)}
      <Box at={[-.55, .75, -.19]} size={[.32, .3, .10]} color="#789278" performance={performance} radius={.06} />
    </>;
    case "table": return <>
      <Cylinder at={[0, .72, 0]} radius={.62} height={.1} color="#a5734a" performance={performance} sides={24} />
      <Cylinder at={[0, .36, 0]} radius={.11} height={.66} color="#765239" performance={performance} />
      <Cylinder at={[0, .08, 0]} radius={.38} height={.08} color="#765239" performance={performance} sides={20} />
    </>;
    case "armchair": return <>
      <Box at={[0, .39, 0]} size={[.88, .3, .82]} color="#c6a879" performance={performance} radius={.06} />
      <Box at={[0, .67, -.34]} size={[.88, .48, .16]} color="#b8996c" performance={performance} radius={.06} />
      {[-.38, .38].map((x) => <Box key={x} at={[x, .52, 0]} size={[.13, .32, .82]} color="#ad8d61" performance={performance} radius={.04} />)}
      <Box at={[0, .56, .09]} size={[.65, .11, .56]} color="#dfc69d" performance={performance} radius={.04} />
      {[-.32, .32].flatMap((x) => [-.3, .3].map((z) => <Box key={`${x}-${z}`} at={[x, .12, z]} size={[.07, .22, .07]} color="#71543b" performance={performance} />))}
    </>;
    case "cupboard": return <>
      <Box at={[0, 1.02, 0]} size={[1.4, 2.05, .58]} color="#8a6042" performance={performance} />
      {[-.35, .35].map((x) => <Box key={x} at={[x, 1.06, .307]} size={[.66, 1.83, .025]} color="#a77951" performance={performance} />)}
      {[-.09, .09].map((x) => <Box key={x} at={[x, 1.04, .335]} size={[.025, .18, .02]} color="#d7b878" performance={performance} />)}
      <Box at={[0, .06, .07]} size={[1.45, .12, .62]} color="#62462f" performance={performance} />
    </>;
    case "flower_vase": return <>
      <mesh position={[0, .18, 0]} castShadow={!performance}><cylinderGeometry args={[.11, .18, .36, 12]} /><meshStandardMaterial color="#d7b38c" roughness={.68} /></mesh>
      <Cylinder at={[0, .39, 0]} radius={.1} height={.12} color="#c39270" performance={performance} sides={12} />
      {[-.11, 0, .12].map((x, i) => <group key={i}><Cylinder at={[x / 2, .63 + i * .04, 0]} radius={.012} height={.43} color="#5e7950" performance={performance} sides={6} /><mesh position={[x, .76 + i * .04, .06]} rotation={[0, 0, x * 2]}><sphereGeometry args={[.13, 8, 6]} /><meshStandardMaterial color={i === 1 ? "#779563" : "#6d8d5b"} /></mesh></group>)}
    </>;
    case "clock": return <>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.24, .24, .055, 24]} /><meshStandardMaterial color="#73553d" /></mesh>
      <mesh position={[0, 0, .035]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.205, .205, .008, 24]} /><meshStandardMaterial color="#f5ead6" /></mesh>
      <Box at={[0, .067, .045]} size={[.014, .14, .01]} color="#2b3a35" performance={performance} /><Box at={[.045, 0, .047]} size={[.09, .014, .01]} color="#2b3a35" performance={performance} />
      <mesh position={[0, 0, .054]}><sphereGeometry args={[.018, 8, 6]} /><meshStandardMaterial color="#2b3a35" /></mesh>
    </>;
    case "painting": return <>
      <Box at={[0, 0, 0]} size={[.9, .65, .06]} color="#9a673d" performance={performance} />
      <Box at={[0, 0, .038]} size={[.8, .55, .009]} color="#d9d7b8" performance={performance} />
      <Box at={[-.18, .10, .048]} size={[.25, .22, .005]} color="#849c89" performance={performance} />
      <Box at={[.16, -.11, .049]} size={[.37, .18, .005]} color="#b57a5b" performance={performance} />
      <Box at={[.17, .15, .05]} size={[.18, .13, .005]} color="#d6af76" performance={performance} />
    </>;
  }
}

export default function PropMeshes({ structure, design, selection, onSelect, performance }: { structure: Structure; design?: DesignConfiguration; selection: Selection; onSelect: (selection: Selection) => void; performance: boolean }) {
  const scale = worldScale(structure);
  return <>{(design?.props ?? []).map((prop) => {
    const wall = prop.placement_type === "wall" ? structure.walls.find((item) => item.id === prop.wall_id) : undefined;
    if (prop.placement_type === "wall" && !wall) return null;
    const point = normalizedToWorld(homePropPosition(prop, structure), scale);
    const selected = selection?.kind === "prop" && selection.id === prop.id;
    const roomScale = roomPropScale(prop, structure);
    const wallDepth = wall ? wallThickness(wall, scale) / 2 + .07 : 0;
    return <group key={prop.id} position={[point.x, wall ? Math.min(structure.wall_height - .4, 1.65) : .04, point.z]} rotation={[0, wall ? wallMountYaw(structure, wall) : -prop.rotation * Math.PI / 180, 0]} scale={wall ? 1 : roomScale} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "prop", id: prop.id }); }}>
      <group position={[0, 0, wallDepth]}><Shape type={prop.type} performance={performance} /></group>
      {selected && (wall ? <Box at={[0, 0, wallDepth - .035]} size={[prop.type === "painting" ? .98 : .56, prop.type === "painting" ? .73 : .56, .015]} color="#ec8b43" performance={performance} /> : <mesh position={[0, .025, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.6, .65, 32]} /><meshBasicMaterial color="#ec8b43" /></mesh>)}
    </group>;
  })}</>;
}
