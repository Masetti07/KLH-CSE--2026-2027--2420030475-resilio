import io

from PIL import Image, ImageDraw

from app.adaptation import engine


def plan_bytes() -> bytes:
    image = Image.new("RGB", (320, 240), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, 300, 220), outline="black", width=10)
    draw.line((160, 20, 160, 220), fill="black", width=8)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def healthy_renderer(client):
    return client.post("/api/system/telemetry", json={"fps": 60, "frame_time_ms": 16, "renderer_health": "HEALTHY", "autosave_health": "HEALTHY"})


def test_low_fps_uses_mape_k_and_real_recovery_hysteresis(client):
    assert healthy_renderer(client).json()["adaptive_mode"] == "NORMAL"
    activated = client.post("/api/simulator/scenarios/low_fps/activate").json()
    assert activated["simulations"]["scenarios"]["low_fps"]["active"] is True
    assert activated["system"]["active_condition"] == "RENDER_OVERLOAD"
    assert activated["system"]["active_strategy"] == "REDUCE_RENDER_QUALITY"
    assert activated["system"]["adaptive_mode"] == "PERFORMANCE"
    assert activated["system"]["rendering_quality"] == "PERFORMANCE"

    cleared = client.post("/api/simulator/scenarios/low_fps/clear").json()
    assert cleared["system"]["adaptive_mode"] == "RECOVERY"
    assert cleared["system"]["rendering_quality"] == "PERFORMANCE"
    assert healthy_renderer(client).json()["adaptive_mode"] == "RECOVERY"
    recovered = healthy_renderer(client).json()
    assert recovered["adaptive_mode"] == "NORMAL"
    assert recovered["rendering_quality"] == "NORMAL"


def test_renderer_failure_uses_2d_fallback_and_preserves_persisted_design(client):
    uploaded = client.post("/api/plans/upload", files={"file": ("plan.png", plan_bytes(), "image/png")}).json()
    plan_id = uploaded["plan"]["id"]
    design = client.post(f"/api/plans/{plan_id}/designs", json={"name": "Preserved"}).json()
    structure_before = client.get(f"/api/plans/{plan_id}/structure").json()
    design_before = client.get(f"/api/designs/{design['id']}").json()
    engine.monitor.record_processing(0, confidence=.9)
    healthy_renderer(client)

    state = client.post("/api/simulator/scenarios/renderer_failure/activate").json()["system"]
    assert state["adaptive_mode"] == "DEGRADED"
    assert state["active_strategy"] == "USE_2D_FALLBACK"
    assert state["use_2d_fallback"] is True
    assert client.get(f"/api/plans/{plan_id}/structure").json() == structure_before
    assert client.get(f"/api/designs/{design['id']}").json() == design_before

    assert client.post("/api/simulator/scenarios/renderer_failure/clear").json()["system"]["adaptive_mode"] == "RECOVERY"
    assert healthy_renderer(client).json()["adaptive_mode"] == "RECOVERY"
    assert healthy_renderer(client).json()["adaptive_mode"] == "NORMAL"


def test_processing_failure_is_controlled_and_source_can_be_retried(client):
    source = plan_bytes()
    client.post("/api/simulator/scenarios/processing_failure/activate")
    failed = client.post("/api/plans/upload", files={"file": ("retry.png", source, "image/png")})
    assert failed.status_code == 503
    assert "source plan is preserved" in failed.json()["detail"]
    latest = client.get("/api/system/adaptations").json()["items"][0]
    assert latest["condition"] == "PROCESSING_FAILURE"
    assert latest["selected_strategy"] == "RETRY_PROCESSING"
    assert latest["outcome"] == "Bounded retry permitted; source retained"

    client.post("/api/simulator/scenarios/processing_failure/clear")
    retry = client.post("/api/plans/upload", files={"file": ("retry.png", source, "image/png")})
    assert retry.status_code == 201


def test_persistent_low_confidence_uses_one_enhanced_retry_then_requests_correction(client):
    first = client.post("/api/simulator/scenarios/low_reconstruction_confidence/activate").json()["system"]
    assert first["active_condition"] == "LOW_RECONSTRUCTION_CONFIDENCE"
    assert first["active_strategy"] == "RETRY_ENHANCED_PREPROCESSING"
    assert engine.knowledge.enhanced_retry_count == 1
    second = client.post("/api/simulator/scenarios/low_reconstruction_confidence/activate").json()["system"]
    assert second["active_strategy"] == "REQUEST_USER_CORRECTION"
    assert second["adaptive_mode"] == "DEGRADED"
    assert engine.knowledge.enhanced_retry_count == 1


def test_autosave_corruption_records_real_snapshot_recovery(client):
    client.post("/api/simulator/scenarios/autosave_corruption/activate")
    state = client.post("/api/system/telemetry", json={"session_corrupted": True, "autosave_health": "HEALTHY"}).json()
    assert state["active_condition"] == "SESSION_CORRUPTION"
    assert state["active_strategy"] == "RESTORE_LAST_VALID_SNAPSHOT"
    latest = client.get("/api/system/adaptations").json()["items"][0]
    assert latest["outcome"] == "Previous valid snapshot restored"
    assert latest["observed_metrics"]["simulated_conditions"] == ["autosave_corruption"]


def test_restore_all_clears_flags_without_forcing_normal(client):
    healthy_renderer(client)
    client.post("/api/simulator/scenarios/low_fps/activate")
    client.post("/api/simulator/scenarios/renderer_failure/activate")
    restored = client.post("/api/simulator/restore").json()
    assert restored["simulations"]["any_active"] is False
    assert all(not item["active"] for item in restored["simulations"]["scenarios"].values())
    assert restored["system"]["adaptive_mode"] == "RECOVERY"
