import type { Design, DesignConfiguration, Selection, UploadResult, VastuAnalysis } from "../types";
import { initialHistory, type HistoryState } from "./editState";

export type NewFileReset = {
  result: UploadResult | null; history: HistoryState; savedSnapshot: string; selection: Selection;
  tab: "Original"; section: "Structure"; designs: Design[]; activeDesign: Design | null;
  designConfiguration: DesignConfiguration | null; designSnapshot: string; vastuAnalysis: VastuAnalysis | null;
  showZones: boolean; compareAId: string; compareBId: string; compareVisualId: string; fullscreen3D: boolean; inspectorCollapsed: boolean;
};

export function newFileResetState(): NewFileReset {
  return {
    result: null, history: initialHistory(), savedSnapshot: "", selection: null, tab: "Original", section: "Structure",
    designs: [], activeDesign: null, designConfiguration: null, designSnapshot: "", vastuAnalysis: null, showZones: false,
    compareAId: "", compareBId: "", compareVisualId: "", fullscreen3D: false, inspectorCollapsed: false,
  };
}

export function confirmDiscardForNewFile(structureDirty: boolean, designDirty: boolean, confirm: (message: string) => boolean): boolean {
  if (!structureDirty && !designDirty) return true;
  return confirm("You have unsaved changes to the current plan. Selecting another plan will discard those unsaved changes. Continue?");
}
