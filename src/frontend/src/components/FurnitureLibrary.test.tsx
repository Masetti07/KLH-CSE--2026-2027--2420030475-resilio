import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Structure, Selection } from "../types";
import { defaultDesignConfiguration } from "../utils/designState";
import { HOME_PROP_CATALOG } from "../utils/homeProps";
import FurnitureLibrary from "./FurnitureLibrary";
import HomePropsPanel from "./HomePropsPanel";

const structure = { id: "plan", wall_height: 3, walls: [{ id: "wall" }], rooms: [{ id: "room", name: "Room", type: null }], openings: [] } as unknown as Structure;
const props = { structure, configuration: defaultDesignConfiguration(structure), selection: null as Selection, onSelect: () => {}, onChange: () => {}, onShow2D: () => {} };

describe("Furniture Library presentation", () => {
  it("starts closed with a keyboard-operable disclosure button", () => {
    const html = renderToStaticMarkup(<FurnitureLibrary {...props} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="furniture-library-drawer"');
    expect(html).toContain(">Furniture Library</button>");
    expect(html).not.toContain('role="dialog"');
  });
  it("shows all 32 existing props once in six native accordion groups, initially Living Room", () => {
    const html = renderToStaticMarkup(<HomePropsPanel {...props} library />);
    const groups = [...html.matchAll(/<details([^>]*)>(.*?)<\/details>/gs)];
    expect(groups).toHaveLength(6);
    const titles = groups.map((group) => group[2].match(/<summary>(.*?)<span/s)![1]);
    expect(titles).toEqual(["Living Room", "Bedroom", "Kitchen &amp; Dining", "Bathroom", "Study &amp; Decor", "Wall Decor"]);
    expect(groups.map((group) => group[1].includes('open=""'))).toEqual([true, false, false, false, false, false]);
    expect(groups.every((group) => group[1].includes('name="furniture-library-categories"'))).toBe(true);
    for (const item of HOME_PROP_CATALOG) expect(html.split(`Add ${item.label}</button>`)).toHaveLength(2);
    const study = groups[4][2];
    for (const name of ["Desk", "Desk Chair", "Open Bookcase", "Closed Bookcase", "Flower Vase", "Round Floor Lamp", "Potted Plant"]) expect(study).toContain(`Add ${name}</button>`);
    expect(groups[0][2]).toContain("Add TV</button>");
    expect(html).not.toContain("Kenney");
    expect(html).not.toContain("Open 2D plan");
  });
  it.each([null, { kind: "room", id: "room" }, { kind: "wall", id: "wall" }] as Selection[])("uses existing placement requirements for %j", (selection) => {
    const html = renderToStaticMarkup(<HomePropsPanel {...props} selection={selection} library />);
    const articles = [...html.matchAll(/<article\b[^>]*>(.*?)<\/article>/gs)].map((match) => match[1]);
    expect(articles).toHaveLength(32);
    for (const item of HOME_PROP_CATALOG) {
      const card = articles.find((article) => article.includes(`Add ${item.label}</button>`))!;
      expect(card.includes('disabled=""')).toBe(selection?.kind !== item.placement);
    }
  });
  it("retains the original Home Props panel and its existing categories and controls", () => {
    const html = renderToStaticMarkup(<HomePropsPanel {...props} />);
    expect(html).toContain('id="home-props-title"');
    expect(html).toContain("Open 2D plan");
    expect(html).toContain("Study &amp; Storage</h4>");
    expect(html).toContain("Decor &amp; Accessories</h4>");
    expect(html).not.toContain("<details");
  });
});
