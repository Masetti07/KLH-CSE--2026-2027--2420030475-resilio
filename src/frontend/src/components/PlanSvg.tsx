import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DesignConfiguration, DirectionalZone, Orientation, Selection, Structure } from "../types";
import { cloneStructure, isStraightWall, moveRoom, pointOnWall, resizeRoom, translateWall, validCoordinate } from "../utils/editState";
import { orientationArrow, roomDisplayName } from "../utils/designState";
import { directionalZone, structuralBounds } from "../utils/orientation";
import { moveHomeProp, moveWallProp } from "../utils/homeProps";
import PropSymbols from "./PropSymbols";

type Drag = { wallId: string; endpoint: "start" | "end" } | { wallId: string; pointerStart: { x: number; y: number }; original: Structure } | { openingId: string } | { propId: string } | { roomId: string; pointerStart: { x: number; y: number }; original: Structure } | { roomId: string; resize: true } | null;

type Props = {
  structure: Structure;
  editable?: boolean;
  selection?: Selection;
  onSelect?: (selection: Selection) => void;
  onChange?: (structure: Structure) => void;
  orientation?: Orientation | null;
  showZones?: boolean;
  preferredZones?: DirectionalZone[];
  design?: DesignConfiguration | null;
  propEditable?: boolean;
  onDesignChange?: (configuration: DesignConfiguration) => void;
};

