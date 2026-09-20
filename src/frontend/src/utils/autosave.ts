import type { DesignConfiguration, Structure, UploadResult } from "../types";

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_LIMIT = 3;
export const snapshotKey = (planId: string) => `resiliospace:snapshots:${planId}`;

export type WorkingSnapshot = {
  schema_version: 1;
  metadata: { created_at: string; plan_id: string; design_id: string | null; design_name: string | null };
  payload: { plan: UploadResult["plan"]; structure: Structure; design_configuration: DesignConfiguration };
};

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const propTypes = new Set(["clock", "painting", "bed", "sofa", "table", "armchair", "cupboard", "flower_vase"]);
const validProp = (value: unknown): boolean => {
  if (!record(value) || typeof value.id !== "string" || !propTypes.has(String(value.type)) || !record(value.position)) return false;
  const isWall = value.type === "clock" || value.type === "painting";
  return value.placement_type === (isWall ? "wall" : "room")
    && typeof (isWall ? value.wall_id : value.room_id) === "string"
    && (isWall ? value.room_id == null : value.wall_id == null)
    && Number.isFinite(value.position.x) && Number.isFinite(value.position.y)
    && Number(value.position.x) >= 0 && Number(value.position.x) <= 1
    && Number(value.position.y) >= 0 && Number(value.position.y) <= 1
    && Number.isFinite(value.rotation) && Number(value.rotation) >= 0 && Number(value.rotation) < 360
    && Number.isFinite(value.wall_offset) && Number(value.wall_offset) >= 0 && Number(value.wall_offset) <= 1;
};

export function validWorkingSnapshot(value: unknown): value is WorkingSnapshot {
  if (!record(value) || value.schema_version !== SNAPSHOT_VERSION || !record(value.metadata) || !record(value.payload)) return false;
  const metadata = value.metadata; const payload = value.payload;
  if (typeof metadata.created_at !== "string" || typeof metadata.plan_id !== "string") return false;
  if (!record(payload.plan) || !record(payload.structure) || !record(payload.design_configuration)) return false;
  const structure = payload.structure; const configuration = payload.design_configuration;
  return typeof structure.id === "string" && structure.id === metadata.plan_id
    && Array.isArray(structure.walls) && Array.isArray(structure.rooms) && Array.isArray(structure.openings)
    && typeof configuration.wall_height === "number"
    && ["wall_appearances", "floor_appearances", "door_configurations", "window_configurations", "room_semantics"].every((key) => record(configuration[key]))
    && (configuration.props === undefined || Array.isArray(configuration.props) && configuration.props.every(validProp));
}

export function readSnapshotHistory(planId: string, storage: Pick<Storage, "getItem"> = localStorage): { snapshot: WorkingSnapshot | null; recoveredPrevious: boolean; corrupted: boolean } {
  const raw = storage.getItem(snapshotKey(planId));
  if (!raw) return { snapshot: null, recoveredPrevious: false, corrupted: false };
  let values: unknown;
  try { values = JSON.parse(raw); } catch { return { snapshot: null, recoveredPrevious: false, corrupted: true }; }
  if (!Array.isArray(values)) return { snapshot: null, recoveredPrevious: false, corrupted: true };
  const newestValidIndex = values.findIndex(validWorkingSnapshot);
  return { snapshot: newestValidIndex >= 0 ? values[newestValidIndex] : null, recoveredPrevious: newestValidIndex > 0, corrupted: newestValidIndex !== 0 };
}

export function writeWorkingSnapshot(snapshot: WorkingSnapshot, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): void {
  if (!validWorkingSnapshot(snapshot)) throw new Error("Working snapshot failed schema validation.");
  let existing: unknown = [];
  try { existing = JSON.parse(storage.getItem(snapshotKey(snapshot.metadata.plan_id)) ?? "[]"); } catch { existing = []; }
  const history = Array.isArray(existing) ? existing.filter(validWorkingSnapshot) : [];
  storage.setItem(snapshotKey(snapshot.metadata.plan_id), JSON.stringify([snapshot, ...history].slice(0, SNAPSHOT_LIMIT)));
}

export function injectCorruptedNewestSnapshot(planId: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): ReturnType<typeof readSnapshotHistory> {
  let existing: unknown = [];
  try { existing = JSON.parse(storage.getItem(snapshotKey(planId)) ?? "[]"); } catch { existing = []; }
  const valid = Array.isArray(existing) ? existing.filter(validWorkingSnapshot) : [];
  const invalidNewest = { schema_version: SNAPSHOT_VERSION, metadata: { created_at: new Date().toISOString(), plan_id: planId }, payload: { deliberately_invalid_simulation: true } };
  storage.setItem(snapshotKey(planId), JSON.stringify([invalidNewest, ...valid].slice(0, SNAPSHOT_LIMIT)));
  return readSnapshotHistory(planId, storage);
}
