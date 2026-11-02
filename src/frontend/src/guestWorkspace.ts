import type { Design, DesignConfiguration, Structure, SystemMetrics, SystemState, UploadResult, VastuAssistPreview } from "./types";
import { defaultDesignConfiguration } from "./utils/designState";

type LocalPlan = UploadResult & { artifacts?: Record<string, string> };
const PREFIX = "resiliospace:guest:v1:";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

/** Only this origin's browser storage holds guest records. No server-record fallback. */
export class GuestWorkspace {
  constructor(private storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem"> = () => localStorage) {}
  private read<T>(key: string): T {
    const value = this.storage().getItem(PREFIX + key);
    if (!value) throw new Error("This guest record is not saved in this browser.");
    return JSON.parse(value) as T;
  }
  private write(key: string, value: unknown) {
    try { this.storage().setItem(PREFIX + key, JSON.stringify(value)); }
    catch { throw new Error("Browser storage is unavailable or full. Your changes could not be saved; export your plan before clearing data."); }
  }
  private designs(planId: string): Design[] {
    this.read<LocalPlan>(`plan:${planId}`);
    const ids = JSON.parse(this.storage().getItem(PREFIX + `designs:${planId}`) ?? "[]") as string[];
    return ids.map((id) => this.read<Design>(`design:${id}`));
  }
  private name(value: unknown, fallback: string): string {
    const name = value === undefined ? fallback : String(value).trim();
    if (!name || name.length > 120) throw new Error("Design names must contain 1–120 characters.");
    return name;
  }
  private create(planId: string, name?: string, configuration?: DesignConfiguration): Design {
    const plan = this.read<LocalPlan>(`plan:${planId}`);
    const designs = this.designs(planId);
    const now = new Date().toISOString();
    const design: Design = { id: crypto.randomUUID(), plan_id: planId, name: this.name(name, `Design ${designs.length + 1}`),
      configuration: structuredClone(configuration ?? defaultDesignConfiguration(plan.structure)), latest_analysis: null, created_at: now, updated_at: now };
    this.write(`design:${design.id}`, design);
    this.write(`designs:${planId}`, [...designs.map((item) => item.id), design.id]);
    return design;
  }
  private metrics: SystemMetrics = { reconstruction_confidence: null, processing_duration_ms: null, api_latency_ms: null,
    api_request_count: 0, api_error_count: 0, api_error_rate: 0, renderer_fps: null, renderer_frame_time_ms: null,
    renderer_health: "UNKNOWN", processing_health: "UNKNOWN", autosave_health: "UNKNOWN" };
  private state(): SystemState {
    const failed = this.metrics.renderer_health === "FAILED" || this.metrics.autosave_health === "FAILED";
    const slow = this.metrics.renderer_health === "SLOW";
    return { overall: failed ? "DEGRADED" : "HEALTHY", backend: "UNKNOWN", processor: this.metrics.processing_health,
      renderer: this.metrics.renderer_health, autosave: this.metrics.autosave_health,
      adaptive_mode: failed ? "DEGRADED" : slow ? "PERFORMANCE" : "NORMAL", active_condition: "BROWSER_LOCAL_TELEMETRY",
      active_strategy: null, recovery_progress: 0, recovery_required: 0, rendering_quality: slow ? "PERFORMANCE" : "NORMAL",
      use_2d_fallback: this.metrics.renderer_health === "FAILED" };
  }
  async fetch(url: string, init: RequestInit, base: string): Promise<Response> {
    const path = url.slice(base.length);
    const method = init.method ?? "GET";
    const body = () => JSON.parse(String(init.body ?? "{}"));
    const remote = (endpoint: string, options: RequestInit = init) => fetch(`${base}/api/guest${endpoint}`, { ...options, cache: "no-store" });
    const analyze = (structure: Structure, configuration: DesignConfiguration) => remote("/analysis", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: init.signal,
      // Furniture does not participate in the cultural-reference rules. Keep all props locally.
      body: JSON.stringify({ structure, configuration: { ...configuration, props: [] } }),
    });
    try {
      if (path.startsWith("/api/plans/samples/") && method === "GET") return remote(path.replace("/api/plans", ""));
      if (method === "POST" && (path === "/api/plans/upload" || path.startsWith("/api/plans/starters/"))) {
        const response = await remote(path.replace("/api/plans", ""));
        if (!response.ok) return response;
        const plan = await response.json() as LocalPlan;
        this.write(`plan:${plan.plan.id}`, plan);
        this.metrics.reconstruction_confidence = plan.structure.overall_confidence;
        this.metrics.processing_health = "HEALTHY";
        return json(plan, 201);
      }
      const planRoute = /^\/api\/plans\/([^/]+)\/(structure|designs|artifacts\/(threshold|cleaned|edges))$/.exec(path);
      if (planRoute) {
        const [, id, action, artifact] = planRoute;
        const plan = this.read<LocalPlan>(`plan:${id}`);
        if (action === "structure" && method === "GET") return json(plan.structure);
        if (action === "structure" && method === "PUT") {
          const structure = body() as Structure;
          if (structure.id !== id) throw new Error("Structure ID does not match this browser's plan.");
          const response = await remote("/structure", { ...init, method: "POST" });
          if (!response.ok) return response;
          const validated = await response.json() as Structure;
          validated.editing_metadata = { revision: validated.editing_metadata.revision + 1, modified_by: "manual", last_saved_at: new Date().toISOString() };
          this.write(`plan:${id}`, { ...plan, structure: validated });
          for (const design of this.designs(id)) this.write(`design:${design.id}`, { ...design, latest_analysis: null });
          return json(validated);
        }
        if (action === "designs" && method === "GET") return json(this.designs(id));
        if (action === "designs" && method === "POST") return json(this.create(id, body().name), 201);
        if (artifact && method === "GET") {
          const data = plan.artifacts?.[artifact];
          if (!data?.startsWith("data:image/png;base64,")) throw new Error("Processed image is not saved in this browser.");
          const bytes = Uint8Array.from(atob(data.split(",")[1]), (character) => character.charCodeAt(0));
          return new Response(bytes, { headers: { "Content-Type": "image/png" } });
        }
      }
      const designRoute = /^\/api\/designs\/([^/]+)(?:\/(duplicate|vastu-analysis))?$/.exec(path);
      if (designRoute) {
        const [, id, action] = designRoute;
        const design = this.read<Design>(`design:${id}`);
        if (!action && method === "GET") return json(design);
        if (!action && method === "PUT") {
          const payload = body();
          const configuration = payload.configuration ?? design.configuration;
          const affectsAnalysis = configuration.orientation !== design.configuration.orientation
            || JSON.stringify(configuration.room_semantics) !== JSON.stringify(design.configuration.room_semantics);
          const next = { ...design, name: this.name(payload.name, design.name), configuration,
            latest_analysis: affectsAnalysis ? null : design.latest_analysis, updated_at: new Date().toISOString() };
          this.write(`design:${id}`, next); return json(next);
        }
        if (!action && method === "DELETE") {
          this.write(`designs:${design.plan_id}`, this.designs(design.plan_id).filter((item) => item.id !== id).map((item) => item.id));
          this.storage().removeItem(PREFIX + `design:${id}`); return new Response(null, { status: 204 });
        }
        if (action === "duplicate" && method === "POST") return json(this.create(design.plan_id, body().name, design.configuration), 201);
        if (action === "vastu-analysis" && method === "POST") {
          const plan = this.read<LocalPlan>(`plan:${design.plan_id}`);
          const response = await analyze(plan.structure, design.configuration);
          if (!response.ok) return response;
          const preview = await response.json() as VastuAssistPreview;
          preview.analysis.design_id = id;
          this.write(`design:${id}`, { ...design, latest_analysis: preview.analysis });
          return json(preview.analysis);
        }
      }
      if (path === "/api/vastu/assist-preview" && method === "POST") return analyze(body().structure, body().configuration);
      if (path === "/api/system/telemetry" && method === "POST") {
        const payload = body();
        for (const key of ["renderer_health", "autosave_health"] as const) if (payload[key]) this.metrics[key] = payload[key];
        if (payload.fps != null) this.metrics.renderer_fps = payload.fps;
        if (payload.frame_time_ms != null) this.metrics.renderer_frame_time_ms = payload.frame_time_ms;
        return json(this.state());
      }
      if (path === "/api/system/health" && method === "GET") {
        const response = await fetch(`${base}/health`, { cache: "no-store" });
        if (!response.ok) return response;
        return json({ ...this.state(), backend: "HEALTHY" });
      }
      if (path === "/api/system/metrics" && method === "GET") return json(this.metrics);
      if (path === "/api/system/adaptations" && method === "GET") return json({ items: [], limit: 0 });
      if (path === "/api/simulator/status" && method === "GET") return json({
        simulations: { any_active: false, scenarios: Object.fromEntries(["low_fps", "renderer_failure", "processing_failure", "low_reconstruction_confidence", "autosave_corruption"].map((key) => [key, { active: false, simulated_value: null }])) }, system: this.state(),
      });
      return json({ detail: "Administrative simulations and shared records are unavailable in public guest mode." }, 403);
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") throw reason;
      return json({ detail: reason instanceof Error ? reason.message : "Guest workspace operation failed." }, 400);
    }
  }
}

export const guestWorkspace = new GuestWorkspace();
