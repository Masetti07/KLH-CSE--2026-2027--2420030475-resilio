import settings from "../config/renderer-quality.json";

export type RenderingQuality = "NORMAL" | "PERFORMANCE";

export function rendererSettings(quality: RenderingQuality) {
  const selected = settings[quality];
  return { ...selected, dpr: Array.isArray(selected.dpr) ? selected.dpr as [number, number] : selected.dpr };
}
