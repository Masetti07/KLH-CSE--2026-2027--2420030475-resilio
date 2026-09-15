import type { Design, DesignConfiguration, Orientation } from "../types";
import { cloneConfiguration, orientationArrow } from "../utils/designState";

type Props = {
  designs: Design[]; active: Design | null; configuration: DesignConfiguration | null; dirty: boolean; busy: boolean;
  onLoad: (id: string) => void; onNameChange: (name: string) => void; onConfigurationChange: (configuration: DesignConfiguration) => void;
  onCreate: () => void; onSave: () => void; onDuplicate: () => void; onDelete: () => void;
};

export default function DesignManager({ designs, active, configuration, dirty, busy, onLoad, onNameChange, onConfigurationChange, onCreate, onSave, onDuplicate, onDelete }: Props) {
  const update = (mutate: (next: DesignConfiguration) => void) => { if (!configuration) return; const next = cloneConfiguration(configuration); mutate(next); onConfigurationChange(next); };
  return <section className="design-manager" aria-label="Design versions">
    <div className="design-manager-heading"><h3>Design versions</h3><span className={dirty ? "unsaved-label" : "saved-label"}>{dirty ? "Unsaved design changes" : "Saved"}</span></div>
    <label className="field"><span>Active design</span><select value={active?.id ?? ""} disabled={!designs.length || busy} onChange={(event) => onLoad(event.target.value)}>{!designs.length && <option value="">No designs yet</option>}{designs.map((design) => <option key={design.id} value={design.id}>{design.name}</option>)}</select></label>
    {active && <label className="field"><span>Design name</span><input value={active.name} maxLength={120} onChange={(event) => onNameChange(event.target.value)} /></label>}
    <div className="design-actions"><button onClick={onCreate} disabled={busy}>Create</button><button onClick={onSave} disabled={!active || !dirty || busy}>Save</button><button onClick={onDuplicate} disabled={!active || busy}>Save As / Duplicate</button><button className="danger-button" onClick={onDelete} disabled={!active || busy}>Delete</button></div>
    {configuration && <><label className="height-control"><span>Effective wall height <strong>{configuration.wall_height.toFixed(1)} m</strong></span><input type="range" min="2" max="5" step="0.1" value={configuration.wall_height} onChange={(event) => update((next) => { next.wall_height = Number(event.target.value); })} /></label><label className="field orientation-field"><span>North Orientation</span><select value={configuration.orientation ?? ""} onChange={(event) => update((next) => { next.orientation = event.target.value === "" ? null : Number(event.target.value) as Orientation; })}><option value="">Not confirmed</option>{([0, 90, 180, 270] as Orientation[]).map((value) => <option key={value} value={value}>North {orientationArrow(value)} · {value}°</option>)}</select></label><p className="field-note">Orientation is semantic metadata; it does not rotate structural geometry.</p></>}
  </section>;
}
