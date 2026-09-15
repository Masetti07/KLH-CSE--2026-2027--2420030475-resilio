import { describe, expect, it } from "vitest";
import { rendererSettings } from "./rendererQuality";

describe("adaptive renderer settings", () => {
  it("applies the real reduced-cost PERFORMANCE configuration", () => {
    expect(rendererSettings("PERFORMANCE")).toEqual({ dpr: 1, shadows: false, shadowMapSize: 256 });
  });

  it("restores the normal configuration only when NORMAL is supplied", () => {
    expect(rendererSettings("NORMAL")).toEqual({ dpr: [1, 1.75], shadows: true, shadowMapSize: 1024 });
  });
});
