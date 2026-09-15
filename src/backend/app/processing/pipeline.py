from pathlib import Path

import cv2
import numpy as np

from app.processing import stages
from app.schemas.plan import (
    Dimensions, NormalizedDimensions, Opening, Point,
    ProcessingMetadata, Room, StructuralPlan, Wall,
)


STAGE_NAMES = [
    "decode", "grayscale", "contrast_normalization", "threshold",
    "morphological_cleanup", "edges", "contours", "line_extraction",
    "line_normalization", "duplicate_line_removal", "collinear_wall_merging",
    "wall_candidates", "room_candidates", "opening_candidates",
    "confidence_estimation",
]


def _clip(value: float) -> float:
    return round(float(min(1.0, max(0.0, value))), 6)


def _wall_candidates(lines: list[stages.NormalizedLine]) -> list[Wall]:
    walls: list[Wall] = []
    for line in lines:
        if line.orientation == "horizontal":
            coordinates = (line.start, line.axis, line.end, line.axis)
        else:
            coordinates = (line.axis, line.start, line.axis, line.end)
        walls.append(Wall(
            id=f"wall-{len(walls) + 1}",
            start_x=_clip(coordinates[0]), start_y=_clip(coordinates[1]),
            end_x=_clip(coordinates[2]), end_y=_clip(coordinates[3]),
            thickness=_clip(line.thickness), confidence=_clip(line.confidence),
        ))
    return walls


def _polygon_area(points: list[Point]) -> float:
    return sum(
        points[index].x * points[(index + 1) % len(points)].y
        - points[(index + 1) % len(points)].x * points[index].y
        for index in range(len(points))
    ) / 2


def _polygon_centroid(points: list[Point]) -> tuple[float, float]:
    return (
        sum(point.x for point in points) / len(points),
        sum(point.y for point in points) / len(points),
    )


def _remove_enclosing_room_duplicates(rooms: list[Room]) -> list[Room]:
    """Remove a whole-plan contour when it encloses the detected room regions."""
    areas = {room.id: abs(_polygon_area(room.polygon)) for room in rooms}
    filtered: list[Room] = []
    for room in rooms:
        area = areas[room.id]
        contour = np.array([(point.x, point.y) for point in room.polygon], dtype=np.float32)
        contained = [
            candidate for candidate in rooms
            if candidate.id != room.id
            and areas[candidate.id] < area * 0.8
            and cv2.pointPolygonTest(contour, _polygon_centroid(candidate.polygon), False) >= 0
        ]
        covered_area = sum(areas[candidate.id] for candidate in contained)
        if area > 0.25 and len(contained) >= 2 and covered_area >= area * 0.6:
            continue
        filtered.append(room)
    return filtered


def _room_candidates(contours: list[np.ndarray], width: int, height: int) -> list[Room]:
    """Existing Day 1 room detection, intentionally unchanged by this repair."""
    image_area = width * height
    rooms: list[Room] = []
    for contour in contours:
        area = cv2.contourArea(contour)
        ratio = area / image_area
        if ratio < 0.015 or ratio > 0.75:
            continue
        polygon = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(polygon) < 3 or len(polygon) > 10:
            continue
        points = [
            Point(x=_clip(point[0][0] / width), y=_clip(point[0][1] / height))
            for point in polygon
        ]
        rectangularity = area / max(1.0, cv2.contourArea(cv2.convexHull(contour)))
        rooms.append(Room(
            id=f"room-{len(rooms) + 1}", polygon=points,
            name=None, type=None,
            confidence=_clip(0.35 + 0.45 * rectangularity),
        ))
    rooms = _remove_enclosing_room_duplicates(rooms)
    rooms.sort(key=lambda room: -abs(_polygon_area(room.polygon)))
    for index, room in enumerate(rooms, start=1):
        room.id = f"room-{index}"
    return rooms[:24]


def _nearest_wall(
    position: Point,
    walls: list[Wall],
    preferred_orientation: str | None,
    search_radius: float,
) -> str | None:
    best: tuple[float, str] | None = None
    for wall in walls:
        horizontal = abs(wall.end_x - wall.start_x) >= abs(wall.end_y - wall.start_y)
        orientation = "horizontal" if horizontal else "vertical"
        if preferred_orientation and orientation != preferred_orientation:
            continue
        if horizontal:
            cross_distance = abs(position.y - wall.start_y)
            along_distance = max(min(wall.start_x, wall.end_x) - position.x, position.x - max(wall.start_x, wall.end_x), 0.0)
        else:
            cross_distance = abs(position.x - wall.start_x)
            along_distance = max(min(wall.start_y, wall.end_y) - position.y, position.y - max(wall.start_y, wall.end_y), 0.0)
        distance = cross_distance * 2 + along_distance
        if cross_distance <= 0.022 and along_distance <= search_radius and (best is None or distance < best[0]):
            best = (distance, wall.id)
    return best[1] if best else None


