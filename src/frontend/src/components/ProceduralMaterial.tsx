import { useEffect, useMemo } from "react";
import type { MaterialFinish } from "../utils/materialTextures";
import { createProceduralTexture, materialPatternSpec } from "../utils/materialTextures";

type Props = { finish: MaterialFinish; color: string; width: number; height: number; selected?: boolean };

export default function ProceduralMaterial({ finish, color, width, height, selected = false }: Props) {
  const texture = useMemo(() => createProceduralTexture(finish, color, width, height), [color, finish, height, width]);
  const spec = materialPatternSpec(finish);
  useEffect(() => () => texture?.dispose(), [texture]);
  return <meshStandardMaterial map={texture ?? undefined} color={selected && !texture ? "#e49a50" : texture ? "#ffffff" : color} emissive={selected ? "#71320d" : "#000000"} emissiveIntensity={selected ? .24 : 0} roughness={spec.roughness} metalness={spec.metalness} />;
}
