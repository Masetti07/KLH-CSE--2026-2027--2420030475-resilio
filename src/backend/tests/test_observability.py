import io

from PIL import Image, ImageDraw
from prometheus_client.parser import text_string_to_metric_families


def plan_bytes() -> bytes:
    image = Image.new("RGB", (320, 240), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, 300, 220), outline="black", width=10)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def samples(client):
    response = client.get("/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    observed = {}
    for family in text_string_to_metric_families(response.text):
        for sample in family.samples:
            observed[sample.name] = observed.get(sample.name, 0) + sample.value
    return observed


def test_metrics_endpoint_exposes_expected_bounded_metrics(client):
    observed = samples(client)
    expected = {
        "resiliospace_http_requests_total", "resiliospace_http_request_duration_seconds_count",
        "resiliospace_floor_plan_processing_duration_seconds_count", "resiliospace_processing_failures_total",
        "resiliospace_floor_plans_processed_total", "resiliospace_adaptations_total",
        "resiliospace_adaptive_mode", "resiliospace_snapshot_recoveries_total",
        "resiliospace_vastu_analyses_total", "resiliospace_renderer_telemetry_received_total",
        "resiliospace_renderer_fps", "resiliospace_reconstruction_confidence",
    }
    assert expected <= observed.keys()


def test_request_processing_and_adaptation_metrics_update(client):
    before = samples(client)
    client.get("/health")
    uploaded = client.post("/api/plans/upload", files={"file": ("plan.png", plan_bytes(), "image/png")})
    assert uploaded.status_code == 201
    client.post("/api/simulator/scenarios/low_fps/activate")
    after = samples(client)
    assert after["resiliospace_http_requests_total"] > before["resiliospace_http_requests_total"]
    assert after["resiliospace_floor_plans_processed_total"] > before["resiliospace_floor_plans_processed_total"]
    assert after["resiliospace_floor_plan_processing_duration_seconds_count"] > before["resiliospace_floor_plan_processing_duration_seconds_count"]
    assert after["resiliospace_adaptations_total"] > before.get("resiliospace_adaptations_total", 0)


def test_snapshot_recovery_renderer_and_vastu_metrics_update(client):
    uploaded = client.post("/api/plans/upload", files={"file": ("plan.png", plan_bytes(), "image/png")}).json()
    design = client.post(f"/api/plans/{uploaded['plan']['id']}/designs", json={}).json()
    configuration = design["configuration"]
    configuration["orientation"] = 0
    client.put(f"/api/designs/{design['id']}", json={"configuration": configuration})
    before = samples(client)

    client.post("/api/system/telemetry", json={"fps": 58, "frame_time_ms": 17, "renderer_health": "HEALTHY"})
    client.post("/api/simulator/scenarios/autosave_corruption/activate")
    client.post("/api/system/telemetry", json={"session_corrupted": True, "autosave_health": "HEALTHY"})
    assert client.post(f"/api/designs/{design['id']}/vastu-analysis").status_code == 200
    after = samples(client)
    assert after["resiliospace_snapshot_recoveries_total"] > before["resiliospace_snapshot_recoveries_total"]
    assert after["resiliospace_renderer_telemetry_received_total"] > before["resiliospace_renderer_telemetry_received_total"]
    assert after["resiliospace_renderer_fps"] == 58
    assert after["resiliospace_vastu_analyses_total"] > before["resiliospace_vastu_analyses_total"]
    assert sum(sample.value for family in text_string_to_metric_families(client.get("/metrics").text) for sample in family.samples if sample.name == "resiliospace_adaptive_mode") == 1
