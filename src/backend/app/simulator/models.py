from enum import StrEnum


class SimulationScenario(StrEnum):
    LOW_FPS = "low_fps"
    RENDERER_FAILURE = "renderer_failure"
    PROCESSING_FAILURE = "processing_failure"
    LOW_RECONSTRUCTION_CONFIDENCE = "low_reconstruction_confidence"
    AUTOSAVE_CORRUPTION = "autosave_corruption"
