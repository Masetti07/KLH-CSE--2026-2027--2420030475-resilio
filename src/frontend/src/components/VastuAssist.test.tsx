import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Structure, VastuAssistPreview } from "../types";
import { defaultDesignConfiguration } from "../utils/designState";
import { selectedRoomGuidance } from "../utils/vastuAssist";
import PlanSvg from "./PlanSvg";
import VastuAssist from "./VastuAssist";

const structure: Structure = { id: "plan", source_dimensions: { width: 100, height: 100 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: 1,
  processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "automatic", last_saved_at: null }, wall_height: 3,
  walls: [{ id: "north", start_x: 0, start_y: 0, end_x: 1, end_y: 0, thickness: .01, confidence: 1 }, { id: "south", start_x: 0, start_y: 1, end_x: 1, end_y: 1, thickness: .01, confidence: 1 }],
  rooms: [{ id: "kitchen", polygon: [{ x: .7, y: .05 }, { x: .95, y: .05 }, { x: .95, y: .3 }, { x: .7, y: .3 }], name: "Kitchen", type: "kitchen", confidence: 1 }], openings: [] };
const config = defaultDesignConfiguration(structure);
config.orientation = 0;
const preview: VastuAssistPreview = { rules: [{ id: "TVR-KITCHEN-01", title: "Kitchen directional preference", room_type: "kitchen", preferred_zones: ["south_east"], description: "Traditional guidance commonly associates kitchens with the south-east zone.", severity: "advisory", source_reference: "docs/vastu/rules.md#tvr-kitchen-01", enabled: true }],
  analysis: { design_id: "preview", orientation: 0, score: 0, score_label: "0.0%", counts: { satisfied: 0, unsatisfied: 1, not_applicable: 0, cannot_evaluate: 0 }, rule_results: [{ rule_id: "TVR-KITCHEN-01", rule_title: "Kitchen directional preference", room_id: "kitchen", room_name: "Kitchen", room_type: "kitchen", detected_zone: "north_east", preferred_zones: ["south_east"], result: "unsatisfied", severity: "advisory", explanation: "The room centroid is in the north-east zone." }], warnings: [], analyzed_at: "", analysis_version: "day-3.0" } };
const callbacks = { onEnabled: () => {}, onConfigurationChange: () => {}, onSelect: () => {}, onViewFull: () => {} };

describe("Traditional Vastu Assist", () => {
  it("hides zones and guidance while off, retaining the disclaimer and full-analysis link", () => {
    const plan = renderToStaticMarkup(<PlanSvg structure={structure} orientation={0} showZones={false} />);
    const panel = renderToStaticMarkup(<VastuAssist structure={structure} configuration={config} selection={null} enabled={false} preview={null} busy={false} error={null} {...callbacks} />);
    expect(plan).not.toContain("north east zone");
    expect(panel).not.toContain("Current Rule Match");
    expect(panel).toContain("informational and cultural-reference purposes");
    expect(panel).toContain("View Full Analysis");
  });

  it("shows nine zones and highlights the selected room's preferred zone", () => {
    const plan = renderToStaticMarkup(<PlanSvg structure={structure} orientation={0} showZones preferredZones={["south_east"]} />);
    expect((plan.match(/zone"/g) ?? []).length).toBe(8);
    expect(plan).toContain("south east zone, configured preference for selected room");
    expect(plan).toContain("CENTER");
    expect(renderToStaticMarkup(<PlanSvg structure={structure} orientation={null} showZones />)).not.toContain("south east zone");
  });

  it("shows backend rule guidance and updates with a new preview without using props", () => {
    const selection = { kind: "room" as const, id: "kitchen" };
    const panel = renderToStaticMarkup(<VastuAssist structure={structure} configuration={config} selection={selection} enabled preview={preview} busy={false} error={null} {...callbacks} />);
    expect(panel).toContain("Current zone:");
    expect(panel).toContain("North-East");
    expect(panel).toContain("South-East");
    expect(panel).toContain(preview.rules[0].description);
    expect(panel).toContain("does not match this configured preference");
    expect(panel).toContain("0 of 1 evaluable rules satisfied");
    const withProp = { ...config, props: [{ id: "decor", type: "bed" as const, placement_type: "room" as const, room_id: "kitchen", wall_id: null, position: { x: .8, y: .2 }, rotation: 0, wall_offset: .5 }] };
    expect(selectedRoomGuidance(preview, selection, withProp, structure)?.result).toEqual(selectedRoomGuidance(preview, selection, config, structure)?.result);
    const changed: VastuAssistPreview = { ...preview, analysis: { ...preview.analysis, counts: { ...preview.analysis.counts, satisfied: 1, unsatisfied: 0 }, rule_results: [{ ...preview.analysis.rule_results[0], detected_zone: "south_east", result: "satisfied" }] } };
    expect(renderToStaticMarkup(<VastuAssist structure={structure} configuration={config} selection={selection} enabled preview={changed} busy={false} error={null} {...callbacks} />)).toContain("matches the configured traditional preference");
  });
});
