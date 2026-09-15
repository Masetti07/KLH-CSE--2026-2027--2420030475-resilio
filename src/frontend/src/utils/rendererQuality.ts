export type RenderingQuality = "NORMAL" | "PERFORMANCE";

export function rendererSettings(quality: RenderingQuality) {
  const performance = quality === "PERFORMANCE";
  return {
    dpr: performance ? 1 : [1, 1.75] as [number, number],
    shadows: !performance,
    shadowMapSize: performance ? 256 : 1024,
  };
}