def _component_boxes(mask: np.ndarray, dilation: int = 0) -> list[tuple[int, int, int, int, int]]:
    if dilation:
        mask = cv2.dilate(mask, np.ones((dilation, dilation), np.uint8), iterations=1)
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    return [tuple(int(value) for value in stats[index]) for index in range(1, count)]


def _window_candidates(image: np.ndarray, walls: list[Wall]) -> list[Opening]:
    """Detect wall-aligned thin markers, using color as one signal plus grayscale geometry."""
    height, width = image.shape[:2]
    blue, green, red = cv2.split(image)
    color_mask = ((blue > 150) & (green > 110) & (red < 140)).astype(np.uint8) * 255

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    midtone = cv2.inRange(gray, 105, 225)
    geometric_mask = cv2.bitwise_or(
        cv2.morphologyEx(midtone, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (24, 1))),
        cv2.morphologyEx(midtone, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 24))),
    )
    combined = cv2.bitwise_or(color_mask, geometric_mask)
    candidates: list[Opening] = []
    seen: list[tuple[float, float]] = []
    for x, y, box_width, box_height, area in _component_boxes(combined, dilation=2):
        length = max(box_width, box_height)
        thickness = min(box_width, box_height)
        if length < 28 or thickness > 15 or length / max(1, thickness) < 3.0:
            continue
        orientation = "horizontal" if box_width >= box_height else "vertical"
        position = Point(x=_clip((x + box_width / 2) / width), y=_clip((y + box_height / 2) / height))
        if any(np.hypot(position.x - old_x, position.y - old_y) < 0.02 for old_x, old_y in seen):
            continue
        wall_id = _nearest_wall(position, walls, orientation, length / max(width, height) / 2 + 0.025)
        if wall_id is None:
            continue
        color_support = cv2.countNonZero(color_mask[y:y + box_height, x:x + box_width]) > max(5, area * 0.15)
        confidence = 0.82 if color_support else 0.57
        candidates.append(Opening(
            id="pending", wall_id=wall_id, position=position,
            width=_clip(length / max(width, height)),
            probable_type="window", confidence=confidence,
        ))
        seen.append((position.x, position.y))
    return candidates


def _door_candidates(image: np.ndarray, walls: list[Wall]) -> list[Opening]:
    """Detect connected swing-arc/leaf geometry near a wall interruption."""
    height, width = image.shape[:2]
    blue, green, red = cv2.split(image)
    # Generator door ink is slate gray. Broad bounds also support grayscale
    # residential plans; shape and wall proximity provide the fallback checks.
    slate_mask = (
        (blue >= 105) & (blue <= 180)
        & (green >= 85) & (green <= 155)
        & (red >= 75) & (red <= 140)
    ).astype(np.uint8) * 255
    candidates: list[Opening] = []
    for x, y, box_width, box_height, area in _component_boxes(slate_mask, dilation=3):
        if not (24 <= box_width <= 120 and 24 <= box_height <= 120 and area >= 80):
            continue
        # A swing symbol occupies a roughly square radius box and contains both
        # a long leaf and curved edge pixels. Labels are much smaller/flatter.
        aspect = box_width / max(1, box_height)
        if not 0.45 <= aspect <= 2.2:
            continue
        crop = slate_mask[y:y + box_height, x:x + box_width]
        edges = cv2.Canny(crop, 30, 100)
        if cv2.countNonZero(edges) < 25:
            continue

        center = Point(x=_clip((x + box_width / 2) / width), y=_clip((y + box_height / 2) / height))
        radius = max(box_width, box_height) / max(width, height)
        # The hinge is one of the component corners. Select the corner closest
        # to a wall, which remains valid for horizontal and vertical examples.
        corners = [
            Point(x=_clip(x / width), y=_clip(y / height)),
            Point(x=_clip((x + box_width) / width), y=_clip(y / height)),
            Point(x=_clip(x / width), y=_clip((y + box_height) / height)),
            Point(x=_clip((x + box_width) / width), y=_clip((y + box_height) / height)),
        ]
        associations: list[tuple[Point, str]] = []
        for corner in corners:
            wall_id = _nearest_wall(corner, walls, None, radius + 0.025)
            if wall_id:
                associations.append((corner, wall_id))
        if not associations:
            continue
        position, wall_id = min(associations, key=lambda item: np.hypot(item[0].x - center.x, item[0].y - center.y))
        candidates.append(Opening(
            id="pending", wall_id=wall_id, position=position,
            width=_clip(radius), probable_type="door", confidence=0.74,
        ))
    return candidates


