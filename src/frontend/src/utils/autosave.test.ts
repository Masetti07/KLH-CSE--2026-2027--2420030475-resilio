import { describe, expect, it } from "vitest";
import { injectCorruptedNewestSnapshot, readSnapshotHistory, SNAPSHOT_LIMIT, validWorkingSnapshot, writeWorkingSnapshot } from "./autosave";

const snapshot = (date = "2026-01-01T00:00:00Z") => ({ schema_version: 1 as const, metadata: { created_at: date, plan_id: "p1", design_id: null, design_name: null }, payload: { plan: { id: "p1", original_name: "p.png", media_type: "image/png", size_bytes: 1, status: "ready", overall_confidence: .8 }, structure: { id: "p1", source_dimensions: { width: 10, height: 10 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: .8, processing_metadata: { pipeline_version: "x", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "automatic" as const, last_saved_at: null }, wall_height: 3, walls: [], rooms: [], openings: [] }, design_configuration: { wall_height: 3, wall_appearances: {}, floor_appearances: {}, door_configurations: {}, window_configurations: {}, room_semantics: {}, orientation: null } } });

function memory(initial: unknown[] = []) { let value = JSON.stringify(initial); return { getItem: () => value, setItem: (_: string, next: string) => { value = next; } }; }

describe("working snapshots", () => {
  it("accepts required versioned state and rejects malformed state", () => { expect(validWorkingSnapshot(snapshot())).toBe(true); expect(validWorkingSnapshot({ schema_version: 1, payload: {} })).toBe(false); });
  it("keeps bounded valid history", () => { const store = memory(); for (let i = 0; i < 5; i++) writeWorkingSnapshot(snapshot(String(i)), store); expect(JSON.parse(store.getItem()).length).toBe(SNAPSHOT_LIMIT); });
  it("restores the previous valid snapshot when the newest is corrupt", () => { const store = memory([{ bad: true }, snapshot()]); const result = readSnapshotHistory("p1", store); expect(result.recoveredPrevious).toBe(true); expect(result.snapshot?.metadata.plan_id).toBe("p1"); });
  it("injects only an invalid newest entry and preserves a valid predecessor", () => { const store = memory([snapshot()]); const result = injectCorruptedNewestSnapshot("p1", store); expect(result.corrupted).toBe(true); expect(result.recoveredPrevious).toBe(true); expect(result.snapshot?.payload.structure.id).toBe("p1"); });
  it("validates saved props while accepting older snapshots without props", () => {
    const withProp = snapshot();
    const value = { ...withProp, payload: { ...withProp.payload, design_configuration: { ...withProp.payload.design_configuration, props: [{ id: "prop-1", type: "bed", placement_type: "room", room_id: "room", wall_id: null, position: { x: .5, y: .5 }, rotation: 0, wall_offset: .5 }] } } };
    expect(validWorkingSnapshot(withProp)).toBe(true);
    expect(validWorkingSnapshot(value)).toBe(true);
    expect(validWorkingSnapshot({ ...value, payload: { ...value.payload, design_configuration: { ...value.payload.design_configuration, props: [{ ...value.payload.design_configuration.props[0], position: { x: 2, y: .5 } }] } } })).toBe(false);
  });
});
