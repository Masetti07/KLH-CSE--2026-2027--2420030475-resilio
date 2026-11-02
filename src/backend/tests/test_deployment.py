from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from starlette.middleware.cors import CORSMiddleware

from app.api import access
from app.config import Settings
from app.main import app


def test_configured_cors_and_development_origins(monkeypatch):
    monkeypatch.setenv("RESILIOSPACE_CORS_ORIGINS", " https://demo.pages.dev/,https://other.example ")
    configured = Settings()
    with TestClient(CORSMiddleware(app, allow_origins=configured.cors_origins,
                                   allow_methods=["PUT"], allow_headers=["Content-Type"])) as client:
        for origin in ["https://demo.pages.dev", "https://other.example", "http://localhost:5173", "http://127.0.0.1:5173"]:
            response = client.options("/api/plans/example/structure", headers={
                "Origin": origin, "Access-Control-Request-Method": "PUT",
                "Access-Control-Request-Headers": "Content-Type",
            })
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin
            assert "access-control-allow-credentials" not in response.headers
        response = client.get("/health", headers={"Origin": "https://untrusted.example"})
        assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("origin", ["*", "https://*.pages.dev", "https://example.com/path", "https://user:secret@example.com", "file:///tmp"])
def test_invalid_cors_configuration_fails(monkeypatch, origin):
    monkeypatch.setenv("RESILIOSPACE_CORS_ORIGINS", origin)
    with pytest.raises(ValueError, match="explicit HTTP"):
        Settings()


@pytest.mark.parametrize("path", ["/api/simulator/scenarios/low_fps/activate",
                                 "/api/simulator/scenarios/low_fps/clear",
                                 "/api/simulator/restore", "/api/system/telemetry"])
def test_public_demo_blocks_global_controls_without_state_changes(client, monkeypatch, path):
    monkeypatch.setattr(access, "settings", Settings(public_demo=True))
    before = client.get("/api/simulator/status").json()
    response = client.post(path, json={"renderer_health": "FAILED", "session_corrupted": True})
    assert response.status_code == 403
    assert "public-demo" in response.json()["detail"]
    assert client.get("/api/simulator/status").json() == before
    assert client.get("/api/system/health").status_code == 200


def test_public_demo_preserves_essential_design_flow(client, monkeypatch):
    monkeypatch.setattr(access, "settings", Settings(public_demo=True))
    response = client.post("/api/plans/starters/one_bedroom")
    assert response.status_code == 201
    plan_id = response.json()["plan"]["id"]
    design = client.post(f"/api/plans/{plan_id}/designs", json={"name": "Demo"})
    assert design.status_code == 201
    assert client.get(f"/api/designs/{design.json()['id']}").json()["name"] == "Demo"


def test_public_demo_flag_requires_valid_value(monkeypatch):
    monkeypatch.setenv("RESILIOSPACE_PUBLIC_DEMO", "true")
    assert Settings().public_demo is True
    monkeypatch.setenv("RESILIOSPACE_PUBLIC_DEMO", "false")
    assert Settings().public_demo is False
    monkeypatch.delenv("RESILIOSPACE_PUBLIC_DEMO")
    assert Settings().public_demo is False
    monkeypatch.setenv("RESILIOSPACE_PUBLIC_DEMO", "typo")
    with pytest.raises(ValueError, match="PUBLIC_DEMO"):
        Settings()


@pytest.mark.parametrize("name", ["sample_simple_1bed.png", "sample_compact_2bed.png", "sample_family_house.png"])
def test_repository_samples_with_render_configuration(client, monkeypatch, name):
    repository = Path(__file__).resolve().parents[3]
    monkeypatch.chdir(repository)
    monkeypatch.setenv("RESILIOSPACE_SAMPLE_DIR", "data")
    response = client.get(f"/api/plans/samples/{name}")
    assert response.status_code == 200
    assert response.content == (repository / "data" / name).read_bytes()
    assert response.headers["content-type"] == "image/png"


def test_missing_sample_directory_returns_controlled_error(client, monkeypatch, tmp_path):
    monkeypatch.setenv("RESILIOSPACE_SAMPLE_DIR", str(tmp_path / "missing"))
    assert client.get("/api/plans/samples/sample_simple_1bed.png").status_code == 503


def test_runtime_override_supports_files_and_sqlite(monkeypatch, tmp_path):
    runtime = tmp_path / "ephemeral" / "runtime"
    monkeypatch.setenv("RESILIOSPACE_RUNTIME_DIR", str(runtime))
    configured = Settings()
    configured.ensure_runtime_directories()
    assert configured.runtime_root == runtime.resolve()
    for directory in [configured.uploads_dir, configured.debug_dir]:
        file = directory / "probe.txt"
        file.write_text("writable", encoding="utf-8")
        assert file.read_text(encoding="utf-8") == "writable"
    engine = create_engine(configured.database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE probe (value TEXT)"))
            connection.execute(text("INSERT INTO probe VALUES ('stored')"))
        with engine.connect() as connection:
            assert connection.execute(text("SELECT value FROM probe")).scalar_one() == "stored"
    finally:
        engine.dispose()
    assert (runtime / "resiliospace.sqlite3").is_file()
