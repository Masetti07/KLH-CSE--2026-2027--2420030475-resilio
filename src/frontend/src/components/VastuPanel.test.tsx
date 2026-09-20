import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Design, Structure, VastuAnalysis, VastuRuleResult } from "../types";
import { defaultDesignConfiguration } from "../utils/designState";
import { visibleVastuResults } from "../utils/vastuAssist";
import VastuPanel from "./VastuPanel";

const structure: Structure = {
  id: "plan", source_dimensions: { width: 100, height: 100 }, normalized_dimensions: { width: 1, height: 1 }, overall_confidence: 1,
  processing_metadata: { pipeline_version: "test", stages: [], warnings: [], debug_images: {} }, editing_metadata: { revision: 0, modified_by: "manual", last_saved_at: null }, wall_height: 3,
  walls: [], openings: [], rooms: [
    { id: "living", name: "Living", type: null, polygon: [{ x: .1, y: .1 }, { x: .4, y: .1 }, { x: .4, y: .4 }, { x: .1, y: .4 }], confidence: 1 },
    { id: "kitchen", name: "Kitchen", type: null, polygon: [{ x: .5, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .4 }, { x: .5, y: .4 }], confidence: 1 },
    { id: "other", name: "Other", type: null, polygon: [{ x: .1, y: .5 }, { x: .9, y: .5 }, { x: .9, y: .9 }, { x: .1, y: .9 }], confidence: 1 },
  ],
};

const configuration = { ...defaultDesignConfiguration(structure), orientation: 0 as const,
  room_semantics: { living: { name: "Living", room_type: "living_room" as const }, kitchen: { name: "Kitchen", room_type: "kitchen" as const }, other: { name: "Other", room_type: null } } };
const result = (rule_id: string, room_id: string | null, room_type: VastuRuleResult["room_type"], status: VastuRuleResult["result"]): VastuRuleResult => ({
  rule_id, rule_title: rule_id, room_id, room_name: room_id, room_type, detected_zone: "north", preferred_zones: ["north"], result: status, severity: "advisory", explanation: `${rule_id} explanation`,
});
const analysis: VastuAnalysis = { design_id: "design", orientation: 0, score: 50, score_label: "50%", counts: { satisfied: 1, unsatisfied: 1, cannot_evaluate: 0, not_applicable: 2 },
  rule_results: [result("living-rule", "living", "living_room", "satisfied"), result("kitchen-rule", "kitchen", "kitchen", "unsatisfied"), result("unused-rule", null, "pooja_room", "not_applicable"), result("stale-rule", "other", "bedroom", "not_applicable")], warnings: [], analyzed_at: "2026-01-01", analysis_version: "test" };
const design: Design = { id: "design", plan_id: "plan", name: "Test design", configuration, latest_analysis: analysis, created_at: "2026-01-01", updated_at: "2026-01-01" };

describe("full Vastu results", () => {
  it("shows applicable assigned-room results without changing the engine score", () => {
    expect(visibleVastuResults(analysis, configuration, structure).map((item) => item.rule_id)).toEqual(["living-rule", "kitchen-rule"]);
    const html = renderToStaticMarkup(<VastuPanel structure={structure} design={design} configuration={configuration} analysis={analysis} busy={false} showZones={false} onShowZones={() => {}} onConfigurationChange={() => {}} onRun={() => {}} />);
    expect(html).toContain("living-rule"); expect(html).toContain("kitchen-rule");
    expect(html).not.toContain("unused-rule"); expect(html).not.toContain("stale-rule");
    expect(html).toContain("50%");
    expect(html).toContain("Traditional Vastu rule analysis is provided for informational and cultural-reference purposes.");
  });
});
