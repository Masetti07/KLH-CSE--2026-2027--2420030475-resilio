#!/usr/bin/env python3
"""Run bounded Day 6 experiments against the real MAPE-K and snapshot code."""

from __future__ import annotations

import argparse
import csv
import json
import platform
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPOSITORY_ROOT / "src" / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.adaptation import engine  # noqa: E402
from app.adaptation.knowledge import Knowledge  # noqa: E402
from app.api.system import _state  # noqa: E402
from app.simulator import SimulationScenario  # noqa: E402


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def renderer_configuration() -> dict[str, Any]:
    path = REPOSITORY_ROOT / "src" / "frontend" / "src" / "config" / "renderer-quality.json"
    return json.loads(path.read_text(encoding="utf-8"))


def healthy_baseline(confidence: float = 0.75) -> None:
    engine.reset()
    engine.monitor.record_processing(0, confidence=confidence, failed=False)
    engine.monitor.record_telemetry(fps=60, frame_time_ms=16, renderer_health="HEALTHY", autosave_health="HEALTHY", session_corrupted=False)
    engine.evaluate()


def evaluate() -> dict[str, Any]:
    observation, analysis, decision, event = engine.evaluate()
    return {
        "observation": observation.to_dict(),
        "condition": analysis.condition,
        "trigger": analysis.trigger,
        "strategy": decision.strategy,
        "target_mode": decision.target_mode,
        "event": event.to_dict() if event else None,
        "system": _state(),
    }


def recover_after_clear(scenario: SimulationScenario) -> list[dict[str, Any]]:
    engine.simulator.clear(scenario)
    checks = []
    for check in range(1, engine.knowledge.policies.recovery_healthy_checks + 1):
        result = evaluate()
        checks.append({
            "healthy_observation": check,
            "mode": result["system"]["adaptive_mode"],
            "recovery_progress": result["system"]["recovery_progress"],
            "rendering_quality": result["system"]["rendering_quality"],
        })
        if result["system"]["adaptive_mode"] == "NORMAL":
            break
    return checks


def valid_snapshot(created_at: str = "2026-01-01T00:00:00+00:00") -> dict[str, Any]:
    return {
        "schema_version": 1,
        "metadata": {"created_at": created_at},
        "payload": {
            "structure": {"id": "experiment-plan", "walls": [], "rooms": [], "openings": []},
            "design_configuration": {
                "wall_height": 3.0,
                "wall_appearances": {}, "floor_appearances": {}, "door_configurations": {},
                "window_configurations": {}, "room_semantics": {},
            },
        },
    }


def adaptive_rendering() -> dict[str, Any]:
    healthy_baseline()
    config = renderer_configuration()
    baseline = _state()
    engine.simulator.activate(SimulationScenario.LOW_FPS)
    adapted = evaluate()
    recovery = recover_after_clear(SimulationScenario.LOW_FPS)
    result = {
        "experiment": "A - Adaptive rendering",
        "timestamp": utc_now(),
        "measurement_scope": "Controlled fault input; no physical GPU performance improvement is claimed.",
        "genuine_browser_fps": None,
        "controlled_healthy_telemetry_fps": 60,
        "controlled_simulated_fps": engine.simulator.simulated_fps,
        "configured_fps_threshold": engine.knowledge.policies.minimum_healthy_fps,
        "baseline_mode": baseline["adaptive_mode"],
        "baseline_rendering_configuration": config["NORMAL"],
        "condition": adapted["condition"],
        "strategy": adapted["strategy"],
        "adapted_mode": adapted["system"]["adaptive_mode"],
        "adapted_rendering_configuration": config[adapted["system"]["rendering_quality"]],
        "observation": adapted["observation"],
        "recovery_healthy_checks_required": engine.knowledge.policies.recovery_healthy_checks,
        "recovery_observations": recovery,
        "final_mode": _state()["adaptive_mode"],
    }
    result["passed"] = result["condition"] == "RENDER_OVERLOAD" and result["strategy"] == "REDUCE_RENDER_QUALITY" and result["adapted_mode"] == "PERFORMANCE" and result["final_mode"] == "NORMAL"
    return result


