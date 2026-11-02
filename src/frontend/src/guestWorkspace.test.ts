import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { GuestWorkspace } from "./guestWorkspace";
import type { Design, Structure, UploadResult } from "./types";
import { HOME_PROP_CATALOG } from "./utils/homeProps";
import { validWorkingSnapshot } from "./utils/autosave";

const base = "https://resiliospace-api.onrender.com";
const storage = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
};
const structure = { id: "plan", walls: [{ id: "wall" }], rooms: [{ id: "room", name: "Living", type: "living_room" }], openings: [], wall_height: 3,
  editing_metadata: { revision: 0, modified_by: "automatic", last_saved_at: null }, overall_confidence: .9 } as unknown as Structure;
const plan = { plan: { id: "plan", original_name: "Starter", media_type: "application/x-resiliospace-starter" }, structure,
  artifacts: { threshold: "data:image/png;base64,YQ==" } } as unknown as UploadResult;
const fetchMock = vi.fn();
const post = (data?: unknown): RequestInit => ({ method: "POST", ...(data ? { body: JSON.stringify(data), headers: { "Content-Type": "application/json" } } : {}) });
const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("isolated browser guest records", () => {
  it("saves/reloads all 32 prop types and versions locally; another browser cannot read or change them", async () => {
    const own = storage(), other = storage();
    const a = new GuestWorkspace(() => own), b = new GuestWorkspace(() => other);
    fetchMock.mockResolvedValueOnce(response(plan));
    await a.fetch(`${base}/api/plans/starters/blank`, post(), base);
    const created = await (await a.fetch(`${base}/api/plans/plan/designs`, post(), base)).json() as Design;
    created.configuration.props = HOME_PROP_CATALOG.map((prop, index) => ({ id: `prop-${index}`, type: prop.type, placement_type: prop.placement,
      room_id: prop.placement === "room" ? "room" : null, wall_id: prop.placement === "wall" ? "wall" : null, position: { x: .5, y: .5 }, rotation: 0, wall_offset: .5 }));
    await a.fetch(`${base}/api/designs/${created.id}`, { method: "PUT", body: JSON.stringify({ name: "My design", configuration: created.configuration }) }, base);
    const duplicate = await (await a.fetch(`${base}/api/designs/${created.id}/duplicate`, post(), base)).json() as Design;
    expect(duplicate.id).not.toBe(created.id);
    const reloaded = new GuestWorkspace(() => own);
    const saved = await (await reloaded.fetch(`${base}/api/designs/${created.id}`, {}, base)).json() as Design;
    expect(saved.configuration.props).toHaveLength(32);
    expect(validWorkingSnapshot({ schema_version: 1, metadata: { created_at: new Date().toISOString(), plan_id: "plan" },
      payload: { plan: plan.plan, structure, design_configuration: saved.configuration } })).toBe(true);
    expect(saved.name).toBe("My design");
    for (const method of ["GET", "PUT", "DELETE"]) expect((await b.fetch(`${base}/api/designs/${created.id}`, { method }, base)).ok).toBe(false);
    expect((await a.fetch(`${base}/api/designs/${created.id}`, {}, base)).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // No CRUD or cross-browser ID is sent to the server.
    await a.fetch(`${base}/api/designs/${duplicate.id}`, { method: "DELETE" }, base);
    expect(await (await a.fetch(`${base}/api/plans/plan/designs`, {}, base)).json()).toHaveLength(1);
  });

  it("validates structure without server persistence and keeps processed images browser-local", async () => {
    const local = new GuestWorkspace(() => storageInstance);
    const storageInstance = storage();
    fetchMock.mockResolvedValueOnce(response(plan));
    await local.fetch(`${base}/api/plans/upload`, { method: "POST", body: new FormData() }, base);
    fetchMock.mockResolvedValueOnce(response(structure));
    const saved = await (await local.fetch(`${base}/api/plans/plan/structure`, { method: "PUT", body: JSON.stringify(structure) }, base)).json();
    expect(saved.editing_metadata.modified_by).toBe("manual");
    expect(fetchMock.mock.calls[1][0]).toBe(`${base}/api/guest/structure`);
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    const count = fetchMock.mock.calls.length;
    const image = await local.fetch(`${base}/api/plans/plan/artifacts/threshold`, {}, base);
    expect(await image.text()).toBe("a");
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });

  it("sends only caller-supplied analysis data and reports storage failures and denied simulations", async () => {
    const store = storage(); const local = new GuestWorkspace(() => store);
    fetchMock.mockResolvedValueOnce(response(plan));
    await local.fetch(`${base}/api/plans/starters/blank`, post(), base);
    const created = await (await local.fetch(`${base}/api/plans/plan/designs`, post(), base)).json() as Design;
    fetchMock.mockResolvedValueOnce(response({ analysis: { design_id: "browser-local" }, rules: [] }));
    const analysis = await (await local.fetch(`${base}/api/designs/${created.id}/vastu-analysis`, post(), base)).json();
    expect(analysis.design_id).toBe(created.id);
    expect(fetchMock.mock.calls[1][0]).toBe(`${base}/api/guest/analysis`);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).structure.id).toBe("plan");
    expect((await local.fetch(`${base}/api/simulator/restore`, post(), base)).status).toBe(403);
    const failing = new GuestWorkspace(() => ({ ...store, setItem: () => { throw new Error("quota"); } }));
    fetchMock.mockResolvedValueOnce(response(plan));
    const result = await failing.fetch(`${base}/api/plans/starters/blank`, post(), base);
    expect(result.ok).toBe(false);
    expect((await result.json()).detail).toContain("Browser storage");
  });

  it("opens guest mode without checking a password and defaults production to HTTPS Render", async () => {
    vi.stubEnv("PROD", true); vi.stubEnv("VITE_API_URL", undefined); vi.stubEnv("VITE_GUEST_DEMO", "true");
    vi.resetModules();
    const auth = await import("./demoAuth");
    expect(auth.GUEST_DEMO).toBe(true);
    expect(auth.API_BASE).toBe(base);
    expect(await auth.authStatus()).toEqual({ required: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await auth.apiFetch(`${base}/api/designs/not-in-this-browser`)).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
