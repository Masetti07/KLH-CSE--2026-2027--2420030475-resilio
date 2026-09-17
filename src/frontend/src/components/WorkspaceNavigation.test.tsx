import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SimulationStatus } from "../types";
import { newFileResetState } from "../utils/sessionState";
import ResilienceLab from "./ResilienceLab";
import WorkspaceNavigation, { workspaceSectionAvailable } from "./WorkspaceNavigation";

const activeProcessingFailure: SimulationStatus = {
  any_active: true,
  scenarios: {
    low_fps: { active: false, simulated_value: 16 },
    renderer_failure: { active: false, simulated_value: null },
    processing_failure: { active: true, simulated_value: null },
    low_reconstruction_confidence: { active: false, simulated_value: .35 },
    autosave_corruption: { active: false, simulated_value: null },
  },
};

describe("processing-failure recovery navigation", () => {
  it("keeps diagnostic sections reachable while structure-dependent sections are safely disabled", () => {
    const html = renderToStaticMarkup(<WorkspaceNavigation section="Structure" hasStructure={false} onSelect={() => undefined} />);
    expect(workspaceSectionAvailable("Structure", false)).toBe(true);
    expect(workspaceSectionAvailable("Control Center", false)).toBe(true);
    expect(workspaceSectionAvailable("Resilience Lab", false)).toBe(true);
    expect(workspaceSectionAvailable("Design Studio", false)).toBe(false);
    expect(workspaceSectionAvailable("Vastu", false)).toBe(false);
    expect(workspaceSectionAvailable("Compare", false)).toBe(false);
    expect(html).toContain(">Structure</button>");
    expect(html).toContain(">Control Center</button>");
    expect(html).toContain(">Resilience Lab</button>");
    expect(html).toContain("Design Studio requires a valid structural reconstruction.");
  });

  it("preserves the selected source, rejects stale structure, exposes the active simulation, and permits a successful retry", async () => {
    const previousStructure = { id: "previous-plan" };
    const selectedSource = { name: "replacement.png" };
    expect(previousStructure.id).toBe("previous-plan");

    const reset = newFileResetState();
    expect(reset.history.present).toBeNull();
    expect(reset.result).toBeNull();
    expect(reset.section).toBe("Structure");

    const controlledUpload = vi.fn().mockRejectedValueOnce(new Error("A controlled processing failure is active. The selected source plan is preserved; clear the simulation and try again."));
    await expect(controlledUpload(selectedSource)).rejects.toThrow("selected source plan is preserved");
    expect(selectedSource.name).toBe("replacement.png");
    expect(reset.history.present).not.toBe(previousStructure);

    const lab = renderToStaticMarkup(<ResilienceLab status={activeProcessingFailure} system={null} history={[]} busy={false} error={null} onActivate={() => undefined} onClear={() => undefined} onRestoreAll={() => undefined} />);
    expect(lab).toContain("SIMULATED CONDITION");
    expect(lab).toContain("Active · simulated");
    expect(lab).toContain("Simulate Processing Failure");
    expect(lab).toContain(">Clear</button>");

    const cleared = structuredClone(activeProcessingFailure);
    cleared.any_active = false;
    cleared.scenarios.processing_failure.active = false;
    const successfulStructure = { id: "replacement-plan" };
    controlledUpload.mockResolvedValueOnce({ structure: successfulStructure });
    const retried = await controlledUpload(selectedSource);
    expect(cleared.scenarios.processing_failure.active).toBe(false);
    expect(retried.structure).toEqual(successfulStructure);
  });
});
