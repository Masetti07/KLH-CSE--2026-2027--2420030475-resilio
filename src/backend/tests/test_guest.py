import io

import pytest
from sqlalchemy import func, select

from app import demo_auth
from app.api import access, guest
from app.config import Settings
from app.database.session import SessionLocal
from app.models.plan_record import PlanRecord
from app.models.design_record import DesignRecord
from tests.test_api import image_bytes


@pytest.fixture
def public_guest(monkeypatch):
    configured = Settings(public_demo=True, guest_demo=True)
    monkeypatch.setattr(demo_auth, "settings", configured)
    monkeypatch.setattr(access, "settings", configured)
    monkeypatch.setattr(demo_auth, "access", demo_auth.DemoAccess())
    demo_auth.validate_configuration()
    return demo_auth.access


def counts():
    with SessionLocal() as session:
        return (session.scalar(select(func.count()).select_from(PlanRecord)),
                session.scalar(select(func.count()).select_from(DesignRecord)))


def test_public_guest_computations_do_not_create_records(client, public_guest, monkeypatch):
    before = counts()
    first = client.post("/api/guest/starters/one_bedroom")
    second = client.post("/api/guest/starters/one_bedroom")
    assert first.status_code == second.status_code == 200
    assert first.json()["plan"]["id"] != second.json()["plan"]["id"]
    structure = first.json()["structure"]
    assert client.post("/api/guest/structure", json=structure).status_code == 200
    assert client.post("/api/guest/analysis", json={"structure": structure, "configuration": {}}).status_code == 200
    assert client.get("/api/guest/samples/sample_compact_2bed.png").status_code == 200
    assert client.get("/api/guest/samples/not-a-sample.png").status_code == 404
    assert counts() == before
    # Body-supplied IDs only describe the caller's own input; no lookup occurs.
    structure["id"] = "any-shared-id"
    assert client.post("/api/guest/structure", json=structure).json()["id"] == "any-shared-id"
    assert counts() == before


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/plans/private/structure"), ("PUT", "/api/plans/private/structure"),
    ("POST", "/api/plans/upload"), ("GET", "/api/plans/private/designs"),
    ("GET", "/api/designs/private"), ("PUT", "/api/designs/private"),
    ("DELETE", "/api/designs/private"), ("POST", "/api/vastu/assist-preview"),
    ("GET", "/api/plans/private/artifacts/threshold"), ("GET", "/metrics"),
    ("POST", "/api/simulator/restore"), ("POST", "/api/system/telemetry"),
    ("GET", "/api/guest/designs/private"), ("POST", "/api/guest/structure/extra"),
])
def test_guest_allowlist_never_unlocks_shared_routes(client, public_guest, method, path):
    assert client.request(method, path).status_code == 401


def test_guest_upload_is_temporary_and_uses_validation(client, public_guest, monkeypatch):
    before = counts()
    paths = []
    real = guest.process_floor_plan
    def capture(image, identifier, debug):
        paths.append(debug)
        return real(image, identifier, debug)
    monkeypatch.setattr(guest, "process_floor_plan", capture)
    response = client.post("/api/guest/upload", files={"file": ("plan.png", image_bytes("PNG"), "image/png")})
    assert response.status_code == 200
    payload = response.json()
    assert payload["artifacts"]["threshold"].startswith("data:image/png;base64,")
    assert all(value == "browser-local" for value in payload["structure"]["processing_metadata"]["debug_images"].values())
    assert paths and all(not path.exists() for path in paths)
    assert counts() == before
    assert client.post("/api/guest/upload", files={"file": ("bad.png", b"bad", "image/png")}).status_code == 400
    assert client.post("/api/guest/upload", files={"file": ("bad.exe", b"bad", "image/png")}).status_code == 400
    from PIL import Image
    image = io.BytesIO()
    Image.new("RGB", (2100, 2000)).save(image, format="PNG")
    assert client.post("/api/guest/upload", files={"file": ("big.png", image.getvalue(), "image/png")}).status_code == 413


def test_failed_processing_cleans_temporary_directory(client, public_guest, monkeypatch):
    paths = []
    def fail(image, identifier, debug):
        paths.append(debug)
        debug.mkdir(parents=True)
        (debug / "partial.png").write_bytes(b"partial")
        raise ValueError("internal path must not be exposed")
    monkeypatch.setattr(guest, "process_floor_plan", fail)
    response = client.post("/api/guest/upload", files={"file": ("plan.png", image_bytes("PNG"), "image/png")})
    assert response.status_code == 422
    assert "internal path" not in response.text
    assert paths and all(not path.exists() for path in paths)
    assert not public_guest.processing.locked()


def test_public_limits_and_cors(client, public_guest):
    headers = {"Origin": "http://localhost:5173"}
    response = client.options("/api/guest/upload", headers={**headers,
        "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Content-Type"})
    assert response.status_code == 200
    for _ in range(5):
        assert client.post("/api/guest/upload").status_code == 422
    assert client.post("/api/guest/upload", headers=headers).status_code == 429
    assert client.post("/api/guest/structure", content=b"x" * (512 * 1024 + 1)).status_code == 413
    assert public_guest.processing.acquire(False)
    try:
        assert client.post("/api/guest/starters/blank").status_code == 429
    finally:
        public_guest.processing.release()
    assert client.post("/api/auth/login", json={"password": "not-needed"}).status_code == 403
    assert client.get("/health").status_code == 200


def test_invalid_geometry_and_private_records_unchanged(client, public_guest):
    before = counts()
    assert client.post("/api/guest/structure", json={"id": "x", "walls": []}).status_code == 422
    starter = client.post("/api/guest/starters/blank").json()["structure"]
    starter["walls"] *= 1001
    assert client.post("/api/guest/structure", json=starter).status_code in {413, 422}
    assert counts() == before
