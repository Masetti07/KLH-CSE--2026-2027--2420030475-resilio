from pathlib import Path

import cv2

from app.processing.pipeline import STAGE_NAMES, process_floor_plan
from app.schemas.plan import StructuralPlan


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def test_structural_schema_and_normalized_coordinates(tmp_path):
    image = cv2.imread(str(REPOSITORY_ROOT / "data" / "sample_simple_1bed.png"))
    structure = process_floor_plan(image, "test-plan", tmp_path / "debug")
    validated = StructuralPlan.model_validate(structure.model_dump())
    assert validated.normalized_dimensions.width == 1.0
    assert validated.normalized_dimensions.height == 1.0
    for wall in validated.walls:
        assert all(0.0 <= coordinate <= 1.0 for coordinate in (wall.start_x, wall.start_y, wall.end_x, wall.end_y))


def test_sample_plan_processing_has_every_stage(tmp_path):
    image = cv2.imread(str(REPOSITORY_ROOT / "data" / "sample_compact_2bed.png"))
    structure = process_floor_plan(image, "sample", tmp_path / "debug")
    assert structure.processing_metadata.stages == STAGE_NAMES
    assert 0.0 <= structure.overall_confidence <= 1.0


def test_family_plan_produces_wall_output(tmp_path):
    image = cv2.imread(str(REPOSITORY_ROOT / "data" / "sample_family_house.png"))
    structure = process_floor_plan(image, "family", tmp_path / "debug")
    assert len(structure.walls) >= 4
    assert all(wall.confidence > 0 for wall in structure.walls)