def _opening_candidates(image: np.ndarray, walls: list[Wall]) -> list[Opening]:
    candidates = _door_candidates(image, walls) + _window_candidates(image, walls)
    unique: list[Opening] = []
    for candidate in sorted(candidates, key=lambda item: -item.confidence):
        if any(
            (
                existing.probable_type == candidate.probable_type
                and np.hypot(existing.position.x - candidate.position.x, existing.position.y - candidate.position.y) < 0.028
            )
            or (
                candidate.probable_type == "window"
                and candidate.confidence < 0.6
                and existing.probable_type == "door"
                and np.hypot(existing.position.x - candidate.position.x, existing.position.y - candidate.position.y) < 0.07
            )
            for existing in unique
        ):
            continue
        candidate.id = f"opening-{len(unique) + 1}"
        unique.append(candidate)
    return unique[:40]


def _split_walls_at_openings(
    walls: list[Wall], openings: list[Opening], width: int, height: int,
) -> list[Wall]:
    """Turn opening annotations into meaningful gaps in final wall geometry."""
    split_walls: list[Wall] = []
    replacement_ids: dict[str, list[str]] = {}
    orientations: dict[str, str] = {}
    maximum_dimension = max(width, height)
    for wall in walls:
        horizontal = abs(wall.end_x - wall.start_x) >= abs(wall.end_y - wall.start_y)
        orientations[wall.id] = "horizontal" if horizontal else "vertical"
        wall_openings = [opening for opening in openings if opening.wall_id == wall.id]
        intervals = [(min(wall.start_x, wall.end_x), max(wall.start_x, wall.end_x))] if horizontal else [(min(wall.start_y, wall.end_y), max(wall.start_y, wall.end_y))]
        for opening in wall_openings:
            center = opening.position.x if horizontal else opening.position.y
            opening_extent = opening.width * maximum_dimension / (width if horizontal else height)
            cut_start, cut_end = center - opening_extent / 2, center + opening_extent / 2
            next_intervals: list[tuple[float, float]] = []
            for start, end in intervals:
                if cut_end <= start or cut_start >= end:
                    next_intervals.append((start, end))
                    continue
                if cut_start - start >= 0.015:
                    next_intervals.append((start, max(start, cut_start)))
                if end - cut_end >= 0.015:
                    next_intervals.append((min(end, cut_end), end))
            intervals = next_intervals

        replacement_ids[wall.id] = []
        for start, end in intervals:
            new_id = f"wall-{len(split_walls) + 1}"
            replacement_ids[wall.id].append(new_id)
            if horizontal:
                split_walls.append(Wall(id=new_id, start_x=_clip(start), start_y=wall.start_y, end_x=_clip(end), end_y=wall.end_y, thickness=wall.thickness, confidence=wall.confidence))
            else:
                split_walls.append(Wall(id=new_id, start_x=wall.start_x, start_y=_clip(start), end_x=wall.end_x, end_y=_clip(end), thickness=wall.thickness, confidence=wall.confidence))

    for opening in openings:
        replacements = replacement_ids.get(opening.wall_id or "", [])
        candidates = [wall for wall in split_walls if wall.id in replacements]
        opening.wall_id = _nearest_wall(
            opening.position, candidates, orientations.get(opening.wall_id or ""),
            opening.width * 1.5 + 0.025,
        ) if candidates else None
    return split_walls


def _confidence(walls: list[Wall], rooms: list[Room], openings: list[Opening]) -> tuple[float, list[str]]:
    warnings: list[str] = []
    if not walls:
        warnings.append("No reliable wall candidates were detected; manual correction will be required.")
    if not rooms:
        warnings.append("No reliable room candidates were detected.")
    if not openings:
        warnings.append("No reliable opening candidates were detected.")
    wall_score = min(1.0, sum(wall.confidence for wall in walls) / 10)
    room_score = min(1.0, len(rooms) / 4)
    opening_score = min(1.0, sum(opening.confidence for opening in openings) / 4)
    return _clip(0.15 + wall_score * 0.5 + room_score * 0.25 + opening_score * 0.1), warnings


