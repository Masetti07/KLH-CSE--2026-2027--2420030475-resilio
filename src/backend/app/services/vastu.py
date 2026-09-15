from datetime import datetime, timezone

from app.schemas.design import DesignConfiguration, VastuAnalysis, VastuCounts, VastuRule, VastuRuleResult, Zone
from app.schemas.plan import Point, StructuralPlan


ANALYSIS_VERSION = "day-3.0"

VASTU_RULES: tuple[VastuRule, ...] = (
    VastuRule(id="TVR-KITCHEN-01", title="Kitchen directional preference", room_type="kitchen", preferred_zones=["south_east"], severity="advisory", description="Traditional guidance commonly associates kitchens with the south-east zone.", source_reference="docs/vastu/rules.md#tvr-kitchen-01"),
    VastuRule(id="TVR-MASTER-01", title="Master bedroom directional preference", room_type="master_bedroom", preferred_zones=["south_west"], severity="advisory", description="Traditional guidance commonly associates the master bedroom with the south-west zone.", source_reference="docs/vastu/rules.md#tvr-master-01"),
    VastuRule(id="TVR-LIVING-01", title="Living room directional preference", room_type="living_room", preferred_zones=["north", "north_east", "east"], severity="info", description="Traditional guidance often places primary living space toward north, north-east, or east.", source_reference="docs/vastu/rules.md#tvr-living-01"),
    VastuRule(id="TVR-ENTRANCE-01", title="Entrance directional preference", room_type="entrance", preferred_zones=["north", "north_east", "east"], severity="advisory", description="Traditional guidance often prefers an entrance in a north, north-east, or east zone.", source_reference="docs/vastu/rules.md#tvr-entrance-01"),
    VastuRule(id="TVR-POOJA-01", title="Pooja or prayer room directional preference", room_type="pooja_room", preferred_zones=["north_east"], severity="info", description="Traditional guidance commonly associates a pooja or prayer room with the north-east zone.", source_reference="docs/vastu/rules.md#tvr-pooja-01"),
    VastuRule(id="TVR-STUDY-01", title="Study directional preference", room_type="study", preferred_zones=["west"], severity="info", description="The documented Shodasa-Mandira-Chakra translation places study in the west zone.", source_reference="docs/vastu/rules.md#tvr-study-01"),
)


def normalized_plan_bounds(structure: StructuralPlan) -> tuple[float, float, float, float]:
    points: list[Point] = []
    for wall in structure.walls:
        points.extend((Point(x=wall.start_x, y=wall.start_y), Point(x=wall.end_x, y=wall.end_y)))
    if not points:
        points = [point for room in structure.rooms for point in room.polygon]
    if not points:
        return 0.0, 1.0, 0.0, 1.0
    min_x, max_x = min(point.x for point in points), max(point.x for point in points)
    min_y, max_y = min(point.y for point in points), max(point.y for point in points)
    if max_x - min_x < 1e-6 or max_y - min_y < 1e-6:
        return 0.0, 1.0, 0.0, 1.0
    return min_x, max_x, min_y, max_y


def north_aligned_point(x: float, y: float, orientation: int) -> tuple[float, float]:
    if orientation == 0:
        return x, y
    if orientation == 90:
        return y, 1.0 - x
    if orientation == 180:
        return 1.0 - x, 1.0 - y
    if orientation == 270:
        return 1.0 - y, x
    raise ValueError("orientation must be 0, 90, 180, or 270 degrees")


def directional_zone(point: Point, bounds: tuple[float, float, float, float], orientation: int) -> Zone:
    min_x, max_x, min_y, max_y = bounds
    local_x = min(1.0, max(0.0, (point.x - min_x) / (max_x - min_x)))
    local_y = min(1.0, max(0.0, (point.y - min_y) / (max_y - min_y)))
    x, y = north_aligned_point(local_x, local_y, orientation)
    horizontal = "west" if x < 1 / 3 else "east" if x > 2 / 3 else "center"
    vertical = "north" if y < 1 / 3 else "south" if y > 2 / 3 else "center"
    zones: dict[tuple[str, str], Zone] = {
        ("west", "north"): "north_west", ("center", "north"): "north", ("east", "north"): "north_east",
        ("west", "center"): "west", ("center", "center"): "center", ("east", "center"): "east",
        ("west", "south"): "south_west", ("center", "south"): "south", ("east", "south"): "south_east",
    }
    return zones[(horizontal, vertical)]


