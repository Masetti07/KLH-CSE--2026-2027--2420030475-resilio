from .analyzer import Analyzer
from .executor import Executor
from .knowledge import Knowledge
from .monitor import Monitor
from .planner import Planner
from app.observability import observe_adaptation, observe_mode
from app.simulator import SimulationController


class AdaptationEngine:
    def __init__(self):
        self.reset()

    def reset(self):
        """Reset volatile runtime state without touching persisted plans or designs."""
        self.monitor = Monitor()
        self.knowledge = Knowledge()
        self.analyzer = Analyzer(self.knowledge.policies)
        self.planner = Planner()
        self.executor = Executor()
        self.simulator = SimulationController(self.knowledge.policies)
        observe_mode("NORMAL")

    def evaluate(self):
        observation = self.simulator.apply(self.monitor.snapshot())
        analysis = self.analyzer.analyze(observation, recovering=self.knowledge.mode.value == "RECOVERY")
        decision = self.planner.plan(analysis, self.knowledge)
        event = self.executor.execute(analysis, decision, self.knowledge)
        if event is not None:
            observe_adaptation(event.condition, event.selected_strategy, event.outcome, event.new_mode)
        return observation, analysis, decision, event


engine = AdaptationEngine()

__all__ = ["AdaptationEngine", "engine"]
