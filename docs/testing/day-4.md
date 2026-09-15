# Day 4 verification

Latest readiness verification: 2026-09-13. Commands were run locally on Windows from the listed directories.

## Automated results

Backend, from `src/backend`:

```powershell
D:\ResilioSpace\.venv\Scripts\python.exe -m pytest -q
```

Result: `74 passed in 89.17s`.

Frontend tests, from `src/frontend`:

```powershell
npm test -- --run
```

Result: 6 test files passed, 28 tests passed in 7.08 seconds.

Frontend production build, from `src/frontend`:

```powershell
npm run build
```

Result: 626 modules transformed and the build completed successfully in 25.51 seconds. Vite reported a non-fatal warning that the main JavaScript chunk is larger than 500 kB after minification (`1,141.90 kB`, gzip `319.25 kB`).

The backend suite covers the existing upload, image processing, structural editing, design persistence/comparison support, and Traditional Vastu Rule Analysis paths in addition to Day 4 analyzer, planner, modes, hysteresis, snapshots, history, and system APIs. Frontend tests cover existing geometry/edit/design/material/session utilities and the new snapshot validation, bounded history, and previous-valid restoration logic.

## Manual validation procedure

1. Start the backend and frontend using the README commands; open `http://127.0.0.1:5173`.
2. Upload each provided clean sample plan. Confirm processing completes, confidence remains visible, and walls/rooms/openings render in Reconstruction and 3D View.
3. Edit a wall/opening, assign room names/types, change wall height, wall/floor finishes, door/window settings, and North orientation. Confirm the same state is reflected in 2D/3D, survives a named design save, and still appears in Compare and Traditional Vastu Rule Analysis.
4. Open Control Center. Confirm mode, component health, confidence, request latency, and the current condition/strategy are readable. Leave 3D open for at least three seconds and confirm FPS/frame time appear after telemetry refresh.
5. In browser developer tools, apply CPU throttling while 3D is visible until the summarized FPS is below 24 or frame time exceeds 45 ms. Confirm mode changes to PERFORMANCE and Rendering Quality reads PERFORMANCE. Inspect the canvas: device pixel ratio is capped and shadows are disabled while geometry/material configuration remains intact.
6. Remove throttling. Confirm mode enters RECOVERY, reduced rendering quality remains active while progress advances across three healthy observations, and only then returns to NORMAL with normal pixel ratio/shadows restored.
7. To validate the failure boundary without harmful faults, temporarily throw an error from a local development copy of the renderer component. Confirm 3D unmounts, the Structure/Reconstruction view opens, the preservation message appears, and Control Center reports DEGRADED / USE_2D_FALLBACK. Use Retry 3D and confirm recovery is stability-gated.
8. Make structural/design edits, wait at least 1.2 seconds, and inspect `localStorage` key `resiliospace:snapshots:<plan-id>`. Confirm it contains no source image blob and never exceeds three entries.
9. With at least two snapshots present, make the first (newest) array entry invalid while leaving the second valid, then reload. Confirm the previous snapshot is restored and the explicit recovery message appears. Corrupt all entries and confirm malformed state is not loaded; the backend-persisted structure remains the safe baseline.
10. Verify the system API responses at `/api/system/health`, `/api/system/metrics`, `/api/system/mode`, and `/api/system/adaptations` and confirm recorded adaptations include observed metrics, trigger, mode transition, outcome, and explanation.

Manual steps involving browser throttling and a temporary development-only renderer throw are controlled application-level checks. They do not create network attacks or resource exhaustion and are not shipped as a Day 5 Resilience Lab.
