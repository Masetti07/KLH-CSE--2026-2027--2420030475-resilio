export type StudioSection = "Structure" | "Design Studio" | "Vastu" | "Compare" | "Control Center" | "Resilience Lab";

export const WORKSPACE_SECTIONS: StudioSection[] = ["Structure", "Design Studio", "Vastu", "Compare", "Control Center", "Resilience Lab"];

export function workspaceSectionAvailable(section: StudioSection, hasStructure: boolean): boolean {
  return hasStructure || section === "Structure" || section === "Control Center" || section === "Resilience Lab";
}

type Props = {
  section: StudioSection;
  hasStructure: boolean;
  onSelect: (section: StudioSection) => void;
};

export default function WorkspaceNavigation({ section, hasStructure, onSelect }: Props) {
  return <div className="studio-tabs" role="tablist" aria-label="Workspace sections">
    {WORKSPACE_SECTIONS.map((item) => {
      const available = workspaceSectionAvailable(item, hasStructure);
      return <button
        key={item}
        type="button"
        role="tab"
        aria-selected={section === item}
        aria-disabled={!available}
        disabled={!available}
        title={available ? undefined : `${item} requires a valid structural reconstruction.`}
        onClick={() => onSelect(item)}
      >{item}</button>;
    })}
  </div>;
}
