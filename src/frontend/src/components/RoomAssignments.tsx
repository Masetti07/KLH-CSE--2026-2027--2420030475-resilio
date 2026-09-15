import type { DesignConfiguration, RoomType, Selection, Structure } from "../types";
import { ROOM_TYPES, updateRoomSemantic } from "../utils/designState";

type Props = {
  structure: Structure;
  configuration: DesignConfiguration;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onChange: (configuration: DesignConfiguration) => void;
};

export default function RoomAssignments({ structure, configuration, selection, onSelect, onChange }: Props) {
  const assignedCount = structure.rooms.filter((room) => configuration.room_semantics[room.id]?.room_type).length;
  const remaining = structure.rooms.length - assignedCount;
  return <section className="room-assignments" aria-labelledby="room-assignments-title">
    <div className="room-assignments-heading"><div><h3 id="room-assignments-title">Room Assignments</h3><span>{structure.rooms.length} detected</span></div><div className={`assignment-status ${remaining ? "incomplete" : "ready"}`}><strong>{assignedCount} / {structure.rooms.length} assigned</strong><span>{remaining ? `${remaining} ${remaining === 1 ? "room still requires" : "rooms still require"} a semantic type.` : "Ready for Vastu analysis."}</span></div></div>
    <p className="field-note">Assign a purpose to existing room geometry. Names and types are saved with the active design; assignments never create walls or rooms.</p>
    <div className="room-assignment-list">
      {structure.rooms.map((room, index) => {
        const semantic = configuration.room_semantics[room.id] ?? { name: room.name, room_type: room.type };
        const selected = selection?.kind === "room" && selection.id === room.id;
        const selectRoom = () => onSelect({ kind: "room", id: room.id });
        return <article className={`room-assignment ${selected ? "selected" : ""}`} key={room.id}>
          <button type="button" className="room-assignment-select" aria-pressed={selected} onClick={selectRoom}>
            <strong>Room {index + 1}</strong><span>{semantic.name || "Unnamed"}</span>
          </button>
          <label className="field"><span>Name</span><input value={semantic.name ?? ""} placeholder={`Room ${index + 1}`} onFocus={selectRoom} onChange={(event) => onChange(updateRoomSemantic(configuration, room.id, { name: event.target.value || null }))} /></label>
          <label className="field"><span>Type</span><select value={semantic.room_type ?? ""} onFocus={selectRoom} onChange={(event) => onChange(updateRoomSemantic(configuration, room.id, { room_type: (event.target.value || null) as RoomType | null }))}><option value="">Unassigned</option>{ROOM_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        </article>;
      })}
    </div>
  </section>;
}
