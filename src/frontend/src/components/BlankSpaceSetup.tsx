import { useState, type FormEvent } from "react";
import { DEFAULT_BLANK_DIMENSIONS, validBlankDimensions, type BlankDimensions } from "../utils/startPlans";

type Props = { busy: boolean; error: string | null; onBack: () => void; onCreate: (dimensions: BlankDimensions) => void };

export default function BlankSpaceSetup({ busy, error, onBack, onCreate }: Props) {
  const [dimensions, setDimensions] = useState<BlankDimensions>(DEFAULT_BLANK_DIMENSIONS);
  const ratio = Number.isFinite(dimensions.width_m / dimensions.depth_m) ? dimensions.width_m / dimensions.depth_m : 1;
  const previewWidth = Math.min(275, 169 * ratio), previewDepth = Math.min(169, 275 / ratio);
  const previewX = 230 - previewWidth / 2, previewY = 139 - previewDepth / 2;
  const [validationError, setValidationError] = useState<string | null>(null);
  const update = (field: keyof BlankDimensions, value: string) => {
    setDimensions((current) => ({ ...current, [field]: value === "" ? Number.NaN : Number(value) }));
    setValidationError(null);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validBlankDimensions(dimensions)) { setValidationError("Enter a width and depth from 3–30 m and a wall height from 2.2–5 m."); return; }
    onCreate(dimensions);
  };
  return <section className="blank-setup" aria-labelledby="blank-title">
    <button type="button" className="start-back" disabled={busy} onClick={onBack}>← Back</button>
    <div className="blank-setup-card">
      <div className="blank-setup-copy"><p className="eyebrow">Create from scratch</p><h1 id="blank-title">Create your space</h1><p>Set the basic dimensions of your home. You can divide and customize the space afterwards.</p></div>
      <div className="blank-preview" aria-label={`Rectangular space approximately ${Number.isFinite(dimensions.width_m) ? dimensions.width_m : 0} by ${Number.isFinite(dimensions.depth_m) ? dimensions.depth_m : 0} metres`}>
        <svg viewBox="0 0 460 290" role="img" aria-label="Preview of an empty rectangular house boundary">
          <rect x="58" y="28" width="344" height="224" rx="10" fill="#f7f2e9" stroke="#d7dfd6" />
          <rect x={previewX} y={previewY} width={previewWidth} height={previewDepth} fill="#e6e0d3" stroke="#234b3d" strokeWidth="15" />
          <rect x={previewX} y={previewY} width={previewWidth} height={previewDepth} fill="none" stroke="#17392e" strokeWidth="7" />
          <path d={`M${previewX} 240h${previewWidth}M77 ${previewY}v${previewDepth}`} stroke="#b36a38" strokeWidth="2" strokeDasharray="5 4" />
          <text x="230" y="266" textAnchor="middle" fill="#234b3d" fontSize="15" fontWeight="700">{Number.isFinite(dimensions.width_m) ? dimensions.width_m : "—"} m width</text>
          <text x="47" y="140" textAnchor="middle" transform="rotate(-90 47 140)" fill="#234b3d" fontSize="15" fontWeight="700">{Number.isFinite(dimensions.depth_m) ? dimensions.depth_m : "—"} m depth</text>
          <text x="230" y="146" textAnchor="middle" fill="#577064" fontSize="18">Your space</text>
        </svg>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="blank-fields">
          <label>Width <span>(metres)</span><input type="number" min="3" max="30" step="0.1" value={Number.isNaN(dimensions.width_m) ? "" : dimensions.width_m} onChange={(event) => update("width_m", event.target.value)} /></label>
          <label>Depth <span>(metres)</span><input type="number" min="3" max="30" step="0.1" value={Number.isNaN(dimensions.depth_m) ? "" : dimensions.depth_m} onChange={(event) => update("depth_m", event.target.value)} /></label>
          <label>Wall height <span>(metres)</span><input type="number" min="2.2" max="5" step="0.1" value={Number.isNaN(dimensions.wall_height_m) ? "" : dimensions.wall_height_m} onChange={(event) => update("wall_height_m", event.target.value)} /></label>
        </div>
        {(validationError || error) && <p role="alert" className="design-error">{validationError || error}</p>}
        <button className="primary-button blank-create" type="submit" disabled={busy}>{busy ? "Creating space…" : "Create Space →"}</button>
      </form>
    </div>
  </section>;
}
