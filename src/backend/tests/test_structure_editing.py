import io
from copy import deepcopy

import pytest
from PIL import Image, ImageDraw


def plan_bytes() -> bytes:
    image = Image.new("RGB", (400, 300), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, 380, 280), outline="#111827", width=12)
    draw.line((200, 20, 200, 280), fill="#111827", width=12)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


@pytest.fixture
def saved_plan(client):
    response = client.post("/api/plans/upload", files={"file": ("editable.png", plan_bytes(), "image/png")})
    assert response.status_code == 201
    payload = response.json()
    return payload["plan"]["id"], payload["structure"]


def save(client, plan_id, structure):
    return client.put(f"/api/plans/{plan_id}/structure", json=structure)


def new_wall(identifier="manual-wall"):
    return {"id": identifier, "start_x": 0.1, "start_y": 0.2, "end_x": 0.8, "end_y": 0.2, "thickness": 0.02, "confidence": 1.0}


def new_opening(identifier="manual-opening", wall_id=None):
    return {"id": identifier, "wall_id": wall_id, "position": {"x": 0.5, "y": 0.2}, "width": 0.08, "probable_type": "unknown", "confidence": 1.0}


def test_save_and_reload_corrected_structure(client, saved_plan):
    plan_id, structure = saved_plan
    structure["wall_height"] = 3.6
    response = save(client, plan_id, structure)
    assert response.status_code == 200
    assert response.json()["editing_metadata"]["modified_by"] == "manual"
    assert client.get(f"/api/plans/{plan_id}/structure").json()["wall_height"] == 3.6


def test_create_wall(client, saved_plan):
    plan_id, structure = saved_plan
    structure["walls"].append(new_wall())
    response = save(client, plan_id, structure)
    assert response.status_code == 200
    assert any(wall["id"] == "manual-wall" for wall in response.json()["walls"])


def test_modify_wall(client, saved_plan):
    plan_id, structure = saved_plan
    structure["walls"][0]["end_x"] = 0.77
    response = save(client, plan_id, structure)
    assert response.status_code == 200
    assert response.json()["walls"][0]["end_x"] == 0.77


def test_delete_wall_and_clear_association(client, saved_plan):
    plan_id, structure = saved_plan
    deleted_id = structure["walls"][0]["id"]
    structure["walls"] = [wall for wall in structure["walls"] if wall["id"] != deleted_id]
    for opening in structure["openings"]:
        if opening["wall_id"] == deleted_id:
            opening["wall_id"] = None
    response = save(client, plan_id, structure)
    assert response.status_code == 200
    assert all(wall["id"] != deleted_id for wall in response.json()["walls"])


def test_assign_room_type(client, saved_plan):
    plan_id, structure = saved_plan
    structure["rooms"][0]["type"] = "living_room"
    assert save(client, plan_id, structure).json()["rooms"][0]["type"] == "living_room"


def test_rename_room(client, saved_plan):
    plan_id, structure = saved_plan
    structure["rooms"][0]["name"] = "Main living area"
    assert save(client, plan_id, structure).json()["rooms"][0]["name"] == "Main living area"


def test_classify_opening(client, saved_plan):
    plan_id, structure = saved_plan
    structure["openings"].append(new_opening(wall_id=structure["walls"][0]["id"]))
    structure["openings"][-1]["probable_type"] = "door"
    response = save(client, plan_id, structure)
    assert response.status_code == 200
    assert response.json()["openings"][-1]["probable_type"] == "door"


def test_create_opening(client, saved_plan):
    plan_id, structure = saved_plan
    structure["openings"].append(new_opening())
    response = save(client, plan_id, structure)
    assert response.status_code == 200
    assert any(opening["id"] == "manual-opening" for opening in response.json()["openings"])


def test_delete_opening(client, saved_plan):
    plan_id, structure = saved_plan
    structure["openings"].append(new_opening())
    first = save(client, plan_id, structure).json()
    first["openings"] = [opening for opening in first["openings"] if opening["id"] != "manual-opening"]
    second = save(client, plan_id, first)
    assert all(opening["id"] != "manual-opening" for opening in second.json()["openings"])


def test_invalid_coordinate_rejected(client, saved_plan):
    plan_id, structure = saved_plan
    structure["walls"][0]["start_x"] = 1.2
    assert save(client, plan_id, structure).status_code == 422


def test_invalid_zero_length_wall_rejected(client, saved_plan):
    plan_id, structure = saved_plan
    structure["walls"].append(new_wall())
    structure["walls"][-1]["end_x"] = structure["walls"][-1]["start_x"]
    structure["walls"][-1]["end_y"] = structure["walls"][-1]["start_y"]
    assert save(client, plan_id, structure).status_code == 422


def test_invalid_opening_width_rejected(client, saved_plan):
    plan_id, structure = saved_plan
    structure["openings"].append(new_opening())
    structure["openings"][-1]["width"] = 0.75
    assert save(client, plan_id, structure).status_code == 422


def test_unknown_wall_association_rejected(client, saved_plan):
    plan_id, structure = saved_plan
    structure["openings"].append(new_opening(wall_id="missing-wall"))
    assert save(client, plan_id, structure).status_code == 422


def test_persistence_round_trip_preserves_edits(client, saved_plan):
    plan_id, structure = saved_plan
    edited = deepcopy(structure)
    edited["walls"].append(new_wall())
    edited["openings"].append(new_opening(wall_id="manual-wall"))
    edited["rooms"][0].update({"name": "Kitchen", "type": "kitchen"})
    edited["wall_height"] = 4.1
    stored = save(client, plan_id, edited)
    assert stored.status_code == 200
    reloaded = client.get(f"/api/plans/{plan_id}/structure")
    assert reloaded.status_code == 200
    assert reloaded.json() == stored.json()