export default function PlanSvg({ structure, editable = false, selection = null, onSelect, onChange, orientation = null, showZones = false, preferredZones = [], design = null, propEditable = false, onDesignChange }: Props) {
  const drag = useRef<Drag>(null);
  const planBounds = structuralBounds(structure);
  const dimensions = structure.physical_dimensions;

  const normalizedPoint = (clientX: number, clientY: number, bounds: DOMRect) => {
    return { x: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)) };
  };

  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((!editable && !propEditable) || !drag.current) return;
    const point = normalizedPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    if (!validCoordinate(point.x) || !validCoordinate(point.y)) return;
    const active = drag.current;
    if ("propId" in active) {
      if (propEditable && design && onDesignChange) {
        const prop = design.props?.find((item) => item.id === active.propId);
        onDesignChange(prop?.placement_type === "wall" ? moveWallProp(design, structure, active.propId, point) : moveHomeProp(design, structure, active.propId, point));
      }
      return;
    }
    if (!editable || !onChange) return;
    if ("roomId" in active) {
      onChange("resize" in active ? resizeRoom(structure, active.roomId, point) : moveRoom(active.original, active.roomId, { x: point.x - active.pointerStart.x, y: point.y - active.pointerStart.y }));
      return;
    }
    if ("pointerStart" in active) {
      if (Math.abs(point.x - active.pointerStart.x) + Math.abs(point.y - active.pointerStart.y) < .0001) return;
      onChange(translateWall(active.original, active.wallId, point.x - active.pointerStart.x, point.y - active.pointerStart.y));
      return;
    }
    const next = cloneStructure(structure);
    if ("wallId" in active) {
      const target = next.walls.find((item) => item.id === active.wallId);
      if (!target) return;
      if (active.endpoint === "start") { target.start_x = point.x; target.start_y = point.y; }
      else { target.end_x = point.x; target.end_y = point.y; }
      if (Math.hypot(target.end_x - target.start_x, target.end_y - target.start_y) < 0.002) return;
    } else {
      const target = next.openings.find((item) => item.id === active.openingId);
      if (!target) return;
      const wall = next.walls.find((item) => item.id === target.wall_id);
      target.position = wall ? pointOnWall(wall, point, target.width) : point;
    }
    onChange(next);
  };

  return (
    <svg className="reconstruction-svg" viewBox="0 0 1000 1000" role="img" aria-label={`Structural plan with ${structure.walls.length} walls, ${structure.rooms.length} rooms, and ${structure.openings.length} openings`} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
      <rect width="1000" height="1000" fill="#fbfaf6" />
      {dimensions && (() => {
        const halfWidth = dimensions.width_m / dimensions.metres_per_normalized_unit * 500;
        const halfDepth = dimensions.depth_m / dimensions.metres_per_normalized_unit * 500;
        const x0 = 500 - halfWidth, x1 = 500 + halfWidth, y0 = 500 - halfDepth, y1 = 500 + halfDepth;
        return <g className="plan-dimensions" aria-label={`Approximate initial space: ${dimensions.width_m} by ${dimensions.depth_m} metres`}>
          <line x1={x0} y1={y0 - 34} x2={x1} y2={y0 - 34} stroke="#ad7141" strokeWidth="2" />
          <text x="500" y={y0 - 43} textAnchor="middle">{dimensions.width_m.toFixed(1)} m approx.</text>
          <line x1={x0 - 34} y1={y0} x2={x0 - 34} y2={y1} stroke="#ad7141" strokeWidth="2" />
          <text x={x0 - 44} y="500" textAnchor="middle" transform={`rotate(-90 ${x0 - 44} 500)`}>{dimensions.depth_m.toFixed(1)} m approx.</text>
          {structure.rooms.length === 0 && <text x="500" y="500" textAnchor="middle" className="blank-plan-label">Your space</text>}
        </g>;
      })()}
      {showZones && orientation !== null && Array.from({ length: 9 }, (_, index) => {
        const column = index % 3, row = Math.floor(index / 3);
        const width = (planBounds.maxX - planBounds.minX) / 3, height = (planBounds.maxY - planBounds.minY) / 3;
        const x = planBounds.minX + column * width, y = planBounds.minY + row * height;
        const zone = directionalZone({ x: x + width / 2, y: y + height / 2 }, planBounds, orientation);
        const preferred = preferredZones.includes(zone);
        return <g key={zone} aria-label={`${zone.replaceAll("_", " ")} zone${preferred ? ", configured preference for selected room" : ""}`} pointerEvents="none"><rect x={x * 1000} y={y * 1000} width={width * 1000} height={height * 1000} fill={preferred ? "#e1b275" : index % 2 ? "#dbe9e2" : "#f3dfc7"} fillOpacity={preferred ? ".42" : ".24"} stroke={preferred ? "#ae742e" : "#8ea69a"} strokeWidth={preferred ? "4" : "1.5"} strokeDasharray={preferred ? "10 7" : undefined} /><text x={(x + width / 2) * 1000} y={(y + height / 2) * 1000} textAnchor="middle" dominantBaseline="middle" fill="#26483c" fillOpacity=".62" fontSize="18" fontWeight="700">{zone.replaceAll("_", " ").toUpperCase()}</text></g>;
      })}
      {structure.rooms.map((room, index) => {
        const selected = selection?.kind === "room" && selection.id === room.id;
        const manual = editable && Boolean(structure.physical_dimensions) && room.id.startsWith("manual-room-");
        const right = Math.max(...room.polygon.map((point) => point.x)), bottom = Math.max(...room.polygon.map((point) => point.y));
        const centroid = { x: room.polygon.reduce((sum, point) => sum + point.x, 0) / room.polygon.length, y: room.polygon.reduce((sum, point) => sum + point.y, 0) / room.polygon.length };
        const label = roomDisplayName(design, room, index); const visibleLabel = label.length > 24 ? `${label.slice(0, 22)}…` : label;
        return <g key={room.id}>
          <polygon className={onSelect ? "selectable-shape" : ""} points={room.polygon.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")} fill={selected ? "rgba(229,155,81,.42)" : "rgba(203,230,220,.52)"} stroke={selected ? "#d97722" : "#75a894"} strokeWidth={selected ? 8 : 4} strokeDasharray="10 8" onPointerDown={(event) => { onSelect?.({ kind: "room", id: room.id }); if (manual) { drag.current = { roomId: room.id, pointerStart: normalizedPoint(event.clientX, event.clientY, event.currentTarget.ownerSVGElement!.getBoundingClientRect()), original: structure }; event.currentTarget.setPointerCapture(event.pointerId); } }}>
            <title>{structure.processing_metadata.pipeline_version === "starter-1" ? `${label}: editable starter room` : `${label}: ${Math.round(room.confidence * 100)}% confidence`}</title>
          </polygon>
          <text className="room-plan-label" x={centroid.x * 1000} y={centroid.y * 1000} textAnchor="middle" dominantBaseline="middle" aria-label={`Room label: ${label}`}>{visibleLabel}</text>
          {manual && selected && <circle className="endpoint-handle" cx={right * 1000} cy={bottom * 1000} r="16" aria-label="Resize room" onPointerDown={(event) => { event.stopPropagation(); drag.current = { roomId: room.id, resize: true }; event.currentTarget.setPointerCapture(event.pointerId); }} />}
        </g>;
      })}
      {structure.walls.map((wall) => {
        const selected = selection?.kind === "wall" && selection.id === wall.id;
        return <g key={wall.id}>
          <line className={editable ? isStraightWall(wall) ? "selectable-shape draggable-wall" : "selectable-shape" : propEditable ? "selectable-shape" : ""} x1={wall.start_x * 1000} y1={wall.start_y * 1000} x2={wall.end_x * 1000} y2={wall.end_y * 1000} stroke={selected ? "#e27728" : "#18352b"} strokeWidth={Math.max(selected ? 12 : 6, wall.thickness * 1000)} strokeLinecap="square" onPointerDown={(event) => { if (!editable && !propEditable) return; onSelect?.({ kind: "wall", id: wall.id }); if (editable && isStraightWall(wall)) { const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect(); if (bounds) { drag.current = { wallId: wall.id, pointerStart: normalizedPoint(event.clientX, event.clientY, bounds), original: structure }; event.currentTarget.setPointerCapture(event.pointerId); } } }}>
            <title>{structure.processing_metadata.pipeline_version === "starter-1" ? `${wall.id}: editable starter wall` : `${wall.id}: ${Math.round(wall.confidence * 100)}% confidence`}</title>
          </line>
          {editable && selected && <>
            <circle className="endpoint-handle" cx={wall.start_x * 1000} cy={wall.start_y * 1000} r="16" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { wallId: wall.id, endpoint: "start" }; }} />
            <circle className="endpoint-handle" cx={wall.end_x * 1000} cy={wall.end_y * 1000} r="16" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { wallId: wall.id, endpoint: "end" }; }} />
          </>}
        </g>;
      })}
      {structure.openings.map((opening) => {
        const selected = selection?.kind === "opening" && selection.id === opening.id;
        const low = opening.confidence < 0.6;
        const color = opening.probable_type === "door" ? "#dc7b2e" : opening.probable_type === "window" ? "#1689be" : "#d1a11d";
        const wall = structure.walls.find((item) => item.id === opening.wall_id);
        const angle = wall ? Math.atan2(wall.end_y - wall.start_y, wall.end_x - wall.start_x) * 180 / Math.PI : 0;
        const half = Math.max(20, opening.width * 500);
        return <g key={opening.id} className={editable ? "selectable-shape" : ""} transform={`translate(${opening.position.x * 1000} ${opening.position.y * 1000}) rotate(${angle})`} onPointerDown={(event) => { if (!editable) return; onSelect?.({ kind: "opening", id: opening.id }); drag.current = { openingId: opening.id }; event.currentTarget.setPointerCapture(event.pointerId); }}>
          {wall && opening.probable_type !== "unknown" ? <>
            <rect x={-half} y="-13" width={half * 2} height="26" fill="#fbfaf6" />
            {opening.probable_type === "window" ? <><line x1={-half} x2={half} y1="-5" y2="-5" stroke={color} strokeWidth="5" /><line x1={-half} x2={half} y1="5" y2="5" stroke={color} strokeWidth="5" /><line x1={-half} x2={-half} y1="-10" y2="10" stroke={color} strokeWidth="4" /><line x1={half} x2={half} y1="-10" y2="10" stroke={color} strokeWidth="4" /></> : <><line x1={-half} y1="0" x2={-half} y2={-half * 1.45} stroke={color} strokeWidth="5" /><path d={`M ${-half} ${-half * 1.45} A ${half * 1.45} ${half * 1.45} 0 0 1 ${half} 0`} fill="none" stroke={color} strokeWidth="3" strokeDasharray={low ? "5 4" : undefined} /></>}
            {selected && <circle r="9" fill="#ffffff" stroke="#172f27" strokeWidth="3" />}
            <rect x={-half} y="-17" width={half * 2} height="34" fill="transparent" />
          </> : <circle r={selected ? 20 : 14} fill={color} fillOpacity={low ? .55 : 1} stroke={selected ? "#172f27" : "#ffffff"} strokeWidth={selected ? 7 : 5} strokeDasharray={low ? "5 4" : undefined} />}
          <title>{structure.processing_metadata.pipeline_version === "starter-1" ? `${opening.id}: editable starter ${opening.probable_type}` : `${opening.id}: ${opening.probable_type}, ${Math.round(opening.confidence * 100)}% confidence, wall ${opening.wall_id ?? "unassociated"}`}</title>
        </g>;
      })}
      <PropSymbols props={design?.props ?? []} structure={structure} selection={selection} interactive={propEditable} onSelect={(id) => onSelect?.({ kind: "prop", id })} onPointerDown={(prop, event) => { event.stopPropagation(); onSelect?.({ kind: "prop", id: prop.id }); if (propEditable) { drag.current = { propId: prop.id }; event.currentTarget.setPointerCapture(event.pointerId); } }} />
      {orientation !== null && <g aria-label={`North orientation ${orientation} degrees`}><rect x="842" y="24" width="130" height="82" rx="12" fill="#ffffff" stroke="#476b5e" strokeWidth="3" /><text x="907" y="55" textAnchor="middle" fontSize="18" fontWeight="700" fill="#24463a">NORTH</text><text x="907" y="91" textAnchor="middle" fontSize="34" fill="#c2682c">{orientationArrow(orientation)}</text></g>}
    </svg>
  );
}
