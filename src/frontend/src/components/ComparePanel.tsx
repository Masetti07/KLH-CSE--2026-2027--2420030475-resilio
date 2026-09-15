import type { Design, Selection, Structure } from "../types";
import { compareDesigns } from "../utils/designState";
import RendererBoundary from "./RendererBoundary";
import ThreeViewer from "./ThreeViewer";

type Props = { structure: Structure; designs: Design[]; designAId: string; designBId: string; visualId: string; selection: Selection; fullscreen: boolean; renderingQuality?: "NORMAL" | "PERFORMANCE"; onTelemetry?: (fps: number, frameTime: number) => void; onFailure?: () => void; onDesignA: (id: string) => void; onDesignB: (id: string) => void; onVisual: (id: string) => void; onSelect: (selection: Selection) => void; onToggleFullscreen: () => void; onReturnTo2D: () => void };

export default function ComparePanel({ structure, designs, designAId, designBId, visualId, selection, fullscreen, renderingQuality, onTelemetry, onFailure, onDesignA, onDesignB, onVisual, onSelect, onToggleFullscreen, onReturnTo2D }: Props) {
  const designA = designs.find((item) => item.id === designAId) ?? designs[0]; const designB = designs.find((item) => item.id === designBId) ?? designs[1] ?? designs[0];
  if (!designA || !designB) return <div className="comparison-empty"><strong>Create at least one saved design to compare.</strong></div>;
  const visual = designs.find((item) => item.id === visualId) ?? designA;
  return <div className="compare-panel">
    <div className="compare-controls"><label className="field"><span>Design A</span><select value={designA.id} onChange={(event) => onDesignA(event.target.value)}>{designs.map((design) => <option key={design.id} value={design.id}>{design.name}</option>)}</select></label><label className="field"><span>Design B</span><select value={designB.id} onChange={(event) => onDesignB(event.target.value)}>{designs.map((design) => <option key={design.id} value={design.id}>{design.name}</option>)}</select></label><div className="segmented-control comparison-toggle"><button aria-pressed={visual.id === designA.id} onClick={() => onVisual(designA.id)}>Show Design A</button><button aria-pressed={visual.id === designB.id} onClick={() => onVisual(designB.id)}>Show Design B</button></div></div>
    <div className="comparison-view"><span className="active-design-badge">Viewing: {visual.name}</span><RendererBoundary onFailure={onFailure} onReturnTo2D={onReturnTo2D}><ThreeViewer structure={structure} design={visual.configuration} selection={selection} onSelect={onSelect} fullscreen={fullscreen} onToggleFullscreen={onToggleFullscreen} renderingQuality={renderingQuality} onTelemetry={onTelemetry} /></RendererBoundary></div>
    <div className="comparison-summary"><h3>Comparison summary</h3><table><thead><tr><th>Property</th><th>{designA.name}</th><th>{designB.name}</th></tr></thead><tbody>{compareDesigns(designA, designB).map((row) => <tr key={row.label} className={row.changed ? "changed" : ""}><th>{row.label}</th><td>{row.designA}</td><td>{row.designB}</td></tr>)}</tbody></table></div>
  </div>;
}
