from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.adaptation import engine


router = APIRouter(prefix="/api/system", tags=["system"])


class TelemetryPayload(BaseModel):
    fps: float | None = Field(default=None, ge=0, le=500)
    frame_time_ms: float | None = Field(default=None, ge=0, le=10000)
    renderer_health: Literal["HEALTHY", "SLOW", "FAILED", "UNKNOWN"] | None = None
    autosave_health: Literal["HEALTHY", "FAILED", "UNKNOWN"] | None = None
    session_corrupted: bool | None = None


def _state() -> dict:
    observation = engine.monitor.snapshot()
    knowledge = engine.knowledge
    renderer = observation.renderer_health
    processor = observation.processing_health
    autosave = observation.autosave_health
    degraded = "FAILED" in (renderer, processor, autosave)
    return {
        "overall": "DEGRADED" if degraded or knowledge.mode.value == "DEGRADED" else "HEALTHY",
        "backend": "HEALTHY",
        "processor": processor,
        "renderer": renderer,
        "autosave": autosave,
        "adaptive_mode": knowledge.mode,
        "active_condition": knowledge.active_condition,
        "active_strategy": knowledge.active_strategy,
        "recovery_progress": knowledge.recovery_progress,
        "recovery_required": knowledge.policies.recovery_healthy_checks,
        # Keep the conservative renderer configuration throughout RECOVERY.
        # Normal quality is restored only after the hysteresis gate completes.
        "rendering_quality": "PERFORMANCE" if knowledge.mode.value in {"PERFORMANCE", "RECOVERY"} else "NORMAL",
        "use_2d_fallback": knowledge.mode.value == "DEGRADED" and knowledge.active_condition.value == "RENDERER_FAILURE",
    }


@router.get("/health")
def system_health() -> dict:
    return _state()


@router.get("/metrics")
def system_metrics() -> dict:
    return {
        **engine.monitor.snapshot().to_dict(),
        "current_adaptive_mode": engine.knowledge.mode,
        "current_active_adaptation": engine.knowledge.active_strategy,
    }


@router.get("/mode")
def system_mode() -> dict:
    return _state()


@router.get("/adaptations")
def system_adaptations() -> dict:
    return {"items": engine.knowledge.adaptations(), "limit": engine.knowledge.policies.history_limit}


@router.post("/telemetry")
def telemetry(payload: TelemetryPayload) -> dict:
    engine.monitor.record_telemetry(
        fps=payload.fps, frame_time_ms=payload.frame_time_ms,
        renderer_health=payload.renderer_health, autosave_health=payload.autosave_health,
        session_corrupted=payload.session_corrupted,
    )
    engine.evaluate()
    return _state()
