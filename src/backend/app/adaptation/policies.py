from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AdaptationPolicies:
    minimum_reconstruction_confidence: float = 0.55
    minimum_healthy_fps: float = 24.0
    maximum_frame_time_ms: float = 45.0
    maximum_api_latency_ms: float = 1500.0
    maximum_api_error_rate: float = 0.20
    minimum_api_samples: int = 5
    recovery_healthy_checks: int = 3
    maximum_enhanced_retries: int = 1
    history_limit: int = 50
    snapshot_history_limit: int = 3


DEFAULT_POLICIES = AdaptationPolicies()
