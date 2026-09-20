import { useState } from "react";
import type { DesignConfiguration, Opening, Room, RoomType, Selection, Structure, Wall } from "../types";
import { addOpening, addRoom, addStraightWall, addWall, blankBoundary, cloneStructure, deleteWall, isStraightWall, metresPerNormalizedUnit, pointOnWall, validCoordinate, wallLengthMetres, type StraightOrientation } from "../utils/editState";
import { cloneConfiguration, FLOOR_FINISHES, roomDisplayName, ROOM_TYPES, roomTypeLabel, WALL_FINISHES } from "../utils/designState";
import { modelBounds } from "../utils/geometry";

type Props = { structure: Structure; selection: Selection; onSelect: (selection: Selection) => void; onChange: (structure: Structure) => void; editable: boolean; collapsed?: boolean; onToggle?: () => void; design?: DesignConfiguration; onDesignChange?: (configuration: DesignConfiguration) => void; designMode?: boolean };

function NumberInput({ label, value, onChange, max = 1 }: { label: string; value: number; onChange: (value: number) => void; max?: number }) {
  return <label className="field"><span>{label}</span><input type="number" value={value} min="0" max={max} step="0.001" onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next) && next >= 0 && next <= max) onChange(next); }} /></label>;
}

export default function StructureInspector({ structure, selection, onSelect, onChange, editable, collapsed = false, onToggle, design, onDesignChange, designMode = false }: Props) {
  const [wallMode, setWallMode] = useState<"free" | "straight">("free");
  const [straightLength, setStraightLength] = useState("3");
  const [straightOrientation, setStraightOrientation] = useState<StraightOrientation>("horizontal");
  const [wallError, setWallError] = useState<string | null>(null);
  const wall = selection?.kind === "wall" ? structure.walls.find((item) => item.id === selection.id) : undefined;
  const room = selection?.kind === "room" ? structure.rooms.find((item) => item.id === selection.id) : undefined;
  const opening = selection?.kind === "opening" ? structure.openings.find((item) => item.id === selection.id) : undefined;
  const openingCounts = structure.openings.reduce((counts, item) => ({ ...counts, [item.probable_type]: counts[item.probable_type] + 1 }), { door: 0, window: 0, unknown: 0 });
  const bounds = modelBounds(structure, metresPerNormalizedUnit(structure));
  const roomWidth = room ? Math.max(...room.polygon.map((point) => point.x)) - Math.min(...room.polygon.map((point) => point.x)) : 0;
  const roomDepth = room ? Math.max(...room.polygon.map((point) => point.y)) - Math.min(...room.polygon.map((point) => point.y)) : 0;

  const updateWall = (changes: Partial<Wall>) => {
    if (!wall) return;
    const next = cloneStructure(structure);
    const target = next.walls.find((item) => item.id === wall.id)!;
    Object.assign(target, changes);
    if (![target.start_x, target.start_y, target.end_x, target.end_y].every(validCoordinate)) return;
    if (Math.hypot(target.end_x - target.start_x, target.end_y - target.start_y) < 0.002) return;
    onChange(next);
  };
  const updateRoom = (changes: Partial<Room>) => {
    if (!room) return; const next = cloneStructure(structure); Object.assign(next.rooms.find((item) => item.id === room.id)!, changes); onChange(next);
    if (design && onDesignChange && ("name" in changes || "type" in changes)) {
      const configuration = cloneConfiguration(design);
      configuration.room_semantics[room.id] = { name: changes.name !== undefined ? changes.name : configuration.room_semantics[room.id]?.name ?? room.name, room_type: changes.type !== undefined ? changes.type : configuration.room_semantics[room.id]?.room_type ?? room.type };
      onDesignChange(configuration);
    }
  };
  const updateOpening = (changes: Partial<Opening>) => {
    if (!opening) return; const next = cloneStructure(structure); const target = next.openings.find((item) => item.id === opening.id)!; Object.assign(target, changes); const wall = next.walls.find((item) => item.id === target.wall_id); if (wall) target.position = pointOnWall(wall, target.position, target.width); onChange(next);
  };
  const updateDesign = (mutate: (configuration: DesignConfiguration) => void) => {
    if (!design || !onDesignChange) return;
    const next = cloneConfiguration(design); mutate(next); onDesignChange(next);
  };
  const wallAppearance = wall && design?.wall_appearances[wall.id];
  const floorAppearance = room && design?.floor_appearances[room.id];
  const roomSemantic = room && design?.room_semantics[room.id];
  const roomIndex = room ? structure.rooms.findIndex((item) => item.id === room.id) : -1;
  const doorConfiguration = opening && design?.door_configurations[opening.id];
  const windowConfiguration = opening && design?.window_configurations[opening.id];

  return <aside className={`inspector ${collapsed ? "is-collapsed" : ""}`} aria-label="Structural inspector">
    {onToggle && <button className="panel-collapse inspector-collapse" type="button" aria-expanded={!collapsed} onClick={onToggle} title={collapsed ? "Expand inspector" : "Collapse inspector"}>{collapsed ? "‹" : "›"}<span>{collapsed ? "Expand inspector" : "Collapse inspector"}</span></button>}
    <div className="inspector-content">
    <div className="inspector-heading"><div><span>Inspector</span><strong>{selection ? selection.kind[0].toUpperCase() + selection.kind.slice(1) : "Nothing selected"}</strong>{selection && <small>{selection.id}</small>}</div></div>
    {!selection && <><p className="inspector-empty">Select a wall, room, or opening to see its details.</p><div className="quick-stats"><strong>Quick stats</strong><dl><div><dt>Walls</dt><dd>{structure.walls.length}</dd></div><div><dt>Rooms</dt><dd>{structure.rooms.length}</dd></div><div><dt>Openings</dt><dd>{structure.openings.length}</dd></div><div><dt>Doors</dt><dd>{openingCounts.door}</dd></div><div><dt>Windows</dt><dd>{openingCounts.window}</dd></div><div><dt>Unknown</dt><dd>{openingCounts.unknown}</dd></div></dl></div></>}
    {wall && <div className="field-stack">
      <p className="dimension-line">Length <strong>{wallLengthMetres(structure, wall).toFixed(2)}</strong> {structure.physical_dimensions ? "approximate metres" : "approximate units"}</p>
      {editable && isStraightWall(wall) && <p className="field-note">Drag the wall to reposition it. Drag either endpoint to change its shape.</p>}
      {designMode && wallAppearance ? <><p className="field-note">Design wall height: {design?.wall_height.toFixed(1)} approximate units</p><label className="field"><span>Wall colour</span><input type="color" value={wallAppearance.color} onChange={(event) => updateDesign((next) => { next.wall_appearances[wall.id].color = event.target.value; })} /></label><label className="field"><span>Wall Finish</span><span className={`material-preview ${wallAppearance.finish}`} aria-hidden="true" /><select value={wallAppearance.finish} onChange={(event) => updateDesign((next) => { next.wall_appearances[wall.id].finish = event.target.value as typeof wallAppearance.finish; })}>{WALL_FINISHES.map((finish) => <option key={finish.value} value={finish.value}>{finish.label}</option>)}</select></label></> : <><p className="confidence-line">{structure.processing_metadata.pipeline_version === "starter-1" ? "Starter geometry" : <>Detection confidence <strong>{Math.round(wall.confidence * 100)}%</strong></>}</p><div className="field-grid"><NumberInput label="Start X" value={wall.start_x} onChange={(value) => updateWall({ start_x: value })} /><NumberInput label="Start Y" value={wall.start_y} onChange={(value) => updateWall({ start_y: value })} /><NumberInput label="End X" value={wall.end_x} onChange={(value) => updateWall({ end_x: value })} /><NumberInput label="End Y" value={wall.end_y} onChange={(value) => updateWall({ end_y: value })} /></div>{editable && <button className="danger-button" onClick={() => { onChange(deleteWall(structure, wall.id)); onSelect(null); }}>Delete wall</button>}</>}
    </div>}
    {room && <div className="field-stack">
      {designMode && <div className="room-semantic-summary"><span>Room</span><strong>{roomDisplayName(design, room, roomIndex)}</strong><span>Type: {roomTypeLabel(roomSemantic?.room_type ?? room.type)}</span><span>{structure.processing_metadata.pipeline_version === "starter-1" ? "Starter geometry" : `Detection confidence: ${Math.round(room.confidence * 100)}%`}</span></div>}
      <p className="dimension-line">Extent <strong>{(roomWidth * metresPerNormalizedUnit(structure)).toFixed(2)} × {(roomDepth * metresPerNormalizedUnit(structure)).toFixed(2)}</strong> {structure.physical_dimensions ? "approximate metres" : "approximate units"}</p>
      {designMode && floorAppearance && roomSemantic ? <><label className="field"><span>Custom room name</span><input value={roomSemantic.name ?? ""} placeholder="Example: Parents Bedroom" onChange={(event) => updateDesign((next) => { next.room_semantics[room.id].name = event.target.value || null; })} /></label><label className="field"><span>Room type</span><select value={roomSemantic.room_type ?? ""} onChange={(event) => updateDesign((next) => { next.room_semantics[room.id].room_type = (event.target.value || null) as RoomType | null; })}><option value="">Unassigned</option>{ROOM_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="field"><span>Floor colour / tone</span><input type="color" value={floorAppearance.color} onChange={(event) => updateDesign((next) => { next.floor_appearances[room.id].color = event.target.value; })} /></label><label className="field"><span>Floor Finish</span><span className={`material-preview ${floorAppearance.finish}`} aria-hidden="true" /><select value={floorAppearance.finish} onChange={(event) => updateDesign((next) => { next.floor_appearances[room.id].finish = event.target.value as typeof floorAppearance.finish; })}>{FLOOR_FINISHES.map((finish) => <option key={finish.value} value={finish.value}>{finish.label}</option>)}</select></label></> : <><p className="confidence-line">{structure.processing_metadata.pipeline_version === "starter-1" ? "Starter geometry" : <>Detection confidence <strong>{Math.round(room.confidence * 100)}%</strong></>}</p><label className="field"><span>Room name</span><input value={room.name ?? ""} disabled={!editable} placeholder="Unnamed room" onChange={(event) => updateRoom({ name: event.target.value || null })} /></label><label className="field"><span>Room type</span><select value={room.type ?? ""} disabled={!editable} onChange={(event) => updateRoom({ type: (event.target.value || null) as RoomType | null })}><option value="">Unassigned</option>{ROOM_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><p className="field-note">{room.id.startsWith("manual-room-") ? "Drag the room in the 2D plan; drag its lower-right handle to resize." : `${room.polygon.length} normalized boundary points`}</p>{editable && room.id.startsWith("manual-room-") && <button className="danger-button" type="button" onClick={() => { const next = cloneStructure(structure); next.rooms = next.rooms.filter((item) => item.id !== room.id); onChange(next); onSelect(null); }}>Delete room</button>}</>}
    </div>}
    {opening && <div className="field-stack">
      <p className="dimension-line">Width <strong>{(opening.width * metresPerNormalizedUnit(structure)).toFixed(2)}</strong> {structure.physical_dimensions ? "approximate metres" : "approximate units"}</p>
      {designMode && opening.probable_type === "door" && doorConfiguration ? <><label className="field"><span>Door colour</span><input type="color" value={doorConfiguration.color} onChange={(event) => updateDesign((next) => { next.door_configurations[opening.id].color = event.target.value; })} /></label><label className="field"><span>Door style</span><select value={doorConfiguration.style} onChange={(event) => updateDesign((next) => { next.door_configurations[opening.id].style = event.target.value as typeof doorConfiguration.style; })}><option value="standard">Standard</option><option value="sliding">Sliding</option><option value="double">Double</option></select></label><NumberInput label="Door width (normalized)" value={doorConfiguration.width} max={.5} onChange={(value) => value > 0 && updateDesign((next) => { next.door_configurations[opening.id].width = value; })} /></> : designMode && opening.probable_type === "window" && windowConfiguration ? <><label className="field"><span>Window tint</span><input type="color" value={windowConfiguration.color} onChange={(event) => updateDesign((next) => { next.window_configurations[opening.id].color = event.target.value; })} /></label><label className="field"><span>Window style</span><select value={windowConfiguration.style} onChange={(event) => updateDesign((next) => { next.window_configurations[opening.id].style = event.target.value as typeof windowConfiguration.style; })}><option value="standard">Standard</option><option value="wide">Wide</option><option value="floor_to_ceiling">Floor-to-Ceiling</option></select></label><NumberInput label="Window width (normalized)" value={windowConfiguration.width} max={.5} onChange={(value) => value > 0 && updateDesign((next) => { next.window_configurations[opening.id].width = value; })} /><NumberInput label="Window height" value={windowConfiguration.height} max={4.5} onChange={(value) => value >= .4 && updateDesign((next) => { next.window_configurations[opening.id].height = value; })} /></> : designMode ? <p className="field-note">Classify this opening as a door or window in Structure mode before styling it.</p> : <><p className={`confidence-line ${opening.confidence < .6 ? "low-confidence" : ""}`}>{structure.processing_metadata.pipeline_version === "starter-1" ? "Starter opening" : <>Detection confidence <strong>{Math.round(opening.confidence * 100)}%</strong></>}{opening.confidence < .6 && <small>Low-confidence candidate</small>}</p><label className="field"><span>Classification</span><select disabled={!editable} value={opening.probable_type} onChange={(event) => updateOpening({ probable_type: event.target.value as Opening["probable_type"] })}><option value="door">Door</option><option value="window">Window</option><option value="unknown">Unknown</option></select></label><label className="field"><span>Associated wall</span><select disabled={!editable} value={opening.wall_id ?? ""} onChange={(event) => updateOpening({ wall_id: event.target.value || null })}><option value="">Unassociated</option>{structure.walls.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label><div className="field-grid"><NumberInput label="Position X" value={opening.position.x} onChange={(value) => updateOpening({ position: { ...opening.position, x: value } })} /><NumberInput label="Position Y" value={opening.position.y} onChange={(value) => updateOpening({ position: { ...opening.position, y: value } })} /></div><NumberInput label="Opening width" value={opening.width} max={0.5} onChange={(value) => { if (value > 0) updateOpening({ width: value }); }} />{editable && <button className="danger-button" onClick={() => { const next = cloneStructure(structure); next.openings = next.openings.filter((item) => item.id !== opening.id); onChange(next); onSelect(null); }}>Remove opening</button>}</>}
    </div>}
    {selection?.kind === "floor" && <div className="field-stack"><p>Plan floor</p><p className="field-note">Detected extent: {bounds.width.toFixed(2)} × {bounds.depth.toFixed(2)} approximate units{designMode ? ". Select a room surface to customize its floor." : ""}</p></div>}
    {editable && <div className="add-actions">
      <div className="wall-builder"><strong>+ Add wall</strong><div className="wall-mode-buttons" role="group" aria-label="Wall creation mode">
        <button type="button" aria-pressed={wallMode === "free"} onClick={() => { setWallMode("free"); setWallError(null); }}>Free Wall</button>
        <button type="button" aria-pressed={wallMode === "straight"} onClick={() => { setWallMode("straight"); setWallError(null); }}>Straight Wall</button>
      </div>
      {wallMode === "free" ? <><p className="field-note">Create a wall with two independently draggable endpoints.</p><button className="tool-button" type="button" onClick={() => { const added = addWall(structure); onChange(added.structure); onSelect(added.selection); }}>Add Free Wall</button></> : <>
        <label className="field">Length (metres)<input type="number" min="0.2" max={(metresPerNormalizedUnit(structure) * .8).toFixed(1)} step="0.1" value={straightLength} onChange={(event) => { setStraightLength(event.target.value); setWallError(null); }} /></label>
        <div className="field"><span>Orientation</span><div className="wall-mode-buttons" role="group" aria-label="Straight wall orientation"><button type="button" aria-pressed={straightOrientation === "horizontal"} onClick={() => setStraightOrientation("horizontal")}>Horizontal</button><button type="button" aria-pressed={straightOrientation === "vertical"} onClick={() => setStraightOrientation("vertical")}>Vertical</button></div></div>
        {!structure.physical_dimensions && <p className="field-note">Length uses an approximate scale until physical dimensions are set.</p>}
        {wallError && <p className="design-error" role="alert">{wallError}</p>}
        <button className="tool-button" type="button" onClick={() => { try { const added = addStraightWall(structure, Number(straightLength), straightOrientation); onChange(added.structure); onSelect(added.selection); setWallError(null); } catch (reason) { setWallError(reason instanceof Error ? reason.message : "Invalid wall length."); } }}>Add Straight Wall</button>
      </>}
      </div>
      {blankBoundary(structure) && <button className="tool-button" type="button" onClick={() => { const added = addRoom(structure); onChange(added.structure); onSelect(added.selection); }}>+ Add Room</button>}
      {wall && <><button className="tool-button" type="button" onClick={() => { const added = addOpening(structure, wall.id, "door"); onChange(added.structure); onSelect(added.selection); }}>+ Add Door</button><button className="tool-button" type="button" onClick={() => { const added = addOpening(structure, wall.id, "window"); onChange(added.structure); onSelect(added.selection); }}>+ Add Window</button></>}
    </div>}
    </div>
  </aside>;
}
