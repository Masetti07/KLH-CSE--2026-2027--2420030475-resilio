import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DesignConfiguration, Orientation, Selection, Structure } from "../types";
import { cloneStructure, validCoordinate } from "../utils/editState";
import { orientationArrow, roomDisplayName } from "../utils/designState";
import { directionalZone, structuralBounds } from "../utils/orientation";

type Drag = { wallId: string; endpoint: "start" | "end" } | { openingId: string } | null;

type Props = {
  structure: Structure;
  editable?: boolean;
  selection?: Selection;
  onSelect?: (selection: Selection) => void;
  onChange?: (structure: Structure) => void;
  orientation?: Orientation | null;
  showZones?: boolean;
  design?: DesignConfiguration | null;
};

export default function PlanSvg({ structure, editable = false, selection = null, onSelect, onChange, orientation = null, showZones = false, design = null }: Props) {
  const drag = useRef<Drag>(null);
  const planBounds = structuralBounds(structure);

  const normalizedPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) };
  };

  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!editable || !drag.current || !onChange) return;
    const point = normalizedPoint(event);
    if (!validCoordinate(point.x) || !validCoordinate(point.y)) return;
    const next = cloneStructure(structure);
    const active = drag.current;
    if ("wallId" in active) {
      const target = next.walls.find((item) => item.id === active.wallId);
      if (!target) return;
      if (active.endpoint === "start") { target.start_x = point.x; target.start_y = point.y; }
      else { target.end_x = point.x; target.end_y = point.y; }
      if (Math.hypot(target.end_x - target.start_x, target.end_y - target.start_y) < 0.002) return;
    } else {
      const target = next.openings.find((item) => item.id === active.openingId);
      if (!target) return;
      target.position = point;
    }
    onChange(next);
  };

  return (
    <svg className="reconstruction-svg" viewBox="0 0 1000 1000" role="img" aria-label={`Structural plan with ${structure.walls.length} walls, ${structure.rooms.length} rooms, and ${structure.openings.length} openings`} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
      <rect width="1000" height="1000" fill="#fbfaf6" />
      {showZones && orientation !== null && Array.from({ length: 9 }, (_, index) => {
        const column = index % 3, row = Math.floor(index / 3);
        const width = (planBounds.maxX - planBounds.minX) / 3, height = (planBounds.maxY - planBounds.minY) / 3;
        const x = planBounds.minX + column * width, y = planBounds.minY + row * height;
        const zone = directionalZone({ x: x + width / 2, y: y + height / 2 }, planBounds, orientation);
        return <g key={zone}><rect x={x * 1000} y={y * 1000} width={width * 1000} height={height * 1000} fill={index % 2 ? "#dbe9e2" : "#f3dfc7"} fillOpacity=".46" stroke="#547267" strokeWidth="2" /><text x={(x + width / 2) * 1000} y={(y + height / 2) * 1000} textAnchor="middle" dominantBaseline="middle" fill="#26483c" fontSize="22" fontWeight="700">{zone.replace("_", " ").toUpperCase()}</text></g>;
      })}
      {structure.rooms.map((room, index) => {
        const selected = selection?.kind === "room" && selection.id === room.id;
        const centroid = { x: room.polygon.reduce((sum, point) => sum + point.x, 0) / room.polygon.length, y: room.polygon.reduce((sum, point) => sum + point.y, 0) / room.polygon.length };
        const label = roomDisplayName(design, room, index); const visibleLabel = label.length > 24 ? `${label.slice(0, 22)}…` : label;
        return <g key={room.id}>
          <polygon className={onSelect ? "selectable-shape" : ""} points={room.polygon.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")} fill={selected ? "rgba(229,155,81,.42)" : "rgba(203,230,220,.52)"} stroke={selected ? "#d97722" : "#75a894"} strokeWidth={selected ? 8 : 4} strokeDasharray="10 8" onPointerDown={() => onSelect?.({ kind: "room", id: room.id })}>
            <title>{structure.processing_metadata.pipeline_version === "starter-1" ? `${label}: editable starter room` : `${label}: ${Math.round(room.confidence * 100)}% confidence`}</title>
          </polygon>
          <text className="room-plan-label" x={centroid.x * 1000} y={centroid.y * 1000} textAnchor="middle" dominantBaseline="middle" aria-label={`Room label: ${label}`}>{visibleLabel}</text>
        </g>;
      })}
      {structure.walls.map((wall) => {
        const selected = selection?.kind === "wall" && selection.id === wall.id;
        return <g key={wall.id}>
          <line className={editable ? "selectable-shape" : ""} x1={wall.start_x * 1000} y1={wall.start_y * 1000} x2={wall.end_x * 1000} y2={wall.end_y * 1000} stroke={selected ? "#e27728" : "#18352b"} strokeWidth={Math.max(selected ? 12 : 6, wall.thickness * 1000)} strokeLinecap="square" onPointerDown={() => editable && onSelect?.({ kind: "wall", id: wall.id })}>
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
        return <g key={opening.id} className={editable ? "selectable-shape" : ""} transform={`translate(${opening.position.x * 1000} ${opening.position.y * 1000})`} onPointerDown={(event) => { if (!editable) return; onSelect?.({ kind: "opening", id: opening.id }); drag.current = { openingId: opening.id }; event.currentTarget.setPointerCapture(event.pointerId); }}>
          <circle r={selected ? 20 : 14} fill={color} fillOpacity={low ? .55 : 1} stroke={selected ? "#172f27" : "#ffffff"} strokeWidth={selected ? 7 : 5} strokeDasharray={low ? "5 4" : undefined} />
          <title>{structure.processing_metadata.pipeline_version === "starter-1" ? `${opening.id}: editable starter ${opening.probable_type}` : `${opening.id}: ${opening.probable_type}, ${Math.round(opening.confidence * 100)}% confidence, wall ${opening.wall_id ?? "unassociated"}`}</title>
        </g>;
      })}
      {orientation !== null && <g aria-label={`North orientation ${orientation} degrees`}><rect x="842" y="24" width="130" height="82" rx="12" fill="#ffffff" stroke="#476b5e" strokeWidth="3" /><text x="907" y="55" textAnchor="middle" fontSize="18" fontWeight="700" fill="#24463a">NORTH</text><text x="907" y="91" textAnchor="middle" fontSize="34" fill="#c2682c">{orientationArrow(orientation)}</text></g>}
    </svg>
  );
}