def room_centroid(points: list[Point]) -> Point:
    return Point(x=sum(point.x for point in points) / len(points), y=sum(point.y for point in points) / len(points))


def analyze_design(design_id: str, configuration: DesignConfiguration, structure: StructuralPlan, rules: tuple[VastuRule, ...] = VASTU_RULES) -> VastuAnalysis:
    bounds = normalized_plan_bounds(structure)
    rooms = {room.id: room for room in structure.rooms}
    warnings: list[str] = []
    unassigned = [room.id for room in structure.rooms if configuration.room_semantics.get(room.id) is None or configuration.room_semantics[room.id].room_type is None]
    if configuration.orientation is None:
        warnings.append("North orientation has not been confirmed; directional rules cannot be evaluated.")
    if unassigned:
        warnings.append(f"Room semantics are unassigned for: {', '.join(unassigned)}. Rules requiring those room purposes cannot be evaluated.")

    results: list[VastuRuleResult] = []
    for rule in rules:
        if not rule.enabled:
            results.append(VastuRuleResult(rule_id=rule.id, rule_title=rule.title, room_id=None, room_name=None, room_type=rule.room_type, detected_zone=None, preferred_zones=rule.preferred_zones, result="not_applicable", severity=rule.severity, explanation="This configurable rule is disabled and was excluded from scoring."))
            continue
        matching = [(room_id, semantic) for room_id, semantic in configuration.room_semantics.items() if semantic.room_type == rule.room_type and room_id in rooms]
        if not matching:
            results.append(VastuRuleResult(rule_id=rule.id, rule_title=rule.title, room_id=None, room_name=None, room_type=rule.room_type, detected_zone=None, preferred_zones=rule.preferred_zones, result="not_applicable", severity=rule.severity, explanation=f"No room is assigned as {rule.room_type.replace('_', ' ')} in this design."))
            continue
        for room_id, semantic in matching:
            room = rooms[room_id]
            if configuration.orientation is None:
                results.append(VastuRuleResult(rule_id=rule.id, rule_title=rule.title, room_id=room_id, room_name=semantic.name or room.name, room_type=rule.room_type, detected_zone=None, preferred_zones=rule.preferred_zones, result="cannot_evaluate", severity=rule.severity, explanation="A user-confirmed North orientation is required to calculate the room's directional zone."))
                continue
            zone = directional_zone(room_centroid(room.polygon), bounds, configuration.orientation)
            satisfied = zone in rule.preferred_zones
            results.append(VastuRuleResult(rule_id=rule.id, rule_title=rule.title, room_id=room_id, room_name=semantic.name or room.name, room_type=rule.room_type, detected_zone=zone, preferred_zones=rule.preferred_zones, result="satisfied" if satisfied else "unsatisfied", severity=rule.severity, explanation=f"The room centroid is in the {zone.replace('_', '-')} zone. Preferred zone(s): {', '.join(item.replace('_', '-') for item in rule.preferred_zones)}."))

    counts = VastuCounts()
    for result in results:
        setattr(counts, result.result, getattr(counts, result.result) + 1)
    evaluable = counts.satisfied + counts.unsatisfied
    score = round(counts.satisfied / evaluable * 100, 1) if evaluable else None
    return VastuAnalysis(design_id=design_id, orientation=configuration.orientation, score=score, score_label=f"{score:.1f}%" if score is not None else "Insufficient information", counts=counts, rule_results=results, warnings=warnings, analyzed_at=datetime.now(timezone.utc), analysis_version=ANALYSIS_VERSION)
