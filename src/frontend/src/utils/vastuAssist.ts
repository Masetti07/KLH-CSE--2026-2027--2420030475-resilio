import type { DesignConfiguration, Selection, Structure, VastuAnalysis, VastuAssistPreview, VastuRuleResult } from "../types";

export const VASTU_DISCLAIMER = "Traditional Vastu rule analysis is provided for informational and cultural-reference purposes. It is not architectural, structural, legal, safety, engineering or scientific advice.";
export const zoneLabel = (zone: string) => zone.replaceAll("_", "-").split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("-");

export function selectedRoomGuidance(preview: VastuAssistPreview | null, selection: Selection, configuration: DesignConfiguration, structure: Structure) {
  if (!preview || selection?.kind !== "room") return null;
  const room = structure.rooms.find((item) => item.id === selection.id);
  if (!room) return null;
  const semantic = configuration.room_semantics[room.id];
  const rule = preview.rules.find((item) => item.enabled && item.room_type === semantic?.room_type);
  const result = preview.analysis.rule_results.find((item) => item.rule_id === rule?.id && item.room_id === room.id);
  return { room, semantic, rule, result };
}

export function evaluableResults(preview: VastuAssistPreview | null): VastuRuleResult[] {
  return preview?.analysis.rule_results.filter((item) => item.result === "satisfied" || item.result === "unsatisfied") ?? [];
}

export function visibleVastuResults(analysis: VastuAnalysis | null, configuration: DesignConfiguration, structure: Structure): VastuRuleResult[] {
  if (!analysis) return [];
  const roomIds = new Set(structure.rooms.map((room) => room.id));
  return analysis.rule_results.filter((result) => result.result !== "not_applicable" && result.room_id && roomIds.has(result.room_id) && configuration.room_semantics[result.room_id]?.room_type === result.room_type);
}
