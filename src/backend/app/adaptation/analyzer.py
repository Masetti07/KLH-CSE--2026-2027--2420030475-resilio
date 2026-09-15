from .models import Analysis, RuntimeCondition
from .policies import AdaptationPolicies, DEFAULT_POLICIES


class Analyzer:
    def __init__(self, policies: AdaptationPolicies = DEFAULT_POLICIES):
        self.policies = policies

    def analyze(self, observation, recovering: bool = False) -> Analysis:
        data = observation.to_dict()
        p = self.policies
        if observation.session_corrupted:
            return Analysis(RuntimeCondition.SESSION_CORRUPTION, "snapshot schema validation failed", data)
        if observation.renderer_health == "FAILED":
            return Analysis(RuntimeCondition.RENDERER_FAILURE, "renderer reported FAILED", data)
        if observation.processing_health == "FAILED":
            return Analysis(RuntimeCondition.PROCESSING_FAILURE, "processor raised an unexpected failure", data)
        if observation.autosave_health == "FAILED":
            return Analysis(RuntimeCondition.AUTOSAVE_FAILURE, "autosave write or validation failed", data)
        if observation.reconstruction_confidence is not None and observation.reconstruction_confidence < p.minimum_reconstruction_confidence:
            return Analysis(RuntimeCondition.LOW_RECONSTRUCTION_CONFIDENCE, f"confidence < {p.minimum_reconstruction_confidence}", data)
        if ((observation.renderer_fps is not None and observation.renderer_fps < p.minimum_healthy_fps)
                or (observation.renderer_frame_time_ms is not None and observation.renderer_frame_time_ms > p.maximum_frame_time_ms)):
            return Analysis(RuntimeCondition.RENDER_OVERLOAD, f"FPS < {p.minimum_healthy_fps} or frame time > {p.maximum_frame_time_ms} ms", data)
        if observation.api_request_count >= p.minimum_api_samples and (
            observation.api_error_rate > p.maximum_api_error_rate
            or (observation.api_latency_ms or 0) > p.maximum_api_latency_ms
        ):
            return Analysis(RuntimeCondition.API_DEGRADATION, f"API latency > {p.maximum_api_latency_ms} ms or error rate > {p.maximum_api_error_rate}", data)
        if recovering:
            return Analysis(RuntimeCondition.RECOVERING, f"healthy stability check required ({p.recovery_healthy_checks})", data)
        return Analysis(RuntimeCondition.HEALTHY, "all observed signals within configured thresholds", data)
