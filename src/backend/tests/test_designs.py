import io
from copy import deepcopy
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from app.schemas.design import DesignConfiguration, RoomSemantic, VastuRule
from app.schemas.plan import Dimensions, NormalizedDimensions, Point, ProcessingMetadata, Room, StructuralPlan, Wall
from app.services.vastu import analyze_design, directional_zone, north_aligned_point


def plan_bytes() -> bytes:
    image = Image.new("RGB", (420, 320), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, 400, 300), outline="#111827", width=12)
    draw.line((210, 20, 210, 300), fill="#111827", width=12)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


@pytest.fixture
def plan_id(client):
    response = client.post("/api/plans/upload", files={"file": ("design-plan.png", plan_bytes(), "image/png")})
    assert response.status_code == 201
    return response.json()["plan"]["id"]


@pytest.fixture
def design(client, plan_id):
    response = client.post(f"/api/plans/{plan_id}/designs", json={})
    assert response.status_code == 201
    return response.json()


def test_create_design_uses_useful_default_name(client, plan_id):
    created = client.post(f"/api/plans/{plan_id}/designs", json={})
    assert created.status_code == 201
    assert created.json()["name"] == "Design 1"


def test_design_save_load_and_round_trip(client, design):
    payload = deepcopy(design)
    configuration = payload["configuration"]
    configuration["wall_height"] = 3.8
    wall_id = next(iter(configuration["wall_appearances"]))
    room_id = next(iter(configuration["floor_appearances"]))
    configuration["wall_appearances"][wall_id] = {"color": "#aabbcc", "finish": "brick_style"}
    configuration["floor_appearances"][room_id] = {"color": "#ddd0bc", "finish": "wood"}
    configuration["room_semantics"][room_id] = {"name": "Parents Bedroom", "room_type": "master_bedroom"}
    configuration["orientation"] = 90
    updated = client.put(f"/api/designs/{design['id']}", json={"name": "Warm House", "configuration": configuration})
    assert updated.status_code == 200
    loaded = client.get(f"/api/designs/{design['id']}")
    assert loaded.json() == updated.json()
    assert loaded.json()["configuration"]["wall_appearances"][wall_id]["finish"] == "brick_style"
    assert loaded.json()["configuration"]["floor_appearances"][room_id]["finish"] == "wood"
    assert loaded.json()["configuration"]["wall_height"] == 3.8
    assert loaded.json()["configuration"]["room_semantics"][room_id]["name"] == "Parents Bedroom"
    assert loaded.json()["configuration"]["orientation"] == 90


def test_door_and_window_style_persistence(client, design):
    configuration = design["configuration"]
    structure = client.get(f"/api/plans/{design['plan_id']}/structure").json()
    opening_id = structure["openings"][0]["id"] if structure["openings"] else None
    if opening_id is None:
        opening_id = "manual-design-opening"
        structure["openings"].append({"id": opening_id, "wall_id": structure["walls"][0]["id"], "position": {"x": .5, "y": .5}, "width": .1, "probable_type": "unknown", "confidence": 1})
        assert client.put(f"/api/plans/{design['plan_id']}/structure", json=structure).status_code == 200
    configuration["door_configurations"][opening_id] = {"color": "#553311", "width": 0.12, "style": "double"}
    configuration["window_configurations"][opening_id] = {"color": "#66aadd", "width": 0.15, "height": 2.4, "style": "floor_to_ceiling"}
    saved = client.put(f"/api/designs/{design['id']}", json={"configuration": configuration})
    assert saved.status_code == 200
    reloaded = client.get(f"/api/designs/{design['id']}").json()["configuration"]
    assert reloaded["door_configurations"][opening_id]["style"] == "double"
    assert reloaded["window_configurations"][opening_id]["style"] == "floor_to_ceiling"


def test_duplicate_design_preserves_configuration(client, design):
    duplicated = client.post(f"/api/designs/{design['id']}/duplicate", json={"name": "Design B"})
    assert duplicated.status_code == 201
    assert duplicated.json()["id"] != design["id"]
    assert duplicated.json()["name"] == "Design B"
    assert duplicated.json()["configuration"] == design["configuration"]


