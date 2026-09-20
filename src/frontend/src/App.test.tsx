import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("landing introduction", () => {
  it("renders the hero and links Start Designing to the existing three-card start section", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("From floor plan");
    expect(html).toContain("living space.");
    expect(html).toContain('href="#workspace"');
    expect(html).toContain('id="workspace"');
    for (const label of ["Upload Floor Plan", "Create From Scratch", "Use Sample Plan"]) expect(html).toContain(label);
  });
});
