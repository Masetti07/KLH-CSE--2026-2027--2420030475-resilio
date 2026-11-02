import { useState } from "react";
import type { DesignConfiguration, HomePropType, Selection, Structure } from "../types";
import { addHomeProp, deleteHomeProp, FURNITURE_CATEGORIES, HOME_PROP_CATALOG, moveHomeProp, offsetWallProp, rotateHomeProp, wallMoveControls } from "../utils/homeProps";

type Props = { structure: Structure; configuration: DesignConfiguration; selection: Selection; onSelect: (selection: Selection) => void; onChange: (configuration: DesignConfiguration) => void; onShow2D: () => void; library?: boolean };

export default function HomePropsPanel({ structure, configuration, selection, onSelect, onChange, onShow2D, library = false }: Props) {
  const [error, setError] = useState<string | null>(null);
  const selected = selection?.kind === "prop" ? (configuration.props ?? []).find((prop) => prop.id === selection.id) : undefined;
  const add = (type: HomePropType) => {
    try { const next = addHomeProp(configuration, structure, selection, type); onChange(next.configuration); onSelect({ kind: "prop", id: next.prop.id }); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The prop could not be added."); }
  };
  const nudge = (x: number, y: number) => {
    if (!selected) return;
    onChange(moveHomeProp(configuration, structure, selected.id, { x: selected.position.x + x, y: selected.position.y + y }));
  };
  const titleId = library ? "furniture-library-catalog-title" : "home-props-title";
  const categories = library ? ["Living Room", "Bedroom", "Kitchen & Dining", "Bathroom", "Study & Decor", "Wall Decor"] : FURNITURE_CATEGORIES;
  return <section className={`home-props-panel${library ? " home-props-library" : ""}`} aria-labelledby={titleId}>
    <div className="home-props-heading"><div>{!library && <p className="eyebrow">Design Studio</p>}<h3 id={titleId}>{library ? "Choose a prop" : "Home Props"}</h3><p>{library ? "Select a room for furniture or a wall for wall decor. You can keep working with this drawer open." : "Cozy decorative details for your design version. Select a room or wall, then add a prop."}</p></div>{!library && <button type="button" className="secondary-button" onClick={onShow2D}>Open 2D plan</button>}</div>
    {library && error && <p role="alert" className="design-error">{error}</p>}
    {categories.map((category) => {
      const items = HOME_PROP_CATALOG.filter((item) => category === "Study & Decor" ? item.category === "Study & Storage" || item.category === "Decor & Accessories" : item.category === category);
      const cards = <div className="home-props-grid">{items.map((item) => <article className="home-prop-card" key={item.type}>
        <span className="home-prop-icon" aria-hidden="true">{item.icon}</span><strong>{item.label}</strong>
        <button type="button" disabled={selection?.kind !== item.placement} onClick={() => add(item.type)}>Add {item.label}</button>
      </article>)}</div>;
      return library ? <details className="furniture-library-category" key={category} name="furniture-library-categories" open={category === "Living Room"}>
        <summary>{category}<span aria-hidden="true">{items.length}</span></summary>{cards}
      </details> : <div className="home-props-group" key={category}><h4>{category}</h4>{cards}</div>;
    })}
    {!library && error && <p role="alert" className="design-error">{error}</p>}
    {!library && selected && <div className="home-prop-controls"><strong>{HOME_PROP_CATALOG.find((item) => item.type === selected.type)?.label} selected</strong>
      {selected.placement_type === "room" ? <><p>Drag it in the 2D plan, or use the move buttons. Rotation changes in 45° steps.</p><div className="home-prop-control-row"><button type="button" onClick={() => onChange(rotateHomeProp(configuration, selected.id, -45))}>Rotate Left</button><button type="button" onClick={() => onChange(rotateHomeProp(configuration, selected.id, 45))}>Rotate Right</button><button type="button" onClick={() => nudge(-.02, 0)} aria-label="Move prop left">←</button><button type="button" onClick={() => nudge(0, -.02)} aria-label="Move prop up">↑</button><button type="button" onClick={() => nudge(0, .02)} aria-label="Move prop down">↓</button><button type="button" onClick={() => nudge(.02, 0)} aria-label="Move prop right">→</button></div></>
        : <><p>Attached to {selected.wall_id}. Move it along the wall if needed.</p><div className="home-prop-control-row">{wallMoveControls(structure.walls.find((wall) => wall.id === selected.wall_id)).map((action) => <button key={action.label} type="button" onClick={() => onChange(offsetWallProp(configuration, selected.id, action.amount))}>{action.label}</button>)}</div></>}
      <button type="button" className="danger-button" onClick={() => { onChange(deleteHomeProp(configuration, selected.id)); onSelect(null); }}>Delete Prop</button>
    </div>}
    {(configuration.props ?? []).length > 0 && <p className="home-props-count">{configuration.props!.length} {configuration.props!.length === 1 ? "prop" : "props"} in this design</p>}
  </section>;
}
