import type { AdaptationEvent, SystemMetrics, SystemState } from "../types";

type Props = { state: SystemState | null; metrics: SystemMetrics | null; history: AdaptationEvent[]; error: string | null; rendererUnavailable: boolean; onRetryRenderer: () => void };
const display = (value: number | null | undefined, suffix = "") => value === null || value === undefined ? "Not measured" : `${value.toFixed(1)}${suffix}`;
const words = (value: string | null | undefined) => value ? value.replaceAll("_", " ") : "None";

export default function ControlCenter({ state, metrics, history, error, rendererUnavailable, onRetryRenderer }: Props) {
  const mode = state?.adaptive_mode ?? "NORMAL";
  const summary = mode === "PERFORMANCE" ? "Rendering quality automatically reduced to maintain responsiveness"
    : mode === "DEGRADED" ? "A safe fallback is active while a component is unavailable"
    : mode === "RECOVERY" ? `Health restored — validating stability ${state?.recovery_progress ?? 0} / ${state?.recovery_required ?? 3}`
    : "System operating normally";
  return <div className="control-center">
    <section className={`mode-banner mode-${mode.toLowerCase()}`} aria-live="polite"><span>SYSTEM MODE</span><strong>{mode}</strong><p>{summary}</p></section>
    {error && <p className="design-error" role="status">Live backend status is temporarily unavailable: {error}</p>}
    {(rendererUnavailable || state?.use_2d_fallback) && <div className="renderer-notice" role="status"><strong>3D rendering is temporarily unavailable.</strong><p>Your design is preserved and the 2D workspace remains available.</p><button className="secondary-button" onClick={onRetryRenderer}>Retry 3D renderer</button></div>}
    {state?.active_strategy === "REQUEST_USER_CORRECTION" && <div className="renderer-notice" role="status"><strong>Automatic reconstruction remains uncertain.</strong><p>Review the detected walls, rooms, doors, and windows in Edit Structure before relying on the model.</p></div>}
    <div className="health-grid">
      <article><span>Overall Health</span><strong>{state?.overall ?? "UNKNOWN"}</strong></article><article><span>Renderer Health</span><strong>{state?.renderer ?? "UNKNOWN"}</strong></article>
      <article><span>Processing Health</span><strong>{state?.processor ?? "UNKNOWN"}</strong></article><article><span>Autosave Health</span><strong>{state?.autosave ?? "UNKNOWN"}</strong></article>
      <article><span>Approx. Renderer FPS</span><strong>{display(metrics?.renderer_fps)}</strong></article><article><span>Frame Time</span><strong>{display(metrics?.renderer_frame_time_ms, " ms")}</strong></article>
      <article><span>Recent API Latency</span><strong>{display(metrics?.api_latency_ms, " ms")}</strong></article><article><span>Reconstruction Confidence</span><strong>{metrics?.reconstruction_confidence == null ? "Not measured" : `${Math.round(metrics.reconstruction_confidence * 100)}%`}</strong></article>
    </div>
    <div className="decision-grid"><article><span>Current Condition</span><strong>{words(state?.active_condition)}</strong></article><article><span>Active Adaptation</span><strong>{words(state?.active_strategy)}</strong></article><article><span>Rendering Quality</span><strong>{state?.rendering_quality ?? "NORMAL"}</strong></article><article><span>Recovery Progress</span><strong>{state?.adaptive_mode === "RECOVERY" ? `${state.recovery_progress} / ${state.recovery_required}` : "Not active"}</strong></article></div>
    <section className="adaptation-history"><h3>Recent adaptation history</h3>{history.length ? <ol>{history.map((event, index) => <li key={`${event.timestamp}-${index}`}><time>{new Date(event.timestamp).toLocaleTimeString()}</time><div><strong>{words(event.condition)}</strong><span>{event.selected_strategy}</span><small>{event.previous_mode} → {event.new_mode} · {event.outcome}</small><details><summary>Why this changed</summary><p>{event.explanation}</p><p>Trigger: {event.threshold_or_trigger}</p></details></div></li>)}</ol> : <p>No adaptations recorded. Healthy operation does not create noise in this history.</p>}</section>
  </div>;
}
