from .knowledge import Knowledge
from .models import AdaptationRecord, AdaptiveMode, Analysis, Decision, RuntimeCondition, Strategy


class Executor:
    """Applies backend mode state; the API response instructs the renderer to apply matching controls."""

    def execute(self, analysis: Analysis, decision: Decision, knowledge: Knowledge) -> AdaptationRecord | None:
        previous = knowledge.mode
        previous_condition = knowledge.active_condition
        previous_strategy = knowledge.active_strategy
        strategy = decision.strategy
        if strategy == Strategy.RETRY_ENHANCED_PREPROCESSING:
            knowledge.enhanced_retry_count += 1
        if strategy == Strategy.CONTROLLED_RECOVERY and decision.target_mode == AdaptiveMode.RECOVERY:
            if previous != AdaptiveMode.RECOVERY:
                knowledge.recovery_progress = 1
            else:
                knowledge.recovery_progress += 1
            if knowledge.recovery_progress >= knowledge.policies.recovery_healthy_checks:
                decision = Decision(Strategy.RETURN_NORMAL, AdaptiveMode.NORMAL, "The configured number of consecutive healthy observations was reached.")
                knowledge.recovery_progress = knowledge.policies.recovery_healthy_checks
        elif analysis.condition != RuntimeCondition.HEALTHY:
            knowledge.recovery_progress = 0

        knowledge.mode = decision.target_mode
        returned_normal = decision.strategy == Strategy.RETURN_NORMAL
        knowledge.active_condition = RuntimeCondition.HEALTHY if returned_normal else analysis.condition
        knowledge.active_strategy = None if returned_normal else decision.strategy
        changed = previous != knowledge.mode or previous_condition != knowledge.active_condition or previous_strategy != knowledge.active_strategy or strategy == Strategy.CONTROLLED_RECOVERY
        if not changed and analysis.condition == RuntimeCondition.HEALTHY:
            return None
        outcome = "Applied successfully"
        if decision.strategy == Strategy.RESTORE_LAST_VALID_SNAPSHOT:
            outcome = "Previous valid snapshot restored" if analysis.observed.get("autosave_health") == "HEALTHY" else "No valid snapshot available; safe persisted baseline retained"
        elif decision.strategy == Strategy.REQUEST_USER_CORRECTION:
            outcome = "Manual correction requested"
        elif decision.strategy == Strategy.RETRY_PROCESSING:
            outcome = "Bounded retry permitted; source retained"
        record = AdaptationRecord.create(analysis, decision, previous, outcome)
        knowledge.record(record)
        return record
