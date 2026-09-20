import type { DesignConfiguration, Orientation, Selection, Structure, VastuAssistPreview } from "../types";
import { cloneConfiguration, orientationArrow, ROOM_TYPES, roomTypeLabel } from "../utils/designState";
import { evaluableResults, selectedRoomGuidance, VASTU_DISCLAIMER, zoneLabel } from "../utils/vastuAssist";

type Props = { structure: Structure; configuration: DesignConfiguration; selection: Selection; enabled: boolean; onEnabled: (value: boolean) => void; preview: VastuAssistPreview | null; busy: boolean; error: string | null; onConfigurationChange: (value: DesignConfiguration) => void; onSelect: (value: Selection) => void; onViewFull: () => void };

export default function VastuAssist({ structure, configuration, selection, enabled, onEnabled, preview, busy, error, onConfigurationChange, onSelect, onViewFull }: Props) {
  const selected = selectedRoomGuidance(preview, selection, configuration, structure);
  const selectedRoom = selection?.kind === "room" ? structure.rooms.find((room) => room.id === selection.id) : undefined;
  const evaluable = evaluableResults(preview);
  const update = (field: "orientation" | "room", value: string) => {
    const next = cloneConfiguration(configuration);
    if (field === "orientation") next.orientation = value === "" ? null : Number(value) as Orientation;
    else if (selectedRoom) next.room_semantics[selectedRoom.id] = { ...next.room_semantics[selectedRoom.id], name: next.room_semantics[selectedRoom.id]?.name ?? selectedRoom.name, room_type: value === "" ? null : value as typeof ROOM_TYPES[number]["value"] };
    onConfigurationChange(next);
  };
  return <section className="vastu-assist" aria-labelledby="vastu-assist-title">
    <div className="vastu-assist-heading"><div><p className="eyebrow">Optional editing guidance</p><h3 id="vastu-assist-title">Traditional Vastu Assist</h3></div><label className="zone-toggle"><input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.target.checked)} /> {enabled ? "ON" : "OFF"}</label></div>
    {enabled && <>
      <div className="vastu-assist-fields"><label className="field"><span>User-confirmed North</span><select value={configuration.orientation ?? ""} onChange={(event) => update("orientation", event.target.value)}><option value="">Select orientation</option>{([0, 90, 180, 270] as Orientation[]).map((value) => <option key={value} value={value}>North {orientationArrow(value)} · {value}°</option>)}</select></label>
        {selectedRoom && <label className="field"><span>Selected room purpose</span><select value={configuration.room_semantics[selectedRoom.id]?.room_type ?? ""} onChange={(event) => update("room", event.target.value)}><option value="">Unassigned</option>{ROOM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
      </div>
      {configuration.orientation === null ? <p role="status">Confirm North to show directional zones and guidance.</p> : busy ? <p role="status">Updating guidance…</p> : error ? <p role="alert" className="design-error">{error}</p> : preview && <div className="vastu-assist-content">
        <div className="vastu-assist-guidance"><strong>Selected room guidance</strong>{selectedRoom ? selected?.result && selected.rule ? <>
          <h4>{selected.semantic?.name || roomTypeLabel(selected.semantic?.room_type) || selectedRoom.name || selectedRoom.id}</h4>
          <p>Current zone: <strong>{selected.result.detected_zone ? zoneLabel(selected.result.detected_zone) : "Unavailable"}</strong></p>
          <p>Configured traditional preference: <strong>{selected.rule.preferred_zones.map(zoneLabel).join(", ")}</strong></p>
          <p className={selected.result.result === "satisfied" ? "assist-matched" : "assist-unmatched"}>{selected.result.result === "satisfied" ? "✓ Current placement matches the configured traditional preference." : "⚠ Current placement does not match this configured preference."}</p>
          <p>{selected.rule.description}</p>
        </> : <p>{configuration.room_semantics[selectedRoom.id]?.room_type ? "No enabled traditional rule is configured for this room purpose." : "Assign a room purpose to see applicable guidance."}</p> : <p>Select a room in the plan for guidance.</p>}</div>
        <div className="vastu-assist-summary"><strong>Current Rule Match</strong><p>{preview.analysis.counts.satisfied} of {evaluable.length} evaluable rules satisfied</p><ul>{evaluable.map((item) => <li key={`${item.rule_id}-${item.room_id}`}><button type="button" onClick={() => item.room_id && onSelect({ kind: "room", id: item.room_id })}><span aria-hidden="true">{item.result === "satisfied" ? "✓" : "⚠"}</span> {item.room_name || roomTypeLabel(item.room_type)}: {item.result === "satisfied" ? "Configured preference matched" : `${item.detected_zone ? zoneLabel(item.detected_zone) : "Unavailable"} → ${item.preferred_zones.map(zoneLabel).join(", ")}`}</button></li>)}</ul></div>
      </div>}
    </>}
    <button type="button" className="secondary-button" onClick={onViewFull}>View Full Analysis</button>
    <p className="vastu-disclaimer">{VASTU_DISCLAIMER}</p>
  </section>;
}
