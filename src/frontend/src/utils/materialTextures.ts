import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { FloorFinish, WallFinish } from "../types";

export type MaterialFinish = WallFinish | FloorFinish;
export type PatternKind = "flat" | "brick" | "panels" | "mottle" | "planks" | "grid" | "veins";
export type MaterialPatternSpec = { pattern: PatternKind; roughness: number; metalness: number; unitX: number; unitY: number };

export const MATERIAL_PATTERN_SPECS: Record<MaterialFinish, MaterialPatternSpec> = {
  paint: { pattern: "flat", roughness: .72, metalness: 0, unitX: 2, unitY: 2 },
  brick_style: { pattern: "brick", roughness: .92, metalness: 0, unitX: 1.2, unitY: .6 },
  wood_panel: { pattern: "panels", roughness: .58, metalness: 0, unitX: .7, unitY: 2 },
  concrete_style: { pattern: "mottle", roughness: .98, metalness: 0, unitX: 2, unitY: 2 },
  wood: { pattern: "planks", roughness: .62, metalness: 0, unitX: .8, unitY: .25 },
  tile: { pattern: "grid", roughness: .35, metalness: .04, unitX: 1, unitY: 1 },
  marble_style: { pattern: "veins", roughness: .24, metalness: .03, unitX: 2.2, unitY: 2.2 },
  concrete: { pattern: "mottle", roughness: .94, metalness: 0, unitX: 2, unitY: 2 },
  neutral: { pattern: "flat", roughness: .88, metalness: 0, unitX: 2, unitY: 2 },
};

export const materialPatternSpec = (finish: MaterialFinish) => MATERIAL_PATTERN_SPECS[finish];
export function textureRepeat(finish: MaterialFinish, width: number, height: number): [number, number] {
  const spec = materialPatternSpec(finish); return [Math.max(1, width / spec.unitX), Math.max(1, height / spec.unitY)];
}

function shade(hex: string, amount: number) {
  const raw = hex.replace("#", "").padEnd(6, "0").slice(0, 6); const value = Number.parseInt(raw, 16);
  const part = (shift: number) => Math.max(0, Math.min(255, ((value >> shift) & 255) + amount));
  return `rgb(${part(16)}, ${part(8)}, ${part(0)})`;
}

export function createProceduralTexture(finish: MaterialFinish, color: string, width: number, height: number): CanvasTexture | null {
  const spec = materialPatternSpec(finish); if (spec.pattern === "flat" || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128; const context = canvas.getContext("2d"); if (!context) return null;
  context.fillStyle = color; context.fillRect(0, 0, 128, 128);
  if (spec.pattern === "brick") {
    context.strokeStyle = shade(color, -48); context.lineWidth = 4;
    for (let y = 0, row = 0; y <= 128; y += 24, row++) { context.beginPath(); context.moveTo(0, y); context.lineTo(128, y); context.stroke(); const offset = row % 2 ? 16 : 0; for (let x = offset; x <= 128; x += 32) { context.beginPath(); context.moveTo(x, y); context.lineTo(x, y + 24); context.stroke(); } }
  } else if (spec.pattern === "panels" || spec.pattern === "planks") {
    const vertical = spec.pattern === "panels"; const step = vertical ? 24 : 20;
    for (let position = 0, index = 0; position < 128; position += step, index++) { context.fillStyle = shade(color, index % 2 ? -12 : 10); context.fillRect(vertical ? position : 0, vertical ? 0 : position, vertical ? step : 128, vertical ? 128 : step); context.strokeStyle = shade(color, -42); context.lineWidth = 2; context.beginPath(); context.moveTo(vertical ? position : 0, vertical ? 0 : position); context.lineTo(vertical ? position : 128, vertical ? 128 : position); context.stroke(); }
    context.strokeStyle = shade(color, -22); context.lineWidth = 1; for (let i = 0; i < 9; i++) { const p = 8 + i * 14; context.beginPath(); context.moveTo(vertical ? p : 0, vertical ? 5 : p); context.bezierCurveTo(vertical ? p + 4 : 42, vertical ? 38 : p + 3, vertical ? p - 3 : 88, vertical ? 83 : p - 2, vertical ? p + 2 : 128, vertical ? 123 : p + 1); context.stroke(); }
  } else if (spec.pattern === "grid") {
    context.strokeStyle = shade(color, -38); context.lineWidth = 3; for (let p = 0; p <= 128; p += 32) { context.beginPath(); context.moveTo(p, 0); context.lineTo(p, 128); context.moveTo(0, p); context.lineTo(128, p); context.stroke(); }
  } else if (spec.pattern === "veins") {
    context.strokeStyle = shade(color, -42); context.globalAlpha = .55; context.lineWidth = 2; for (let i = 0; i < 5; i++) { context.beginPath(); context.moveTo(-8, 18 + i * 27); context.bezierCurveTo(30, i * 18, 68, 52 + i * 13, 136, 12 + i * 24); context.stroke(); } context.globalAlpha = 1;
  } else {
    for (let i = 0; i < 260; i++) { const x = (i * 47) % 128; const y = (i * 83) % 128; context.fillStyle = shade(color, i % 3 === 0 ? -28 : 18); context.globalAlpha = .16 + (i % 4) * .045; context.fillRect(x, y, 2 + i % 4, 2 + (i * 3) % 4); } context.globalAlpha = 1;
  }
  const texture = new CanvasTexture(canvas); texture.wrapS = RepeatWrapping; texture.wrapT = RepeatWrapping; texture.repeat.set(...textureRepeat(finish, width, height)); texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.anisotropy = 4; texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true; return texture;
}
