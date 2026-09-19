# Day 6 reproducible experiments

These bounded experiments exercise the existing Python MAPE-K engine, simulator, snapshot validator, and (for experiment B) real in-memory API persistence. Run from the repository root with Python 3.12 and the backend dependencies installed:

```powershell
.\.venv\Scripts\python.exe scripts/run_day6_experiments.py
```

The runner writes five JSON records and a CSV index to `results/experiments/`; it exits nonzero if an asserted transition fails. The generated timestamps and observed engine states are evidence from the run, not manually entered expected results. The Resilience Lab supplies **controlled application-level fault inputs**, not destructive operating-system faults. Its FPS and confidence values are injected, not physical GPU benchmarks or independent reconstruction measurements. Browser-only behavior is marked for manual validation.

## A — Adaptive rendering

- **Input:** Controlled healthy FPS 60, then simulator FPS 16; configured minimum healthy FPS 24.
- **Observation:** The engine reported `RENDER_OVERLOAD`.
- **MAPE-K analysis:** Sustained low FPS selects renderer-quality reduction.
- **Strategy:** `REDUCE_RENDER_QUALITY` moved `NORMAL` to `PERFORMANCE`. The frontend's imported quality policy reduces the pixel-ratio cap from 1.75 to 1, disables shadows, and reduces the shadow map from 1024 to 256.
- **Outcome:** Clearing the fault entered `RECOVERY`; three healthy checks returned to `NORMAL`. No real browser FPS gain was measured. See `results/experiments/day6-adaptive-rendering.json`.

## B — Renderer failure self-healing

- **Input:** Controlled renderer failure after an in-memory plan and design were created through the actual APIs.
- **Observation:** The engine reported `RENDERER_FAILURE`; structural and design API responses stayed identical before and after adaptation.
- **MAPE-K analysis:** An unhealthy 3D renderer requires a renderer-independent view.
- **Strategy:** `USE_2D_FALLBACK` moved to `DEGRADED` and set `use_2d_fallback`.
- **Outcome:** Three healthy checks restored `NORMAL`. The browser canvas unmount and hands-on 2D interaction were not measured by this Python runner and require manual validation. See `results/experiments/day6-renderer-failure.json`.

## C — Low reconstruction confidence

- **Input:** Controlled baseline confidence 0.72 and injected confidence 0.35; policy threshold 0.55. No genuine image confidence was measured in this experiment.
- **Observation:** The engine reported `LOW_RECONSTRUCTION_CONFIDENCE`.
- **MAPE-K analysis:** One enhanced-preprocessing decision is allowed before user correction.
- **Strategy:** First `RETRY_ENHANCED_PREPROCESSING`, then `REQUEST_USER_CORRECTION` when the controlled low condition persisted.
- **Outcome:** The policy retry counter was one. The runner did not reprocess an image or claim recalculated confidence. See `results/experiments/day6-low-confidence.json`.

## D — Snapshot corruption recovery

- **Input:** One valid in-memory snapshot and one intentionally invalid newer candidate; the simulator's autosave-corruption signal. No SQLite file or user project file was corrupted.
- **Observation:** The existing validator rejected the invalid candidate and selected the previous valid one; the engine reported `SESSION_CORRUPTION`.
- **MAPE-K analysis:** The newest candidate is not restorable.
- **Strategy:** `RESTORE_LAST_VALID_SNAPSHOT`.
- **Outcome:** The previous snapshot's structural and design payload was recovered. Browser localStorage recovery is separately covered by frontend tests, not this runner. See `results/experiments/day6-snapshot-recovery.json`.

## E — Recovery stability

- **Input:** Controlled low-FPS fault followed by removal.
- **Observation:** `PERFORMANCE` moved to `RECOVERY` on the first healthy observation, remained there on the second, and reached `NORMAL` on the third.
- **MAPE-K analysis:** Recovery requires three consecutive healthy observations.
- **Strategy:** Stability-gated recovery rather than a direct faulted-to-normal jump.
- **Outcome:** Hysteresis assertion passed. See `results/experiments/day6-recovery-hysteresis.json`.

These results demonstrate application logic and configuration changes in this local environment. They do not establish frame-rate improvement, production reliability, security, or generalized performance on arbitrary plans.
