from prometheus_client import Counter, Gauge, Histogram


HTTP_REQUESTS = Counter("resiliospace_http_requests_total", "HTTP requests handled.", ["method", "route", "status"])
HTTP_LATENCY = Histogram("resiliospace_http_request_duration_seconds", "HTTP request latency.", ["method", "route"])
PROCESSING_DURATION = Histogram("resiliospace_floor_plan_processing_duration_seconds", "Floor-plan processing duration.")
PROCESSING_FAILURES = Counter("resiliospace_processing_failures_total", "Floor-plan processing failures.")
PLANS_PROCESSED = Counter("resiliospace_floor_plans_processed_total", "Successfully processed floor plans.")
ADAPTATIONS = Counter("resiliospace_adaptations_total", "MAPE-K adaptation decisions.", ["condition", "strategy"])
ADAPTIVE_MODE = Gauge("resiliospace_adaptive_mode", "Current adaptive mode; exactly one mode is 1.", ["mode"])
SNAPSHOT_RECOVERIES = Counter("resiliospace_snapshot_recoveries_total", "Previous-valid snapshot recoveries.")
VASTU_ANALYSES = Counter("resiliospace_vastu_analyses_total", "Traditional Vastu Rule Analyses completed.")
RENDERER_TELEMETRY = Counter("resiliospace_renderer_telemetry_received_total", "Renderer telemetry summaries received.")
RENDERER_FPS = Gauge("resiliospace_renderer_fps", "Latest observed renderer frames per second.")
RECONSTRUCTION_CONFIDENCE = Gauge("resiliospace_reconstruction_confidence", "Latest reconstruction confidence from 0 to 1.")

MODES = ("NORMAL", "PERFORMANCE", "DEGRADED", "RECOVERY")


def observe_mode(mode: str) -> None:
    for candidate in MODES:
        ADAPTIVE_MODE.labels(mode=candidate).set(1 if candidate == mode else 0)


def observe_request(method: str, route: str, status: int, duration_seconds: float) -> None:
    HTTP_REQUESTS.labels(method=method, route=route, status=str(status)).inc()
    HTTP_LATENCY.labels(method=method, route=route).observe(duration_seconds)


def observe_processing(duration_seconds: float, *, success: bool, confidence: float | None = None) -> None:
    PROCESSING_DURATION.observe(duration_seconds)
    if success:
        PLANS_PROCESSED.inc()
        if confidence is not None:
            RECONSTRUCTION_CONFIDENCE.set(confidence)
    else:
        PROCESSING_FAILURES.inc()


def observe_adaptation(condition: str, strategy: str, outcome: str, mode: str) -> None:
    ADAPTATIONS.labels(condition=condition, strategy=strategy).inc()
    observe_mode(mode)
    if strategy == "RESTORE_LAST_VALID_SNAPSHOT" and outcome == "Previous valid snapshot restored":
        SNAPSHOT_RECOVERIES.inc()


observe_mode("NORMAL")