def renderer_failure() -> dict[str, Any]:
    healthy_baseline()
    # Exercise actual persisted model/design API reads using an isolated in-memory DB.
    from uuid import uuid4
    from tempfile import TemporaryDirectory
    import numpy as np
    import cv2
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from sqlalchemy.pool import StaticPool
    from app.database.base import Base
    from app.database.session import get_session
    from app.main import app
    from app.models.plan_record import PlanRecord
    from app.processing.pipeline import process_floor_plan

    database = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(database)
    def session_override():
        with Session(database) as session:
            yield session
    original_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_session] = session_override
    try:
        with TemporaryDirectory(prefix="resiliospace-day6-") as scratch:
            image = np.full((240, 320, 3), 255, dtype=np.uint8)
            cv2.rectangle(image, (20, 20), (300, 220), (0, 0, 0), 10)
            cv2.line(image, (160, 20), (160, 220), (0, 0, 0), 8)
            plan_id = str(uuid4())
            structure = process_floor_plan(image, plan_id, Path(scratch))
            with Session(database) as session:
                session.add(PlanRecord(id=plan_id, original_name="synthetic-day6.png", media_type="image/png", size_bytes=0, storage_path="isolated-experiment-no-upload", structure=structure.model_dump(mode="json")))
                session.commit()
            # No application lifespan: never create/open the user's runtime database.
            client = TestClient(app)
            created = client.post(f"/api/plans/{plan_id}/designs", json={"name": "Day 6 preserved design"})
            created.raise_for_status()
            design_id = created.json()["id"]
            before_structure = client.get(f"/api/plans/{plan_id}/structure").json()
            before_design = client.get(f"/api/designs/{design_id}").json()
            start = _state()["adaptive_mode"]
            engine.simulator.activate(SimulationScenario.RENDERER_FAILURE)
            adapted = evaluate()
            after_structure = client.get(f"/api/plans/{plan_id}/structure")
            after_design = client.get(f"/api/designs/{design_id}")
            preserved = after_structure.status_code == 200 and after_design.status_code == 200 and after_structure.json() == before_structure and after_design.json() == before_design
            data_available = after_structure.status_code == 200
            client.close()
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)
        database.dispose()
    recovery = recover_after_clear(SimulationScenario.RENDERER_FAILURE)
    result = {
        "experiment": "B - Renderer failure self-healing", "timestamp": utc_now(),
        "starting_mode": start, "injected_condition": "renderer_health=FAILED",
        "condition": adapted["condition"], "strategy": adapted["strategy"],
        "adapted_mode": adapted["system"]["adaptive_mode"],
        "three_d_disable_requested": adapted["system"]["use_2d_fallback"],
        "three_d_unmounted_observed": None,
        "two_d_ui_available_observed": None,
        "two_d_structural_data_available": data_available,
        "browser_validation": "MANUAL VALIDATION REQUIRED: actual canvas unmount and 2D interaction",
        "model_and_design_state_preserved": preserved,
        "recovery_observations": recovery, "final_mode": _state()["adaptive_mode"],
    }
    result["passed"] = result["condition"] == "RENDERER_FAILURE" and result["strategy"] == "USE_2D_FALLBACK" and result["three_d_disable_requested"] and preserved and result["final_mode"] == "NORMAL"
    return result


def low_confidence() -> dict[str, Any]:
    healthy_baseline(confidence=0.72)
    engine.simulator.activate(SimulationScenario.LOW_RECONSTRUCTION_CONFIDENCE)
    first = evaluate()
    retry_count_after_first = engine.knowledge.enhanced_retry_count
    second = evaluate()
    result = {
        "experiment": "C - Low reconstruction confidence", "timestamp": utc_now(),
        "genuine_reconstruction_confidence": None,
        "controlled_baseline_confidence": 0.72,
        "controlled_injected_confidence": engine.simulator.simulated_confidence,
        "configured_confidence_threshold": engine.knowledge.policies.minimum_reconstruction_confidence,
        "condition": first["condition"], "first_strategy": first["strategy"],
        "enhanced_retry_decision_count": retry_count_after_first,
        "actual_image_preprocessing_attempts": 0,
        "genuinely_recalculated_confidence": None,
        "recalculation_note": "No image was reprocessed in this bounded policy experiment; no improved confidence is claimed.",
        "persistent_strategy": second["strategy"],
        "user_correction_requested": second["strategy"] == "REQUEST_USER_CORRECTION",
        "final_mode": second["system"]["adaptive_mode"],
    }
    result["passed"] = result["condition"] == "LOW_RECONSTRUCTION_CONFIDENCE" and result["first_strategy"] == "RETRY_ENHANCED_PREPROCESSING" and retry_count_after_first == 1 and result["user_correction_requested"]
    return result


