import type { PointerEvent as ReactPointerEvent } from "react";
import type { HomeProp, Selection, Structure } from "../types";
import { HOME_PROP_CATALOG, homePropPosition, roomPropScale } from "../utils/homeProps";

type Props = { props: HomeProp[]; structure: Structure; selection: Selection; interactive: boolean; onSelect: (id: string) => void; onPointerDown: (prop: HomeProp, event: ReactPointerEvent<SVGGElement>) => void };

function SymbolShape({ type }: { type: HomeProp["type"] }) {
  switch (type) {
    case "bed": return <><rect x="-87" y="-107" width="174" height="214" rx="13" fill="#d9b995" stroke="#604a38" strokeWidth="8" /><rect x="-76" y="-82" width="152" height="179" rx="10" fill="#f7f0e4" /><rect x="-74" y="-84" width="148" height="55" rx="8" fill="#c8d4bd" /><rect x="-68" y="-74" width="60" height="34" rx="8" fill="#fffaf1" /><rect x="8" y="-74" width="60" height="34" rx="8" fill="#fffaf1" /><rect x="-76" y="-20" width="152" height="116" rx="8" fill="#d9e2d3" /></>;
    case "sofa": return <><rect x="-103" y="-48" width="206" height="96" rx="15" fill="#b5bda5" stroke="#566c5c" strokeWidth="6" /><rect x="-83" y="-35" width="166" height="70" rx="10" fill="#e7e5d6" /><path d="M-28 -35v70M28 -35v70" stroke="#b0bbab" strokeWidth="5" /><rect x="-103" y="-48" width="18" height="96" rx="7" fill="#9aa88e" /><rect x="85" y="-48" width="18" height="96" rx="7" fill="#9aa88e" /></>;
    case "table": return <><circle r="63" fill="#aa7249" stroke="#68422b" strokeWidth="7" /><circle r="51" fill="#c78d57" stroke="#dca66e" strokeWidth="4" /><circle r="8" fill="#ead5b2" /></>;
    case "armchair": return <><rect x="-44" y="-44" width="88" height="88" rx="15" fill="#a4b09b" stroke="#536756" strokeWidth="6" /><rect x="-29" y="-30" width="58" height="58" rx="12" fill="#f0e7d5" /><rect x="-44" y="-44" width="15" height="88" rx="6" fill="#879c87" /><rect x="29" y="-44" width="15" height="88" rx="6" fill="#879c87" /></>;
    case "cupboard": return <><rect x="-70" y="-30" width="140" height="60" rx="5" fill="#b68455" stroke="#67472f" strokeWidth="6" /><path d="M0 -27v54" stroke="#6f4c32" strokeWidth="4" /><circle cx="-8" cy="0" r="3" fill="#2f3b33" /><circle cx="8" cy="0" r="3" fill="#2f3b33" /></>;
    case "flower_vase": return <><circle r="24" fill="#bc8468" stroke="#744b3d" strokeWidth="5" /><circle r="11" fill="#3b6651" /><path d="M0 -9Q-18 -34 -27 -30M0 -9Q16 -37 27 -27M0 -9V-38" stroke="#4b7755" strokeWidth="6" fill="none" /><circle cy="-38" r="6" fill="#dfab79" /></>;
    case "clock": return <><circle r="26" fill="#f6f0df" stroke="#926c45" strokeWidth="7" /><path d="M0 -17V0L12 8" stroke="#304a3c" strokeWidth="4" fill="none" /><circle r="4" fill="#304a3c" /></>;
    case "painting": return <><rect x="-46" y="-35" width="92" height="70" rx="3" fill="#a47147" stroke="#65432e" strokeWidth="5" /><rect x="-37" y="-26" width="74" height="52" fill="#dce4d5" /><path d="M-37 21L-8 -10 8 8 25 -14 37 4V26h-74z" fill="#859c7b" /><circle cx="17" cy="-14" r="6" fill="#d69b61" /></>;
  }
}

export default function PropSymbols({ props, structure, selection, interactive, onSelect, onPointerDown }: Props) {
  return <g aria-label="Home props">
    {props.map((prop) => {
      const point = homePropPosition(prop, structure);
      const scale = roomPropScale(prop, structure);
      const label = HOME_PROP_CATALOG.find((item) => item.type === prop.type)?.label ?? prop.type;
      const selected = selection?.kind === "prop" && selection.id === prop.id;
      return <g key={prop.id} className={interactive ? "prop-symbol interactive" : "prop-symbol"} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-label={`${label}${selected ? ", selected" : ""}`} transform={`translate(${point.x * 1000} ${point.y * 1000}) rotate(${prop.rotation}) scale(${scale})`}
        onPointerDown={(event) => { if (interactive) onPointerDown(prop, event); }} onKeyDown={(event) => { if (interactive && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(prop.id); } }}>
        {selected && <circle r="125" fill="none" stroke="#db8b48" strokeWidth="6" strokeDasharray="10 7" />}
        <SymbolShape type={prop.type} />
        <title>{label}</title>
      </g>;
    })}
  </g>;
}
