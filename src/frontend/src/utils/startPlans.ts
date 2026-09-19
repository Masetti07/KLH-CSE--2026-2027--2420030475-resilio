export type StarterKind = "blank" | "one_bedroom" | "two_bedroom" | "three_bedroom";
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
