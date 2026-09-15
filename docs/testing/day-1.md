# Day 1 Verification

## Environment

- Date: 2026-08-29
- Python: 3.12.0
- Node.js: 22.23.2
- npm: 10.9.8
- Platform: Windows

## Synthetic fixtures

Executed from the repository root:

```powershell
.\.venv\Scripts\python.exe .\data\generators\generate_sample_plans.py
```

The deterministic generator created three original 960×680 PNG plans: `sample_simple_1bed.png`, `sample_compact_2bed.png`, and `sample_family_house.png`.

## Backend

Command:

```powershell
.\.venv\Scripts\python.exe -m pytest -q .\src\backend
```

Verified result: **9 passed in 4.50s**.

Coverage includes the health endpoint, valid PNG, valid JPG, invalid extension, malformed image, mismatched content/extension, upload retrieval, structural schema validation, normalized coordinates, declared processing stages, synthetic sample processing, runtime threshold artifact, and wall output.

## Frontend

Command from `src/frontend`:

```powershell
npm run build
```

Verified result: Vite 7.1.3 transformed 32 modules and completed the production build in 1.50 seconds. Output included `dist/index.html` and hashed CSS/JavaScript assets.

## Interpretation

These results verify the listed automated behaviors and buildability in the recorded environment. They do not establish detection accuracy, calibrated confidence, security completeness, browser compatibility, accessibility conformance, or production readiness.

## Day 1 wall/opening repair

The repair adds semantic tests for horizontal and vertical collinear merging, near-duplicate removal, meaningful gap preservation, synthetic door and window detection, normalized opening coordinates, bounded confidence, opening serialization, and valid family-house structure.

Final repair verification on 2026-08-29:

- Backend: **19 passed in 6.73s**.
- Frontend: Vite 7.1.3 transformed 32 modules and built successfully in **2.06s**.
- `sample_simple_1bed.png`: 4 rooms, 10 consolidated/opening-split walls, 2 doors, 2 windows, 0 unknown openings, confidence 0.743634.
- `sample_compact_2bed.png`: 5 rooms, 13 consolidated/opening-split walls, 3 doors, 3 windows, 0 unknown openings, confidence 0.855027.
- `sample_family_house.png`: 7 rooms, 18 consolidated/opening-split walls, 5 doors, 5 windows, 0 unknown openings, confidence 0.986458.

Counts are observed outputs from program execution, not fixed targets or general accuracy claims.
