import { describe, expect, it, vi } from "vitest";
import { confirmDiscardForNewFile, newFileResetState } from "./sessionState";

describe("new source file session invalidation", () => {
  it("clears every processed-plan and renderer input", () => {
    const reset = newFileResetState();
    expect(reset.result).toBeNull(); expect(reset.history.present).toBeNull(); expect(reset.history.past).toEqual([]); expect(reset.history.future).toEqual([]);
    expect(reset.selection).toBeNull(); expect(reset.designs).toEqual([]); expect(reset.activeDesign).toBeNull(); expect(reset.designConfiguration).toBeNull();
    expect(reset.vastuAnalysis).toBeNull(); expect(reset.compareAId).toBe(""); expect(reset.compareBId).toBe(""); expect(reset.compareVisualId).toBe("");
    expect(reset.showZones).toBe(false); expect(reset.fullscreen3D).toBe(false); expect(reset.tab).toBe("Original"); expect(reset.section).toBe("Structure");
  });

  it("switches immediately when nothing is dirty", () => {
    const confirm = vi.fn(() => false);
    expect(confirmDiscardForNewFile(false, false, confirm)).toBe(true); expect(confirm).not.toHaveBeenCalled();
  });

  it("Cancel preserves the current session and Continue permits clearing", () => {
    expect(confirmDiscardForNewFile(true, false, () => false)).toBe(false);
    expect(confirmDiscardForNewFile(false, true, () => true)).toBe(true);
  });
});
