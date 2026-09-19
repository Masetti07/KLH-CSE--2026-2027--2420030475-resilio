import pytest

from app.api.plans import sample_dir
from app.services.starter_plans import STARTER_NAMES, make_starter_plan


@pytest.mark.parametrize("kind,bedrooms", [("blank", 0), ("one_bedroom", 1), ("two_bedroom", 2), ("three_bedroom", 3)])
def test_starter_factory_and_persistence(client, kind, bedrooms):
    first = make_starter_plan(kind, "fixed-id")
    assert first == make_starter_plan(kind, "fixed-id")
    assert sum(room.type in ("bedroom", "master_bedroom") for room in first.rooms) == bedrooms
    assert first.processing_metadata.pipeline_version == "starter-1"
    assert all(opening.wall_id in {wall.id for wall in first.walls} for opening in first.openings)
    response = client.post(f"/api/plans/starters/{kind}")
    assert response.status_code == 201
    payload = response.json()
    plan_id = payload["plan"]["id"]
    assert payload["plan"]["original_name"] == STARTER_NAMES[kind]
    assert client.get(f"/api/plans/{plan_id}/structure").json()["rooms"] == payload["structure"]["rooms"]
    design = client.post(f"/api/plans/{plan_id}/designs", json={})
    assert design.status_code == 201
    semantics = design.json()["configuration"]["room_semantics"]
    assert len(semantics) == len(first.rooms)
    assert all(value["name"] and value["room_type"] for value in semantics.values())


def test_starter_validation_and_sample_allowlist(client):
    assert client.post("/api/plans/starters/invalid").status_code == 422
    sample = client.get("/api/plans/samples/sample_simple_1bed.png")
    assert sample.status_code == 200
    reconstructed = client.post("/api/plans/upload", files={"file": ("sample_simple_1bed.png", sample.content, "image/png")})
    assert reconstructed.status_code == 201
    assert reconstructed.json()["structure"]["processing_metadata"]["pipeline_version"] != "starter-1"
    assert client.get("/api/plans/samples/unknown.png").status_code == 404


def test_sample_directory_uses_configured_mount_or_discovers_local_data(tmp_path, monkeypatch, client):
    local_data = tmp_path / "data"
    local_data.mkdir()
    monkeypatch.delenv("RESILIOSPACE_SAMPLE_DIR", raising=False)
    assert sample_dir(tmp_path / "app" / "api" / "plans.py") == local_data

    monkeypatch.setenv("RESILIOSPACE_SAMPLE_DIR", str(local_data))
    assert sample_dir(tmp_path / "app" / "api" / "plans.py") == local_data
    assert client.get("/api/plans/samples/sample_simple_1bed.png").status_code == 503
