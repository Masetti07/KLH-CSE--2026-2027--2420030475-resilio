import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StartExperience from "./StartExperience";
import { newFileResetState } from "../utils/sessionState";
import { starterEntryView, validBlankDimensions } from "../utils/startPlans";
import BlankSpaceSetup from "./BlankSpaceSetup";

const props = { busy: false, error: null, onUpload: () => undefined, onChoice: () => undefined, onSample: () => undefined, onStarter: () => undefined };

describe("start experience", () => {
  it("shows three entry paths and keeps upload accessible", () => {
    const html = renderToStaticMarkup(<StartExperience {...props} choice="home" />);
    expect(html).toContain("Start your home design");
    for (const label of ["Upload Floor Plan", "Create From Scratch", "Use Sample Plan", "PNG/JPG"]) expect(html).toContain(label);
  });
  it("shows the existing sample choices and back navigation", () => {
    const html = renderToStaticMarkup(<StartExperience {...props} choice="samples" />);
    for (const label of ["Simple 1 Bedroom", "Compact 2 Bedroom", "Family House", "Back"]) expect(html).toContain(label);
  });
  it("shows four starter choices and back navigation", () => {
    const html = renderToStaticMarkup(<StartExperience {...props} choice="starters" />);
    for (const label of ["Blank Plan", "1 Bedroom Starter", "2 Bedroom Starter", "3 Bedroom Starter", "Back"]) expect(html).toContain(label);
  });
  it("routes only Blank Plan through dimension setup and validates its dimensions", () => {
    expect(starterEntryView("blank")).toBe("blank_setup");
    for (const kind of ["one_bedroom", "two_bedroom", "three_bedroom"] as const) expect(starterEntryView(kind)).toBe("create");
    const html = renderToStaticMarkup(<BlankSpaceSetup busy={false} error={null} onBack={() => undefined} onCreate={() => undefined} />);
    for (const label of ["Create your space", "Width", "Depth", "Wall height", "Create Space", "Back"]) expect(html).toContain(label);
    expect(validBlankDimensions({ width_m: 10, depth_m: 8, wall_height_m: 3 })).toBe(true);
    expect(validBlankDimensions({ width_m: 2, depth_m: 8, wall_height_m: 3 })).toBe(false);
    expect(validBlankDimensions({ width_m: 10, depth_m: 31, wall_height_m: 3 })).toBe(false);
    expect(validBlankDimensions({ width_m: 10, depth_m: 8, wall_height_m: 6 })).toBe(false);
  });
  it("clears prior plan-specific workspace state before another start", () => {
    const reset = newFileResetState();
    expect(reset.history.present).toBeNull();
    expect(reset.selection).toBeNull();
    expect(reset.designs).toEqual([]);
    expect(reset.vastuAnalysis).toBeNull();
    expect(reset.section).toBe("Structure");
  });
});
