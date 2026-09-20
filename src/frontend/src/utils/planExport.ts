import type { DesignConfiguration, Structure } from "../types";
import { roomDisplayName } from "./designState";

const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const number = (value: number) => Math.round(value * 1000 * 100) / 100;

export function planExportSvg(structure: Structure, design?: DesignConfiguration | null): string {
  const rooms = structure.rooms.map((room, index) => {
    const points = room.polygon.map((point) => `${number(point.x)},${number(point.y)}`).join(" ");
    const x = room.polygon.reduce((sum, point) => sum + point.x, 0) / room.polygon.length;
    const y = room.polygon.reduce((sum, point) => sum + point.y, 0) / room.polygon.length;
    return `<polygon points="${points}" fill="#f6f8f4" stroke="#a9b9b0" stroke-width="2" stroke-dasharray="8 6"/><text x="${number(x)}" y="${number(y)}" text-anchor="middle" dominant-baseline="middle" font-size="20" fill="#294139">${xml(roomDisplayName(design, room, index))}</text>`;
  }).join("");
  const walls = structure.walls.map((wall) => `<line x1="${number(wall.start_x)}" y1="${number(wall.start_y)}" x2="${number(wall.end_x)}" y2="${number(wall.end_y)}" stroke="#172f2a" stroke-width="${Math.max(6, number(wall.thickness))}" stroke-linecap="square"/>`).join("");
  const openings = structure.openings.map((opening) => {
    const wall = structure.walls.find((item) => item.id === opening.wall_id);
    const x = number(opening.position.x), y = number(opening.position.y), half = Math.max(20, number(opening.width) / 2);
    const angle = wall ? Math.atan2(wall.end_y - wall.start_y, wall.end_x - wall.start_x) * 180 / Math.PI : 0;
    if (!wall || opening.probable_type === "unknown") return `<circle cx="${x}" cy="${y}" r="9" fill="#b69148"/>`;
    const mask = `<rect x="${-half}" y="-13" width="${half * 2}" height="26" fill="white"/>`;
    const symbol = opening.probable_type === "window"
      ? `<line x1="${-half}" y1="-5" x2="${half}" y2="-5" stroke="#327b9b" stroke-width="5"/><line x1="${-half}" y1="5" x2="${half}" y2="5" stroke="#327b9b" stroke-width="5"/>`
      : `<line x1="${-half}" y1="0" x2="${-half}" y2="${-half * 1.4}" stroke="#865837" stroke-width="5"/><path d="M ${-half} ${-half * 1.4} A ${half * 1.4} ${half * 1.4} 0 0 1 ${half} 0" fill="none" stroke="#865837" stroke-width="3"/>`;
    return `<g transform="translate(${x} ${y}) rotate(${angle})">${mask}${symbol}</g>`;
  }).join("");
  const dimensions = structure.physical_dimensions ? `<text x="500" y="35" text-anchor="middle" font-size="20" fill="#294139">${structure.physical_dimensions.width_m} m × ${structure.physical_dimensions.depth_m} m</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="white"/>${dimensions}${rooms}${walls}${openings}</svg>`;
}

export async function downloadPlanPng(structure: Structure, design?: DesignConfiguration | null): Promise<void> {
  const source = URL.createObjectURL(new Blob([planExportSvg(structure, design)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("The floor plan image could not be prepared.")); image.src = source; });
    const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 1600;
    const context = canvas.getContext("2d"); if (!context) throw new Error("PNG export is unavailable in this browser.");
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG export failed.")), "image/png"));
    const url = URL.createObjectURL(blob);
    try { const link = document.createElement("a"); link.href = url; link.download = "resiliospace-floor-plan.png"; document.body.append(link); link.click(); link.remove(); }
    finally { URL.revokeObjectURL(url); }
  } finally { URL.revokeObjectURL(source); }
}
