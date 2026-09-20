export type StarterKind = "blank" | "one_bedroom" | "two_bedroom" | "three_bedroom";
export const starterEntryView = (kind: StarterKind): "blank_setup" | "create" => kind === "blank" ? "blank_setup" : "create";
export type BlankDimensions = { width_m: number; depth_m: number; wall_height_m: number };
export const DEFAULT_BLANK_DIMENSIONS: BlankDimensions = { width_m: 10, depth_m: 8, wall_height_m: 3 };
export function validBlankDimensions(value: BlankDimensions): boolean {
  return Number.isFinite(value.width_m) && value.width_m >= 3 && value.width_m <= 30
    && Number.isFinite(value.depth_m) && value.depth_m >= 3 && value.depth_m <= 30
    && Number.isFinite(value.wall_height_m) && value.wall_height_m >= 2.2 && value.wall_height_m <= 5;
}
export const STARTER_PLANS: { kind: StarterKind; label: string }[] = [
  { kind: "blank", label: "Blank Plan" },
  { kind: "one_bedroom", label: "1 Bedroom Starter" },
  { kind: "two_bedroom", label: "2 Bedroom Starter" },
  { kind: "three_bedroom", label: "3 Bedroom Starter" },
];
export const SAMPLE_PLANS = [
  { name: "sample_simple_1bed.png", label: "Simple 1 Bedroom" },
  { name: "sample_compact_2bed.png", label: "Compact 2 Bedroom" },
  { name: "sample_family_house.png", label: "Family House" },
];
