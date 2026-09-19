import importlib.util
from pathlib import Path


RUNNER_PATH = Path(__file__).resolve().parents[3] / "scripts" / "run_day6_experiments.py"
SPEC = importlib.util.spec_from_file_location("day6_experiments", RUNNER_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def test_day6_experiment_runner_generates_five_genuine_pass_results(tmp_path):
    results = MODULE.run_experiments(tmp_path)
    assert len(results) == 5
    assert all(result["passed"] for result in results.values())
    assert (tmp_path / "day6-summary.csv").is_file()
    assert set(path.name for path in tmp_path.glob("*.json")) == set(results)
    adaptive = results["day6-adaptive-rendering.json"]
    assert adaptive["genuine_browser_fps"] is None
    assert adaptive["controlled_simulated_fps"] < adaptive["configured_fps_threshold"]
    assert adaptive["adapted_rendering_configuration"]["shadows"] is False
    assert [step["mode"] for step in adaptive["recovery_observations"]] == ["RECOVERY", "RECOVERY", "NORMAL"]
    renderer = results["day6-renderer-failure.json"]
    assert renderer["model_and_design_state_preserved"] is True
    assert renderer["three_d_disable_requested"] is True
    assert renderer["three_d_unmounted_observed"] is None
    confidence = results["day6-low-confidence.json"]
    assert confidence["genuine_reconstruction_confidence"] is None
    assert confidence["actual_image_preprocessing_attempts"] == 0
    assert confidence["enhanced_retry_decision_count"] == 1
    assert confidence["persistent_strategy"] == "REQUEST_USER_CORRECTION"
    snapshot = results["day6-snapshot-recovery.json"]
    assert snapshot["invalid_newest_rejected"] is True
    assert snapshot["structural_and_design_state_recovered"] is True
    hysteresis = results["day6-recovery-hysteresis.json"]
    assert [step["mode"] for step in hysteresis["healthy_observations"]] == ["RECOVERY", "RECOVERY", "NORMAL"]
