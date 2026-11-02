type Props = { kind: "door" | "window"; width: number; height: number; depth: number; sill: number; selected: boolean; handleSide?: number };

// Decorative children of the existing opening mesh: no structural or edit changes.
export default function OpeningDetails({ kind, width, height, depth, sill, selected, handleSide = 1 }: Props) {
  const trim = Math.min(.035, width * .12, height * .08);
  const frameColor = selected ? "#ff8b30" : "#ece6db";
  const bar = (name: string, position: [number, number, number], size: [number, number, number]) => <mesh key={name} name={name} position={position}>
    <boxGeometry args={size} /><meshStandardMaterial color={frameColor} roughness={.75} />
  </mesh>;
  return <group name="opening-details">
    {[-1, 1].map((face) => {
      const z = face * (depth / 2 + .012);
      return <group key={face}>
        {[-1, 1].map((side) => bar(`jamb-${side}`, [side * (width - trim) / 2, 0, z], [trim, height, .02]))}
        {bar("header", [0, (height - trim) / 2, z], [Math.max(.001, width - trim * 2), trim, .02])}
        {kind === "window" && bar("bottom-frame", [0, -(height - trim) / 2, z], [Math.max(.001, width - trim * 2), trim, .02])}
        {kind === "door" && <mesh name="door-knob" position={[handleSide * width * .32, Math.min(1, height * .48) - height / 2, face * (depth / 2 + .035)]}>
          <sphereGeometry args={[Math.min(.028, width * .08), 8, 6]} /><meshStandardMaterial color="#b6aca0" roughness={.35} metalness={.6} />
        </mesh>}
      </group>;
    })}
    {kind === "window" && sill > .08 && bar("window-sill", [0, -height / 2 - .025, 0], [width + .08, .04, depth + .12])}
  </group>;
}
