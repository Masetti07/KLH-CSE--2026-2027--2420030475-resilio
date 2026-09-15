from dataclasses import replace
from threading import RLock

from app.adaptation.models import Observation
from app.adaptation.policies import AdaptationPolicies

from .models import SimulationScenario


class SimulationController:
    """Allow-listed, in-process observation overrides for local resilience demonstrations."""

    def __init__(self, policies: AdaptationPolicies):
        self._lock = RLock()
        self._active: set[SimulationScenario] = set()
        self.simulated_fps = max(1.0, policies.minimum_healthy_fps - 8.0)
        self.simulated_confidence = max(0.0, policies.minimum_reconstruction_confidence - 0.20)

    def activate(self, scenario: SimulationScenario) -> bool:
        with self._lock:
            newly_activated = scenario not in self._active
            self._active.add(scenario)
            return newly_activated

    def clear(self, scenario: SimulationScenario) -> None:
        with self._lock:
            self._active.discard(scenario)

    def clear_all(self) -> None:
        with self._lock:
            self._active.clear()

    def is_active(self, scenario: SimulationScenario) -> bool:
        with self._lock:
            return scenario in self._active

    def apply(self, observation: Observation) -> Observation:
        with self._lock:
            active = set(self._active)
        simulated = replace(observation, simulated_conditions=sorted(item.value for item in active))
        if SimulationScenario.LOW_FPS in active:
            simulated.renderer_fps = self.simulated_fps
            simulated.renderer_frame_time_ms = round(1000 / self.simulated_fps, 2)
            simulated.renderer_health = "SLOW"
        if SimulationScenario.RENDERER_FAILURE in active:
            simulated.renderer_health = "FAILED"
        if SimulationScenario.LOW_RECONSTRUCTION_CONFIDENCE in active:
            simulated.reconstruction_confidence = self.simulated_confidence
        if SimulationScenario.AUTOSAVE_CORRUPTION in active:
            simulated.session_corrupted = True
        return simulated

    def status(self) -> dict:
        with self._lock:
            active = set(self._active)
        return {
            "scenarios": {
                scenario.value: {
                    "active": scenario in active,
                    "simulated_value": self.simulated_fps if scenario == SimulationScenario.LOW_FPS else self.simulated_confidence if scenario == SimulationScenario.LOW_RECONSTRUCTION_CONFIDENCE else None,
                }
                for scenario in SimulationScenario
            },
            "any_active": bool(active),
        }