def _draw_raw_lines(image: np.ndarray, lines: list[stages.LineCandidate]) -> np.ndarray:
    output = image.copy()
    for line in lines:
        cv2.line(output, (line.x1, line.y1), (line.x2, line.y2), (0, 140, 255), 2)
    return output


def _draw_normalized_lines(image: np.ndarray, lines: list[stages.NormalizedLine]) -> np.ndarray:
    height, width = image.shape[:2]
    output = image.copy()
    for line in lines:
        if line.orientation == "horizontal":
            start, end = (int(line.start * width), int(line.axis * height)), (int(line.end * width), int(line.axis * height))
        else:
            start, end = (int(line.axis * width), int(line.start * height)), (int(line.axis * width), int(line.end * height))
        cv2.line(output, start, end, (150, 80, 255), 3)
    return output


def _draw_structure(image: np.ndarray, walls: list[Wall], rooms: list[Room], openings: list[Opening]) -> np.ndarray:
    height, width = image.shape[:2]
    output = np.full_like(image, 248)
    for room in rooms:
        polygon = np.array([[(int(point.x * width), int(point.y * height)) for point in room.polygon]], np.int32)
        cv2.polylines(output, polygon, True, (170, 150, 70), 2, cv2.LINE_AA)
    for wall in walls:
        cv2.line(output, (int(wall.start_x * width), int(wall.start_y * height)), (int(wall.end_x * width), int(wall.end_y * height)), (35, 70, 55), max(2, int(wall.thickness * min(width, height))))
    for opening in openings:
        color = (0, 140, 255) if opening.probable_type == "door" else (255, 160, 30)
        cv2.circle(output, (int(opening.position.x * width), int(opening.position.y * height)), 8, color, -1)
        cv2.putText(output, opening.probable_type[0].upper(), (int(opening.position.x * width) + 10, int(opening.position.y * height) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)
    return output


def process_floor_plan(image: np.ndarray, plan_id: str, debug_dir: Path, enhanced: bool = False) -> StructuralPlan:
    decoded = stages.decode(image)
    gray = stages.grayscale(decoded)
    normalized = stages.normalize_contrast(gray)
    if enhanced:
        # A bounded alternate path for difficult scans: a larger local window and
        # two close passes bridge weak wall ink without mutating the source image.
        binary = cv2.adaptiveThreshold(normalized, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 7)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
    else:
        binary = stages.threshold_image(normalized)
        cleaned = stages.morphological_cleanup(binary)
    edges = stages.edge_map(cleaned)
    contours = stages.extract_contours(cleaned)
    raw_lines = stages.extract_lines(edges)
    line_source = cv2.cvtColor(cv2.bitwise_not(cleaned), cv2.COLOR_GRAY2BGR) if enhanced else decoded
    normalized_lines = stages.normalize_wall_lines(line_source)
    deduplicated_lines = stages.remove_duplicate_segments(normalized_lines)
    merged_lines = stages.merge_collinear_segments(deduplicated_lines)
    height, width = gray.shape
    base_walls = _wall_candidates(merged_lines)
    rooms = _room_candidates(contours, width, height)
    openings = _opening_candidates(decoded, base_walls)
    walls = _split_walls_at_openings(base_walls, openings, width, height)
    overall_confidence, warnings = _confidence(base_walls, rooms, openings)

    debug_dir.mkdir(parents=True, exist_ok=True)
    debug_outputs = {
        "threshold": binary,
        "raw_lines": _draw_raw_lines(decoded, raw_lines),
        "normalized_lines": _draw_normalized_lines(decoded, normalized_lines),
        "merged_walls": _draw_normalized_lines(decoded, merged_lines),
        "opening_candidates": _draw_structure(decoded, [], [], openings),
        "final_structure": _draw_structure(decoded, walls, rooms, openings),
        "cleaned": cleaned,
        "edges": edges,
    }
    debug_images: dict[str, str] = {}
    for name, debug_image in debug_outputs.items():
        path = debug_dir / f"{name}.png"
        if cv2.imwrite(str(path), debug_image):
            debug_images[name] = str(path.relative_to(debug_dir.parent.parent)).replace("\\", "/")

    return StructuralPlan(
        id=plan_id,
        source_dimensions=Dimensions(width=width, height=height),
        normalized_dimensions=NormalizedDimensions(),
        overall_confidence=overall_confidence,
        processing_metadata=ProcessingMetadata(
            pipeline_version="day-4-enhanced" if enhanced else "day-1.1-repair", stages=STAGE_NAMES,
            warnings=warnings, debug_images=debug_images,
        ),
        walls=walls, rooms=rooms, openings=openings,
    )
