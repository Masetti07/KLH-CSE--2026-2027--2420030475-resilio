import type { AdaptationEvent, SimulationScenario, SimulationStatus, SystemState } from "../types";

const SCENARIOS: { id: SimulationScenario; name: string; description: string }[] = [
  { id: "low_fps", name: "Simulate Low FPS", description: "Injects bounded low-FPS telemetry without adding renderer load." },
  { id: "renderer_failure", name: "Simulate Renderer Failure", description: "Marks 3D unavailable through MAPE-K without crashing WebGL." },
  { id: "processing_failure", name: "Simulate Processing Failure", description: "Makes the next processing request fail safely while retaining the selected source." },
  { id: "low_reconstruction_confidence", name: "Simulate Low Reconstruction Confidence", description: "Overrides confidence without damaging detected geometry." },
  { id: "autosave_corruption", name: "Simulate Autosave Corruption", description: "Adds an invalid newest local snapshot and exercises previous-valid recovery." },
];

type Props = { status: SimulationStatus | null; system: SystemState | null; history: AdaptationEvent[]; busy: boolean; error: string | null; onActivate: (scenario: SimulationScenario) => void; onClear: (scenario: SimulationScenario) => void; onRestoreAll: () => void };
const words = (value: string | null | undefined) => value ? value.replaceAll("_", " ") : "None";

export default function ResilienceLab({ status, system, history, busy, error, onActivate, onClear, onRestoreAll }: Props) {
  const latest = history[0];
  return <div className="resilience-lab">
    <header className="lab-heading"><div><p className="eyebrow">Safe local demonstrations</p><h3>Resilience Lab</h3><p>Allow-listed simulations enter the real Monitor → Analyze → Plan → Execute → Knowledge pipeline. They never create resource load or damage persistent project data.</p></div>{status?.any_active && <strong className="simulated-banner">SIMULATED CONDITION</strong>}</header>
    <section className="lab-current" aria-live="polite"><div><span>Current Mode</span><strong>{system?.adaptive_mode ?? "UNKNOWN"}</strong></div><div><span>Current Condition</span><strong>{words(system?.active_condition)}</strong></div><div><span>Selected Strategy</span><strong>{words(system?.active_strategy)}</strong></div><div><span>Adaptation Outcome</span><strong>{latest?.outcome ?? "No adaptation recorded"}</strong></div></section>
    {error && <p className="design-error" role="alert">{error}</p>}
    <div className="scenario-grid">{SCENARIOS.map((scenario) => { const state = status?.scenarios[scenario.id]; return <article key={scenario.id} className={state?.active ? "active" : ""}><div><span className="scenario-state">{state?.active ? "Active · simulated" : "Inactive"}</span><h4>{scenario.name}</h4><p>{scenario.description}</p>{state?.simulated_value !== null && state?.simulated_value !== undefined && <small>Injected value: {state.simulated_value}</small>}</div>{state?.active ? <button className="secondary-button" disabled={busy} onClick={() => onClear(scenario.id)}>Clear</button> : <button className="primary-button" disabled={busy} onClick={() => onActivate(scenario.id)}>Simulate</button>}</article>; })}</div>
    <button className="restore-all-button" disabled={busy || !status?.any_active} onClick={onRestoreAll}>Restore All / Clear Simulations</button>
    <p className="lab-note">Restore All clears overrides and returns monitoring to genuine telemetry. It does not force NORMAL; existing recovery hysteresis still applies.</p>
  </div>;
}
