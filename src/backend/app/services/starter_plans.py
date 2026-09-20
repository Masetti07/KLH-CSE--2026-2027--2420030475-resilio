"""Local, deterministic editable layouts using the shared structural schema."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.plan import Opening, Point, ProcessingMetadata, Room, StructuralPlan, Wall


StarterKind = Literal["blank", "one_bedroom", "two_bedroom", "three_bedroom"]
STARTER_NAMES: dict[StarterKind, str] = {
    "blank": "Blank Plan", "one_bedroom": "1 Bedroom Starter",
    "two_bedroom": "2 Bedroom Starter", "three_bedroom": "3 Bedroom Starter",
}


class BlankDimensions(BaseModel):
    width_m: float = Field(default=10, ge=3, le=30)
    depth_m: float = Field(default=8, ge=3, le=30)
    wall_height_m: float = Field(default=3, ge=2.2, le=5)


def make_starter_plan(kind: StarterKind, plan_id: str, dimensions: BlankDimensions | None = None) -> StructuralPlan:
    dimensions = dimensions or BlankDimensions()
    layouts = {
        "blank": [],
        "one_bedroom": [("Living Room", "living_room", 0, 0), ("Kitchen", "kitchen", 1, 0),
                        ("Bedroom", "master_bedroom", 0, 1), ("Bathroom", "bathroom", 1, 1)],
        "two_bedroom": [("Living Room", "living_room", 0, 0), ("Kitchen", "kitchen", 1, 0), ("Bathroom", "bathroom", 2, 0),
                        ("Bedroom 1", "master_bedroom", 0, 1), ("Bedroom 2", "bedroom", 1, 1), ("Dining Room", "dining", 2, 1)],
        "three_bedroom": [("Living Room", "living_room", 0, 0), ("Kitchen", "kitchen", 1, 0), ("Bathroom", "bathroom", 2, 0),
                          ("Bedroom 1", "master_bedroom", 0, 1), ("Bedroom 2", "bedroom", 1, 1), ("Bedroom 3", "bedroom", 2, 1)],
    }
    cells = layouts[kind]
    columns = 2 if kind == "one_bedroom" else 3
    rooms: list[Room] = []
    walls: list[Wall] = []
    openings: list[Opening] = []
    edges: set[tuple[float, float, float, float]] = set()
    physical_dimensions = None
    if kind == "blank":
        scale = round(max(dimensions.width_m, dimensions.depth_m) / .8, 8)
        half_width = dimensions.width_m / scale / 2
        half_depth = dimensions.depth_m / scale / 2
        x0, x1 = .5 - half_width, .5 + half_width
        y0, y1 = .5 - half_depth, .5 + half_depth
        corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        walls = [Wall(id=f"boundary-{index + 1}", start_x=start[0], start_y=start[1], end_x=end[0], end_y=end[1], thickness=.012, confidence=1)
                 for index, (start, end) in enumerate(zip(corners, corners[1:] + corners[:1]))]
        physical_dimensions = {"width_m": dimensions.width_m, "depth_m": dimensions.depth_m, "metres_per_normalized_unit": scale}
    for index, (name, room_type, col, row) in enumerate(cells):
        x0, x1 = round(.1 + col * .8 / columns, 6), round(.1 + (col + 1) * .8 / columns, 6)
        y0, y1 = .1 + row * .4, .1 + (row + 1) * .4
        rooms.append(Room(id=f"room-{index + 1}", polygon=[Point(x=x0, y=y0), Point(x=x1, y=y0), Point(x=x1, y=y1), Point(x=x0, y=y1)], name=name, type=room_type, confidence=1))
        for a, b in [((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x0, y1), (x1, y1)), ((x0, y0), (x0, y1))]:
            edge = (*a, *b)
            if edge in edges:
                continue
            edges.add(edge)
            wall_id = f"wall-{len(walls) + 1}"
            walls.append(Wall(id=wall_id, start_x=a[0], start_y=a[1], end_x=b[0], end_y=b[1], thickness=.012, confidence=1))
            if a[1] == b[1] and a[1] == .1:
                openings.append(Opening(id=f"window-{len(openings) + 1}", wall_id=wall_id, position=Point(x=round((a[0] + b[0]) / 2, 6), y=a[1]), width=.075, probable_type="window", confidence=1))
        # An internal opening connects each lower room to the row above.
        if row == 1:
            top_wall = next(wall for wall in walls if wall.start_x == x0 and wall.end_x == x1 and wall.start_y == y0 and wall.end_y == y0)
            openings.append(Opening(id=f"door-{index + 1}", wall_id=top_wall.id, position=Point(x=round((x0 + x1) / 2, 6), y=y0), width=.07, probable_type="door", confidence=1))
        if col > 0:
            side_wall = next(wall for wall in walls if wall.start_x == x0 and wall.end_x == x0 and wall.start_y == y0 and wall.end_y == y1)
            openings.append(Opening(id=f"door-side-{index + 1}", wall_id=side_wall.id, position=Point(x=x0, y=round((y0 + y1) / 2, 6)), width=.07, probable_type="door", confidence=1))
    if rooms:
        entrance_wall = next(wall for wall in walls if wall.start_x == .1 and wall.end_x == .1 and wall.start_y == .1 and wall.end_y == .5)
        openings.append(Opening(id="door-entrance", wall_id=entrance_wall.id, position=Point(x=.1, y=.3), width=.08, probable_type="door", confidence=1))
    return StructuralPlan(
        id=plan_id, source_dimensions={"width": 1000, "height": 1000}, normalized_dimensions={"width": 1, "height": 1}, physical_dimensions=physical_dimensions,
        overall_confidence=1, processing_metadata=ProcessingMetadata(pipeline_version="starter-1", stages=["editable_starter"], warnings=["Editable starter layout; dimensions and openings are illustrative."], debug_images={}),
        editing_metadata={"modified_by": "manual"}, wall_height=dimensions.wall_height_m if kind == "blank" else 3, walls=walls, rooms=rooms, openings=openings,
    )
