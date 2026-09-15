from collections import deque
from copy import deepcopy
from threading import RLock
from typing import Any

from .models import AdaptationRecord, AdaptiveMode, RuntimeCondition, Strategy
from .policies import AdaptationPolicies, DEFAULT_POLICIES


class Knowledge:
    def __init__(self, policies: AdaptationPolicies = DEFAULT_POLICIES):
        self.policies = policies
        self.mode = AdaptiveMode.NORMAL
        self.active_condition = RuntimeCondition.HEALTHY
        self.active_strategy: Strategy | None = None
        self.recovery_progress = 0
        self.enhanced_retry_count = 0
        self.history: deque[AdaptationRecord] = deque(maxlen=policies.history_limit)
        self._snapshots: deque[dict[str, Any]] = deque(maxlen=policies.snapshot_history_limit)
        self._lock = RLock()

    def record(self, event: AdaptationRecord) -> None:
        with self._lock:
            self.history.appendleft(event)

    def adaptations(self) -> list[dict[str, Any]]:
        with self._lock:
            return [item.to_dict() for item in self.history]

    @staticmethod
    def validate_snapshot(snapshot: Any) -> bool:
        if not isinstance(snapshot, dict) or snapshot.get("schema_version") != 1:
            return False
        payload = snapshot.get("payload")
        metadata = snapshot.get("metadata")
        if not isinstance(payload, dict) or not isinstance(metadata, dict):
            return False
        structure = payload.get("structure")
        configuration = payload.get("design_configuration")
        if not isinstance(structure, dict) or not isinstance(configuration, dict):
            return False
        return (
            isinstance(structure.get("id"), str)
            and all(isinstance(structure.get(key), list) for key in ("walls", "rooms", "openings"))
            and isinstance(configuration.get("wall_height"), (int, float))
            and all(isinstance(configuration.get(key), dict) for key in (
                "wall_appearances", "floor_appearances", "door_configurations",
                "window_configurations", "room_semantics",
            ))
            and isinstance(metadata.get("created_at"), str)
        )

    def add_snapshot(self, snapshot: dict[str, Any]) -> bool:
        if not self.validate_snapshot(snapshot):
            return False
        with self._lock:
            self._snapshots.append(deepcopy(snapshot))
        return True

    def restore_latest_valid_snapshot(self, candidates: list[Any] | None = None) -> dict[str, Any] | None:
        source = reversed(candidates) if candidates is not None else reversed(self._snapshots)
        for snapshot in source:
            if self.validate_snapshot(snapshot):
                return deepcopy(snapshot)
        return None
