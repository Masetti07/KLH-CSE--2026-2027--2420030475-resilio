import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PerspectiveCamera } from "three";
import type { DesignConfiguration, Selection, Structure } from "../types";
import { orientationArrow, structureWithEffectiveWallHeight } from "../utils/designState";
import { cameraFrame, modelBounds, normalizedToWorld, openingTransform, openingVisualDepth, wallAngle, wallLength, wallMidpoint, wallThickness, worldScale, type ModelBounds } from "../utils/geometry";
import { rendererSettings } from "../utils/rendererQuality";
import ProceduralMaterial from "./ProceduralMaterial";
import PropMeshes from "./PropMeshes";

type CameraCommand = { name: "reset" | "top" | "perspective"; sequence: number };

function CameraRig({ command, bounds, modelKey }: { command: CameraCommand; bounds: ModelBounds; modelKey: string }) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const mode = command.name === "top" ? "top" : "perspective";
  const frame = useMemo(() => cameraFrame(bounds, size.width / Math.max(1, size.height), mode), [bounds, mode, size.height, size.width]);
  useEffect(() => {
    camera.position.set(...frame.position);
    camera.up.set(0, 1, 0);
    camera.near = frame.near; camera.far = frame.far;
    if (camera instanceof PerspectiveCamera) camera.updateProjectionMatrix();
    controls.current?.target.set(...frame.target);
    camera.lookAt(...frame.target); controls.current?.update();
  }, [camera, command.sequence, modelKey, size.height, size.width]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={frame.minDistance} maxDistance={frame.maxDistance} maxPolarAngle={Math.PI / 2.01} screenSpacePanning />;
}

function TelemetryProbe({ onTelemetry }: { onTelemetry?: (fps: number, frameTime: number) => void }) {
  const sample = useRef({ frames: 0, elapsed: 0 });
  useFrame((_, delta) => { sample.current.frames += 1; sample.current.elapsed += delta; if (sample.current.elapsed >= 3) { const fps = sample.current.frames / sample.current.elapsed; onTelemetry?.(fps, 1000 / Math.max(1, fps)); sample.current = { frames: 0, elapsed: 0 }; } });
  return null;
}

function Scene({ structure, design, selection, onSelect, command, bounds, performance, shadowMapSize, onTelemetry }: { structure: Structure; design?: DesignConfiguration; selection: Selection; onSelect: (selection: Selection) => void; command: CameraCommand; bounds: ModelBounds; performance: boolean; shadowMapSize: number; onTelemetry?: (fps: number, frameTime: number) => void }) {
  const scale = worldScale(structure);
  const gridSize = Math.max(bounds.width, bounds.depth) * 1.45;
  return <>
    <hemisphereLight color="#fffdf7" groundColor="#68756e" intensity={1.45} />
    <directionalLight position={[bounds.center.x + gridSize * .55, bounds.maxY + gridSize, bounds.center.z + gridSize * .4]} intensity={1.8} castShadow={!performance} shadow-mapSize-width={shadowMapSize} shadow-mapSize-height={shadowMapSize} />
    <mesh position={[bounds.center.x, -0.045, bounds.center.z]} receiveShadow={!performance} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "floor", id: structure.id }); }}>
      <boxGeometry args={[bounds.width, 0.09, bounds.depth]} /><meshStandardMaterial color={selection?.kind === "floor" ? "#d8b782" : "#e8e1d4"} roughness={.94} />
    </mesh>
    {structure.rooms.map((room) => {
      const xs = room.polygon.map((point) => normalizedToWorld(point, scale).x); const zs = room.polygon.map((point) => normalizedToWorld(point, scale).z);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const appearance = design?.floor_appearances[room.id];
      return <mesh key={room.id} position={[(minX + maxX) / 2, .015, (minZ + maxZ) / 2]} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "room", id: room.id }); }}>
        <boxGeometry args={[Math.max(.05, maxX - minX), .035, Math.max(.05, maxZ - minZ)]} /><ProceduralMaterial finish={appearance?.finish ?? "neutral"} color={appearance?.color ?? "#e8e1d4"} width={Math.max(.05, maxX - minX)} height={Math.max(.05, maxZ - minZ)} selected={selection?.kind === "room" && selection.id === room.id} />
      </mesh>;
    })}
    {structure.walls.map((wall) => {
      const midpoint = wallMidpoint(wall, scale); const selected = selection?.kind === "wall" && selection.id === wall.id;
      const appearance = design?.wall_appearances[wall.id];
      return <mesh key={wall.id} position={[midpoint.x, structure.wall_height / 2, midpoint.z]} rotation={[0, -wallAngle(wall), 0]} castShadow={!performance} receiveShadow={!performance} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "wall", id: wall.id }); }}>
        <boxGeometry args={[wallLength(wall, scale), structure.wall_height, wallThickness(wall, scale)]} /><ProceduralMaterial finish={appearance?.finish ?? "paint"} color={appearance?.color ?? "#eee9de"} width={wallLength(wall, scale)} height={structure.wall_height} selected={selected} />
      </mesh>;
    })}
    {structure.openings.map((opening) => {
      const wall = structure.walls.find((item) => item.id === opening.wall_id); const transform = openingTransform(opening, wall, scale); const selected = selection?.kind === "opening" && selection.id === opening.id;
      const door = design?.door_configurations[opening.id]; const window = design?.window_configurations[opening.id];
      const isWindow = opening.probable_type === "window"; const isDoor = opening.probable_type === "door";
      const configuredWidth = isDoor ? door?.width ?? opening.width : isWindow ? window?.width ?? opening.width : opening.width;
      const width = Math.max(.14, configuredWidth * scale * (isWindow && window?.style === "wide" ? 1.2 : 1));
      const height = isWindow ? (window?.style === "floor_to_ceiling" ? Math.max(2.2, window.height) : window?.height ?? transform.height) : transform.height;
      const sill = isWindow ? window?.style === "floor_to_ceiling" ? 0 : transform.sillHeight : 0;
      const color = isDoor ? door?.color ?? "#8b4d28" : isWindow ? window?.color ?? "#67b9dc" : "#d39b28";
      const panels = isDoor && door?.style === "double" ? 2 : 1; const panelWidth = panels === 2 ? width / 2 - .025 : door?.style === "sliding" ? width * 1.08 : width;
      return <group key={opening.id} position={[transform.x, sill + height / 2, transform.z]} rotation={[0, -transform.angle, 0]} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "opening", id: opening.id }); }}>
        {Array.from({ length: panels }, (_, index) => <mesh key={index} position={[panels === 2 ? (index ? 1 : -1) * (panelWidth / 2 + .025) : 0, 0, 0]} castShadow={!performance}>
          <boxGeometry args={[panelWidth, height, openingVisualDepth(wall, scale, isWindow)]} /><meshStandardMaterial color={selected ? "#ff8b30" : color} emissive={selected ? "#5d2100" : "#000000"} transparent={isWindow} opacity={isWindow ? .66 : 1} roughness={isWindow ? .22 : .65} metalness={isWindow ? .12 : 0} />
        </mesh>)}
      </group>;
    })}
    <PropMeshes structure={structure} design={design} selection={selection} onSelect={onSelect} performance={performance} />
    <Grid args={[gridSize, gridSize]} position={[bounds.center.x, -.095, bounds.center.z]} cellSize={Math.max(.25, gridSize / 30)} sectionSize={Math.max(1, gridSize / 6)} cellColor="#acb6b0" sectionColor="#7e8d85" cellThickness={.45} sectionThickness={.75} fadeDistance={gridSize * 1.1} fadeStrength={1.3} />
    <CameraRig command={command} bounds={bounds} modelKey={structure.id} />
    <TelemetryProbe onTelemetry={onTelemetry} />
  </>;
}

