from collections import deque
from threading import RLock

from .models import Observation


class Monitor:
    """Collects real request, processor, renderer, and autosave observations."""

    def __init__(self):
        self._lock = RLock()
        self._latencies: deque[float] = deque(maxlen=100)
        self._requests = 0
        self._errors = 0
        self._observation = Observation()

    def record_request(self, latency_ms: float, status_code: int) -> None:
        with self._lock:
            self._requests += 1
            self._errors += int(status_code >= 500)
            self._latencies.append(latency_ms)

    def record_processing(self, duration_ms: float, confidence: float | None = None, failed: bool = False) -> None:
        with self._lock:
            self._observation.processing_duration_ms = round(duration_ms, 2)
            self._observation.processing_health = "FAILED" if failed else "HEALTHY"
            if confidence is not None:
                self._observation.reconstruction_confidence = confidence

    def record_telemetry(self, *, fps: float | None = None, frame_time_ms: float | None = None,
                         renderer_health: str | None = None, autosave_health: str | None = None,
                         session_corrupted: bool | None = None) -> None:
        with self._lock:
            if fps is not None: self._observation.renderer_fps = fps
            if frame_time_ms is not None: self._observation.renderer_frame_time_ms = frame_time_ms
            if renderer_health is not None: self._observation.renderer_health = renderer_health
            if autosave_health is not None: self._observation.autosave_health = autosave_health
            if session_corrupted is not None: self._observation.session_corrupted = session_corrupted

    def snapshot(self) -> Observation:
        with self._lock:
            values = self._observation.to_dict()
            values.pop("api_error_rate")
            values["api_request_count"] = self._requests
            values["api_error_count"] = self._errors
            values["api_latency_ms"] = round(sum(self._latencies) / len(self._latencies), 2) if self._latencies else None
            return Observation(**values)
