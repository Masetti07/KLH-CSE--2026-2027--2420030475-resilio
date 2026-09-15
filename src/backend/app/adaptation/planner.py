from .knowledge import Knowledge
from .models import AdaptiveMode, Analysis, Decision, RuntimeCondition, Strategy


class Planner:
    def plan(self, analysis: Analysis, knowledge: Knowledge) -> Decision:
        condition = analysis.condition
        if condition == RuntimeCondition.RENDER_OVERLOAD:
            return Decision(Strategy.REDUCE_RENDER_QUALITY, AdaptiveMode.PERFORMANCE, "Renderer performance remained below the configured threshold.")
        if condition == RuntimeCondition.RENDERER_FAILURE:
            return Decision(Strategy.USE_2D_FALLBACK, AdaptiveMode.DEGRADED, "The 3D renderer is unavailable; preserve the model and expose the 2D workspace.")
        if condition == RuntimeCondition.LOW_RECONSTRUCTION_CONFIDENCE:
            if knowledge.enhanced_retry_count < knowledge.policies.maximum_enhanced_retries:
                return Decision(Strategy.RETRY_ENHANCED_PREPROCESSING, knowledge.mode, "Reconstruction confidence is low; run one bounded enhanced preprocessing attempt.")
            return Decision(Strategy.REQUEST_USER_CORRECTION, AdaptiveMode.DEGRADED, "Enhanced preprocessing remained uncertain; manual geometry review is required.")
        if condition == RuntimeCondition.PROCESSING_FAILURE:
            return Decision(Strategy.RETRY_PROCESSING, AdaptiveMode.DEGRADED, "Processing failed; keep the source and permit a bounded retry.")
        if condition == RuntimeCondition.SESSION_CORRUPTION:
            return Decision(Strategy.RESTORE_LAST_VALID_SNAPSHOT, AdaptiveMode.DEGRADED, "The newest snapshot is invalid; restore the most recent valid predecessor.")
        if condition == RuntimeCondition.AUTOSAVE_FAILURE:
            return Decision(Strategy.RESTORE_LAST_VALID_SNAPSHOT, AdaptiveMode.DEGRADED, "Autosave failed validation; preserve and restore validated state.")
        if condition == RuntimeCondition.API_DEGRADATION:
            return Decision(Strategy.CONTROLLED_RECOVERY, AdaptiveMode.DEGRADED, "API reliability is below its threshold; retain local state while service health recovers.")
        if condition in (RuntimeCondition.RECOVERING, RuntimeCondition.HEALTHY) and knowledge.mode != AdaptiveMode.NORMAL:
            return Decision(Strategy.CONTROLLED_RECOVERY, AdaptiveMode.RECOVERY, "Healthy readings must remain stable before normal rendering is restored.")
        return Decision(Strategy.RETURN_NORMAL, AdaptiveMode.NORMAL, "All observed runtime signals are healthy.")
