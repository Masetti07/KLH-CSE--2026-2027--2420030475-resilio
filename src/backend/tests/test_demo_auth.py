import asyncio

import pytest

from app import demo_auth
from app.api import access as controls
from app.config import Settings
from tests.test_api import image_bytes

PASSWORD = "test-only-strong-demo-password"


@pytest.fixture
def secured(monkeypatch):
    configured = Settings(public_demo=True, demo_password=PASSWORD)
    monkeypatch.setattr(demo_auth, "settings", configured)
    monkeypatch.setattr(controls, "settings", configured)
    monkeypatch.setattr(demo_auth, "access", demo_auth.DemoAccess())
    return demo_auth.access


def authorize(client):
    response = client.post("/api/auth/login", json={"password": PASSWORD})
    assert response.status_code == 200
    assert response.json()["expires_in"] == 1800
    assert response.headers["cache-control"] == "no-store"
    return {"Authorization": f"Bearer {response.json()['token']}"}


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/plans/samples/sample_simple_1bed.png"),
    ("POST", "/api/plans/upload"), ("POST", "/api/plans/starters/blank"),
    ("GET", "/api/plans/example/artifacts/threshold"),
    ("PUT", "/api/plans/example/structure"),
    ("GET", "/api/plans/example/designs"), ("POST", "/api/plans/example/designs"),
    ("GET", "/api/designs/example"), ("PUT", "/api/designs/example"),
    ("DELETE", "/api/designs/example"), ("POST", "/api/designs/example/duplicate"),
    ("POST", "/api/designs/example/vastu-analysis"), ("POST", "/api/vastu/assist-preview"),
    ("POST", "/api/system/telemetry"), ("POST", "/api/simulator/restore"),
    ("GET", "/metrics"), ("GET", "/docs"), ("GET", "/openapi.json"),
])
def test_backend_denies_anonymous_routes(client, secured, method, path):
    assert client.request(method, path).status_code == 401
    assert client.request(method, path, headers={"Authorization": "Bearer forged"}).status_code == 401


def test_health_login_expiration_and_logout(client, secured):
    assert client.get("/health").status_code == 200
    assert client.get("/api/auth/status").json() == {"required": True}
    assert client.post("/api/auth/login", json={"password": "wrong"}).status_code == 401
    headers = authorize(client)
    assert client.get("/api/system/health", headers=headers).status_code == 200
    for key in secured.sessions:
        secured.sessions[key] = 0
    assert client.get("/api/system/health", headers=headers).status_code == 401
    headers = authorize(client)
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/system/health", headers=headers).status_code == 401


def test_login_is_bounded_and_malformed_body_rejected(client, secured):
    assert client.post("/api/auth/login", content="not json").status_code == 400
    for _ in range(9):
        assert client.post("/api/auth/login", json={"password": "wrong"}).status_code == 401
    response = client.post("/api/auth/login", json={"password": PASSWORD}, headers={"X-Forwarded-For": "different-client"})
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"
    for bucket in secured.windows.values():
        bucket.clear()
    assert client.post("/api/auth/login", content=b"x" * 1025).status_code == 413
    assert client.post("/api/auth/login", content=iter([b"x" * 600, b"y" * 600])).status_code == 413


def test_cors_preflight_and_denied_response(client, secured):
    headers = {"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST",
               "Access-Control-Request-Headers": "Authorization,Content-Type"}
    response = client.options("/api/plans/upload", headers=headers)
    assert response.status_code == 200
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
    response = client.get("/api/system/health", headers={"Origin": headers["Origin"]})
    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == headers["Origin"]
    assert "access-control-allow-credentials" not in response.headers


def test_authorized_upload_artifact_design_save_and_restrictions(client, secured):
    headers = authorize(client)
    sample = client.get("/api/plans/samples/sample_simple_1bed.png", headers=headers)
    assert sample.status_code == 200
    upload = client.post("/api/plans/upload", headers=headers,
                         files={"file": ("plan.png", image_bytes("PNG"), "image/png")})
    assert upload.status_code == 201
    plan_id = upload.json()["plan"]["id"]
    assert client.get(f"/api/plans/{plan_id}/artifacts/threshold", headers=headers).status_code == 200
    design = client.post(f"/api/plans/{plan_id}/designs", json={"name": "Shared demo"}, headers=headers)
    assert design.status_code == 201
    payload = design.json()
    assert client.put(f"/api/designs/{payload['id']}", headers=headers,
                      json={"name": "Saved", "configuration": payload["configuration"]}).status_code == 200
    assert client.post(f"/api/designs/{payload['id']}/vastu-analysis", headers=headers).status_code == 200
    structure = upload.json()["structure"]
    assert client.put(f"/api/plans/{plan_id}/structure", json=structure, headers=headers).status_code == 200
    for path in ["/api/simulator/scenarios/low_fps/activate", "/api/simulator/scenarios/low_fps/clear",
                 "/api/simulator/restore", "/api/system/telemetry"]:
        assert client.post(path, json={}, headers=headers).status_code == 403


def test_upload_write_processing_limits_and_lock_release(client, secured):
    headers = authorize(client)
    for _ in range(5):
        assert client.post("/api/plans/upload", headers=headers).status_code == 422
    assert client.post("/api/plans/upload", headers=headers).status_code == 429
    assert secured.processing.acquire(blocking=False)
    try:
        assert client.post("/api/plans/starters/blank", headers=headers).status_code == 429
    finally:
        secured.processing.release()
    assert client.post("/api/plans/starters/blank", headers=headers).status_code == 201
    secured.windows.clear()
    for _ in range(60):
        assert secured.allow("processing", 60)
    assert client.post("/api/plans/starters/blank", headers=headers).status_code == 429
    secured.windows.clear()
    for _ in range(120):
        assert secured.allow("writes", 120)
    assert client.post("/api/plans/starters/blank", headers=headers).status_code == 429


def test_processing_lock_released_on_failure(secured):
    token = secured.issue()
    async def broken(scope, receive, send):
        raise RuntimeError("processing failed")
    async def unused(*args):
        raise AssertionError("unexpected call")
    middleware = demo_auth.DemoAccessMiddleware(broken)
    scope = {"type": "http", "method": "POST", "path": "/api/plans/upload",
             "headers": [(b"authorization", f"Bearer {token}".encode())]}
    with pytest.raises(RuntimeError, match="processing failed"):
        asyncio.run(middleware(scope, unused, unused))
    assert not secured.processing.locked()


def test_required_password_fails_closed(monkeypatch):
    monkeypatch.setattr(demo_auth, "settings", Settings(public_demo=True))
    with pytest.raises(ValueError, match="DEMO_PASSWORD"):
        demo_auth.validate_configuration()
    monkeypatch.setattr(demo_auth, "settings", Settings(public_demo=False, demo_password="short"))
    with pytest.raises(ValueError, match="DEMO_PASSWORD"):
        demo_auth.validate_configuration()
    monkeypatch.setattr(demo_auth, "settings", Settings(public_demo=False))
    demo_auth.validate_configuration()


def test_local_development_needs_no_password(client):
    assert client.get("/api/auth/status").json() == {"required": False}
    assert client.post("/api/plans/starters/blank").status_code == 201