def snapshot_recovery() -> dict[str, Any]:
    healthy_baseline()
    valid = valid_snapshot()
    invalid = {"schema_version": 1, "metadata": {"created_at": utc_now()}, "payload": {"invalid": True}}
    validator = Knowledge(engine.knowledge.policies)
    valid_stored = validator.add_snapshot(valid)
    invalid_rejected = not validator.validate_snapshot(invalid)
    restored = validator.restore_latest_valid_snapshot([valid, invalid])
    engine.simulator.activate(SimulationScenario.AUTOSAVE_CORRUPTION)
    adapted = evaluate()
    result = {
        "experiment": "D - Snapshot corruption recovery", "timestamp": utc_now(),
        "valid_snapshot_existed": valid_stored,
        "invalid_newest_snapshot_was_controlled_input": True,
        "invalid_newest_rejected": invalid_rejected,
        "condition": adapted["condition"], "strategy": adapted["strategy"],
        "selected_fallback_created_at": restored["metadata"]["created_at"] if restored else None,
        "structural_and_design_state_recovered": restored == valid,
        "backend_reported_outcome": adapted["event"]["outcome"] if adapted["event"] else None,
        "validation_scope": "Backend Knowledge validator on in-memory candidates; browser localStorage recovery is separately tested, not observed here.",
    }
    result["passed"] = valid_stored and invalid_rejected and result["condition"] == "SESSION_CORRUPTION" and result["strategy"] == "RESTORE_LAST_VALID_SNAPSHOT" and restored == valid
    return result


def recovery_hysteresis() -> dict[str, Any]:
    healthy_baseline()
    initial = _state()["adaptive_mode"]
    engine.simulator.activate(SimulationScenario.LOW_FPS)
    adapted = evaluate()
    recovery = recover_after_clear(SimulationScenario.LOW_FPS)
    modes = [item["mode"] for item in recovery]
    result = {
        "experiment": "E - Recovery stability and hysteresis", "timestamp": utc_now(),
        "initial_mode": initial, "injected_fault": "low_fps",
        "adapted_mode": adapted["system"]["adaptive_mode"],
        "mode_immediately_after_fault_removal": modes[0],
        "healthy_observations": recovery,
        "required_consecutive_healthy_observations": engine.knowledge.policies.recovery_healthy_checks,
        "final_mode": _state()["adaptive_mode"],
    }
    result["passed"] = result["adapted_mode"] == "PERFORMANCE" and modes[0] == "RECOVERY" and len(recovery) == 3 and modes[-1] == "NORMAL"
    return result


def run_experiments(output_dir: Path) -> dict[str, dict[str, Any]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    experiments = {
        "day6-adaptive-rendering.json": adaptive_rendering(),
        "day6-renderer-failure.json": renderer_failure(),
        "day6-low-confidence.json": low_confidence(),
        "day6-snapshot-recovery.json": snapshot_recovery(),
        "day6-recovery-hysteresis.json": recovery_hysteresis(),
    }
    for filename, result in experiments.items():
        (output_dir / filename).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    with (output_dir / "day6-summary.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["experiment", "passed", "timestamp", "result_file", "execution_environment"])
        writer.writeheader()
        for filename, result in experiments.items():
            writer.writerow({
                "experiment": result["experiment"], "passed": result["passed"], "timestamp": result["timestamp"],
                "result_file": filename, "execution_environment": f"{platform.system()} {platform.release()}; Python {platform.python_version()}; local process",
            })
    engine.reset()
    return experiments


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=REPOSITORY_ROOT / "results" / "experiments")
    args = parser.parse_args()
    experiments = run_experiments(args.output_dir.resolve())
    failed = [result["experiment"] for result in experiments.values() if not result["passed"]]
    print(json.dumps({"output_dir": str(args.output_dir.resolve()), "experiments": len(experiments), "passed": len(experiments) - len(failed), "failed": failed}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
