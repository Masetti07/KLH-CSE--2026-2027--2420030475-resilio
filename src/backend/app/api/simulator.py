from fastapi import APIRouter

from app.adaptation import engine
from app.api.system import _state
from app.simulator import SimulationScenario


router = APIRouter(prefix="/api/simulator", tags=["resilience-lab"])


def _response() -> dict:
    return {"simulations": engine.simulator.status(), "system": _state()}


@router.get("/status")
def simulation_status() -> dict:
    return _response()


@router.post("/scenarios/{scenario}/activate")
def activate_simulation(scenario: SimulationScenario) -> dict:
    newly_activated = engine.simulator.activate(scenario)
    if scenario == SimulationScenario.LOW_RECONSTRUCTION_CONFIDENCE and newly_activated:
        engine.knowledge.enhanced_retry_count = 0
    if scenario not in {SimulationScenario.PROCESSING_FAILURE, SimulationScenario.AUTOSAVE_CORRUPTION}:
        engine.evaluate()
    return _response()


@router.post("/scenarios/{scenario}/clear")
def clear_simulation(scenario: SimulationScenario) -> dict:
    engine.simulator.clear(scenario)
    if scenario == SimulationScenario.PROCESSING_FAILURE:
        engine.monitor.record_processing(0, engine.monitor.snapshot().reconstruction_confidence, failed=False)
    if scenario == SimulationScenario.AUTOSAVE_CORRUPTION:
        engine.monitor.record_telemetry(autosave_health="HEALTHY", session_corrupted=False)
    engine.evaluate()
    return _response()


@router.post("/restore")
def restore_all_simulations() -> dict:
    engine.simulator.clear_all()
    engine.monitor.record_processing(0, engine.monitor.snapshot().reconstruction_confidence, failed=False)
    engine.monitor.record_telemetry(autosave_health="HEALTHY", session_corrupted=False)
    engine.evaluate()
    return _response()