def test_duplicate_room_semantics_and_materials_remain_independent(client, design):
    source_configuration = deepcopy(design["configuration"])
    room_id = next(iter(source_configuration["room_semantics"]))
    wall_id = next(iter(source_configuration["wall_appearances"]))
    source_configuration["room_semantics"][room_id] = {"name": "Living Room", "room_type": "living_room"}
    source_configuration["wall_appearances"][wall_id] = {"color": "#a56d48", "finish": "wood_panel"}
    source = client.put(f"/api/designs/{design['id']}", json={"configuration": source_configuration}).json()
    duplicated = client.post(f"/api/designs/{design['id']}/duplicate", json={"name": "Design B"}).json()
    assert duplicated["configuration"] == source["configuration"]

    duplicate_configuration = duplicated["configuration"]
    duplicate_configuration["room_semantics"][room_id] = {"name": "Prayer Room", "room_type": "pooja_room"}
    duplicate_configuration["wall_appearances"][wall_id] = {"color": "#b57862", "finish": "brick_style"}
    client.put(f"/api/designs/{duplicated['id']}", json={"configuration": duplicate_configuration})

    reloaded_source = client.get(f"/api/designs/{design['id']}").json()["configuration"]
    reloaded_duplicate = client.get(f"/api/designs/{duplicated['id']}").json()["configuration"]
    assert reloaded_source["room_semantics"][room_id] == {"name": "Living Room", "room_type": "living_room"}
    assert reloaded_source["wall_appearances"][wall_id]["finish"] == "wood_panel"
    assert reloaded_duplicate["room_semantics"][room_id] == {"name": "Prayer Room", "room_type": "pooja_room"}
    assert reloaded_duplicate["wall_appearances"][wall_id]["finish"] == "brick_style"


def test_rename_design(client, design):
    response = client.put(f"/api/designs/{design['id']}", json={"name": "Courtyard Option"})
    assert response.status_code == 200
    assert response.json()["name"] == "Courtyard Option"


def test_list_designs(client, plan_id, design):
    client.post(f"/api/designs/{design['id']}/duplicate", json={})
    listed = client.get(f"/api/plans/{plan_id}/designs")
    assert listed.status_code == 200
    assert [item["name"] for item in listed.json()] == ["Design 1", "Design 2"]


def test_delete_design(client, design):
    response = client.delete(f"/api/designs/{design['id']}")
    assert response.status_code == 204
    assert client.get(f"/api/designs/{design['id']}").status_code == 404


def test_design_rejects_unknown_structural_reference(client, design):
    configuration = design["configuration"]
    configuration["wall_appearances"]["missing-wall"] = {"color": "#ffffff", "finish": "paint"}
    response = client.put(f"/api/designs/{design['id']}", json={"configuration": configuration})
    assert response.status_code == 409


BOUNDS = (0.0, 1.0, 0.0, 1.0)


@pytest.mark.parametrize(("point", "zone"), [
    (Point(x=.5, y=.1), "north"), (Point(x=.9, y=.5), "east"),
    (Point(x=.5, y=.9), "south"), (Point(x=.1, y=.5), "west"),
    (Point(x=.1, y=.1), "north_west"), (Point(x=.9, y=.1), "north_east"),
    (Point(x=.1, y=.9), "south_west"), (Point(x=.9, y=.9), "south_east"),
    (Point(x=.5, y=.5), "center"),
])
def test_directional_zones(point, zone):
    assert directional_zone(point, BOUNDS, 0) == zone


def test_orientation_transformation():
    assert north_aligned_point(1, .5, 90) == (.5, 0)
    assert north_aligned_point(.5, 1, 180) == (.5, 0)
    assert north_aligned_point(0, .5, 270) == (.5, 0)


