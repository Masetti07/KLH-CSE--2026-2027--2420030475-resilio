import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Structure } from "../types";
import { commitHistory, dropOpeningOnWall, initialHistory, redoHistory, snapOpeningToWall, undoHistory } from "./editState";
import { openingTransform } from "./geometry";
import PlanSvg from "../components/PlanSvg";

const h = { id: "h", start_x: .1, start_y: .2, end_x: .9, end_y: .2, thickness: .02, confidence: 1 };
const v = { ...h, id: "v", start_x: .8, end_x: .8, start_y: .1, end_y: .9 };
export const plan: Structure = { id: "plan", source_dimensions: { width: 1000, height: 1000 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: 1, wall_height: 3,
  processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "manual", last_saved_at: null }, rooms: [], walls: [h, v],
  openings: [{ id: "opening", wall_id: "h", position: { x: .4, y: .2 }, width: .1, probable_type: "door", confidence: 1 }] };

describe("opening wall reassignment", () => {
  it("preserves same-wall movement and rejects distant or out-of-span releases", () => {
    expect(dropOpeningOnWall(plan, "opening", { x: .6, y: .21 }, .02).openings[0]).toMatchObject({ wall_id: "h", position: { x: .6, y: .2 } });
    for (const point of [{ x: .5, y: .5 }, { x: .95, y: .2 }, { x: -.1, y: .2 }, { x: NaN, y: .2 }]) expect(dropOpeningOnWall(plan, "opening", point, .02)).toBe(plan);
  });
  it.each(["door", "window"] as const)("round-trips %s across horizontal/vertical walls with synchronized symbols and 3D transforms", (type) => {
    const original = { ...plan, openings: [{ ...plan.openings[0], probable_type: type }] };
    const before = JSON.stringify(original);
    const moved = dropOpeningOnWall(original, "opening", { x: .79, y: .6 }, .02);
    const restored: Structure = JSON.parse(JSON.stringify(moved));
    expect(restored.openings).toHaveLength(1);
    expect(restored.openings[0]).toMatchObject({ id: "opening", wall_id: "v", probable_type: type, width: .1, position: { x: .8, y: .6 } });
    expect(openingTransform(restored.openings[0], restored.walls[1]).angle).toBeCloseTo(Math.PI / 2);
    const svg = renderToStaticMarkup(<PlanSvg structure={restored} />);
    expect(svg).toContain('translate(800 600) rotate(90)');
    expect(svg).toContain(type === "door" ? "<path" : 'y1="-5"');
    const back = dropOpeningOnWall(restored, "opening", { x: .55, y: .21 }, .02);
    expect(back.openings[0]).toMatchObject({ wall_id: "h", position: { x: .55, y: .2 } });
    expect(openingTransform(back.openings[0], h).angle).toBe(0);
    const history = commitHistory(initialHistory(original), moved);
    expect(undoHistory(history).present).toEqual(original);
    expect(redoHistory(undoHistory(history)).present).toEqual(moved);
    expect(moved.rooms).toEqual(original.rooms); expect(moved.walls).toEqual(original.walls);
    expect(JSON.stringify(original)).toBe(before);
  });
  it("rejects incompatible widths, overlapping openings and invalid wall geometry", () => {
    const occupied = { ...plan, openings: [...plan.openings, { ...plan.openings[0], id: "other", wall_id: "v", position: { x: .8, y: .6 } }] };
    expect(dropOpeningOnWall(occupied, "opening", { x: .8, y: .6 }, .02)).toBe(occupied);
    for (const wall of [{ ...v, end_y: .15 }, { ...v, end_y: .1 }, { ...v, start_x: NaN }, { ...v, thickness: -1 }]) {
      const invalid = { ...plan, walls: [wall] };
      expect(dropOpeningOnWall(invalid, "opening", { x: .8, y: .13 }, .02)).toBe(invalid);
    }
  });
  it("uses reversed wall endpoints and keeps the current wall when snap distances tie", () => {
    const reversed = { ...plan, walls: [{ ...h, start_x: h.end_x, end_x: h.start_x }, v] };
    expect(snapOpeningToWall(reversed, "opening", { x: .6, y: .2 }, .02)?.position.x).toBeCloseTo(.6);
    expect(snapOpeningToWall(plan, "opening", { x: .8, y: .2 }, .02)?.wallId).toBe("h");
  });
});
