import type { AdaptationEvent, Design, DesignConfiguration, SimulationResponse, SimulationScenario, Structure, SystemMetrics, SystemState, UploadResult, VastuAnalysis } from "./types";
import type { StarterKind } from "./utils/startPlans";

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export async function createStarterPlan(kind: StarterKind): Promise<UploadResult> {
  const response = await fetch(`${API_BASE}/api/plans/starters/${kind}`, { method: "POST" });
  if (!response.ok) throw new Error("The starter plan could not be created.");
  return response.json() as Promise<UploadResult>;
}

export async function samplePlanFile(name: string): Promise<File> {
  const response = await fetch(`${API_BASE}/api/plans/samples/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error("The sample plan could not be loaded.");
  return new File([await response.blob()], name, { type: "image/png" });
}

export async function uploadPlan(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/plans/upload`, { method: "POST", body });
  } catch {
    throw new Error("The processing service is unavailable. Start the backend and try again.");
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "The floor plan could not be processed.");
  }
  return response.json() as Promise<UploadResult>;
}

export function artifactUrl(planId: string, artifact: "threshold" | "cleaned" | "edges"): string {
  return `${API_BASE}/api/plans/${planId}/artifacts/${artifact}`;
}

async function structureResponse(response: Response): Promise<Structure> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string | { msg?: string }[] } | null;
    const detail = Array.isArray(payload?.detail) ? payload.detail.map((item) => item.msg).join("; ") : payload?.detail;
    throw new Error(typeof detail === "string" ? detail : "The structural model could not be saved.");
  }
  return response.json() as Promise<Structure>;
}

export async function saveStructure(planId: string, structure: Structure): Promise<Structure> {
  try {
    return await structureResponse(await fetch(`${API_BASE}/api/plans/${planId}/structure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(structure),
    }));
  } catch (reason) {
    if (reason instanceof TypeError) throw new Error("The processing service is unavailable. Your edits remain unsaved in this session.");
    throw reason;
  }
}

export async function loadStructure(planId: string): Promise<Structure> {
  try {
    return await structureResponse(await fetch(`${API_BASE}/api/plans/${planId}/structure`));
  } catch (reason) {
    if (reason instanceof TypeError) throw new Error("The saved structure could not be reloaded because the backend is unavailable.");
    throw reason;
  }
}

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string | { msg?: string }[] } | null;
    const detail = Array.isArray(payload?.detail) ? payload.detail.map((item) => item.msg).join("; ") : payload?.detail;
    throw new Error(typeof detail === "string" ? detail : fallback);
  }
  return response.json() as Promise<T>;
}

export async function listDesigns(planId: string): Promise<Design[]> {
  return jsonResponse(await fetch(`${API_BASE}/api/plans/${planId}/designs`), "Designs could not be loaded.");
}

export async function createDesign(planId: string, name?: string): Promise<Design> {
  return jsonResponse(await fetch(`${API_BASE}/api/plans/${planId}/designs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(name ? { name } : {}) }), "The design could not be created.");
}

export async function saveDesign(designId: string, name: string, configuration: DesignConfiguration): Promise<Design> {
  return jsonResponse(await fetch(`${API_BASE}/api/designs/${designId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, configuration }) }), "The design could not be saved.");
}

export async function duplicateDesign(designId: string, name?: string): Promise<Design> {
  return jsonResponse(await fetch(`${API_BASE}/api/designs/${designId}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(name ? { name } : {}) }), "The design could not be duplicated.");
}

export async function deleteDesign(designId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/designs/${designId}`, { method: "DELETE" });
  if (!response.ok) await jsonResponse(response, "The design could not be deleted.");
}

export async function runVastuAnalysis(designId: string): Promise<VastuAnalysis> {
  return jsonResponse(await fetch(`${API_BASE}/api/designs/${designId}/vastu-analysis`, { method: "POST" }), "Traditional Vastu Rule Analysis could not be completed.");
}

export async function sendSystemTelemetry(payload: { fps?: number; frame_time_ms?: number; renderer_health?: string; autosave_health?: string; session_corrupted?: boolean }): Promise<SystemState> {
  return jsonResponse(await fetch(`${API_BASE}/api/system/telemetry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }), "System telemetry could not be recorded.");
}

export async function loadSystemStatus(): Promise<{ state: SystemState; metrics: SystemMetrics; adaptations: AdaptationEvent[] }> {
  const [state, metrics, history] = await Promise.all([
    jsonResponse<SystemState>(await fetch(`${API_BASE}/api/system/health`), "System health is unavailable."),
    jsonResponse<SystemMetrics>(await fetch(`${API_BASE}/api/system/metrics`), "System metrics are unavailable."),
    jsonResponse<{ items: AdaptationEvent[] }>(await fetch(`${API_BASE}/api/system/adaptations`), "Adaptation history is unavailable."),
  ]);
  return { state, metrics, adaptations: history.items };
}

export async function loadSimulationStatus(): Promise<SimulationResponse> {
  return jsonResponse(await fetch(`${API_BASE}/api/simulator/status`), "Simulation status is unavailable.");
}

export async function activateSimulation(scenario: SimulationScenario): Promise<SimulationResponse> {
  return jsonResponse(await fetch(`${API_BASE}/api/simulator/scenarios/${scenario}/activate`, { method: "POST" }), "The controlled simulation could not be activated.");
}

export async function clearSimulation(scenario: SimulationScenario): Promise<SimulationResponse> {
  return jsonResponse(await fetch(`${API_BASE}/api/simulator/scenarios/${scenario}/clear`, { method: "POST" }), "The controlled simulation could not be cleared.");
}

export async function restoreAllSimulations(): Promise<SimulationResponse> {
  return jsonResponse(await fetch(`${API_BASE}/api/simulator/restore`, { method: "POST" }), "The controlled simulations could not be cleared.");
}