def analysis_structure() -> StructuralPlan:
    return StructuralPlan(
        id="plan-analysis", source_dimensions=Dimensions(width=1000, height=1000), normalized_dimensions=NormalizedDimensions(), overall_confidence=.8,
        processing_metadata=ProcessingMetadata(pipeline_version="test", stages=[]),
        walls=[Wall(id="north", start_x=0, start_y=0, end_x=1, end_y=0, thickness=.01, confidence=1), Wall(id="south", start_x=0, start_y=1, end_x=1, end_y=1, thickness=.01, confidence=1)],
        rooms=[
            Room(id="room-ne", polygon=[Point(x=.7, y=.05), Point(x=.95, y=.05), Point(x=.95, y=.3), Point(x=.7, y=.3)], name="Kitchen", type=None, confidence=1),
            Room(id="room-sw", polygon=[Point(x=.05, y=.7), Point(x=.3, y=.7), Point(x=.3, y=.95), Point(x=.05, y=.95)], name="Bedroom", type=None, confidence=1),
        ],
    )


KITCHEN_RULE = VastuRule(id="test-kitchen", title="Kitchen test", room_type="kitchen", preferred_zones=["north_east"], description="test", severity="info", source_reference="test")
POOJA_RULE = VastuRule(id="test-pooja", title="Pooja test", room_type="pooja_room", preferred_zones=["north_east"], description="test", severity="info", source_reference="test")


def test_satisfied_rule_and_score():
    config = DesignConfiguration(orientation=0, room_semantics={"room-ne": RoomSemantic(name="Kitchen", room_type="kitchen")})
    analysis = analyze_design("design", config, analysis_structure(), (KITCHEN_RULE,))
    assert analysis.rule_results[0].result == "satisfied"
    assert analysis.score == 100


def test_vastu_uses_current_room_type_after_semantic_change():
    initial = DesignConfiguration(orientation=0, room_semantics={"room-ne": RoomSemantic(name="Bedroom", room_type="bedroom")})
    changed = DesignConfiguration(orientation=0, room_semantics={"room-ne": RoomSemantic(name="Pooja Room", room_type="pooja_room")})
    before = analyze_design("design", initial, analysis_structure(), (POOJA_RULE,))
    after = analyze_design("design", changed, analysis_structure(), (POOJA_RULE,))
    assert before.rule_results[0].result == "not_applicable"
    assert after.rule_results[0].result == "satisfied"
    assert after.rule_results[0].room_name == "Pooja Room"


def test_unsatisfied_rule_and_score():
    config = DesignConfiguration(orientation=180, room_semantics={"room-ne": RoomSemantic(room_type="kitchen")})
    analysis = analyze_design("design", config, analysis_structure(), (KITCHEN_RULE,))
    assert analysis.rule_results[0].result == "unsatisfied"
    assert analysis.score == 0


def test_not_applicable_rule():
    analysis = analyze_design("design", DesignConfiguration(orientation=0), analysis_structure(), (KITCHEN_RULE,))
    assert analysis.rule_results[0].result == "not_applicable"


def test_cannot_evaluate_without_orientation():
    config = DesignConfiguration(room_semantics={"room-ne": RoomSemantic(room_type="kitchen")})
    analysis = analyze_design("design", config, analysis_structure(), (KITCHEN_RULE,))
    assert analysis.rule_results[0].result == "cannot_evaluate"
    assert analysis.score is None
    assert analysis.score_label == "Insufficient information"


def test_zero_evaluable_rules_has_no_misleading_score():
    analysis = analyze_design("design", DesignConfiguration(orientation=0), analysis_structure(), ())
    assert analysis.score is None
    assert analysis.counts.satisfied == 0


def test_disabled_rule_is_excluded_from_score():
    disabled = KITCHEN_RULE.model_copy(update={"enabled": False})
    config = DesignConfiguration(orientation=0, room_semantics={"room-ne": RoomSemantic(room_type="kitchen")})
    analysis = analyze_design("design", config, analysis_structure(), (disabled,))
    assert analysis.rule_results[0].result == "not_applicable"
    assert analysis.score is None


