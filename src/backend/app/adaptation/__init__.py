from .analyzer import Analyzer
from .executor import Executor
from .knowledge import Knowledge
from .monitor import Monitor
from .planner import Planner


class AdaptationEngine:
    def __init__(self):
        self.monitor = Monitor()
        self.knowledge = Knowledge()
        self.analyzer = Analyzer(self.knowledge.policies)
        self.planner = Planner()
        self.executor = Executor()

    def evaluate(self):
        observation = self.monitor.snapshot()
        analysis = self.analyzer.analyze(observation, recovering=self.knowledge.mode.value == "RECOVERY")
        decision = self.planner.plan(analysis, self.knowledge)
        event = self.executor.execute(analysis, decision, self.knowledge)
        return observation, analysis, decision, event


engine = AdaptationEngine()

__all__ = ["AdaptationEngine", "engine"]
