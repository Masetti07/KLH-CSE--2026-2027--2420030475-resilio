# Resilience Lab

## Purpose

The Day 5 Resilience Lab demonstrates the existing Day 4 self-adaptation behavior without consuming artificial resources or damaging user data. It provides exactly five allow-listed scenarios: low FPS, renderer failure, processing failure, low reconstruction confidence, and autosave corruption. Restore All clears every injected condition.

## Architecture

The backend simulation controller only overlays selected fields on a normal Monitor observation. The resulting observation continues through the real Analyzer, Planner, Executor, and Knowledge components. Adaptation history therefore records the same condition, threshold, strategy, mode, outcome, and observed metrics used in normal operation. `simulated_conditions` marks the provenance of injected observations; the UI displays `SIMULATED CONDITION` while any override is active.

The controller is process-local and allow-listed. It does not create CPU, memory, network, WebGL, database, or filesystem faults. Restarting the backend also clears its flags.

## Scenario behavior

| Scenario | Injected signal | Real strategy and effect |
| --- | --- | --- |
| Low FPS | FPS below the configured renderer policy | `REDUCE_RENDER_QUALITY`; PERFORMANCE caps DPR, disables shadows, and reduces the shadow map |
| Renderer failure | Renderer health `FAILED` | `USE_2D_FALLBACK`; 3D unmounts while the structural model and 2D reconstruction remain usable |
| Processing failure | One controlled application-level failure on a processing attempt | `RETRY_PROCESSING`; the browser-selected source remains available and retry is user-triggered and bounded |
| Low confidence | Confidence below the configured reconstruction policy | One `RETRY_ENHANCED_PREPROCESSING`, then `REQUEST_USER_CORRECTION` while uncertainty persists |
| Autosave corruption | Invalid newest local snapshot plus session-corruption telemetry | The real snapshot validator rejects it, restores the newest valid predecessor, and Knowledge records `RESTORE_LAST_VALID_SNAPSHOT` |

Clearing simulations removes observation overrides and returns to measured telemetry. Restore All never writes NORMAL directly. Adapted modes pass through RECOVERY and require the configured three consecutive healthy observations before NORMAL is restored.

## Data preservation and limits

The structural model remains the source of truth. Scenarios do not mutate geometry, room metadata, appearances, wall height, openings, orientation, active designs, or saved versions. The autosave scenario prepends an invalid in-memory/local-storage entry only after retaining a valid predecessor; it never alters SQLite or project files. These demonstrations are single-backend-process prototype controls and are not an authorization or chaos-testing system.