def test_analysis_serialization_and_api_persistence(client, design):
    configuration = design["configuration"]
    configuration["orientation"] = 0
    client.put(f"/api/designs/{design['id']}", json={"configuration": configuration})
    response = client.post(f"/api/designs/{design['id']}/vastu-analysis")
    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis_version"] == "day-3.0"
    assert isinstance(payload["rule_results"], list)
    assert client.get(f"/api/designs/{design['id']}").json()["latest_analysis"] == payload


def test_room_semantic_change_invalidates_persisted_analysis(client, design):
    configuration = design["configuration"]
    room_id = next(iter(configuration["room_semantics"]))
    configuration["orientation"] = 0
    configuration["room_semantics"][room_id] = {"name": "Kitchen", "room_type": "kitchen"}
    assert client.put(f"/api/designs/{design['id']}", json={"configuration": configuration}).status_code == 200
    assert client.post(f"/api/designs/{design['id']}/vastu-analysis").status_code == 200
    configuration["room_semantics"][room_id] = {"name": "Study", "room_type": "study"}
    changed = client.put(f"/api/designs/{design['id']}", json={"configuration": configuration})
    assert changed.status_code == 200
    assert changed.json()["latest_analysis"] is None
    assert client.get(f"/api/designs/{design['id']}").json()["configuration"]["room_semantics"][room_id] == {"name": "Study", "room_type": "study"}


def test_family_house_day3_persistence_and_orientation_flow(client):
    sample = Path(__file__).resolve().parents[3] / "data" / "sample_family_house.png"
    with sample.open("rb") as image:
        uploaded = client.post("/api/plans/upload", files={"file": (sample.name, image, "image/png")})
    assert uploaded.status_code == 201
    plan_id = uploaded.json()["plan"]["id"]
    design_a = client.post(f"/api/plans/{plan_id}/designs", json={"name": "Design A"}).json()
    config_a = design_a["configuration"]
    wall_ids = list(config_a["wall_appearances"]); room_ids = list(config_a["room_semantics"])
    assert config_a["door_configurations"] and config_a["window_configurations"] and len(room_ids) >= 6
    config_a["wall_appearances"][wall_ids[0]] = {"color": "#c98f65", "finish": "wood_panel"}
    config_a["floor_appearances"][room_ids[0]] = {"color": "#d8c4a4", "finish": "tile"}
    first_door = next(iter(config_a["door_configurations"])); first_window = next(iter(config_a["window_configurations"]))
    config_a["door_configurations"][first_door].update({"style": "double", "color": "#704122"})
    config_a["window_configurations"][first_window].update({"style": "wide", "height": 1.6})
    config_a["wall_height"] = 3.6
    for room_id, room_type in zip(room_ids, ["living_room", "kitchen", "master_bedroom", "entrance", "pooja_room", "study"]):
        config_a["room_semantics"][room_id] = {"name": room_type.replace("_", " ").title(), "room_type": room_type}
    config_a["orientation"] = 0
    saved_a = client.put(f"/api/designs/{design_a['id']}", json={"name": "Design A", "configuration": config_a})
    assert saved_a.status_code == 200
    design_b = client.post(f"/api/designs/{design_a['id']}/duplicate", json={"name": "Design B"}).json()
    config_b = design_b["configuration"]
    config_b["wall_appearances"][wall_ids[0]] = {"color": "#8f9697", "finish": "concrete_style"}
    assert client.put(f"/api/designs/{design_b['id']}", json={"name": "Design B", "configuration": config_b}).status_code == 200
    assert client.get(f"/api/designs/{design_a['id']}").json()["configuration"] == config_a
    analysis_north = client.post(f"/api/designs/{design_a['id']}/vastu-analysis").json()
    config_a["orientation"] = 90
    client.put(f"/api/designs/{design_a['id']}", json={"configuration": config_a})
    analysis_east = client.post(f"/api/designs/{design_a['id']}/vastu-analysis").json()
    north_zones = [item["detected_zone"] for item in analysis_north["rule_results"] if item["detected_zone"]]
    east_zones = [item["detected_zone"] for item in analysis_east["rule_results"] if item["detected_zone"]]
    assert north_zones != east_zones
    assert client.get(f"/api/designs/{design_a['id']}").json()["configuration"]["orientation"] == 90
