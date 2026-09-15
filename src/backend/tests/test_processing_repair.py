from pathlib import Path

import cv2

from app.processing.pipeline import process_floor_plan
from app.processing.stages import NormalizedLine, merge_collinear_segments, remove_duplicate_segments
from app.schemas.plan import Opening, StructuralPlan


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def line(orientation: str, axis: float, start: float, end: float, confidence: float = 0.8) -> NormalizedLine:
    return NormalizedLine(orientation, axis, start, end, 0.02, confidence)


def process_sample(name: str, tmp_path: Path) -> StructuralPlan:
    image = cv2.imread(str(REPOSITORY_ROOT / "data" / name))
    assert image is not None
    return process_floor_plan(image, name, tmp_path / name)


def test_collinear_horizontal_wall_merging():
    merged = merge_collinear_segments([
        line("horizontal", 0.25, 0.10, 0.40),
        line("horizontal", 0.255, 0.405, 0.80),
    ])
    assert len(merged) == 1
    assert merged[0].start == 0.10
    assert merged[0].end == 0.80


def test_collinear_vertical_wall_merging():
    merged = merge_collinear_segments([
        line("vertical", 0.60, 0.05, 0.45),
        line("vertical", 0.605, 0.455, 0.90),
    ])
    assert len(merged) == 1
    assert merged[0].orientation == "vertical"


def test_duplicate_wall_removal():
    unique = remove_duplicate_segments([
        line("horizontal", 0.20, 0.10, 0.90, 0.7),
        line("horizontal", 0.205, 0.105, 0.895, 0.9),
    ])
    assert len(unique) == 1
    assert unique[0].confidence == 0.9


def test_meaningful_wall_gap_is_preserved():
    merged = merge_collinear_segments([
        line("horizontal", 0.50, 0.10, 0.40),
        line("horizontal", 0.50, 0.46, 0.90),
    ])
    assert len(merged) == 2
    assert merged[1].start - merged[0].end == 0.06


def test_synthetic_door_candidate_detection(tmp_path):
    structure = process_sample("sample_family_house.png", tmp_path)
    doors = [opening for opening in structure.openings if opening.probable_type == "door"]
    assert doors
    assert all(opening.wall_id for opening in doors)


def test_synthetic_window_candidate_detection(tmp_path):
    structure = process_sample("sample_family_house.png", tmp_path)
    windows = [opening for opening in structure.openings if opening.probable_type == "window"]
    assert windows
    assert all(opening.wall_id for opening in windows)


def test_opening_coordinates_remain_normalized(tmp_path):
    structure = process_sample("sample_compact_2bed.png", tmp_path)
    assert structure.openings
    assert all(0.0 <= opening.position.x <= 1.0 and 0.0 <= opening.position.y <= 1.0 and 0.0 < opening.width <= 1.0 for opening in structure.openings)


def test_opening_confidence_remains_valid(tmp_path):
    structure = process_sample("sample_simple_1bed.png", tmp_path)
    assert structure.openings
    assert all(0.0 <= opening.confidence <= 1.0 for opening in structure.openings)


def test_opening_serialization_round_trip(tmp_path):
    structure = process_sample("sample_simple_1bed.png", tmp_path)
    serialized = structure.model_dump(mode="json")
    restored = StructuralPlan.model_validate(serialized)
    assert restored.openings == structure.openings
    assert all(isinstance(opening, Opening) for opening in restored.openings)


def test_simple_plan_room_count_comes_from_non_overlapping_geometry(tmp_path):
    structure = process_sample("sample_simple_1bed.png", tmp_path)
    assert len(structure.rooms) == 3
    for room in structure.rooms:
        area = abs(sum(
            room.polygon[index].x * room.polygon[(index + 1) % len(room.polygon)].y
            - room.polygon[(index + 1) % len(room.polygon)].x * room.polygon[index].y
            for index in range(len(room.polygon))
        ) / 2)
        assert area >= 0.015


def test_family_house_produces_valid_consolidated_structure(tmp_path):
    structure = process_sample("sample_family_house.png", tmp_path)
    validated = StructuralPlan.model_validate(structure.model_dump())
    assert validated.rooms
    assert validated.walls
    assert any(opening.probable_type == "door" for opening in validated.openings)
    assert any(opening.probable_type == "window" for opening in validated.openings)
    assert len(validated.walls) < 76
