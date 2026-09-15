# Day 3 Verification

## Commands

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q .\src\backend
Set-Location .\src\frontend
npx tsc --noEmit
npm test
npm run build
```

## Automated coverage

Backend tests cover geometry-derived room filtering/counting, design creation, default naming, save/load, duplication, rename, listing, deletion, reference validation, configuration round trips, wall/floor/door/window appearance, wall height, room semantics, independent duplicated designs, orientation, all nine zones, orientation transforms, current-semantic Vastu evaluation, every result state, scoring, zero-evaluable behavior, disabled rules, serialization, latest-analysis persistence, and analysis invalidation after a semantic change. An integration test processes `sample_family_house.png`, saves Design A, duplicates/modifies Design B, restores A, changes orientation, reruns analysis, and verifies directional results and persisted configuration. The full suite also includes every Day 1/Day 2 regression.

Frontend tests cover design defaults, effective-height projection into renderer geometry, immutable room name/type updates, label precedence, concise semantic comparison summaries, distinct procedural material mappings, world-relative texture repetition, orientation arrows/transforms, deterministic zone mapping, comprehensive new-file session clearing, and unsaved-change confirmation/cancel behavior, in addition to existing structural-edit and geometry tests.

## Manual material validation

1. Upload `data/sample_simple_1bed.png`, run Detect Structure, and open Design Studio.
2. Select one long wall and keep one camera position. Set a medium wall colour, then choose Paint, Wood Panel, Brick Style, and Concrete Style in turn. Confirm Paint is uniform; Wood Panel has repeated seams/grain; Brick Style has staggered rows and mortar; Concrete Style is matte and mottled. Each change must appear immediately without saving, reprocessing, or reloading.
3. Select one room floor. In the same view choose Neutral, Wood, Tile, Marble Style, and Concrete. Confirm a uniform surface, plank boundaries, a regular grid, vein lines, and mottling respectively.
4. Save as Design A. Duplicate it as Design B, change at least one room assignment plus wall and floor finish, save, and switch between A and B. Confirm each design restores its own names, types, finishes, colours, wall height, opening styles, and North orientation.
5. In Reconstruction, confirm custom/friendly room labels appear near their polygons. Change a room assignment and confirm its label and the 3D Inspector update from the same unsaved configuration.
6. Run Traditional Vastu Rule Analysis, change a semantic type, confirm the previous result clears, rerun, and verify the current type is evaluated.
7. Choose another source image and stop before Detect Structure. Confirm the previous counts, reconstruction, 3D scene, assignments, analysis, and comparison are absent.

## Verified result — 2026-09-12

- Backend pytest: **63 passed in 125.98s**.
- Frontend Vitest: **5 files passed, 25 tests passed in 6.07s**.
- Strict TypeScript: passed with no diagnostics.
- Vite 7.1.3 production build: **624 modules transformed; completed in 25.76s**.
- Build output: 25.74 kB CSS and 1,133.00 kB JavaScript (316.55 kB gzip).
- Vite emitted the existing non-failing warning for a JavaScript chunk larger than 500 kB.

Browser-specific visual behavior still requires the manual sequence in the project request; passing unit tests does not establish architectural accuracy, accessibility conformance, or WebGL compatibility on every device.
