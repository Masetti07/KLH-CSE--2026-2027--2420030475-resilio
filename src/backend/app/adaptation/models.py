from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any


class AdaptiveMode(StrEnum):
    NORMAL = "NORMAL"
    PERFORMANCE = "PERFORMANCE"
    DEGRADED = "DEGRADED"
    RECOVERY = "RECOVERY"


class RuntimeCondition(StrEnum):
    HEALTHY = "HEALTHY"
    LOW_RECONSTRUCTION_CONFIDENCE = "LOW_RECONSTRUCTION_CONFIDENCE"
    RENDER_OVERLOAD = "RENDER_OVERLOAD"
    API_DEGRADATION = "API_DEGRADATION"
    RENDERER_FAILURE = "RENDERER_FAILURE"
    PROCESSING_FAILURE = "PROCESSING_FAILURE"
    AUTOSAVE_FAILURE = "AUTOSAVE_FAILURE"
    SESSION_CORRUPTION = "SESSION_CORRUPTION"
    RECOVERING = "RECOVERING"


class Strategy(StrEnum):
    RETURN_NORMAL = "RETURN_NORMAL"
    RETRY_ENHANCED_PREPROCESSING = "RETRY_ENHANCED_PREPROCESSING"
    REQUEST_USER_CORRECTION = "REQUEST_USER_CORRECTION"
    REDUCE_RENDER_QUALITY = "REDUCE_RENDER_QUALITY"
    DISABLE_EXPENSIVE_EFFECTS = "DISABLE_EXPENSIVE_EFFECTS"
    USE_2D_FALLBACK = "USE_2D_FALLBACK"
    RETRY_PROCESSING = "RETRY_PROCESSING"
    RESTORE_LAST_VALID_SNAPSHOT = "RESTORE_LAST_VALID_SNAPSHOT"
    CONTROLLED_RECOVERY = "CONTROLLED_RECOVERY"


@dataclass(slots=True)
class Observation:
    reconstruction_confidence: float | None = None
    processing_duration_ms: float | None = None
    api_latency_ms: float | None = None
    api_request_count: int = 0
    api_error_count: int = 0
    renderer_fps: float | None = None
    renderer_frame_time_ms: float | None = None
    renderer_health: str = "UNKNOWN"
    processing_health: str = "HEALTHY"
    autosave_health: str = "UNKNOWN"
    session_corrupted: bool = False
    simulated_conditions: list[str] = field(default_factory=list)

    @property
    def api_error_rate(self) -> float:
        return self.api_error_count / self.api_request_count if self.api_request_count else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {**asdict(self), "api_error_rate": round(self.api_error_rate, 4)}


@dataclass(slots=True)
class Analysis:
    condition: RuntimeCondition
    trigger: str
    observed: dict[str, Any]


@dataclass(slots=True)
class Decision:
    strategy: Strategy
    target_mode: AdaptiveMode
    explanation: str


@dataclass(slots=True)
class AdaptationRecord:
    timestamp: str
    condition: str
    observed_metrics: dict[str, Any]
    threshold_or_trigger: str
    previous_mode: str
    selected_strategy: str
    new_mode: str
    outcome: str
    post_adaptation_metrics: dict[str, Any] | None
    explanation: str

    @classmethod
    def create(cls, analysis: Analysis, decision: Decision, previous: AdaptiveMode, outcome: str) -> "AdaptationRecord":
        return cls(
            timestamp=datetime.now(timezone.utc).isoformat(), condition=analysis.condition,
            observed_metrics=analysis.observed, threshold_or_trigger=analysis.trigger,
            previous_mode=previous, selected_strategy=decision.strategy, new_mode=decision.target_mode,
            outcome=outcome, post_adaptation_metrics=None, explanation=decision.explanation,
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
