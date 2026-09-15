from app.adaptation import AdaptationEngine
from app.adaptation.analyzer import Analyzer
from app.adaptation.executor import Executor
from app.adaptation.knowledge import Knowledge
from app.adaptation.models import AdaptiveMode, Analysis, Observation, RuntimeCondition, Strategy
from app.adaptation.planner import Planner
from app.adaptation.policies import AdaptationPolicies


def components(**policy_changes):
    policies = AdaptationPolicies(**policy_changes)
    knowledge = Knowledge(policies)
    return policies, knowledge, Analyzer(policies), Planner(), Executor()


def test_healthy_observation_maps_to_healthy_normal():
    _, knowledge, analyzer, planner, executor = components()
    analysis = analyzer.analyze(Observation(renderer_fps=60, renderer_frame_time_ms=16, renderer_health="HEALTHY", autosave_health="HEALTHY"))
    assert analysis.condition == RuntimeCondition.HEALTHY
    decision = planner.plan(analysis, knowledge)
    executor.execute(analysis, decision, knowledge)
    assert knowledge.mode == AdaptiveMode.NORMAL


def test_low_confidence_retries_once_then_requests_user_correction():
    _, knowledge, analyzer, planner, executor = components()
    observation = Observation(reconstruction_confidence=.3)
    first = analyzer.analyze(observation)
    assert first.condition == RuntimeCondition.LOW_RECONSTRUCTION_CONFIDENCE
    first_decision = planner.plan(first, knowledge)
    assert first_decision.strategy == Strategy.RETRY_ENHANCED_PREPROCESSING
    executor.execute(first, first_decision, knowledge)
    second_decision = planner.plan(analyzer.analyze(observation), knowledge)
    assert second_decision.strategy == Strategy.REQUEST_USER_CORRECTION
    executor.execute(first, second_decision, knowledge)
    assert knowledge.mode == AdaptiveMode.DEGRADED


def test_renderer_overload_reduces_quality_and_enters_performance():
    _, knowledge, analyzer, planner, executor = components()
    analysis = analyzer.analyze(Observation(renderer_fps=18, renderer_frame_time_ms=56, renderer_health="SLOW"))
    assert analysis.condition == RuntimeCondition.RENDER_OVERLOAD
    decision = planner.plan(analysis, knowledge)
    assert decision.strategy == Strategy.REDUCE_RENDER_QUALITY
    executor.execute(analysis, decision, knowledge)
    assert knowledge.mode == AdaptiveMode.PERFORMANCE


def test_renderer_failure_uses_2d_and_enters_degraded():
    _, knowledge, analyzer, planner, executor = components()
    analysis = analyzer.analyze(Observation(renderer_health="FAILED"))
    assert analysis.condition == RuntimeCondition.RENDERER_FAILURE
    decision = planner.plan(analysis, knowledge)
    assert decision.strategy == Strategy.USE_2D_FALLBACK
    executor.execute(analysis, decision, knowledge)
    assert knowledge.mode == AdaptiveMode.DEGRADED


def test_renderer_failure_moves_performance_mode_to_degraded():
    _, knowledge, analyzer, planner, executor = components()
    knowledge.mode = AdaptiveMode.PERFORMANCE
    analysis = analyzer.analyze(Observation(renderer_health="FAILED"))
    executor.execute(analysis, planner.plan(analysis, knowledge), knowledge)
    assert knowledge.mode == AdaptiveMode.DEGRADED


def test_recovery_requires_consecutive_healthy_checks():
    _, knowledge, analyzer, planner, executor = components(recovery_healthy_checks=3)
    knowledge.mode = AdaptiveMode.PERFORMANCE
    healthy = Observation(renderer_fps=60, renderer_frame_time_ms=16, renderer_health="HEALTHY")
    for expected in (1, 2):
        analysis = analyzer.analyze(healthy, recovering=knowledge.mode == AdaptiveMode.RECOVERY)
        executor.execute(analysis, planner.plan(analysis, knowledge), knowledge)
        assert knowledge.mode == AdaptiveMode.RECOVERY
        assert knowledge.recovery_progress == expected
    analysis = analyzer.analyze(healthy, recovering=True)
    executor.execute(analysis, planner.plan(analysis, knowledge), knowledge)
    assert knowledge.mode == AdaptiveMode.NORMAL


def test_processing_failure_has_bounded_retry_strategy():
    _, knowledge, analyzer, planner, _ = components()
    analysis = analyzer.analyze(Observation(processing_health="FAILED"))
    assert analysis.condition == RuntimeCondition.PROCESSING_FAILURE
    assert planner.plan(analysis, knowledge).strategy == Strategy.RETRY_PROCESSING


def valid_snapshot(timestamp="2026-01-01T00:00:00Z"):
    return {"schema_version": 1, "metadata": {"created_at": timestamp}, "payload": {"structure": {"id": "p", "walls": [], "rooms": [], "openings": []}, "design_configuration": {"wall_height": 3, "wall_appearances": {}, "floor_appearances": {}, "door_configurations": {}, "window_configurations": {}, "room_semantics": {}}}}


def test_snapshot_validation_bounded_history_and_previous_restore():
    knowledge = Knowledge(AdaptationPolicies(snapshot_history_limit=3))
    assert knowledge.add_snapshot(valid_snapshot("1"))
    assert not knowledge.add_snapshot({"schema_version": 1, "payload": {}})
    for index in range(2, 6):
        knowledge.add_snapshot(valid_snapshot(str(index)))
    assert len(knowledge._snapshots) == 3
    restored = knowledge.restore_latest_valid_snapshot([valid_snapshot("old"), {"corrupt": True}])
    assert restored["metadata"]["created_at"] == "old"


def test_adaptation_history_is_explainable_and_bounded():
    _, knowledge, _, planner, executor = components(history_limit=2)
    for fps in (10, 11, 12):
        knowledge.mode = AdaptiveMode.NORMAL
        knowledge.active_condition = RuntimeCondition.HEALTHY
        knowledge.active_strategy = None
        analysis = Analysis(RuntimeCondition.RENDER_OVERLOAD, "FPS below 24", {"renderer_fps": fps})
        executor.execute(analysis, planner.plan(analysis, knowledge), knowledge)
    history = knowledge.adaptations()
    assert len(history) == 2
    assert history[0]["threshold_or_trigger"] == "FPS below 24"
    assert history[0]["explanation"]
    assert history[0]["post_adaptation_metrics"] is None


def test_system_api_exposes_health_metrics_mode_and_history(client):
    assert client.get("/api/system/health").status_code == 200
    assert client.get("/api/system/metrics").status_code == 200
    assert client.get("/api/system/mode").json()["adaptive_mode"] in {"NORMAL", "PERFORMANCE", "DEGRADED", "RECOVERY"}
    assert isinstance(client.get("/api/system/adaptations").json()["items"], list)
    response = client.post("/api/system/telemetry", json={"fps": 60, "frame_time_ms": 16, "renderer_health": "HEALTHY", "autosave_health": "HEALTHY"})
    assert response.status_code == 200


def test_recovery_keeps_conservative_rendering_until_normal():
    from app.adaptation import engine
    from app.api.system import _state

    previous = engine.knowledge.mode
    try:
        engine.knowledge.mode = AdaptiveMode.RECOVERY
        assert _state()["rendering_quality"] == "PERFORMANCE"
        engine.knowledge.mode = AdaptiveMode.NORMAL
        assert _state()["rendering_quality"] == "NORMAL"
    finally:
        engine.knowledge.mode = previous