type Props = { structure: Structure; design?: DesignConfiguration; selection: Selection; onSelect: (selection: Selection) => void; fullscreen: boolean; onToggleFullscreen: () => void; renderingQuality?: "NORMAL" | "PERFORMANCE"; available?: boolean; onTelemetry?: (fps: number, frameTime: number) => void };

export default function ThreeViewer({ structure, design, selection, onSelect, fullscreen, onToggleFullscreen, renderingQuality = "NORMAL", available = true, onTelemetry }: Props) {
  const [command, setCommand] = useState<CameraCommand>({ name: "perspective", sequence: 0 });
  const renderStructure = useMemo(() => structureWithEffectiveWallHeight(structure, design), [design, structure]);
  const bounds = useMemo(() => modelBounds(renderStructure, worldScale(renderStructure)), [renderStructure]);
  const settings = rendererSettings(renderingQuality);
  const issue = (name: CameraCommand["name"]) => setCommand((current) => ({ name, sequence: current.sequence + 1 }));
  if (!available) return <div className="renderer-fallback" role="status"><strong>3D rendering is temporarily unavailable.</strong><p>Your design is preserved and the 2D workspace remains available.</p></div>;
  return <div className="three-viewer">
    <div className="viewer-toolbar"><span>Approximate normalized geometry {design?.orientation !== null && design?.orientation !== undefined ? `· North ${orientationArrow(design.orientation)}` : ""}</span><div className="viewer-actions"><button onClick={() => issue("reset")}>Reset</button><button onClick={() => issue("top")}>Top</button><button onClick={() => issue("perspective")}>3D / Perspective</button><button className="fullscreen-button" aria-pressed={fullscreen} onClick={onToggleFullscreen}>{fullscreen ? "Exit fullscreen" : "Fullscreen 3D"}</button></div></div>
    <div className="three-canvas"><Canvas shadows={settings.shadows} dpr={settings.dpr} camera={{ position: [8, 8, 8], fov: 42, near: .05, far: 150 }}><Scene structure={renderStructure} design={design} selection={selection} onSelect={onSelect} command={command} bounds={bounds} performance={renderingQuality === "PERFORMANCE"} shadowMapSize={settings.shadowMapSize} onTelemetry={onTelemetry} /></Canvas></div>
    <div className="viewport-help" aria-label="3D navigation help"><span>Left drag: Orbit</span><span>Right drag: Pan</span><span>Scroll: Zoom</span></div>
  </div>;
}
