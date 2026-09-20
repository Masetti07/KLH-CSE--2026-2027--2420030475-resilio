import type { DesignConfiguration, Selection, Structure } from "../types";
import { deleteHomeProp, HOME_PROP_CATALOG, moveHomeProp, offsetWallProp, rotateHomeProp, wallMoveControls } from "../utils/homeProps";

type Props = { structure: Structure; configuration: DesignConfiguration; selection: Selection; onChange: (value: DesignConfiguration) => void; onSelect: (value: Selection) => void };

export default function PropQuickEdit({ structure, configuration, selection, onChange, onSelect }: Props) {
  const prop = selection?.kind === "prop" ? configuration.props?.find((item) => item.id === selection.id) : undefined;
  if (!prop) return null;
  const move = (x: number, y: number) => onChange(moveHomeProp(configuration, structure, prop.id, { x: prop.position.x + x, y: prop.position.y + y }));
  const wallMoves = wallMoveControls(structure.walls.find((wall) => wall.id === prop.wall_id));
  return <div className="prop-quick-edit" aria-label="Selected prop quick controls">
    <strong>Selected: {HOME_PROP_CATALOG.find((item) => item.type === prop.type)?.label}</strong>
    {prop.placement_type === "room" ? <><div><button type="button" onClick={() => onChange(rotateHomeProp(configuration, prop.id, -45))}>Rotate Left</button><button type="button" onClick={() => onChange(rotateHomeProp(configuration, prop.id, 45))}>Rotate Right</button></div><div><button type="button" aria-label="Move prop left" onClick={() => move(-.02, 0)}>←</button><button type="button" aria-label="Move prop up" onClick={() => move(0, -.02)}>↑</button><button type="button" aria-label="Move prop down" onClick={() => move(0, .02)}>↓</button><button type="button" aria-label="Move prop right" onClick={() => move(.02, 0)}>→</button></div></> : <div>{wallMoves.map((action) => <button key={action.label} type="button" onClick={() => onChange(offsetWallProp(configuration, prop.id, action.amount))}>{action.label}</button>)}</div>}
    <button type="button" className="danger-button" onClick={() => { onChange(deleteHomeProp(configuration, prop.id)); onSelect(null); }}>Delete</button>
  </div>;
}
