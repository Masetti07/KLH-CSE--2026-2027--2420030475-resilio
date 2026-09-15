# Day 2 Verification

## Automated backend validation

Command from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q .\src\backend
```

The Day 2 suite covers save/reload, wall creation/modification/deletion, room naming and type assignment, opening classification/creation/deletion, invalid coordinates, zero-length walls, invalid opening widths, invalid wall references, revision metadata, and persistence round trips. All Day 1 processing regressions remain in the same suite.

Verified result after the 3D-view refinement on 2026-08-30: **33 passed in 27.04s**.

## Frontend utility validation

Commands from `src/frontend`:

```powershell
npx tsc --noEmit
npm test
npm run build
```

Utility tests cover normalized-to-world coordinates, wall midpoint, wall length, wall angle, opening transformation, cloned edit operations, wall-deletion reference cleanup, undo/redo, finite normalized-coordinate validation, generated-model bounds, and adaptive top/perspective camera frames. Three framing cases represent the bundled simple one-bedroom, compact two-bedroom, and family-house extents.

Verified results on 2026-08-30:

- Strict TypeScript (`npx tsc --noEmit`): passed with no diagnostics.
- Vitest: **2 files passed, 10 tests passed in 1.60s**.
- Vite 7.1.3: **615 modules transformed; production build completed in 16.81s**.
- Output: `dist/index.html`, 16.96 kB CSS, and 1,102.44 kB JavaScript (308.31 kB gzip).
- Vite reported a non-failing warning for a chunk larger than 500 kB.

## Multiple-plan framing evidence

All three original synthetic images were processed through `process_floor_plan` during this refinement. The generated structures and normalized wall ranges were:

| Sample | Walls | Rooms | Openings | Wall X range | Wall Y range |
| --- | ---: | ---: | ---: | --- | --- |
| `sample_simple_1bed.png` | 10 | 4 | 4 | 0.115–0.885 | 0.118–0.882 |
| `sample_compact_2bed.png` | 13 | 5 | 6 | 0.083–0.917 | 0.103–0.897 |
| `sample_family_house.png` | 18 | 7 | 10 | 0.057–0.943 | 0.081–0.919 |

The top-frame calculation fits the limiting plan dimension to 84.7% of the viewport. The perspective safety sphere projects to approximately 75% on the limiting field-of-view axis before view-angle variation. The tests assert centered targets, complete top framing, valid clipping ranges, and bounded zoom for all three extent cases.

## Runtime smoke-test boundary

The local application loaded successfully in the in-app browser with its accessible page and workspace controls. The browser automation file-chooser bridge again timed out before a synthetic sample could be attached, so interactive WebGL, collapse, and fullscreen behavior are not claimed as manually verified through that browser session. Automated geometry, type, regression, and build evidence passed; the exact hands-on sequence below remains required for browser-specific visual confirmation.

## Manual sequence

1. Upload and process `data/sample_family_house.png`.
2. Open Reconstruction and choose **Edit Structure**.
3. Select a wall and slightly move one endpoint by dragging or numeric input.
4. Add a temporary wall, select it, and delete it.
5. Assign representative rooms as Living room, Kitchen, Bedroom, and Bathroom; optionally add names.
6. Select one opening and classify it as Door.
7. Select another opening and classify it as Window.
8. Add a missing opening, set normalized position/width, and associate a wall when reliable.
9. Confirm **Unsaved changes**, then choose **Save structure** and confirm **Saved**.
10. Reload the page, reopen the workspace, and confirm the corrected structure is restored.
11. Open **3D View** and confirm the wall layout and door/window markers reflect the model.
12. Drag to rotate and use the wheel/trackpad to zoom.
13. Exercise **Top**, **3D / Perspective**, and **Reset**.
14. Collapse Source Plan, collapse Inspector, and confirm the canvas expands after each action.
15. Enter **Fullscreen**, verify selection and camera controls remain active, then exit with **Escape** and the visible exit button.
16. Select a wall, room/floor, door, and window and confirm inspector/highlight synchronization and compact details.
17. Change global wall height, orbit/pan/zoom, press Reset, and confirm the updated model is reframed; save again.
18. Repeat framing, Reset, Top, and Perspective checks with `sample_compact_2bed.png` and `sample_simple_1bed.png`.

## Interpretation

Passing tests and builds validate the covered contracts and transformations. They do not establish architectural accuracy, browser-wide WebGL compatibility, accessibility conformance, or production readiness.
