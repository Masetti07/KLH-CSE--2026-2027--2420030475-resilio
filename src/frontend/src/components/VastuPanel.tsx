import type { Design, DesignConfiguration, Orientation, Structure, VastuAnalysis } from "../types";
import { cloneConfiguration, orientationArrow } from "../utils/designState";
import PlanSvg from "./PlanSvg";

const DISCLAIMER = "Traditional Vastu rule analysis is provided for informational and cultural-reference purposes. It is not architectural, structural, legal, safety, engineering or scientific advice.";

type Props = { structure: Structure; design: Design; configuration: DesignConfiguration; analysis: VastuAnalysis | null; busy: boolean; showZones: boolean; onShowZones: (show: boolean) => void; onConfigurationChange: (configuration: DesignConfiguration) => void; onRun: () => void };

export default function VastuPanel({ structure, design, configuration, analysis, busy, showZones, onShowZones, onConfigurationChange, onRun }: Props) {
  const unassigned = structure.rooms.filter((room) => !configuration.room_semantics[room.id]?.room_type);
  const assignedCount = structure.rooms.length - unassigned.length;
  const setOrientation = (value: string) => { const next = cloneConfiguration(configuration); next.orientation = value === "" ? null : Number(value) as Orientation; onConfigurationChange(next); };
  return <div className="vastu-panel">
    <div className="vastu-controls">
      <p className="eyebrow">Cultural-reference module</p><h3>Traditional Vastu Rule Analysis</h3>
      <label className="field"><span>User-confirmed North</span><select value={configuration.orientation ?? ""} onChange={(event) => setOrientation(event.target.value)}><option value="">Select orientation</option>{([0, 90, 180, 270] as Orientation[]).map((value) => <option key={value} value={value}>North {orientationArrow(value)} · {value}°</option>)}</select></label>
      <div className={`readiness ${configuration.orientation !== null ? "ready" : "not-ready"}`}><strong>Orientation</strong><span>{configuration.orientation === null ? "Required before analysis" : `Confirmed at ${configuration.orientation}°`}</span></div>
      <div className={`readiness ${unassigned.length ? "not-ready" : "ready"}`}><strong>Room assignment readiness</strong><span>{assignedCount} / {structure.rooms.length} rooms assigned</span>{unassigned.length ? <><span>Analysis will evaluate only rules supported by assigned room semantics.</span><span>Unassigned: {unassigned.map((room) => `Room ${structure.rooms.indexOf(room) + 1}`).join(", ")}</span></> : <span>Ready for analysis.</span>}</div>
      <label className="zone-toggle"><input type="checkbox" checked={showZones} disabled={configuration.orientation === null} onChange={(event) => onShowZones(event.target.checked)} /> Show Direction Zones</label>
      <button className="primary-button" disabled={configuration.orientation === null || busy} onClick={onRun}>{busy ? "Analyzing…" : "Run Traditional Vastu Rule Analysis"}</button>
      <p className="vastu-disclaimer">{DISCLAIMER}</p>
    </div>
    <div className="vastu-plan"><PlanSvg structure={structure} orientation={configuration.orientation} showZones={showZones} design={configuration} /></div>
    <div className="vastu-results">
      <div className="analysis-summary"><span>Design</span><strong>{design.name}</strong><span>Traditional Vastu Rule Match Score</span><strong>{analysis?.score_label ?? "Not analyzed"}</strong></div>
      {analysis && <><div className="analysis-counts"><div><strong>{analysis.counts.satisfied}</strong><span>Satisfied</span></div><div><strong>{analysis.counts.unsatisfied}</strong><span>Unsatisfied</span></div><div><strong>{analysis.counts.cannot_evaluate}</strong><span>Cannot Evaluate</span></div></div>{analysis.warnings.map((warning) => <p className="analysis-warning" key={warning}>{warning}</p>)}<div className="rule-results">{analysis.rule_results.map((result, index) => <article key={`${result.rule_id}-${result.room_id ?? index}`} className={`rule-card ${result.result}`}><div><span>{result.rule_id}</span><strong>{result.rule_title}</strong><em>{result.result.replaceAll("_", " ")}</em></div><p>{result.explanation}</p><small>Room: {result.room_name ?? result.room_type.replaceAll("_", " ")} · Detected: {result.detected_zone?.replaceAll("_", "-") ?? "Unavailable"} · Preferred: {result.preferred_zones.map((zone) => zone.replaceAll("_", "-")).join(", ")}</small></article>)}</div></>}
      <p className="vastu-disclaimer compact">{DISCLAIMER}</p>
    </div>
  </div>;
}
